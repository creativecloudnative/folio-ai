/**
 * migrate-004-demo-folio.ts
 *
 * 1. Add studio_full_access column to folios
 * 2. Create demo folio for Alex Chen (slug: alex-chen)
 * 3. Seed fake job applications + timeline events
 * 4. Make clint-brown studio private again
 *
 * Run: npx tsx scripts/migrate-004-demo-folio.ts
 */

import { sql } from '../src/lib/db'

const DEMO_OWNER_ID = '00000000-demo-0000-0000-alex-chen0001'
const DEMO_SLUG     = 'alex-chen'
const DEMO_NAME     = 'Alex Chen'
const DEMO_EMAIL    = 'alex.chen@example.com'
const DEMO_BUDGET   = 50_000   // ~12 resume generations or ~50 chat turns

async function run() {
  // ── 1. Add studio_full_access column ──────────────────────────────────────
  await sql`
    ALTER TABLE folios
    ADD COLUMN IF NOT EXISTS studio_full_access BOOLEAN NOT NULL DEFAULT FALSE
  `
  console.log('✓ Added studio_full_access column')

  // ── 2. Create demo folio ───────────────────────────────────────────────────
  const existing = await sql`SELECT id FROM folios WHERE slug = ${DEMO_SLUG} LIMIT 1`
  if (existing.length > 0) {
    console.log('  Demo folio already exists — updating flags')
    await sql`
      UPDATE folios
      SET is_public = TRUE, studio_is_public = TRUE, studio_full_access = TRUE,
          token_budget = ${DEMO_BUDGET}
      WHERE slug = ${DEMO_SLUG}
    `
  } else {
    await sql`
      INSERT INTO folios (
        owner_id, slug, name, email,
        is_public, studio_is_public, studio_full_access, token_budget
      ) VALUES (
        ${DEMO_OWNER_ID}, ${DEMO_SLUG}, ${DEMO_NAME}, ${DEMO_EMAIL},
        TRUE, TRUE, TRUE, ${DEMO_BUDGET}
      )
    `
    console.log('✓ Created demo folio alex-chen')
  }

  // ── 3. Ensure resumes table exists (created by migrate-002) ───────────────
  const folioRow = await sql`SELECT id FROM folios WHERE slug = ${DEMO_SLUG} LIMIT 1`
  const folioId  = folioRow[0].id as string

  // ── 4. Seed a demo resume ─────────────────────────────────────────────────
  const existingResumes = await sql`SELECT id FROM resumes WHERE owner_id = ${DEMO_OWNER_ID} LIMIT 1`
  if (existingResumes.length === 0) {
    await sql`
      INSERT INTO resumes (owner_id, folio_id, title, company, role, template, content, job_description)
      VALUES (
        ${DEMO_OWNER_ID}, ${folioId},
        'Staff Engineer at Stripe',
        'Stripe',
        'Staff Engineer',
        'modern',
        ${STRIPE_RESUME_CONTENT},
        'Staff Software Engineer – Payments Infrastructure at Stripe'
      )
    `
    console.log('✓ Seeded demo resume')
  } else {
    console.log('  Demo resumes already exist — skipping')
  }

  // ── 5. Seed job applications ───────────────────────────────────────────────
  const existingApps = await sql`SELECT id FROM job_applications WHERE owner_id = ${DEMO_OWNER_ID} LIMIT 1`
  if (existingApps.length === 0) {
    const apps = [
      { company: 'Stripe',      role: 'Staff Engineer, Payments Infra', status: 'interviewing', applied_at: '2026-05-28', notes: 'Referred by former colleague. Team owns the payment processing pipeline.' },
      { company: 'Cloudflare',  role: 'Senior Software Engineer',       status: 'screening',    applied_at: '2026-06-03', notes: 'Strong interest in Workers and edge compute platform.' },
      { company: 'HashiCorp',   role: 'Principal Engineer, Platform',   status: 'applied',      applied_at: '2026-06-10', notes: 'Long admired their open-source approach to infra tooling.' },
      { company: 'Vercel',      role: 'Staff Engineer, Infrastructure', status: 'rejected',     applied_at: '2026-05-12', notes: 'Made it to the final round. Strong team, timing wasn\'t right.' },
      { company: 'Databricks',  role: 'Senior Software Engineer, MLOps',status: 'withdrawn',    applied_at: '2026-05-20', notes: 'Withdrew after accepting a better offer pipeline.' },
    ]

    const insertedIds: string[] = []
    for (const app of apps) {
      const rows = await sql`
        INSERT INTO job_applications (owner_id, company, role, status, applied_at, notes)
        VALUES (${DEMO_OWNER_ID}, ${app.company}, ${app.role}, ${app.status}, ${app.applied_at}::date, ${app.notes})
        RETURNING id
      `
      insertedIds.push(rows[0].id as string)
    }
    console.log(`✓ Seeded ${apps.length} demo applications`)

    // Seed timeline events for Stripe (interviewing)
    await sql`
      INSERT INTO application_events (application_id, owner_id, event_type, title, notes, occurred_at)
      VALUES
        (${insertedIds[0]}, ${DEMO_OWNER_ID}, 'phone_screen', 'Recruiter intro call',
         'Spoke with Sarah from the recruiting team. Good vibe. She explained the team structure and gave details on comp bands.', '2026-06-02'),
        (${insertedIds[0]}, ${DEMO_OWNER_ID}, 'technical', 'Technical screen — systems design',
         'One-hour systems design round with the hiring manager. Designed a distributed rate limiter. Went well — they seemed excited about my approach to consistency trade-offs.', '2026-06-11'),
        (${insertedIds[0]}, ${DEMO_OWNER_ID}, 'behavioral', 'Behavioral interview',
         'Two interviewers. Questions focused on cross-functional collaboration and handling ambiguity at scale. Felt confident.', '2026-06-17'),
        (${insertedIds[0]}, ${DEMO_OWNER_ID}, 'followup', 'Sent thank-you notes',
         'Emailed all three interviewers individually with specific follow-ups from our conversations.', '2026-06-18')
    `

    // Seed timeline events for Cloudflare (screening)
    await sql`
      INSERT INTO application_events (application_id, owner_id, event_type, title, notes, occurred_at)
      VALUES
        (${insertedIds[1]}, ${DEMO_OWNER_ID}, 'phone_screen', 'Recruiter call',
         'Brief intro with the recruiter. Confirmed the role is focused on the Workers runtime team. Moving to a technical screen.', '2026-06-09'),
        (${insertedIds[1]}, ${DEMO_OWNER_ID}, 'followup', 'Technical screen scheduled',
         'Confirmed for June 24th — 90 minutes, live coding + systems design.', '2026-06-19')
    `

    // Note for HashiCorp (just applied)
    await sql`
      INSERT INTO application_events (application_id, owner_id, event_type, title, notes, occurred_at)
      VALUES
        (${insertedIds[2]}, ${DEMO_OWNER_ID}, 'note', 'Application submitted',
         'Applied via their careers portal. Cover letter emphasized open-source experience and Terraform contributions.', '2026-06-10')
    `

    console.log('✓ Seeded timeline events')
  } else {
    console.log('  Demo applications already exist — skipping')
  }

  // ── 6. Make clint-brown studio private ────────────────────────────────────
  const clintResult = await sql`
    UPDATE folios SET studio_is_public = FALSE
    WHERE slug = 'clint-brown'
    RETURNING slug
  `
  if (clintResult.length > 0) {
    console.log('✓ Made clint-brown studio private')
  } else {
    console.log('  clint-brown folio not found — skipping privacy update')
  }

  console.log('\nDone. Demo folio is live at /folio-ai/alex-chen/design')
  process.exit(0)
}

