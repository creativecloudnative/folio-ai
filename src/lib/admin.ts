export function isAdminEmail(email: string | null | undefined): boolean {
  const adminEmail = process.env.ADMIN_EMAIL ?? ''
  return !!adminEmail && !!email && email === adminEmail
}
