import { useState } from 'react';
import { GameEngine } from '../game/engine';
import { saveGame, loadGame, deleteSave, getSaveInfo } from '../lib/saveSystem';
import { getCurrentUser } from '../lib/auth';

interface Props {
  engine: GameEngine;
  onClose: () => void;
}

export default function SaveLoad({ engine, onClose }: Props) {
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const username = getCurrentUser();
  const saveInfo = username ? getSaveInfo(username) : null;

  const handleSave = () => {
    if (!username) { setMessage('Not logged in'); return; }
    setSaving(true);
    try {
      saveGame(username, engine.state);
      setMessage('Game saved!');
    } catch (e) {
      setMessage('Save failed: ' + String(e));
    }
    setSaving(false);
  };

  const handleLoad = () => {
    if (!username) { setMessage('Not logged in'); return; }
    setLoading(true);
    const save = loadGame(username);
    if (!save) { setMessage('No save found'); setLoading(false); return; }
    try {
      engine.loadFromSave(save);
      setMessage('Loaded!');
    } catch (e) {
      setMessage('Load failed: ' + String(e));
    }
    setLoading(false);
    setTimeout(onClose, 800);
  };

  const handleDelete = () => {
    if (!username) return;
    if (!confirm('Delete your save? This cannot be undone.')) return;
    deleteSave(username);
    setMessage('Save deleted');
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-md" onClick={onClose}>
      <div
        className="panel-glass rounded-2xl p-5 max-w-md w-full mx-4 animate-slide-up font-exo"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5 pb-3" style={{ borderBottom: '1px solid rgba(148,163,184,0.15)' }}>
          <h2 className="font-orbitron font-bold text-lg text-white/80 tracking-wider">SAVE / LOAD</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-all text-sm font-orbitron">✕</button>
        </div>

        {username && (
          <div className="mb-4 text-xs text-white/30 font-mono text-center">
            Logged in as <span className="text-amber-400/70">{username}</span>
          </div>
        )}

        {saveInfo && (
          <div
            className="mb-4 p-3 rounded-xl text-xs font-mono"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="text-white/50 mb-1">Last save:</div>
            <div className="text-white/70">Tick {saveInfo.tick} · {new Date(saveInfo.timestamp).toLocaleString()}</div>
          </div>
        )}

        <div className="space-y-2">
          <button
            onClick={handleSave}
            disabled={saving || !username}
            className="w-full py-3 text-sm font-bold rounded-xl transition-all disabled:opacity-40 hover:opacity-90 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #166534, #22c55e)',
              color: 'white',
              boxShadow: '0 0 20px rgba(34,197,94,0.2)',
            }}
          >
            {saving ? '⏳ Saving...' : '💾 Save Game'}
          </button>

          {saveInfo && (
            <button
              onClick={handleLoad}
              disabled={loading || !username}
              className="w-full py-3 text-sm font-bold rounded-xl transition-all disabled:opacity-40 hover:opacity-90 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #0c4a6e, #0ea5e9)',
                color: 'white',
                boxShadow: '0 0 20px rgba(14,165,233,0.2)',
              }}
            >
              {loading ? '⏳ Loading...' : '📂 Load Save'}
            </button>
          )}

          {saveInfo && (
            <button
              onClick={handleDelete}
              className="w-full py-2 text-xs font-semibold rounded-xl transition-all hover:opacity-90"
              style={{
                background: 'rgba(239,68,68,0.08)',
                color: '#f87171',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              🗑 Delete Save
            </button>
          )}
        </div>

        {message && (
          <div
            className="mt-4 text-xs text-center py-2 rounded-lg font-semibold"
            style={{
              background: message.includes('fail') || message.includes('failed') || message.includes('No save') ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
              color: message.includes('fail') || message.includes('failed') || message.includes('No save') ? '#f87171' : '#4ade80',
              border: `1px solid ${message.includes('fail') ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`,
            }}
          >{message}</div>
        )}

        <div className="mt-4 text-center text-[9px] text-white/15 font-exo">
          Saves stored in browser localStorage
        </div>
      </div>
    </div>
  );
}

