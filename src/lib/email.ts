import nodemailer from 'nodemailer'
import config from '../../folio.config'

// Lazy — avoids module-load failure when env vars aren't set (e.g. build time)
function getTransport() {
  const user = process.env.ZOHO_SMTP_USER
  const pass = process.env.ZOHO_SMTP_PASS
  if (!user || !pass) throw new Error('ZOHO_SMTP_USER or ZOHO_SMTP_PASS is not set')

  return nodemailer.createTransport({
    host: 'smtp.zoho.com',
    port: 587,
    secure: false, // STARTTLS
    auth: { user, pass },
  })
}

const FROM_EMAIL =
  process.env.ZOHO_SMTP_USER ?? `assistant@${config.owner.domain}`

export type NoteEmailParams = {
  visitorName: string
  visitorEmail: string
  subject: string
  message: string
}

export async function sendNoteToOwner(params: NoteEmailParams): Promise<void> {
  const { visitorName, visitorEmail, subject, message } = params

  await getTransport().sendMail({
    from: `${config.agent.assistantName} <${FROM_EMAIL}>`,
    replyTo: `${visitorName} <${visitorEmail}>`,
    to: process.env.OWNER_EMAIL ?? config.owner.email,
    subject: `Note from ${visitorName}: ${subject}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <p style="color: #6366f1; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">
          Message via ${config.site.url}
        </p>
        <h2 style="margin: 4px 0 16px;">${subject}</h2>
        <p style="white-space: pre-wrap; line-height: 1.6; color: #374151;">${message}</p>
        <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />
        <p style="font-size: 13px; color: #6b7280;">
          Sent by <strong>${visitorName}</strong> (${visitorEmail}) via the portfolio chat.<br/>
          Reply to this email to respond directly.
        </p>
      </div>
    `,
  })
}