run().catch((err) => { console.error(err); process.exit(1) })

// ── Demo resume content ────────────────────────────────────────────────────────

const STRIPE_RESUME_CONTENT = `# Alex Chen

alex.chen@example.com · linkedin.com/in/alexchen · github.com/alexchen · San Francisco, CA

## Summary

Staff Software Engineer with 10 years of experience building distributed systems at scale. Deep expertise in payment processing infrastructure, consensus protocols, and operational reliability. Proven track record leading cross-functional initiatives that materially improve system throughput and developer experience.

## Experience

### Staff Software Engineer — Plaid · 2022–Present

- Led the redesign of the real-time transaction processing pipeline, reducing P99 latency from 450ms to 62ms across 2B+ daily events
- Designed and shipped a distributed rate-limiting service using Redis Cluster + lease-based consensus; eliminated 99.7% of cascading failure events during peak load
- Mentored 6 engineers across two teams; established async code review practices that cut review cycle time by 40%
- Drove adoption of structured observability (OpenTelemetry) across 14 services, reducing MTTR from 47 minutes to 11 minutes

### Senior Software Engineer — Square (now Block) · 2018–2022

- Built the reconciliation engine for international payment settlements across 32 currencies, processing $1.4B in daily volume
- Owned on-call rotation for critical payments path; reduced alert fatigue by 60% through better signal/noise tuning
- Designed the internal developer portal that standardized service provisioning, cutting new service time-to-production from 3 weeks to 2 days

### Software Engineer — Stripe · 2015–2018

- Core contributor to the Stripe Radar fraud detection pipeline (Go + Apache Beam)
- Implemented ML feature serving layer that reduced feature staleness from 24h to 5 minutes for 400+ fraud signals
- Collaborated with the payments team to harden idempotency key handling, eliminating a class of double-charge bugs

## Skills

**Languages:** Go, Rust, TypeScript, Python, SQL
**Infrastructure:** Kubernetes, Terraform, Pulumi, AWS, GCP
**Data:** PostgreSQL, Redis, Kafka, Apache Beam, Flink
**Observability:** OpenTelemetry, Prometheus, Grafana, Datadog

## Education

B.S. Computer Science — UC San Diego · 2015
`
