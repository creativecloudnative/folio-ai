/**
 * seed-005-alex-chen-content.ts
 *
 * Ingests bio, base resume, and case study documents for the Alex Chen demo folio,
 * then wires up published compositions so the public folio page has real content.
 *
 * Run: npx dotenv-cli -e .env.local -- npx tsx scripts/seed-005-alex-chen-content.ts
 */

import { sql } from '../src/lib/db'
import { ingestDocument } from '../src/lib/ingest'
import { ensureBuiltInTypes } from '../src/lib/compositions'

const OWNER_ID = '00000000-demo-0000-0000-alex-chen0001'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const RATE_LIMIT_DELAY = 22_000 // VoyageAI free tier: 3 RPM → wait 22s between calls

async function ingestIfMissing(
  type: Parameters<typeof ingestDocument>[0],
  title: string,
  source: string,
  content: string,
  metadata?: Record<string, unknown>,
) {
  const existing = await sql`SELECT 1 FROM documents WHERE owner_id = ${OWNER_ID} AND source = ${source} LIMIT 1`
  if (existing.length > 0) {
    console.log(`  skip (already ingested): ${source}`)
    return
  }
  await ingestDocument(type, title, source, content, OWNER_ID, undefined, metadata)
  console.log(`✓ Ingested: ${source} — waiting for rate limit...`)
  await sleep(RATE_LIMIT_DELAY)
}

// ─────────────────────────────────────────────────────────────────────────────
// Content
// ─────────────────────────────────────────────────────────────────────────────

const BIO = `# Alex Chen — Staff Software Engineer

I'm a Staff Software Engineer with 10 years of experience designing and operating distributed systems at scale. My work lives at the intersection of payments infrastructure, platform engineering, and developer experience — building the foundations that let product teams move fast without breaking things.

Most recently I've been at Plaid, where I led the redesign of our real-time transaction processing pipeline (450ms → 62ms P99 at 2B+ daily events) and built the distributed rate-limiting service that eliminated cascading failure events during peak load. Before that I spent four years at Square and three at Stripe, owning pieces of the payments stack that process hundreds of billions of dollars annually.

I care a lot about the craft of platform engineering: principled API design, observable systems, and the kind of infrastructure that other engineers genuinely enjoy building on top of. I write about this sometimes.

I'm currently exploring Staff and Principal roles at companies building ambitious infrastructure — payments, data, developer tools, or AI platforms.

## What I'm good at

- **Distributed systems design** — consensus, idempotency, exactly-once semantics, distributed rate limiting
- **Payments infrastructure** — settlement, reconciliation, fraud signals, international money movement
- **Operational reliability** — reducing MTTR through structured observability, on-call discipline, and post-incident learning
- **Platform and developer experience** — internal tooling that compresses time-to-production for product engineers
- **Technical leadership** — cross-functional scope, mentoring, and driving alignment on hard architectural choices

## Background

I grew up in the Bay Area and studied Computer Science at UC San Diego. I've lived in San Francisco since 2015.

Outside of work: distance running (training for my third marathon), cooking, and an embarrassing amount of time thinking about coffee.
`

const BASE_RESUME = `# Alex Chen

alex.chen@example.com · linkedin.com/in/alexchen · github.com/alexchen · San Francisco, CA

## Summary

Staff Software Engineer with 10 years of experience building distributed systems at scale. Deep expertise in payment processing infrastructure, consensus protocols, and operational reliability. Proven track record leading cross-functional initiatives that materially improve system throughput and developer experience.

## Experience

### Staff Software Engineer — Plaid · 2022–Present

Led the redesign of the real-time transaction processing pipeline, reducing P99 latency from 450ms to 62ms across 2B+ daily events.

Designed and shipped a distributed rate-limiting service using Redis Cluster + lease-based consensus; eliminated 99.7% of cascading failure events during peak load.

Mentored 6 engineers across two teams; established async code review practices that cut review cycle time by 40%.

Drove adoption of structured observability (OpenTelemetry) across 14 services, reducing MTTR from 47 minutes to 11 minutes.

### Senior Software Engineer — Square (now Block) · 2018–2022

Built the reconciliation engine for international payment settlements across 32 currencies, processing $1.4B in daily volume.

Owned on-call rotation for critical payments path; reduced alert fatigue by 60% through better signal/noise tuning.

Designed the internal developer portal that standardized service provisioning, cutting new service time-to-production from 3 weeks to 2 days.

### Software Engineer — Stripe · 2015–2018

Core contributor to the Stripe Radar fraud detection pipeline (Go + Apache Beam).

Implemented ML feature serving layer that reduced feature staleness from 24h to 5 minutes for 400+ fraud signals.

Collaborated with the payments team to harden idempotency key handling, eliminating a class of double-charge bugs.

## Skills

**Languages:** Go, Rust, TypeScript, Python, SQL
**Infrastructure:** Kubernetes, Terraform, Pulumi, AWS, GCP
**Data:** PostgreSQL, Redis, Kafka, Apache Beam, Flink
**Observability:** OpenTelemetry, Prometheus, Grafana, Datadog

## Education

B.S. Computer Science — UC San Diego · 2015
`

