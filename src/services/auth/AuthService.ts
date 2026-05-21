import { type Session, type User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { type Result, Ok, Err, fromPromise } from '../../lib/result'
import { AppError } from '../../lib/errors'
import { isAdmin } from '../../config/admins'

export interface AuthState {
  user: User | null
  username: string | null
  session: Session | null
  isAdmin: boolean
  loading: boolean
}

type AuthListener = (state: AuthState) => void

class AuthServiceClass {
  private state: AuthState = {
    user: null,
    username: null,
    session: null,
    isAdmin: false,
    loading: true,
  }
  private listeners = new Set<AuthListener>()
  private initialized = false

  getState(): AuthState {
    return this.state
  }

  subscribe(listener: AuthListener): () => void {
    this.listeners.add(listener)
    listener(this.state)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state)
    }
  }

  async init(): Promise<void> {
    if (this.initialized) return
    this.initialized = true

    supabase.auth.onAuthStateChange((_event, session) => {
      this.updateSession(session)
    })

    const { data } = await supabase.auth.getSession()
    this.updateSession(data.session)
    this.state = { ...this.state, loading: false }
    this.notify()
  }

  private updateSession(session: Session | null): void {
    const user = session?.user ?? null
    const username = user?.user_metadata?.username as string | null ?? null
    this.state = {
      user,
      username,
      session,
      isAdmin: isAdmin(username),
      loading: false,
    }
    this.notify()
  }

  async login(username: string, password: string): Promise<Result<User, AppError>> {
    const trimmed = username.trim()
    if (!trimmed) return Err(AppError.validation('Username is required'))

    const fakeEmail = `${trimmed.toLowerCase()}@novactorio.io`
    const result = await fromPromise(
      supabase.auth.signInWithPassword({ email: fakeEmail, password }),
      err => AppError.network('Login failed', err)
    )
    if (!result.ok) return result

    const { data } = result.value
    if (!data.user) return Err(AppError.auth('Login failed: no user returned'))

    this.updateSession(data.session)
    return Ok(data.user)
  }

  async register(username: string, password: string): Promise<Result<User, AppError>> {
    const trimmed = username.trim()
    if (!trimmed || trimmed.length < 3) return Err(AppError.validation('Username must be 3+ characters'))
    if (!password || password.length < 4) return Err(AppError.validation('Password must be 4+ characters'))

    const fakeEmail = `${trimmed.toLowerCase()}@novactorio.io`
    const result = await fromPromise(
      supabase.auth.signUp({
        email: fakeEmail,
        password,
        options: { data: { username: trimmed } },
      }),
      err => {
        const msg = (err as Error)?.message ?? ''
        if (msg.includes('already registered')) {
          return AppError.validation('Username already taken')
        }
        return AppError.network('Registration failed', err)
      }
    )
    if (!result.ok) return result

    const { data } = result.value
    if (!data.user) return Err(AppError.auth('Registration failed: no user returned'))

    await supabase.from('profiles').upsert({ id: data.user.id, username: trimmed })
    this.updateSession(data.session)
    return Ok(data.user)
  }

  async logout(): Promise<void> {
    await supabase.auth.signOut()
    this.state = {
      user: null,
      username: null,
      session: null,
      isAdmin: false,
      loading: false,
    }
    this.notify()
  }

  getCurrentUser(): string | null {
    return this.state.username
  }

  getCurrentUserId(): string | null {
    return this.state.user?.id ?? null
  }
}

export const AuthService = new AuthServiceClass()
