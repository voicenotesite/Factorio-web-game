/**
 * Autoryzacja przez Supabase Auth (email + password, z username w metadata).
 * Przechowuje aktualnego użytkownika w localStorage.
 */
import { supabase } from './supabase';

export interface Account {
  username: string;
  passwordHash: string;
}

const CURRENT_USER_KEY = 'novactorio_current_user';
const CURRENT_USER_ID_KEY = 'novactorio_current_user_id';

/** Rejestruje nowego użytkownika przez Supabase Auth. Wymaga 3+ znaków username i 4+ znaków hasła. */
export async function register(username: string, password: string): Promise<{ success: boolean; error?: string }> {
  const trimmed = username.trim();
  if (!trimmed || trimmed.length < 3) return { success: false, error: 'Username must be 3+ characters' };
  if (!password || password.length < 4) return { success: false, error: 'Password must be 4+ characters' };

  const fakeEmail = `${trimmed.toLowerCase()}@novactorio.io`;

  const { data, error } = await supabase.auth.signUp({
    email: fakeEmail,
    password,
    options: {
      data: { username: trimmed },
    },
  });

  if (error) {
    if (error.message.includes('already registered')) return { success: false, error: 'Username already taken' };
    return { success: false, error: error.message };
  }

  if (data.user) {
    localStorage.setItem(CURRENT_USER_KEY, trimmed);
    localStorage.setItem(CURRENT_USER_ID_KEY, data.user.id);
    await supabase.from('profiles').upsert({ id: data.user.id, username: trimmed });
  }

  return { success: true };
}

/** Loguje użytkownika przez Supabase Auth. Zwraca success/error. */
export async function login(username: string, password: string): Promise<{ success: boolean; error?: string }> {
  const fakeEmail = `${username.trim().toLowerCase()}@novactorio.io`;
  const { data, error } = await supabase.auth.signInWithPassword({ email: fakeEmail, password });

  if (error) {
    return { success: false, error: 'Wrong username or password' };
  }

  if (data.user) {
    const displayName = data.user.user_metadata?.username || username.trim();
    localStorage.setItem(CURRENT_USER_KEY, displayName);
    localStorage.setItem(CURRENT_USER_ID_KEY, data.user.id);
  }

  return { success: true };
}

/** Wylogowuje — czyści localStorage i wywołuje signOut z Supabase. */
export function logout(): void {
  supabase.auth.signOut();
  localStorage.removeItem(CURRENT_USER_KEY);
  localStorage.removeItem(CURRENT_USER_ID_KEY);
}

/** Zwraca nazwę zalogowanego użytkownika z localStorage (lub null). */
export function getCurrentUser(): string | null {
  return localStorage.getItem(CURRENT_USER_KEY);
}

/** Zwraca UUID aktualnego użytkownika z localStorage (lub null). */
export function getCurrentUserId(): string | null {
  return localStorage.getItem(CURRENT_USER_ID_KEY);
}

// Legacy compatibility
export function getAccounts(): Account[] { return []; }
