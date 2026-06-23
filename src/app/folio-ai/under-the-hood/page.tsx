import Link from 'next/link'
import CaseStudyContent from '@/components/CaseStudyContent'
import config from '../../../../folio.config'

export const metadata = {
  title: 'Under the Hood — folio-ai',
  description: 'How folio-ai works: the ReAct agent, RAG pipeline, streaming architecture, and design studio.',
}

const folioSlug = config.agent.folioSlug

const CONTENT = `
## What is folio-ai?

folio-ai is an AI-native portfolio platform built as both a personal portfolio and an open-source template. The site itself is the artifact: it demonstrates cloud-native architecture instincts, AI engineering depth, and product thinking in a single deployable system.

There are two distinct AI systems running in this application:

1. **Visitor chat agent** — a public-facing ReAct-style agent that answers questions about the portfolio owner, schedules meetings via Cal.com, and performs semantic search over portfolio content.
2. **Design studio agent** — an owner-facing agent for managing portfolio content, saving memories about visitors, building compositions, and publishing.

Both agents are built on Claude, use explicit tool definitions, and follow an agentic loop where the model decides whether to call a tool or respond directly.

---

## System Architecture

\`\`\`mermaid
flowchart TD
  subgraph Browser
    A[Visitor]
    O[Owner]
  end

  subgraph App["Next.js on Vercel"]
    B[ChatButton]
    P[StudioChat]
    C[folio chat route]
    Q[studio chat route]
    D[Visitor Agent]
    R[Studio Agent]
    E[RAG Retrieval]
    F["Cal.com API"]
  end

  subgraph AIServices["AI Services"]
    I[Claude API]
    J[Voyage AI]
  end

  subgraph Data["Data Layer"]
    G[(Neon Postgres)]
    K[(pgvector index)]
  end

  subgraph AuthLayer[Auth]
    M["Auth.js via LinkedIn"]
  end

  A -->|message| B
  O -->|studio session| P
  O -->|sign in| M
  B -->|SSE stream| C
  P -->|SSE stream| Q
  C --> D
  Q --> R
  D -->|search portfolio| E
  D -->|schedule meeting| F
  D -->|take note| G
  R -->|save content| E
  R -->|save memory| G
  D -->|messages and tools| I
  I -->|tool calls and text| D
  R -->|messages and tools| I
  I -->|tool calls and text| R
  E -->|embed query| J
  J -->|vector| K
  K -->|top-k chunks| E
  E --> G
\`\`\`

---

## The Visitor Chat Agent

### Pattern: Streaming Agentic Loop

The visitor agent follows a ReAct-style pattern: the model is given a system prompt, the conversation history, and a set of tool definitions. On each turn it either responds directly or calls a tool. Tool results are injected back into the conversation and the loop continues until the model produces a final response. Every turn streams to the browser over Server-Sent Events.

\`\`\`mermaid
sequenceDiagram
  participant Browser
  participant Route as /api/chat (Edge)
  participant Claude as Claude API
  participant Tools as Tool Handlers

  Browser->>Route: POST {message, conversationId}
  Route->>Claude: messages + tools + system prompt
  loop Agentic loop
    Claude-->>Route: stream delta
    alt tool_use block
      Route->>Tools: execute(name, input)
      Tools-->>Route: result string
      Route->>Claude: tool_result → continue
    else text block
      Route-->>Browser: SSE text delta
    end
  end
  Route-->>Browser: [DONE]
  Route->>DB: persist conversation
\`\`\`

### Tool Definitions

The visitor agent has four tools:

| Tool | Trigger | What it does |
|---|---|---|
| \`search_portfolio\` | Questions about experience, skills, projects | Embeds the query, runs cosine similarity search over portfolio documents, injects the top-k chunks into context |
| \`schedule_meeting\` | Scheduling requests | Generates a Cal.com booking URL for the appropriate event type based on the visitor's stated intent |
| \`take_note\` | Visitor leaves a message | Stores the message with visitor contact info; emails the owner |
| \`analyze_fit\` | Recruiter pastes a job description | Runs a structured fit analysis against the owner's background, returning matches, gaps, and an overall assessment |

### System Prompt Design

The system prompt is the agent's persona and operating instructions. It is generated at request time (not hardcoded) so it can include live context like the current date. Key sections:

- **Identity** — who the agent is, whose portfolio it represents, the tone to maintain
- **Context** — owner background, career history, skills, and philosophy (injected from portfolio documents)
- **Tool usage rules** — when to call each tool, how to format results naturally in conversation
- **Privacy constraints** — what not to share, how to handle sensitive requests
- **Capabilities link** — instruction to surface the capabilities page when visitors ask what the agent can do

The system prompt deliberately avoids injecting all portfolio content upfront. Instead, \`search_portfolio\` pulls only the most relevant chunks at query time — keeping the context window efficient and responses grounded in specific content.

---

## RAG: Semantic Search Over Portfolio Content

The semantic search system uses the retrieval-augmented generation (RAG) pattern. Portfolio content is chunked, embedded into vectors, and stored in Neon Postgres with pgvector. At query time, the agent embeds the visitor's question and retrieves the most semantically similar chunks to inject into context.

### Ingestion Pipeline

\`\`\`mermaid
flowchart LR
  A[Raw document\n.md / .pdf / .txt] --> B[Text extraction]
  B --> C[Chunk by paragraph\n~500 tokens each]
  C --> D[Voyage AI\nembed each chunk]
  D --> E[Neon Postgres\npgvector INSERT]
  E --> F[(documents table\n+ embedding column)]
\`\`\`

Documents are chunked by paragraph rather than by fixed token count. This preserves semantic coherence — a paragraph about a specific architecture decision stays together rather than being split mid-sentence.

Embeddings use [Voyage AI](https://www.voyageai.com)'s \`voyage-3\` model, which is optimised for retrieval tasks and outperforms general-purpose embedding models on technical content.

### Query-Time Retrieval

\`\`\`mermaid
flowchart LR
  A[Visitor question] --> B[Voyage AI\nembed query]
  B --> C[pgvector\n<=> cosine distance]
  C --> D[Top 5 chunks\nby similarity]
  D --> E[Format as context\nfor Claude]
  E --> F[Claude generates\ngrounded answer]
\`\`\`

The retrieval query uses pgvector's \`<=>\` cosine distance operator with an index on the embedding column. The top-5 chunks are formatted with their source and title, then injected into the agent's tool result before the next model call.

### Why pgvector Over a Dedicated Vector Store

The decision to use Neon Postgres with pgvector rather than a dedicated vector store (Pinecone, Weaviate, etc.) was deliberate:

- **Single data store** — documents, folios, conversations, and embeddings all live in one place, reducing operational complexity
- **Transactional consistency** — document upserts and embedding updates happen in the same transaction
- **Cost** — Neon's serverless pricing means no idle costs; pgvector is included
- **Sufficient scale** — a portfolio has hundreds of documents, not millions; pgvector handles this easily with an HNSW index

The tradeoff is that at large scale (millions of vectors, sub-millisecond latency requirements) a dedicated vector store would be the right call. For a portfolio, the simplicity wins.

---

## The Design Studio

The design studio is the owner-facing content management interface, accessible at \`/folio-ai/[slug]/design\`. It is auth-gated (LinkedIn OAuth) and owner-scoped — only the folio owner can access their studio.

### Studio Agent

The studio agent has a different tool set from the visitor agent, focused on content operations:

| Tool | What it does |
|---|---|
| \`save_content\` | Ingests a document (case study, architecture ADR, journal entry, etc.) into the vector store |
| \`search_content\` | Semantic search over the owner's own documents — useful for "what have I already written about X?" |
| \`save_memory\` | Stores a structured memory about a person or interaction, associated with their email for future recall |
| \`save_connection\` | Creates or updates a visitor connection profile with contact info and relationship context |
| \`get_document\` / \`list_content\` | Retrieves specific documents or lists all content by type |
| \`list_compositions\` / \`publish_composition\` | Manages the composition system (see below) |
| \`save_diagram\` | Stores a Mermaid diagram with metadata for use in case studies |
| \`list_job_applications\` / \`get_job_application\` | Lists all tracked applications or retrieves one with its full timeline history |
| \`add_application_note\` | Creates a timeline entry on an application — note, phone screen, technical interview, onsite, offer, or follow-up. The agent can do this on demand from conversation |
| \`update_application_status\` | Advances an application through the pipeline: applied → screening → interviewing → offer → accepted / rejected / withdrawn |

### Compositions System

A **composition** is an ordered assembly of documents that gets compiled and published as a single readable document. The system separates *authoring* (individual source documents) from *presentation* (what visitors see).

\`\`\`mermaid
flowchart TD
  A[Source documents\nbio, resume, case studies, diagrams] --> B[Composition Editor\nCompositionsTab.tsx]
  B --> C{Publish}
  C --> D[publishCompositionById\ncompiles ordered items]
  D --> E[Single compiled document\nin documents table]
  E --> F[Folio page\ncase studies, architecture pages]
\`\`\`

This makes it easy to build different views of the same underlying content: a short-form resume composition and a detailed architecture write-up can draw from the same source documents.

### Job Tracking

The studio includes a full job search management system that the agent actively participates in — not just a tracker you fill in manually.

**Applications** capture the role, company, job posting URL, status, and which resume was used to apply.

**Timeline events** record what happened at each stage. Event types include: note, phone screen, technical interview, behavioral interview, onsite, offer, and follow-up. The studio agent can create timeline entries directly from conversation — "log a technical interview for my Stripe application today" will call \`add_application_note\` and persist the entry without leaving the chat.

**Evidence** attaches supporting artifacts to an application — take-home submissions, written responses, challenge code. Stored and linked by application so everything for a given role stays together.

**Resumes** are AI-generated against a specific job description, using the owner's portfolio documents as source material. The system retrieves relevant experience chunks from the vector store and synthesises a tailored resume in Markdown. Four templates are available (Modern, Classic, Compact, Minimal) with a split-pane editor and print-to-PDF export.

\`\`\`mermaid
flowchart LR
  A[Job description] --> B[Fetch and parse JD]
  B --> C[search_portfolio retrieve owner context]
  C --> D[Claude synthesize tailored resume]
  D --> E[Markdown resume saved to DB]
  E --> F[Resume Editor split-pane and print/PDF]
\`\`\`

### Visitor Memory

When a visitor interacts with the chat agent and provides their name or email (e.g. when scheduling a meeting), the agent can call \`save_connection\` to store a profile. On subsequent visits, the agent retrieves the connection profile and can personalise the conversation — remembering what they discussed, what role they're hiring for, etc.

Memories are scoped by email and surfaced via the same pgvector retrieval pipeline as portfolio content.

---

## Streaming Architecture

All agent endpoints stream responses over Server-Sent Events (SSE). The Next.js route handlers use \`ReadableStream\` with a custom encoder — compatible with Vercel's edge and serverless runtimes.

The Anthropic SDK's streaming API is used to pipe Claude's token stream directly to the browser with minimal buffering. Tool calls interrupt the stream, execute synchronously on the server, and resume. The client accumulates deltas and renders them incrementally.

Conversation state is persisted to Neon Postgres at the end of each turn, keyed by a \`conversationId\` stored in the browser's \`localStorage\`.

---

## Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Framework | Next.js 15 App Router | SSR, streaming, edge-compatible route handlers |
| Hosting | Vercel | Zero-config deployment, streaming SSE support, preview URLs per PR |
| AI model | Anthropic Claude | Best-in-class tool use and reasoning; first-party SDK with streaming |
| Embeddings | Voyage AI voyage-3 | State-of-the-art retrieval quality on technical content |
| Database | Neon Postgres + pgvector | Serverless pricing, vector-native, single data store for all layers |
| Auth | Auth.js v5 + LinkedIn OAuth | Professional identity; LinkedIn sub is a stable unique user ID |
| Scheduling | Cal.com | Open-source, API-accessible, self-hostable — fits the project ethos |
| Email | Zoho Mail + SMTP | Simple, reliable transactional delivery for note notifications |
| Styling | Tailwind CSS v4 | Utility-first, no runtime CSS-in-JS overhead |

---

## Open Source

The template layer of folio-ai is MIT licensed. All personal content (bio, case studies, portfolio documents) is excluded. To fork and deploy your own instance:

1. Clone the repo and copy \`.env.local.example\` → \`.env.local\`
2. Provision a Neon Postgres database and run the schema migrations
3. Create a LinkedIn OAuth app and a Voyage AI account
4. Deploy to Vercel — environment variables connect everything
5. Sign in with LinkedIn to create your folio, then use the Design Studio to upload your content

The \`folio.config.ts\` file is the single configuration point — owner name, domain, agent persona, and scheduling settings are all read from environment variables. No hardcoded personal data lives in the template code.
`

