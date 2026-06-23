# ADR-006: Image Storage — Vercel Blob

**Date:** 2026-06-22
**Status:** Accepted
**Feature:** Profile headshot

---

## Context

The headshot feature requires persistent storage for three categories of images:

1. **User-uploaded images** — JPEG, PNG, WebP uploaded directly from the browser
2. **LinkedIn-imported images** — profile pictures fetched from LinkedIn's CDN and re-hosted
3. **AI-generated images** — PNG outputs from OpenAI `gpt-image-1`, selected by the user

All three need to be publicly readable (served to visitors on the folio page) and writable only from server-side API routes. The storage layer must also support key-based overwrite — so saving a new headshot replaces the old one at a stable URL without orphaning blobs.

---

## Options Considered

### Option A: Vercel Blob
Vercel's managed object storage, integrated directly into the deployment platform via `@vercel/blob`. Zero infrastructure configuration — the `BLOB_READ_WRITE_TOKEN` is provisioned through the Vercel dashboard.

**Pros:**
- No additional infrastructure account or config (already on Vercel)
- `put()` API is three lines; returns a public URL immediately
- Same-region co-location with the Next.js edge functions that write to it
- Supports key-based overwrite via `allowOverwrite`

**Cons:**
- Vendor lock-in to Vercel (acceptable for this project's hosting choice)
- Storage costs apply beyond free tier (negligible at portfolio scale)

---

### Option B: AWS S3 / Cloudflare R2
Proven object storage with more control over access policies, lifecycle rules, and CDN configuration.

**Pros:** Industry-standard, highly portable, flexible IAM/ACL controls

**Cons:** Requires a second infrastructure account, access key management, bucket policy configuration, and a CDN layer (CloudFront or Cloudflare) for public serving. Adds ~2–3 hours of setup and ongoing credential rotation for a feature with minimal throughput needs.

---

### Option C: Store LinkedIn CDN URLs directly (no re-hosting)
Skip Blob storage for the LinkedIn import path — just persist the LinkedIn CDN URL in the database.

**Pros:** Zero storage cost, zero code for the import path

**Cons:** LinkedIn CDN URLs are session-scoped or time-limited; they expire. Storing them produces broken images within hours or days. This option was immediately rejected.

---

## Decision

**Vercel Blob (Option A).**

The folio-ai project is committed to Vercel for hosting. Vercel Blob requires no additional accounts, no bucket policies, and no CDN configuration. At portfolio-scale image volumes (single-digit uploads per user lifetime), the cost and complexity of S3/R2 is unjustified. The LinkedIn URL re-hosting requirement (see Option C rejection) makes a Blob store mandatory for that path regardless; consolidating all three image types through Blob keeps the storage layer uniform.

All images are written to a stable key path (`headshots/{owner_id}/headshot.{ext}`) so the `headshot_url` in the database remains valid across re-uploads. Generated image options are written to timestamped keys until the user selects one, at which point the selected image is re-uploaded to the canonical key and the options are abandoned (not explicitly deleted — cost-acceptable given low generation volume per tenant).

---

## Consequences

- `BLOB_READ_WRITE_TOKEN` must be set in Vercel environment variables (local dev and production)
- Headshot URLs in the database are Vercel Blob CDN URLs — portable if Blob CDN domains change, but must be migrated if the project moves off Vercel
- No explicit deletion of superseded blobs (old headshots remain in Blob storage but are unreachable); acceptable at this scale
