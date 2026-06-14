import Anthropic from '@anthropic-ai/sdk'

export const tools: Anthropic.Tool[] = [
  {
    name: 'schedule_meeting',
    description:
      "Generate a Cal.com booking link for the visitor to schedule time with Clint. Use this when a visitor expresses interest in meeting, chatting, or scheduling a call. Requires the visitor to be signed in with LinkedIn.",
    input_schema: {
      type: 'object' as const,
      properties: {
        topic: {
          type: 'string',
          description:
            'Brief description of what the visitor wants to discuss (e.g., "job opportunity", "consulting project", "architecture review")',
        },
      },
      required: [],
    },
  },
  {
    name: 'send_note',
    description:
      "Send a direct message from the visitor to the portfolio owner via email. Use this when a visitor wants to reach out, introduce themselves, ask a question directly, or send a quick message — but doesn't need a full meeting. Their LinkedIn identity is automatically included as the reply-to address.",
    input_schema: {
      type: 'object' as const,
      properties: {
        subject: {
          type: 'string',
          description: 'Brief subject line, e.g. "Quick question about your Kubernetes work"',
        },
        message: {
          type: 'string',
          description: "The visitor's message to the owner, as they wrote it or lightly cleaned up",
        },
      },
      required: ['subject', 'message'],
    },
  },
  {
    name: 'take_note',
    description:
      "Capture a visitor lead or interest note. Use this when someone shares their name, email, or specific interest in working with Clint. Helps Clint follow up with interested visitors.",
    input_schema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: "Visitor's name",
        },
        email: {
          type: 'string',
          description: "Visitor's email address",
        },
        interest: {
          type: 'string',
          description:
            'What they are interested in (e.g., "hiring for SA role", "wants consulting help with Kubernetes migration", "interested in folio-ai template")',
        },
        notes: {
          type: 'string',
          description: 'Any additional context from the conversation worth capturing',
        },
      },
      required: ['interest'],
    },
  },
]
