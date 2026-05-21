import { ENV } from './env'

export function isAdmin(username: string | null | undefined): boolean {
  if (!username) return false
  return ENV.adminUsers.includes(username.trim().toLowerCase())
}