const CASE_STUDY_PIPELINE = `# Redesigning Plaid's Transaction Processing Pipeline

**Type:** Architecture Case Study
**Company:** Plaid
**Role:** Staff Software Engineer (Tech Lead)
**Outcome:** P99 latency reduced from 450ms to 62ms at 2B+ events/day

---

## Problem / Context

Plaid's transaction enrichment pipeline ingests raw bank transactions and runs them through a series of enrichment steps — merchant normalization, category tagging, recurring payment detection, and fraud signal generation — before fanning the enriched records out to 6,000+ connected applications.

By late 2022, the pipeline was struggling. P99 latency had climbed to 450ms and was trending up as transaction volume grew. Several enrichment steps had been bolted on over the years without a coherent execution model, leading to redundant database reads and inefficient fan-out patterns. On high-traffic days (tax season, Black Friday) the pipeline would visibly degrade and cascade failures into downstream consumer-facing features.

## Constraints

- **Zero downtime** — the pipeline processes transactions for 6,000+ fintech apps; any cutover had to be seamless
- **Strict ordering guarantees** — enriched transactions must arrive at consumers in the same order they were ingested, even under retry
- **12-person team** — needed to ship incrementally; a full rewrite wasn't on the table
- **Kafka as the backbone** — replacing the message bus was out of scope

## Options Considered

**Option A: Micro-optimise the existing pipeline**
Profile individual enrichment steps, add caching, reduce redundant DB reads. Low risk, low effort. We estimated a 20–30% latency improvement but not a step-change. Also wouldn't address the structural fan-out problem.

**Option B: Parallel enrichment with a merge step**
Run independent enrichment steps concurrently and merge results before fan-out. Higher complexity but potentially large latency gains. Risk: merge step adds coordination overhead and a new failure mode if any enricher is slow.

**Option C: Pre-materialised enrichment caches with async refresh**
Move enrichment lookup data into Redis-backed caches, refreshed asynchronously. Enrichment steps become cache reads rather than DB queries. Risk: cache staleness; requires careful invalidation logic and a fallback path.

We chose **Option C** as the primary intervention, paired with a smaller version of Option B for the enrichment steps that were already independent.

## Design Decision

The key insight was that most latency was coming from synchronous DB reads during enrichment, not from the enrichment logic itself. Merchant normalization was hitting Postgres on every event; category tagging was doing the same. These tables are large but change slowly — perfect candidates for Redis-backed read caches.

We built an async cache refresh service that subscribes to a separate change-data-capture stream from Postgres and keeps Redis in sync with a typical staleness of < 500ms. Enrichment steps now do Redis lookups (sub-millisecond) with a Postgres fallback on cache miss.

For steps that were genuinely independent (category tagging, recurring payment detection), we parallelised execution within the enrichment worker using Go's goroutines. A merge step collects results with a hard 200ms deadline; if any enricher misses the deadline, it's applied asynchronously in a second pass.

The ordering guarantee is preserved through a sequence-numbered envelope on the Kafka message. The merge step respects the sequence; the async second-pass enricher only emits enriched fields as a patch — never a full record replacement.

## Architecture Diagram

    Kafka (raw transactions)
        │
        ▼
    Enrichment Worker (Go, horizontally scaled)
        ├── Redis Cache  ──── Merchant Normalizer ─────────┐
        ├── Redis Cache  ──── Category Tagger ─────────────┤ merge (200ms deadline)
        └── Redis Cache  ──── Recurring Detector ──────────┘
                                    │
                              Fan-out Worker
                                    │
                       ┌────────────┼────────────┐
                       ▼            ▼            ▼
                 App Webhook   App Webhook   App Webhook
                  (6,000+)

    Async Cache Refresh Service
        ├── subscribes to CDC stream (Postgres → Debezium → Kafka)
        └── writes to Redis with 5-minute TTL (hard expiry safety net)

## Outcome

- P99 latency: **450ms → 62ms** (86% reduction)
- Peak throughput headroom: increased from ~1.8B to ~4B events/day before degradation
- Cascading failures during high-traffic days: eliminated (rate-limiting service, separate project, also contributed)
- MTTR for pipeline incidents: reduced from 47 minutes to 11 minutes after adding structured observability spans

The parallel enrichment model has since been adopted as the standard pattern for new enrichment steps at Plaid. The async cache refresh architecture was reused for a separate ML feature serving project.
`

