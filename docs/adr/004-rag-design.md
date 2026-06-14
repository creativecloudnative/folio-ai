# ADR-004: RAG Architecture and Content Strategy

**Date:** 2026-06-09  
**Status:** Accepted

---

## Context

The public-facing agent needs to answer questions about the portfolio owner's background, projects, and design philosophy with accuracy and depth. Initially, bio.md and resume.md were stuffed directly into the system prompt on every request. This is sufficient for small content but becomes expensive and limited as the corpus grows.

The portfolio has a second requirement: the owner needs a way to *generate* portfolio content conversationally — describing projects and design philosophies to an agent that structures and stores the output — rather than writing case studies by hand.

Both requirements converge on the same solution: a vector database that serves as the canonical content store, consumed by both the public agent (retrieval) and the content studio (ingestion).

---

## Decisions

### Retrieval pattern: RAG over context stuffing

**Chosen:** Retrieve the top-k most relevant document chunks at query time and inject only those into the system prompt.  
**Rejected:** Stuffing all content into every system prompt call.

**Rationale:** As the corpus grows (case studies, journal entries, design philosophy notes), stuffing everything into every request becomes expensive and can degrade response quality through irrelevant context. RAG keeps per-request token costs bounded regardless of corpus size and surfaces the most relevant content for each specific question. The tradeoff is added latency for the embedding + retrieval step (~100–200ms), which is acceptable for a conversational interface.

---

### Vector store: pgvector (Neon) — confirmed from ADR-001

**Chosen:** pgvector on Neon, `documents` table with HNSW index.  
**Rejected:** Pinecone, Weaviate, Qdrant.

**Rationale:** The corpus is small (tens to low hundreds of chunks). Introducing a dedicated vector database adds a third managed service and a new API surface for no benefit at this scale. pgvector on Neon keeps everything in one Postgres database — the same connection string serves both relational data (future: bookings, leads) and vector similarity search. HNSW index over IVFFlat because IVFFlat requires a minimum number of rows before the index is useful; HNSW works correctly on small datasets and is faster at query time.

---

### Embedding provider: Voyage AI (`voyage-3-lite`)

**Chosen:** Voyage AI `voyage-3-lite`, 512 dimensions, $0.02/1M tokens.  
**Rejected:** OpenAI `text-embedding-3-small` (same cost), self-hosted models.

**Rationale:** Voyage AI is Anthropic's recommended embedding partner and is designed to produce embeddings that work well alongside Claude for retrieval-augmented generation. The models are optimized for retrieval quality, not just similarity. `voyage-3-lite` at 512 dimensions is more than sufficient for a portfolio corpus and keeps vector storage compact. OpenAI embeddings are excellent but would add a second API provider (the stack already has Anthropic); keeping embeddings with a Claude-aligned provider is philosophically consistent and practically equivalent in quality and cost.

---

### Document schema: single `documents` table with `type` column

**Chosen:** One table, `type` enum (`bio`, `resume`, `case-study`, `journal`), with a `source` column for the originating file.  
**Rejected:** Separate tables per content type; a dedicated document store like S3 + metadata DB.

**Rationale:** The corpus is homogeneous from a retrieval standpoint — all content is text that gets chunked, embedded, and retrieved by cosine similarity. Separate tables would require union queries or multiple parallel retrievals with no benefit. The `type` column allows post-retrieval filtering if needed (e.g., "only case studies"). The `source` column enables idempotent re-ingestion: deleting by source before re-inserting means running `npm run db:ingest` twice doesn't duplicate records.

---

### Chunking: paragraph-based, ~600 chars max

**Chosen:** Split on double newlines, merge small paragraphs up to ~600 characters.  
**Rejected:** Fixed token-count chunking, sentence-level chunking, full-document embedding.

**Rationale:** Portfolio content is structured as markdown with natural paragraph breaks that correspond to distinct ideas. Paragraph-based chunking preserves semantic coherence — a retrieval hit returns a complete thought, not a sentence fragment. The 600-char ceiling keeps chunks within a meaningful size range without splitting mid-idea. Fixed token chunking would produce more consistent sizes but obscures natural content boundaries. Full-document embedding would miss intra-document relevance (e.g., a specific skills section of the resume).

---

### Content generation: conversational ingestion via `/studio` agent

**Chosen:** Owner-facing agent at `/studio` that takes conversational input, structures it, and writes to the `documents` table directly.  
**Rejected:** Manual markdown editing only; CMS (Contentful, Sanity).

**Rationale:** The owner's content (case studies, design philosophies, lessons learned) exists as tacit knowledge — it's easier to narrate than to write. A conversational agent that asks structured clarifying questions (constraints, options considered, outcome) and produces consistent markdown output lowers the activation energy for content creation significantly. The same pipeline that ingests static markdown files can ingest agent-generated content, so no new infrastructure is needed. A CMS adds a managed service and requires a separate editorial workflow that doesn't fit a solo-developer portfolio.

---

### Similarity threshold: 0.5 cosine similarity floor

**Chosen:** Filter out chunks with cosine similarity below 0.5 before injecting into the prompt.  
**Rejected:** No threshold (always inject top-k), higher threshold (0.7+).

**Rationale:** Without a floor, unrelated chunks get injected for every query, adding noise and cost. A 0.5 threshold removes clearly irrelevant results while keeping the cutoff permissive enough to handle paraphrased questions that don't exactly match document language. The threshold is soft-tunable — if the agent starts missing relevant content, lower it; if it surfaces irrelevant context, raise it.

---

## Consequences

- `npm run db:setup` must be run once against a Neon database with the pgvector extension available before any application code runs
- `npm run db:ingest` must be re-run after any content changes to `content/` to keep the vector store in sync
- Content studio (`/studio`) is a future deliverable; until it ships, ingestion is CLI-only
- If the corpus grows beyond ~10,000 chunks, revisit the HNSW index parameters and consider moving to a dedicated vector store
- Voyage AI adds a third API key (`VOYAGE_API_KEY`) to the environment surface — documented in `.env.local.example`
