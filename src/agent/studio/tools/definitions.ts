import Anthropic from '@anthropic-ai/sdk'

export const studioTools: Anthropic.Tool[] = [
  {
    name: 'save_content',
    description:
      'Save a finalized piece of portfolio content to the vector database and optionally to the filesystem. Only call this when the owner explicitly approves the content for saving.',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: {
          type: 'string',
          enum: ['case-study', 'architecture', 'journal', 'bio', 'resume', 'adr'],
          description: 'Content type',
        },
        title: {
          type: 'string',
          description: 'Human-readable title',
        },
        slug: {
          type: 'string',
          description:
            'URL-safe filename without extension, e.g. "container-platform-redesign"',
        },
        content: {
          type: 'string',
          description: 'Full markdown content to save',
        },
      },
      required: ['type', 'title', 'slug', 'content'],
    },
  },
  {
    name: 'save_diagram',
    description:
      'Save a Mermaid diagram to the portfolio. The diagram source is stored as a document and can be embedded in case studies or ADRs. Only call this once the user has reviewed and approved the diagram in the chat.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'Short descriptive title, e.g. "CI/CD Pipeline Architecture"',
        },
        slug: {
          type: 'string',
          description: 'URL-safe filename without extension, e.g. "cicd-pipeline"',
        },
        diagram_type: {
          type: 'string',
          enum: ['flowchart', 'sequence', 'er', 'class', 'state', 'gantt', 'graph', 'other'],
          description: 'Mermaid diagram type',
        },
        mermaid_source: {
          type: 'string',
          description: 'The complete Mermaid diagram source code (without the ``` fences)',
        },
        description: {
          type: 'string',
          description: 'One or two sentences describing what the diagram shows — used for semantic search',
        },
      },
      required: ['title', 'slug', 'diagram_type', 'mermaid_source'],
    },
  },
  {
    name: 'search_content',
    description:
      'Semantically search existing portfolio content. Use to check if a topic is already covered or to find related content before creating new material.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'What to search for',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'save_memory',
    description:
      'Save a career memory involving one or more people. A memory ONLY surfaces to a visitor if their LinkedIn email exactly matches an email recorded in the people array — email is mandatory for the memory to be retrievable by that person. Memories with no emails are owner-only and will never surface to visitors.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'Short title for the memory, e.g. "Kubernetes migration at Acme Corp"',
        },
        content: {
          type: 'string',
          description: 'The full narrative of the memory — what happened, why it mattered, the shared experience',
        },
        people: {
          type: 'array',
          description: 'People involved in this memory. Email is required per person for the memory to surface when they visit — do not omit it without explicitly confirming the owner does not have it.',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              email: { type: 'string', description: 'LinkedIn email address — required for this person to see the memory when they visit' },
            },
            required: ['name'],
          },
        },
        context_date: {
          type: 'string',
          description: 'Approximate timeframe, e.g. "2021–2022" or "Q3 2023"',
        },
      },
      required: ['title', 'content', 'people'],
    },
  },
  {
    name: 'save_connection',
    description:
      "Save a persistent profile for a specific person who may visit the portfolio. The chat agent uses this to personalize conversations — nicknames, relationship context, and notes will be available whenever that person logs in with their email. Unlike memories (which are event-based), a connection is an ongoing profile that captures who this person is to the owner.",
    input_schema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: "Person's full name",
        },
        email: {
          type: 'string',
          description: "Person's LinkedIn email — required; this is the only way the system identifies the visitor",
        },
        nickname: {
          type: 'string',
          description: "Preferred name or nickname the owner uses for this person",
        },
        relationship: {
          type: 'string',
          description: "How the owner knows this person — context, history, company, timeframe",
        },
        notes: {
          type: 'string',
          description: "Anything else the chat agent should know: personality, shared experiences, topics to reference or avoid, current role, etc.",
        },
      },
      required: ['name', 'email'],
    },
  },
  {
    name: 'get_document',
    description:
      'Retrieve the full content of any document from the database by its source path. Use list_content first to find the source path, then call this to read the full text — useful for reviewing, editing, or displaying any existing portfolio document, connection profile, memory, resume, etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        source: {
          type: 'string',
          description: 'The source path of the document, e.g. "connection/leslie-watson" or "content/resume.md"',
        },
      },
      required: ['source'],
    },
  },
  {
    name: 'get_connection',
    description:
      'Retrieve the full connection profile for a person by their email address, including visit history (visit count, last seen date) and any notes saved by the owner. Use this to inspect what the chat agent knows about a specific visitor before deciding whether to update their profile.',
    input_schema: {
      type: 'object' as const,
      properties: {
        email: {
          type: 'string',
          description: "The person's LinkedIn email address",
        },
      },
      required: ['email'],
    },
  },
  {
    name: 'set_baseline',
    description:
      'Designate an existing resume document as the baseline. Use this when the owner wants to promote a conversationally-generated resume to baseline status. Clears the baseline flag from any previous baseline resume.',
    input_schema: {
      type: 'object' as const,
      properties: {
        source: {
          type: 'string',
          description: 'The source path of the document to designate, e.g. "content/resume.md"',
        },
      },
      required: ['source'],
    },
  },
  {
    name: 'list_compositions',
    description:
      'List all compositions along with their member documents and nested composition references. Use this to show the owner what compositions exist and what is in each one before deciding to publish or modify. Compositions can include documents and/or other compositions.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'publish_composition',
    description:
      'Publish or republish a composition by compiling all its source documents and nested compositions into a single polished Markdown page using AI. Use this when the owner asks to generate or regenerate a published page for a composition.',
    input_schema: {
      type: 'object' as const,
      properties: {
        composition_id: {
          type: 'string',
          description: 'The UUID of the composition to publish. Get this from list_compositions.',
        },
      },
      required: ['composition_id'],
    },
  },
  {
    name: 'list_content',
    description:
      'List documents in the portfolio vector database. Results include creation date and are ordered newest-first. Optionally filter by type or restrict to documents created on or after a given date.',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: {
          type: 'string',
          description: 'Filter by document type: bio, resume, case-study, architecture, journal, memory, job-req, connection, diagram, adr',
        },
        since: {
          type: 'string',
          description: 'ISO 8601 date string (e.g. "2025-01-01"). Only return documents created on or after this date.',
        },
      },
      required: [],
    },
  },
]
