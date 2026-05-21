class EnvError extends Error {
  readonly code: 'ENV_MISSING'
  constructor(key: string) {
    super(`Missing required environment variable: ${key}`)
    this.code = 'ENV_MISSING'
    this.name = 'EnvError'
  }
}

function requireEnv(key: string): string {
  const value = import.meta.env[key]
  if (!value) throw new EnvError(key)
  return value as string
}

export const ENV = {
  supabaseUrl: requireEnv('VITE_SUPABASE_URL'),
  supabaseAnonKey: requireEnv('VITE_SUPABASE_ANON_KEY'),
  adminUsers: (import.meta.env.VITE_ADMIN_USERS as string | undefined)?.split(',').map(s => s.trim().toLowerCase()) ?? [],
} as const
