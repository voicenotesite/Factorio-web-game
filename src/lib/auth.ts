export interface Account {
  username: string;
  passwordHash: string;
}

const ACCOUNTS_KEY = 'factorio_accounts';
const CURRENT_USER_KEY = 'factorio_current_user';

function hashPassword(password: string): string {
  let hash = 5381;
  for (let i = 0; i < password.length; i++) {
    hash = ((hash << 5) + hash) ^ password.charCodeAt(i);
    hash = hash >>> 0;
  }
  return hash.toString(36);
}

export function getAccounts(): Account[] {
  try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]'); } catch { return []; }
}

function saveAccounts(accounts: Account[]): void {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function register(username: string, password: string): { success: boolean; error?: string } {
  const trimmed = username.trim();
  if (!trimmed || trimmed.length < 3) return { success: false, error: 'Username must be 3+ characters' };
  if (!password || password.length < 4) return { success: false, error: 'Password must be 4+ characters' };
  const accounts = getAccounts();
  if (accounts.find(a => a.username.toLowerCase() === trimmed.toLowerCase())) {
    return { success: false, error: 'Username already taken' };
  }
  accounts.push({ username: trimmed, passwordHash: hashPassword(password) });
  saveAccounts(accounts);
  localStorage.setItem(CURRENT_USER_KEY, trimmed);
  return { success: true };
}

export function login(username: string, password: string): { success: boolean; error?: string } {
  const accounts = getAccounts();
  const account = accounts.find(a => a.username.toLowerCase() === username.trim().toLowerCase());
  if (!account) return { success: false, error: 'Account not found' };
  if (account.passwordHash !== hashPassword(password)) return { success: false, error: 'Wrong password' };
  localStorage.setItem(CURRENT_USER_KEY, account.username);
  return { success: true };
}

export function logout(): void {
  localStorage.removeItem(CURRENT_USER_KEY);
}

export function getCurrentUser(): string | null {
  return localStorage.getItem(CURRENT_USER_KEY);
}
