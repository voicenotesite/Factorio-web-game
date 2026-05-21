import { type ReactNode, useEffect, useState } from 'react'
import { AuthService, type AuthState } from './AuthService'

interface Props {
  loading?: ReactNode
  children: (state: AuthState) => ReactNode
}

export function AuthGuard({ loading, children }: Props) {
  const [state, setState] = useState<AuthState>(AuthService.getState())

  useEffect(() => {
    const unsub = AuthService.subscribe(setState)
    return unsub
  }, [])

  if (state.loading) {
    return <>{loading ?? <div className="fixed inset-0 flex items-center justify-center bg-black font-exo">
      <div className="text-amber-500/60 font-orbitron text-sm tracking-widest animate-pulse">AUTHENTICATING...</div>
    </div>}</>
  }

  return <>{children(state)}</>
}