export default function UnderTheHoodPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Nav */}
      <nav className="border-b border-zinc-800/60 px-6 py-4 sticky top-0 bg-zinc-950/80 backdrop-blur z-10">
        <div className="mx-auto max-w-3xl flex items-center justify-between">
          <Link
            href={folioSlug ? `/folio-ai/${folioSlug}` : '/folio-ai'}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ← Portfolio
          </Link>
          <span className="text-xs text-zinc-600 font-mono">folio-ai / under the hood</span>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 text-xs text-indigo-400 border border-indigo-800/50 bg-indigo-950/30 rounded-full px-3 py-1 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            Architecture
          </div>
          <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
            Under the Hood
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed">
            How folio-ai works — the ReAct agent, RAG pipeline, streaming architecture,
            design studio, and job tracking system. Written for engineers who want to understand or fork the system.
          </p>
        </div>

        {/* Table of contents */}
        <nav className="mb-12 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">On this page</p>
          <ol className="space-y-1.5 text-sm">
            {[
              ['#what-is-folio-ai', 'What is folio-ai?'],
              ['#system-architecture', 'System Architecture'],
              ['#the-visitor-chat-agent', 'The Visitor Chat Agent'],
              ['#rag-semantic-search-over-portfolio-content', 'RAG: Semantic Search'],
              ['#the-design-studio', 'The Design Studio'],
              ['#streaming-architecture', 'Streaming Architecture'],
              ['#tech-stack', 'Tech Stack'],
              ['#open-source', 'Open Source'],
            ].map(([href, label]) => (
              <li key={href}>
                <a href={href} className="text-zinc-400 hover:text-indigo-400 transition-colors">
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* Content */}
        <CaseStudyContent content={CONTENT} title="Under the Hood" />

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-zinc-800 flex items-center justify-between">
          <Link
            href={folioSlug ? `/folio-ai/${folioSlug}` : '/folio-ai'}
            className="text-sm text-zinc-500 hover:text-indigo-400 transition-colors"
          >
            ← Back to portfolio
          </Link>
          <a
            href="https://github.com/creativecloudnative/folio-ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            View source →
          </a>
        </div>
      </main>
    </div>
  )
}