const CASE_STUDY_RATELIMITER = `# Distributed Rate Limiting at Plaid

**Type:** Architecture Case Study
**Company:** Plaid
**Role:** Staff Software Engineer (Designer and Tech Lead)
**Outcome:** Eliminated cascading failure events during peak load

---

## Problem / Context

Plaid's payments APIs are called by thousands of fintech applications, many of which have spiky traffic patterns — payroll runs, end-of-month settlement batches, Black Friday surges. Without effective rate limiting, a single high-volume caller could saturate shared database connection pools and cause latency spikes for unrelated callers, a classic "noisy neighbour" failure mode.

The existing rate limiting was per-instance and naïve: each API server maintained its own in-memory counter, which meant limits were effectively multiplied by the number of running instances. A 1,000 req/s limit with 20 instances was actually 20,000 req/s — not meaningful protection.

## Constraints

- **Sub-millisecond overhead** — rate limit checks happen on every API request; anything slow would directly inflate P99 latency
- **Correct under distributed conditions** — limits must hold even as instances scale up or down
- **Graceful degradation** — if the rate limiting service itself is unavailable, we should fail open rather than take down the API
- **Configurable per caller** — different apps have different negotiated limits

## Options Considered

**Option A: Centralised atomic counter in Redis**
Simple sliding window or token bucket in Redis, incremented atomically with INCR + EXPIRE. Well-understood pattern. Risk: Redis becomes a single point of failure; adds a Redis roundtrip to every request.

**Option B: Token bucket with gossip synchronisation**
Each instance maintains a local token bucket. Instances periodically gossip their current rate to peers and adjust their local bucket based on aggregate consumption. No single SPOF. Risk: complex to implement correctly; eventual consistency means limits can be temporarily exceeded.

**Option C: Lease-based distributed rate limiting**
Instances request a "lease" (a batch of tokens) from a coordination layer, consume locally until the lease is exhausted, then request another. Coordination is Redis-backed but hit infrequently. Combines the simplicity of centralised counting with the performance of local counters.

We chose **Option C**. The lease model gave us the correctness of centralised counting with dramatically reduced Redis pressure — instead of one Redis call per API request, we make one call per lease (typically every few hundred requests per instance).

## Design Decision

The lease coordinator is a thin Go service backed by Redis Cluster. When an API instance needs tokens, it calls the coordinator with its caller ID and the number of tokens it wants. The coordinator deducts from the shared budget atomically (using a Lua script to ensure the check-and-deduct is atomic) and returns a signed lease with a TTL.

The API instance consumes from the lease locally (in-process, no network calls) until it's exhausted or the lease TTL expires. When either happens, it requests a new lease. Lease TTLs are short (500ms) to bound the maximum overshoot.

If the coordinator is unavailable, instances fall back to a local-only mode with a conservative limit derived from the last known config. This is the "fail open" path — callers continue to be served, but at a reduced rate that avoids overwhelming the database.

Caller configs (limits, burst size, lease TTL) are stored in Postgres and cached in the coordinator with a 60-second TTL, so config changes propagate quickly without requiring a deploy.

## Architecture

    API Request
        │
        ▼
    API Server (Go)
        │
        ├─── local lease available? ──── Yes ──► consume token, serve request
        │
        └─── No ──► Lease Coordinator (Go service, 3 replicas)
                        │
                        ├─── Redis Cluster (atomic Lua deduct)
                        │
                        └─── return signed lease (N tokens, 500ms TTL)
                                  │
                              API Server
                              (cache lease, consume locally)

    Fallback (coordinator unreachable):
        API Server uses local conservative limit
        from last-known config (no Redis call)

## Outcome

- Cascading failure events from noisy-neighbour callers: **eliminated** in the 6 months post-launch
- Rate limit check overhead: **< 0.2ms** average (vs. ~4ms with per-request Redis calls)
- Redis request volume from rate limiting: **reduced by 98%** (lease batching)
- Overshoot worst case: bounded to **< 5%** above configured limit (tested under adversarial conditions)

The lease-based model has since been adopted as our standard rate limiting primitive. Three other teams have built on top of the coordinator rather than implementing their own.
`

