# CLAUDE.md — folio-ai Project Context

> This file is the persistent project bible for Claude Code sessions.
> Read this at the start of every session before taking any action.

---

## Project Overview

**Repo:** `creativecloudnative/folio-ai` (currently private, will go public)
**Domain:** `creativecloudnative.com`
**Owner:** Principal Engineer & Container Platform Architect pivoting to Solutions Architect with AI systems design specialization

**folio-ai** is two things simultaneously:
1. A personal AI-native portfolio site showcasing architecture case studies and demonstrating AI engineering capability
2. An open-source template that any engineer can fork and configure to build their own portfolio site with an embedded AI assistant

The site itself *is* the portfolio piece. It should demonstrate cloud-native instincts, AI engineering depth, and product thinking in a single artifact.

---

## Goals

### Primary
- Showcase 3–5 architecture case studies (container platforms, cloud-native systems, AI-ready infrastructure)
- Demonstrate AI systems design capability through the site's own architecture
- Serve as a leave-behind for recruiters and hiring managers targeting SA + AI roles

### Secondary
- Open-source template with clean config-driven content separation so others can fork and personalize
- GitHub traction (stars, forks) as passive credibility signal

---

## AI Capabilities Built Into the Site

### 1. ReAct-Style Agentic Chatbot (Core Feature)
A conversational AI assistant acting as a "front-desk secretary" with:
- **Deep context** on the owner: bio, career history, philosophies, skills, architecture case studies
- **Tool use (ReAct loop):**
  - Schedule appointments (real calendar integration — Calendly, Google Calendar, or Cal.com)
  - Take and store notes from visitor conversations
  - Surface relevant portfolio case studies based on visitor questions
  - Answer recruiter/hiring manager Q&A about experience and fit
- **Memory:** Conversation context within a session; structured note capture persisted to backend
- Architecture should be visible to technical visitors (see "How It Works" page)

### 2. Semantic Search / RAG over Portfolio Content (Stretch Goal)
- Visitors can ask natural language questions: *"show me projects involving Kubernetes and cost optimization"*
- Embeddings over case study content stored in a vector store
- Demonstrates RAG pattern alongside the agentic pattern — two AI design paradigms in one site

---

## Architecture Decisions (ADRs)

### Tech Stack (to be finalized in first session)
- **Frontend:** Next.js or Astro (TBD — favor Astro if content-heavy, Next.js if interactivity-heavy)
- **Hosting:** Vercel or Cloudflare Pages
- **Agent Backend:** Claude API (claude-sonnet-4-20250514) via Anthropic SDK
- **Agent Pattern:** ReAct loop with explicit tool definitions
- **Vector Store (RAG):** Pinecone or pgvector (TBD based on hosting choice)
- **Scheduling Integration:** Cal.com (open source, self-hostable — fits the project ethos)
- **Note Storage:** Secure backend endpoint; notes emailed or pushed to owner's inbox
- **Auth (admin):** Simple token-based auth for note review panel

### Content Architecture
- `/content` or `/data` directory holds all owner-specific content (bio, case studies, resume facts)
- Core template code is completely decoupled from personal content
- New users configure `folio.config.ts` (or equivalent) to personalize — no touching core logic
- Personal content is NOT MIT licensed; template code IS MIT licensed

### Open Source
- **License:** MIT (template code only)
- **Project name for OSS identity:** folio-ai (distinct from the domain)
- README includes clear setup guide and `TEMPLATE.md` for content configuration

---

## Portfolio Case Studies (Content To Be Written)

Target: 3–4 substantial case studies + 1 greenfield AI architecture piece

Each case study follows this structure:
1. **Problem / Context** — Business or technical challenge
2. **Constraints** — Budget, latency, compliance, team, existing stack
3. **Options Considered** — Decision-making process (most important section)
4. **Design Decision** — What was chosen and why
5. **Architecture Diagram** — Clean, annotated
6. **Outcome** — Delivered value, metrics where possible

### Candidate Projects (from existing work — to be documented):
- Container platform design → reframe as AI-ready infrastructure architecture
- Multi-tenant or multi-cluster designs → maps to AI platform architecture
- CI/CD or GitOps pipelines → reframe toward MLOps
- Observability/monitoring stacks → applicable to AI system monitoring

### Greenfield AI Architecture Piece (new — not from prior work):
- Options: RAG pipeline on Kubernetes, LLM inference platform with autoscaling, agentic workflow system
- Does not need to be deployed — a well-reasoned design doc with diagrams is sufficient
- This piece signals intentional pivot toward AI systems design

---

## 100-Hour Timebox — Phase Plan

| Phase | Hours | Deliverable |
|---|---|---|
| Architecture & design doc | 8 | ADRs, system diagram, final tech stack decisions |
| Site scaffold + infra | 12 | Framework scaffolded, deployed to Vercel/Cloudflare, domain live |
| Portfolio content | 10 | 3–4 case studies written and formatted |
| ReAct agent core | 20 | System prompt, tool definitions, memory, conversation loop |
| Scheduling integration | 10 | Cal.com tool call, booking confirmation flow |
| Semantic search / RAG | 15 | Embeddings, vector store, retrieval over portfolio content |
| "How it works" page | 5 | Architecture diagram, agent walkthrough for technical visitors |
| Open-source template layer | 10 | Config-driven content, README, setup guide, TEMPLATE.md |
| Polish, QA, security review | 10 | Admin auth, rate limiting, privacy notice, final UX pass |

**Note:** RAG layer is a stretch goal. If time pressure hits, ship the ReAct agent first.

---

## Security & Privacy Requirements

- Visitor messages captured by the agent require a **privacy notice** (banner or modal)
- Note storage backend must be **auth-protected** (token-based at minimum)
- **Rate limiting** on all agent endpoints (prevent abuse and runaway API costs)
- No PII stored beyond what is explicitly needed for scheduling and note delivery
- These requirements should be surfaced in the architecture — security-conscious design is an SA signal

---

## Certifications Context (Career Pivot Background)

The owner is pursuing SA + AI specialization. Relevant cert roadmap for context:
- **Foundation:** AWS SAA or AZ-305
- **AI Engineering:** Azure AI Engineer (AI-102), AWS MLA-C01
- **Architecture Specialization:** AZ-305 + AB-100, or AWS SAP + AIP-C01

This context is useful when writing bio content and the "about" section of the site.

---

## Conventions & Preferences

- **Commits:** Conventional commits format (`feat:`, `fix:`, `docs:`, `chore:`)
- **Branching:** `main` is production; feature branches per issue
- **Issues:** GitHub Projects for task tracking; issues map to the phase plan above
- **Diagrams:** draw.io or Mermaid (prefer Mermaid for version-controlled diagrams)
- **Code style:** TypeScript throughout; ESLint + Prettier configured at scaffold
- **No over-engineering:** This is a portfolio project on a 100-hour budget — favor clarity and shipping over architectural perfection

---

## First Session Checklist

- [ ] Finalize tech stack (Next.js vs Astro, vector store choice)
- [ ] Scaffold project structure
- [ ] Configure deployment (Vercel/Cloudflare + domain)
- [ ] Create GitHub Project board with milestones and issues from phase plan
- [ ] Write first ADR documenting tech stack decisions
- [ ] Draft `folio.config.ts` schema for template content separation

---

*Last updated from planning conversation in Claude.ai — June 2026*
