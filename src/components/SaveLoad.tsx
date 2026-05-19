import { useState, useEffect } from 'react';
import { t } from '../lib/i18n';
import { GameEngine } from '../game/engine';
import { saveGame, loadGame, deleteSave, getSaveInfo } from '../lib/saveSystem';
import { getCurrentUser } from '../lib/auth';

/** Props menu save/load — silnik, cooldown i callbacki. */
interface Props {
  engine: GameEngine;
  onClose: () => void;
  saveCooldown: number;
  onSave: () => void;
}

/** Panel zapisu/odczytu gry z cooldownem, informacją o ostatnim save i przyciskiem usuwania. */
export default function SaveLoad({ engine, onClose, saveCooldown, onSave }: Props) {
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localCooldown, setLocalCooldown] = useState(0);

  /** Odlicza localCooldown co sekundę. */
  useEffect(() => {
    if (localCooldown <= 0) return;
    const t = setInterval(() => setLocalCooldown(p => Math.max(0, p - 1)), 1000);
    return () => clearInterval(t);
  }, [localCooldown]);

  const username = getCurrentUser();
  const saveInfo = username ? getSaveInfo(username) : null;
  const cooldown = Math.max(saveCooldown, localCooldown);

  /** Zapisuje grę z 10s cooldownem. */
  const handleSave = () => {
    if (!username) { setMessage(t('notLoggedIn')); return; }
    if (cooldown > 0) { setMessage(t('cooldownMsg', { s: cooldown })); return; }
    setLocalCooldown(10);
    onSave();
    setMessage(t('gameSaved'));
  };

  /** Ładuje zapisaną grę z localStorage. */
  const handleLoad = () => {
    if (!username) { setMessage(t('notLoggedIn')); return; }
    setLoading(true);
    try {
      const save = loadGame(username);
      if (save && engine) {
        engine.loadFromSave(save);
        setMessage(t('gameLoaded'));
      } else {
        setMessage(t('noSaveData'));
      }
    } catch (e) {
      setMessage('Load failed: ' + String(e));
    }
    setLoading(false);
  };

  /** Usuwa zapis gry po potwierdzeniu. */
  const handleDelete = () => {
    if (!username) return;
    if (!confirm('Delete save for ' + username + '?')) return;
    try {
      deleteSave(username);
      setMessage(t('saveDeleted'));
    } catch (e) {
      setMessage('Delete failed: ' + String(e));
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-md" onClick={onClose}>
      <div
        className="panel-glass rounded-2xl p-5 max-w-md w-full mx-4 animate-slide-up font-exo"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5 pb-3" style={{ borderBottom: '1px solid rgba(148,163,184,0.15)' }}>
          <h2 className="font-orbitron font-bold text-lg text-white/80 tracking-wider">{t('saveLoadTitle')}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-all text-sm font-orbitron">✕</button>
        </div>

        {cooldown > 0 && (
          <div className="mb-4 p-4 rounded-xl text-center animate-slide-up"
            style={{
              background: 'rgba(34,197,94,0.08)',
              border: '1px solid rgba(34,197,94,0.2)',
              boxShadow: '0 0 20px rgba(34,197,94,0.05)',
            }}
          >
            <div className="font-orbitron font-bold text-xs tracking-[0.2em] text-green-400 mb-1">
              {t('savingGameState')}
            </div>
            <div className="font-mono text-4xl font-black animate-pulse text-green-500">
              {cooldown}s
            </div>
            <div className="w-full h-1.5 mt-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="h-full rounded-full transition-all duration-1000 ease-linear"
                style={{
                  width: `${(cooldown / 10) * 100}%`,
                  background: 'linear-gradient(90deg, #166534, #22c55e)',
                }}
              />
            </div>
          </div>
        )}

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
            <div className="text-white/50 mb-1">{t('lastSave')}</div>
            <div className="text-white/70">Tick {saveInfo.tick} · {new Date(saveInfo.timestamp).toLocaleString()}</div>
          </div>
        )}

        <div className="space-y-2">
          <button
            onClick={handleSave}
            disabled={cooldown > 0 || !username}
            className="w-full py-3 text-sm font-bold rounded-xl transition-all disabled:opacity-40 hover:opacity-90 active:scale-95"
            style={{
              background: cooldown > 0 ? 'linear-gradient(135deg, #166534, #22c55e)' : 'linear-gradient(135deg, #166534, #22c55e)',
              color: 'white',
              boxShadow: cooldown > 0 ? '0 0 20px rgba(34,197,94,0.3)' : '0 0 10px rgba(34,197,94,0.1)',
            }}
          >
            {cooldown > 0 ? `⏳ ${cooldown}s` : saving ? '⏳ Saving...' : t('saveGame')}
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
              {loading ? '⏳ Loading...' : t('loadGame')}
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
              {t('deleteSave')}
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
          {t('saveStorage')}
        </div>
      </div>
    </div>
  );
}
