function getEnv(key: string, fallback: string): string {
  return (import.meta.env[key] as string | undefined) || fallback
}

export const ENV = {
  supabaseUrl: getEnv('VITE_SUPABASE_URL', 'https://kxxbowcujznapkrfdovu.supabase.co'),
  supabaseAnonKey: getEnv('VITE_SUPABASE_ANON_KEY', 'sb_publishable_EbZEhP77H7B6k6BN4wwOOA_Am8mzWJe'),
  adminUsers: (import.meta.env.VITE_ADMIN_USERS as string | undefined)?.split(',').map(s => s.trim().toLowerCase()) ?? [],
} as const
