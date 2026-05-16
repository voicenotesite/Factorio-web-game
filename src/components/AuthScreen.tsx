import { useState } from 'react';
import { login, register, getCurrentUser } from '../lib/auth';
import { hasSave, getSaveInfo } from '../lib/saveSystem';

interface Props {
  onAuth: (username: string, hasSaveData: boolean) => void;
}

export default function AuthScreen({ onAuth }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = mode === 'login'
      ? login(username, password)
      : register(username, password);

    setLoading(false);

    if (!result.success) {
      setError(result.error || 'Unknown error');
      return;
    }

    const user = getCurrentUser()!;
    const saveExists = hasSave(user);
    onAuth(user, saveExists);
  };

  const saveInfo = username.trim().length >= 3 && mode === 'login'
    ? getSaveInfo(username.trim())
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: 'radial-gradient(ellipse at center, #0a0e14 0%, #060810 100%)',
      }}
    >
      {/* Animated grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(#d88010 1px, transparent 1px), linear-gradient(90deg, #d88010 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative z-10 w-full max-w-sm mx-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="inline-block text-3xl font-orbitron font-black tracking-[0.2em] mb-1"
            style={{ color: '#d88010', textShadow: '0 0 30px rgba(216,128,16,0.5)' }}
          >
            NOVACTORIO
          </div>
          <div className="text-xs font-exo tracking-[0.3em] text-white/20">BUILD. AUTOMATE. SURVIVE.</div>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-6 font-exo"
          style={{
            background: 'linear-gradient(180deg, #0f1418 0%, #0a0d11 100%)',
            border: '1px solid rgba(216,128,16,0.2)',
            borderTop: '1px solid rgba(216,128,16,0.4)',
            boxShadow: '0 0 60px rgba(0,0,0,0.8), inset 0 1px 0 rgba(216,128,16,0.08)',
          }}
        >
          {/* Tab switcher */}
          <div className="flex mb-6 rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            {(['login', 'register'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
                className="flex-1 py-2 text-xs font-orbitron tracking-wider uppercase transition-all"
                style={{
                  background: mode === m ? 'rgba(216,128,16,0.15)' : 'transparent',
                  color: mode === m ? '#d88010' : 'rgba(255,255,255,0.3)',
                  borderRight: m === 'login' ? '1px solid rgba(255,255,255,0.06)' : 'none',
                }}
              >
                {m === 'login' ? '⬡ Sign In' : '+ Register'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-orbitron tracking-widest text-white/30 mb-1.5 uppercase">
                Commander ID
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="enter username"
                className="w-full px-3 py-2.5 text-sm font-exo rounded-lg outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.85)',
                  caretColor: '#d88010',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(216,128,16,0.4)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
              />
              {saveInfo && (
                <div className="mt-1 text-[9px] text-green-400/60 font-mono">
                  ✓ Save found — Tick {saveInfo.tick} · {new Date(saveInfo.timestamp).toLocaleDateString()}
                </div>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-orbitron tracking-widest text-white/30 mb-1.5 uppercase">
                Access Code
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="enter password"
                className="w-full px-3 py-2.5 text-sm font-exo rounded-lg outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.85)',
                  caretColor: '#d88010',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(216,128,16,0.4)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
              />
            </div>

            {error && (
              <div
                className="text-xs py-2 px-3 rounded-lg text-center"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                ⚠ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username.trim() || !password}
              className="w-full py-3 text-sm font-bold font-orbitron tracking-wider rounded-xl transition-all disabled:opacity-40 hover:opacity-90 active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, rgba(180,90,0,0.9), rgba(216,128,16,0.9))',
                color: 'white',
                boxShadow: '0 0 20px rgba(216,128,16,0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
                border: '1px solid rgba(216,128,16,0.4)',
              }}
            >
              {loading ? '...' : mode === 'login' ? '▶ ENTER FACTORY' : '+ CREATE ACCOUNT'}
            </button>
          </form>

          <div className="mt-4 text-center text-[9px] text-white/15 font-exo">
            Saves stored locally in browser · No server required
          </div>
        </div>
      </div>
    </div>
  );
}
