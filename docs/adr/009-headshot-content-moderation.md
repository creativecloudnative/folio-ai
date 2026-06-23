# ADR-009: Headshot Content Moderation

**Date:** 2026-06-22
**Status:** Accepted
**Feature:** Profile headshot — direct upload path

---

## Context

The headshot feature has two paths for setting a profile picture:

1. **AI-generated path** — the user's reference photo is passed to `gpt-image-1` with the prompt `"Professional headshot"`. OpenAI's own content policy and safety filters constrain the output: whatever the input, the output is a professional headshot or a refusal. This path is inherently safe — the model will not produce inappropriate output from an inappropriate input.

2. **Direct upload path** — the user uploads an image (or imports from LinkedIn) which is stored as-is and can be displayed on their public folio page. This path bypasses the AI output constraint entirely, creating a vector for inappropriate content to reach a public-facing profile.

The direct upload path is intentionally kept as an escape hatch for users who want their actual photo without AI styling. But it needs a moderation layer to match the safety guarantee of the AI path.

---

## Options Considered

### Option A: OpenAI `omni-moderation-latest`
A purpose-built multimodal safety model that accepts image inputs (as URL or base64 data URL) and returns structured classifications across categories including `sexual`, `sexual/minors`, `violence`, `violence/graphic`, `hate`, `harassment`, `self-harm`, and `illicit`. Free to call. Synchronous response. Returns `flagged: boolean` plus per-category booleans.

**Pros:**
- Purpose-built for content moderation — not a general model repurposed
- Free — no additional cost per check
- No additional credentials (OpenAI key already required for image generation)
- Structured response: specific categories flagged, useful for logging
- Synchronous: fits cleanly into the upload request/response cycle

**Cons:**
- Adds OpenAI as a hard dependency for direct uploads (if `OPENAI_API_KEY` is absent, fail closed)
- Adds ~200–500ms latency to the upload flow

---

### Option B: Claude vision (Anthropic)
Send the image to Claude with a prompt asking whether it is appropriate for a professional profile picture. We already have the Anthropic API key.

**Pros:** No additional credentials, nuanced judgment

**Cons:** Not purpose-built for moderation — output must be parsed rather than read from a structured field. More expensive per check (~$0.01 vs free). Prompt engineering required to get consistent pass/fail decisions. More likely to produce false positives on edge cases.

---

### Option C: Google Cloud Vision SafeSearch
Google's image content detection API, purpose-built for detecting explicit/violent content.

**Pros:** Excellent accuracy on explicit content, well-established

**Cons:** Requires a third API account and credentials. Adds infrastructure complexity for a feature that already has two AI providers.

---

## Decision

**OpenAI `omni-moderation-latest` (Option A).**

It is the only purpose-built, free, structured moderation option available without adding new credentials. The `OPENAI_API_KEY` is already required for image generation; reusing it for moderation keeps the dependency surface flat.

The moderation check runs **before** the image is uploaded to Blob storage. This means flagged images never reach persistent storage — the check happens in memory during the upload request. This is the cleanest possible failure mode: nothing is stored, nothing needs to be cleaned up, and the user receives a 422 immediately.

**Fail closed:** If `OPENAI_API_KEY` is not configured, the direct upload path is disabled entirely. This is a deliberate choice — an unchecked upload path is worse than a temporarily unavailable one.

---

## Architecture

```
Direct upload or LinkedIn import
         │
         ▼
  Read image → ArrayBuffer
         │
         ▼
  moderateImage(buffer, contentType)
  [omni-moderation-latest via OpenAI API]
         │
    ┌────┴────┐
    │         │
  flagged   safe
    │         │
    ▼         ▼
 422 error  put() → Vercel Blob
 nothing    setHeadshotUrl()
 stored     200 ok
```

---

## Safety Guarantee

| Path | Safety mechanism |
|------|-----------------|
| AI generation | OpenAI content policy + prompt constraint (`"Professional headshot"`) |
| Direct upload | `omni-moderation-latest` pre-upload check, fail closed |
| LinkedIn import | `omni-moderation-latest` pre-upload check, fail closed |

Public folio profiles can only display headshots that have passed at least one of these checks.

---

## Consequences

- Direct upload and LinkedIn import add ~200–500ms latency for the moderation API call
- `OPENAI_API_KEY` is now required for all headshot mutations (generation and direct upload)
- Flagged category names are logged server-side for audit purposes; the user receives a generic error message (no information about which category was triggered)
- False positives are possible but unlikely for typical profile photos; users can retry with a different image or use the AI generation path
