import { type ReactNode } from 'react'
import { AuthService } from './AuthService'

interface Props {
  fallback?: ReactNode
  children: ReactNode
}

export function AdminGuard({ fallback, children }: Props) {
  const state = AuthService.getState()
  if (!state.isAdmin) {
    return <>{fallback ?? null}</>
  }
  return <>{children}</>
}
