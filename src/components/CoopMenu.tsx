import { useState, useEffect, useRef } from 'react';
import { t } from '../lib/i18n';
import { getCurrentUserId } from '../lib/auth';
import { GameEngine } from '../game/engine';

interface Props {
  engine: GameEngine;
  coopMode: boolean;
  onToggleCoop: () => void;
  onClose: () => void;
}

export default function CoopMenu({ engine, coopMode, onToggleCoop, onClose }: Props) {
  const myId = getCurrentUserId();
  const [copied, setCopied] = useState(false);
  const [visitors, setVisitors] = useState<{ username: string; color: string }[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      if (engine.state.coopVisitors) {
        setVisitors(Array.from(engine.state.coopVisitors.values()));
      }
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [engine]);

  const copyCode = () => {
    if (myId) {
      navigator.clipboard.writeText(myId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-md" onClick={onClose}>
      <div
        className="rounded-2xl w-full max-w-sm mx-4 overflow-hidden font-exo"
        style={{
          background: 'linear-gradient(180deg, #0f1418 0%, #0a0d11 100%)',
          border: '1px solid rgba(244,114,182,0.2)',
          borderTop: '1px solid rgba(244,114,182,0.4)',
          boxShadow: '0 0 60px rgba(0,0,0,0.8)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(244,114,182,0.1)' }}>
          <h2 className="font-orbitron font-bold text-base tracking-wider" style={{ color: '#f472b6' }}>🌐 {t('coopTitle')}</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors font-orbitron text-sm">✕</button>
        </div>

        <div className="p-4 space-y-4">
          {/* World Code */}
          <div className="p-3 rounded-xl" style={{ background: 'rgba(244,114,182,0.06)', border: '1px solid rgba(244,114,182,0.15)' }}>
            <div className="text-[10px] font-orbitron tracking-wider mb-1.5" style={{ color: 'rgba(244,114,182,0.6)' }}>{t('yourWorldCode')}</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono px-2 py-1.5 rounded-lg truncate" style={{ background: 'rgba(0,0,0,0.3)', color: '#f472b6', border: '1px solid rgba(244,114,182,0.2)' }}>
                {myId}
              </code>
              <button
                onClick={copyCode}
                className="px-2.5 py-1.5 text-[10px] font-orbitron rounded-lg transition-all whitespace-nowrap"
                style={{
                  background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(244,114,182,0.15)',
                  color: copied ? '#4ade80' : '#f472b6',
                  border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'rgba(244,114,182,0.25)'}`,
                }}
              >
                {copied ? t('copied') : t('copyCode')}
              </button>
            </div>
          </div>

          {/* Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-sm text-white/70 font-semibold">{t('coopBroadcast')}</span>
            <button
              onClick={onToggleCoop}
              className="relative w-12 h-6 rounded-full transition-all"
              style={{
                background: coopMode ? 'rgba(244,114,182,0.4)' : 'rgba(255,255,255,0.1)',
                border: `1px solid ${coopMode ? 'rgba(244,114,182,0.5)' : 'rgba(255,255,255,0.15)'}`,
              }}
            >
              <div className="absolute top-0.5 w-5 h-5 rounded-full transition-all duration-200" style={{
                left: coopMode ? 'calc(100% - 22px)' : '2px',
                background: coopMode ? '#f472b6' : 'rgba(255,255,255,0.3)',
                boxShadow: coopMode ? '0 0 8px rgba(244,114,182,0.4)' : 'none',
              }} />
            </button>
          </div>

          {/* Visitors */}
          <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-[10px] font-orbitron tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('visitors')} ({visitors.length})</div>
            {visitors.length === 0 ? (
              <div className="text-center text-white/20 text-xs py-4 font-orbitron">{t('noVisitors')}</div>
            ) : (
              visitors.map(v => (
                <div key={v.username} className="flex items-center gap-2 py-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: v.color }} />
                  <span className="text-sm text-white/70">{v.username}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
