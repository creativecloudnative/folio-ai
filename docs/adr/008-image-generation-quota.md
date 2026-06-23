# ADR-008: Image Generation Quota Model

**Date:** 2026-06-22
**Status:** Accepted
**Feature:** Profile headshot AI generation

---

## Context

folio-ai is a multi-tenant platform where each tenant (folio owner) is provisioned with a resource budget by the platform admin. The existing LLM token budget (`token_budget`, `tokens_used` on `folios`) controls spend on Claude API calls made through the studio agent. The headshot AI generation feature introduces a second cost dimension: OpenAI image generation. A quota model is needed to prevent runaway spend and to give the platform admin per-tenant control.

Two design axes must be decided:
1. **Unified vs. separate counter** — fold image generation into the existing token budget, or track it independently
2. **Lifetime vs. periodic reset** — quota is exhausted once and never refills, or it resets on a cadence

---

## Options Considered

### Quota Accounting

#### Option A: Separate counter (`image_gen_quota` / `image_gen_used`)
Independent columns on `folios`, managed separately from `token_budget` / `tokens_used`. The admin sets each independently.

**Pros:**
- Clean unit separation — LLM tokens and image generations are fundamentally different cost primitives
- Admin can tune each limit independently per tenant without affecting the other
- Quota UI shows a meaningful number ("3 of 3 generations") rather than a token-equivalent conversion
- Simpler to reason about: 1 "use" = 1 click of Generate = 3 images produced

**Cons:**
- Two separate budgets to manage in the admin panel
- Slightly more schema columns

---

#### Option B: Convert to token-equivalent and deduct from `tokens_used`
Define a token-equivalent cost per image generation (e.g., 10,000 tokens per generate click) and deduct from the existing `tokens_used` counter.

**Pros:** Single admin control surface, single budget number per tenant

**Cons:** The conversion rate is arbitrary and opaque to users ("you spent 30,000 tokens generating a headshot" is confusing). The token budget is sized for LLM conversation turns; image generation cost is 100× more per "action" at standard quality, making the existing budget numbers misleading. Mixing the two also makes cost attribution for billing analysis harder.

---

### Reset Cadence

#### Option C: Monthly reset
`image_gen_reset_at` tracks the next reset timestamp. The generate route checks whether the current time has passed the reset timestamp and, if so, zeroes `image_gen_used` and advances the timestamp by one month — atomically in the same SQL `UPDATE`.

**Pros:**
- Aligns with how users intuitively think about quotas ("I get X per month")
- Prevents a one-time demo experience from becoming a permanent limitation
- Admin can still set quota to 0 to fully disable generation for a tenant

**Cons:** Slightly more complex schema (one additional timestamp column) and atomic update logic

---

#### Option D: Lifetime quota (never resets)
Quota is set once; when exhausted, generation is permanently disabled unless admin manually resets it.

**Pros:** Simpler implementation, predictable total cost ceiling per tenant

**Cons:** Poor UX for demo tenants who want to try the feature over time. A user who generates 3 options on day one can never try the feature again. This makes the quota feel like a hard paywall rather than a rate limit, which conflicts with the project's demo-tier ethos.

---

## Decision

**Separate counter (Option A) + monthly reset (Option C).**

The separate counter keeps the two cost dimensions legible — to the admin, to the UI, and in the database. Image generation and LLM token consumption are different enough in unit, cost, and user action that conflating them (Option B) would produce confusing UX and misleading cost attribution.

The monthly reset aligns with how demo-tier quotas are understood. Three generations per month is enough to genuinely experience the feature (try it, refine the base image, try again next month) without enabling abuse. The atomic SQL pattern for the reset avoids race conditions without requiring a separate cron job or reset mechanism:

```sql
UPDATE folios
SET
  image_gen_used = CASE
    WHEN NOW() >= image_gen_reset_at THEN 1   -- reset and consume in one operation
    ELSE image_gen_used + 1
  END,
  image_gen_reset_at = CASE
    WHEN NOW() >= image_gen_reset_at THEN date_trunc('month', NOW()) + interval '1 month'
    ELSE image_gen_reset_at
  END
WHERE owner_id = $1
  AND (NOW() >= image_gen_reset_at OR image_gen_used < image_gen_quota)
RETURNING image_gen_used, image_gen_quota
```

If no rows are returned, the quota is exhausted and the route returns 429. If rows are returned, the deduction succeeded and generation proceeds. This is the same atomic check-and-consume pattern used by the LLM token budget (`consumeTokens`), extended with a conditional reset.

---

## Schema

```sql
ALTER TABLE folios ADD COLUMN image_gen_quota    INT          NOT NULL DEFAULT 3;
ALTER TABLE folios ADD COLUMN image_gen_used     INT          NOT NULL DEFAULT 0;
ALTER TABLE folios ADD COLUMN image_gen_reset_at TIMESTAMPTZ  NOT NULL
  DEFAULT (date_trunc('month', now()) + interval '1 month');
```

---

## Consequences

- Default quota of 3 generations/month caps maximum per-tenant image generation cost at ~$0.75/month
- Admin can set `image_gen_quota = 0` to disable generation for a tenant entirely
- The reset timestamp advances lazily (on the first generate request after expiry) — no background job required
- `getImageGenBalance()` reads the reset timestamp and computes effective remaining client-side, so the UI shows accurate remaining counts even before the next generate attempt
