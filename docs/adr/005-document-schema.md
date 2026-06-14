# ADR-005: Document Schema and Multi-Tenant Relationship Model

**Date:** 2026-06-10  
**Status:** Accepted  
**Supersedes:** The "Document schema" section in ADR-004 (which captured the initial single-owner design)

---

## Context

ADR-004 established the `documents` table with an `owner_id` column to scope content per portfolio owner — the foundation for multi-tenancy. The initial schema was sufficient for a single owner ingesting their own content.

Two requirements exposed limitations in that model:

1. **Visitor-submitted content (job reqs):** When a recruiter submits a job description for fit analysis, the document belongs to the owner's folio (`owner_id = clint`) but was created by the visitor. Storing it with `owner_id = visitor_id` would break the folio relationship — queries for "all documents in Clint's folio" would miss it. Storing it with `owner_id = clint_id` and nothing else loses the attribution — you can't answer "which recruiter submitted this req?"

2. **RAG contamination:** If visitor-submitted content (job reqs) is stored in the same table without type discrimination, the public chat RAG would retrieve recruiter job descriptions as context when answering questions about the owner's background. A `type`-based exclusion is needed at retrieval time.

---

## Schema

```sql
CREATE TABLE documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     TEXT NOT NULL DEFAULT 'default',  -- folio owner (always)
  submitted_by TEXT,                              -- who created this document
  type         TEXT NOT NULL,                     -- see types below
  title        TEXT NOT NULL,
  source       TEXT,                              -- e.g. 'content/bio.md'
  content      TEXT NOT NULL,                     -- a single chunk
  embedding    vector(512),
  metadata     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Document types

| type | created by | description |
|---|---|---|
| `bio` | owner | Portfolio owner's professional bio |
| `resume` | owner | Work history, skills, credentials |
| `case-study` | owner | Architecture and project case studies |
| `journal` | owner | Design philosophy, lessons learned, opinions |
| `job-req` | visitor | Recruiter-submitted job descriptions |

### Indexes

```sql
-- Fast scans for all documents in a folio
CREATE INDEX documents_owner_id_idx ON documents (owner_id);

-- Scoped queries: all docs submitted by a specific visitor to a folio
CREATE INDEX documents_submitted_by_idx ON documents (owner_id, submitted_by);

-- Vector similarity search (cosine distance)
CREATE INDEX documents_embedding_hnsw ON documents
  USING hnsw (embedding vector_cosine_ops);
```

---

## Decisions

### Two-field relationship model: `owner_id` + `submitted_by`

**Chosen:** Separate `owner_id` (folio owner) and `submitted_by` (document creator).  
**Rejected:** Using `owner_id` alone; using a separate `visitor_documents` table.

**Rationale:** `owner_id` must always point to the folio owner — this is the invariant that makes multi-tenancy work. A second field `submitted_by` captures who created the content without breaking that invariant. For owner-created content, `submitted_by = owner_id`. For visitor-submitted content, `submitted_by = visitor_linkedin_id` while `owner_id` still points to the folio owner.

A separate `visitor_documents` table was rejected because it would require union queries for fit analysis (which needs both owner content and the job req together) and would fragment a fundamentally homogeneous data model — all documents are text chunks with embeddings regardless of origin.

---

### `job-req` excluded from public chat RAG by default

**Chosen:** `retrieveRelevant()` excludes `job-req` type unless the caller explicitly opts in.  
**Rejected:** Including all types in retrieval; filtering at the application layer.

**Rationale:** A recruiter's job description is not part of the portfolio owner's professional narrative. If included in the public chat RAG, it could surface as context for unrelated questions ("tell me about Clint's Kubernetes experience" might return a job req that mentions Kubernetes). Excluding at the query layer is the correct control point — it requires no application-layer logic and is enforced regardless of which code path calls retrieval.

The `analyze_job_fit` tool explicitly passes `excludeTypes: []` because fit analysis is the one context where comparing owner content against a job req is intentional.

---

### `submitted_by` defaults to `owner_id` for owner-created content

**Chosen:** When `submitted_by` is not provided, `ingestDocument()` sets it equal to `owner_id`.  
**Rejected:** Leaving it NULL for owner content; requiring callers to always pass it.

**Rationale:** A NULL `submitted_by` is ambiguous — it could mean "owner-created" or "unknown origin." Making it always populated simplifies queries: `WHERE submitted_by = owner_id` reliably returns all owner-created content with no NULL handling. The default in `ingestDocument()` makes this transparent to existing call sites.

---

## Multi-tenant evolution

The current deployment uses `owner_id = 'default'` (single-owner mode). The path to multi-tenancy:

1. Wire `owner_id` to the owner's LinkedIn `sub` claim (set via `OWNER_ID` env var per deployment)
2. For a hosted multi-tenant product: each folio owner gets their own `owner_id` at signup; all queries are scoped by it
3. `submitted_by` already supports visitor attribution — no schema change needed when multi-tenancy ships

The schema is intentionally forward-compatible. The single-owner deployment is a degenerate case of the multi-tenant model, not a separate architecture.

---

## Consequences

- `npm run db:migrate` must be run on existing databases to add `submitted_by` and back-fill existing rows
- Fresh installs via `npm run db:setup` get the full schema including `submitted_by`
- All new `ingestDocument()` calls should pass `submittedBy` explicitly when the creator is a visitor; omitting it is safe for owner-created content
- `retrieveRelevant()` signature now accepts `excludeTypes` — callers that need `job-req` content must opt in explicitly