// ─────────────────────────────────────────────────────────────────────────────
// Seed
// ─────────────────────────────────────────────────────────────────────────────

async function run() {
  // ── 1. Bio ─────────────────────────────────────────────────────────────────
  await ingestIfMissing('bio', 'Alex Chen — Bio', 'content/bio/alex-chen.md', BIO)

  // ── 2. Base resume ─────────────────────────────────────────────────────────
  await ingestIfMissing('resume', 'Alex Chen — Base Resume', 'content/resume/alex-chen-base.md', BASE_RESUME, { is_baseline: true })

  // ── 3. Case studies ────────────────────────────────────────────────────────
  await ingestIfMissing('case-study', 'Redesigning Plaid\'s Transaction Processing Pipeline', 'content/case-studies/plaid-pipeline.md', CASE_STUDY_PIPELINE, { published: 'true' })
  await ingestIfMissing('case-study', 'Distributed Rate Limiting at Plaid', 'content/case-studies/plaid-rate-limiter.md', CASE_STUDY_RATELIMITER, { published: 'true' })

  // ── 4. Ensure built-in composition types exist for this owner ──────────────
  await ensureBuiltInTypes(OWNER_ID)
  console.log('✓ Ensured composition types')

  // ── 5. Clear existing compositions so we can re-seed cleanly ──────────────
  await sql`DELETE FROM compositions WHERE owner_id = ${OWNER_ID}`
  console.log('✓ Cleared existing compositions')

  // ── 6. Create case study compositions (published) ─────────────────────────
  const pipeline = await sql`
    INSERT INTO compositions (owner_id, type, title, slug, published)
    VALUES (${OWNER_ID}, 'case-study', 'Plaid Transaction Pipeline', 'plaid-pipeline', TRUE)
    RETURNING id
  `
  await sql`
    INSERT INTO composition_items (composition_id, document_source, section_label, position)
    VALUES (${pipeline[0].id}, 'content/case-studies/plaid-pipeline.md', 'Case Study', 0)
  `
  console.log('✓ Created composition: plaid-pipeline')

  const rateLimiter = await sql`
    INSERT INTO compositions (owner_id, type, title, slug, published)
    VALUES (${OWNER_ID}, 'case-study', 'Distributed Rate Limiting', 'plaid-rate-limiter', TRUE)
    RETURNING id
  `
  await sql`
    INSERT INTO composition_items (composition_id, document_source, section_label, position)
    VALUES (${rateLimiter[0].id}, 'content/case-studies/plaid-rate-limiter.md', 'Case Study', 0)
  `
  console.log('✓ Created composition: plaid-rate-limiter')

  // ── 7. Create folio page composition (controls the public folio layout) ────
  const folio = await sql`
    INSERT INTO compositions (owner_id, type, title, slug, published)
    VALUES (${OWNER_ID}, 'folio', 'Folio Page', 'folio-page', TRUE)
    RETURNING id
  `
  const folioId = folio[0].id as string

  // Folio page items: bio intro + refs to both case studies
  await sql`
    INSERT INTO composition_items (composition_id, document_source, section_label, position)
    VALUES (${folioId}, 'content/bio/alex-chen.md', 'Intro', 0)
  `
  await sql`
    INSERT INTO composition_items (composition_id, ref_composition_id, section_label, position)
    VALUES (${folioId}, ${pipeline[0].id}, 'Case Studies', 1)
  `
  await sql`
    INSERT INTO composition_items (composition_id, ref_composition_id, section_label, position)
    VALUES (${folioId}, ${rateLimiter[0].id}, 'Case Studies', 2)
  `
  console.log('✓ Created folio page composition with bio + case study refs')

  console.log('\nDone. Alex Chen demo folio has bio, base resume, 2 case studies, and a published folio page.')
  process.exit(0)
}

run().catch((err) => { console.error(err); process.exit(1) })
