import { useState, useEffect } from 'react';
import { t } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../lib/auth';
import { GameEngine } from '../game/engine';
import { GameState } from '../game/types';

/** Props panelu admina — silnik (do cheat commands), stan gry i callback zamknięcia. */
interface Props {
  engine: GameEngine;
  state: GameState;
  onClose: () => void;
}

/** Wiersz gracza z Supabase world_snapshots. */
interface PlayerRow {
  username: string;
  tick: number;
  building_count: number;
  updated_at: string;
  user_id: string;
}

/** Wiersz czatu z Supabase chat_messages. */
interface ChatRow {
  id: string;
  username: string;
  message: string;
  created_at: string;
}

/** Zakładki panelu: overview (podgląd + akcje), players (lista graczy), chat (logi), world (debug świat). */
type Tab = 'overview' | 'players' | 'chat' | 'world';

/**
 * Panel administratora — podgląd stanu gry (tick, pollution, evolution),
 * zarządzanie graczami (lista online/offline), podgląd czatu z możliwością
 * usuwania wiadomości, wysyłanie broadcastów, komendy cheaterskie
 * (give resources, unlock research, max level, reset evolution, zmiana pory dnia).
 */
export default function AdminPanel({ engine, state, onClose }: Props) {
  /** Aktualna zakładka. */
  const [tab, setTab] = useState<Tab>('overview');
  /** Lista graczy z Supabase. */
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  /** Logi czatu. */
  const [chatLogs, setChatLogs] = useState<ChatRow[]>([]);
  /** Treść broadcastu do wysłania. */
  const [broadcast, setBroadcast] = useState('');
  /** Komunikat zwrotny (zielony, znika po 2s). */
  const [msg, setMsg] = useState('');
  /** Czy trwa wysyłanie broadcastu. */
  const [loading, setLoading] = useState(false);

  /** Przy starcie ładuje listę graczy i logi czatu z Supabase. */
  useEffect(() => {
    loadPlayers();
    loadChat();
  }, []);

  /** Pobiera top 50 snapshotów świata (gracze) z Supabase. */
  const loadPlayers = async () => {
    const { data } = await supabase
      .from('world_snapshots')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(50);
    if (data) setPlayers(data as PlayerRow[]);
  };

  /** Pobiera ostatnie 100 wiadomości czatu z Supabase. */
  const loadChat = async () => {
    const { data } = await supabase
      .from('chat_messages')
      .select('id,username,message,created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) setChatLogs(data as ChatRow[]);
  };

  /** Usuwa wiadomość czatu po ID (admin moderation). */
  const deleteMessage = async (id: string) => {
    await supabase.from('chat_messages').delete().eq('id', id);
    setChatLogs(prev => prev.filter(m => m.id !== id));
  };

  /** Wysyła broadcast systemowy na kanał Realtime i zapisuje do bazy. */
  const sendBroadcast = async () => {
    if (!broadcast.trim()) return;
    setLoading(true);
    const channel = supabase.channel('global-chat');
    channel.send({
      type: 'broadcast', event: 'msg', payload: {
        id: crypto.randomUUID(),
        username: '🔴 SERVER',
        message: broadcast.trim(),
        created_at: new Date().toISOString(),
      }
    });
    await supabase.from('chat_messages').insert({
      username: '🔴 SERVER',
      message: broadcast.trim(),
      user_id: getCurrentUserId(),
    });
    setBroadcast('');
    setMsg(t('broadcastSent'));
    setTimeout(() => setMsg(''), 2000);
    setLoading(false);
  };

  /** Resetuje evolution i pollution do 0 (cheat). */
  const wipeEvolution = () => {
    engine.state.evolution = 0;
    engine.state.pollution = 0;
    setMsg(t('cheatEvoReset'));
    setTimeout(() => setMsg(''), 2000);
  };

  /** Dodaje +500 każdego surowca do ekwipunku gracza (cheat). */
  const giveResources = () => {
    const res = ['iron', 'copper', 'coal', 'stone', 'wood', 'iron_plate', 'copper_plate', 'gear', 'circuit', 'steel_plate'];
    for (const r of res) {
      const slot = engine.state.player.inventory.find(s => s.itemId === r);
      if (slot) slot.count += 500; else engine.state.player.inventory.push({ itemId: r, count: 500 });
    }
    setMsg(t('cheatResources'));
    setTimeout(() => setMsg(''), 2000);
  };

  /** Odblokowuje wszystkie badania (cheat). */
  const unlockAllResearch = () => {
    for (const [, r] of engine.state.research) { r.unlocked = true; r.progress = r.cost; }
    setMsg(t('cheatResearch'));
    setTimeout(() => setMsg(''), 2000);
  };

  /** Ustawia gracza na level 100 z max XP i 100 gemami (cheat). */
  const maxLevel = () => {
    engine.state.player.level = 100;
    engine.state.player.xp = 999999;
    engine.state.player.gems = 100;
    setMsg(t('cheatLevel100'));
    setTimeout(() => setMsg(''), 2000);
  };

  /** Ustawia porę dnia (phase 0..1: 0=night, 0.25=dawn, 0.5=noon, 0.75=dusk). */
  const timeOfDay = (phase: number) => {
    engine.state.dayTime = engine.state.dayLength * phase;
    setMsg(t('cheatTimeSet'));
    setTimeout(() => setMsg(''), 1500);
  };

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview', label: t('adminOverview'), icon: '📊' },
    { id: 'players', label: t('adminPlayersTab'), icon: '👥' },
    { id: 'chat', label: t('adminChatLogs'), icon: '💬' },
    { id: 'world', label: t('adminWorldTab'), icon: '🌍' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md" onClick={onClose}>
      <div
        className="w-full max-w-2xl mx-4 rounded-2xl overflow-hidden font-exo"
        style={{
          background: 'linear-gradient(180deg, #0a0d11 0%, #060809 100%)',
          border: '1px solid rgba(220,38,38,0.4)',
          borderTop: '2px solid rgba(220,38,38,0.7)',
          boxShadow: '0 0 80px rgba(220,38,38,0.15), 0 0 0 1px rgba(0,0,0,0.5)',
          maxHeight: '85vh',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3">
            <span className="text-lg">🛡️</span>
            <div>
              <h2 className="font-orbitron font-bold text-sm text-red-400 tracking-wider">{t('adminPanel')}</h2>
              <p className="text-[10px] text-white/30 font-orbitron">Novactorio Debug Console</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {msg && <span className="text-xs text-green-400 font-orbitron">{msg}</span>}
            <button onClick={onClose} className="text-white/30 hover:text-white/60 font-orbitron text-sm">✕</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {tabs.map(tabItem => (
            <button key={tabItem.id} onClick={() => setTab(tabItem.id)}
              className="flex-1 py-2.5 text-[10px] font-orbitron tracking-wider transition-colors"
              style={{ color: tab === tabItem.id ? '#ef4444' : 'rgba(255,255,255,0.3)', borderBottom: tab === tabItem.id ? '2px solid #ef4444' : '2px solid transparent' }}
            >
              {tabItem.icon} {tabItem.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto p-4 space-y-3" style={{ maxHeight: 'calc(85vh - 130px)' }}>

          {/* OVERVIEW */}
          {tab === 'overview' && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: t('adminTick'), value: state.tick.toLocaleString() },
                  { label: t('evolution'), value: (state.evolution * 100).toFixed(2) + '%' },
                  { label: t('adminPollution'), value: state.pollution.toFixed(1) },
                  { label: t('adminBuildings'), value: state.buildings.size },
                  { label: t('adminNPCs'), value: state.npcs.size },
                  { label: t('adminBuildQueue'), value: state.buildQueue.length },
                  { label: t('adminPlayerHP'), value: `${state.player.health}/${state.player.maxHealth}` },
                  { label: 'Level', value: state.player.level },
                  { label: t('adminPosition'), value: `${Math.floor(state.player.x)},${Math.floor(state.player.y)}` },
                ].map(s => (
                  <div key={s.label} className="p-2.5 rounded-xl text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="text-[10px] text-white/30 font-orbitron">{s.label}</div>
                    <div className="text-sm font-bold text-white/80 mt-0.5">{s.value}</div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-[10px] text-white/30 font-orbitron uppercase tracking-wider">{t('adminQuickActions')}</p>
                <div className="grid grid-cols-2 gap-2">
                  <AdminBtn onClick={wipeEvolution} color="#ef4444" label={t('adminResetEvo')} />
                  <AdminBtn onClick={giveResources} color="#22c55e" label={t('adminAddResources')} />
                  <AdminBtn onClick={unlockAllResearch} color="#38bdf8" label={t('adminUnlockResearch')} />
                  <AdminBtn onClick={maxLevel} color="#a78bfa" label={t('adminSetLevel100')} />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] text-white/30 font-orbitron uppercase tracking-wider">{t('adminTimeOfDay')}</p>
                <div className="grid grid-cols-4 gap-2">
                  <AdminBtn onClick={() => timeOfDay(0.25)} color="#fbbf24" label={t('adminDawn')} />
                  <AdminBtn onClick={() => timeOfDay(0.5)} color="#f59e0b" label={t('adminNoon')} />
                  <AdminBtn onClick={() => timeOfDay(0.75)} color="#f97316" label={t('adminDusk')} />
                  <AdminBtn onClick={() => timeOfDay(0)} color="#6366f1" label={t('adminNight')} />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] text-white/30 font-orbitron uppercase tracking-wider">{t('adminServerBroadcast')}</p>
                <div className="flex gap-2">
                  <input
                    value={broadcast}
                    onChange={e => setBroadcast(e.target.value)}
                    onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') sendBroadcast(); }}
                    placeholder={t('adminMessagePlaceholder')}
                    className="flex-1 px-3 py-2 text-xs rounded-lg outline-none"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)' }}
                  />
                  <button onClick={sendBroadcast} disabled={!broadcast.trim() || loading}
                    className="px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-40"
                    style={{ background: 'rgba(220,38,38,0.2)', color: '#ef4444', border: '1px solid rgba(220,38,38,0.3)' }}>
                    📢 {t('adminSend')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PLAYERS */}
          {tab === 'players' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-white/30 font-orbitron">{t('adminTotalRegistered')}: {players.length}</p>
                <button onClick={loadPlayers} className="text-[10px] text-white/30 hover:text-white/60 font-orbitron">↻ {t('adminRefresh')}</button>
              </div>
              {players.map(p => {
                const mins = Math.floor(p.tick / 3600);
                const ago = Math.round((Date.now() - new Date(p.updated_at).getTime()) / 60000);
                return (
                  <div key={p.user_id} className="flex items-center justify-between p-3 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                      <div className="text-sm font-bold text-white/80">{p.username}</div>
                      <div className="text-[10px] text-white/30">{p.building_count} buildings · {mins}m playtime</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-[10px] font-orbitron ${ago < 5 ? 'text-green-400' : 'text-white/25'}`}>
                        {ago < 5 ? `🟢 ${t('adminOnline')}` : `${ago}${t('adminMinAgo')}`}
                      </div>
                      <div className="text-[10px] text-white/20">tick {p.tick.toLocaleString()}</div>
                    </div>
                  </div>
                );
              })}
              {players.length === 0 && <div className="text-center text-white/20 text-xs py-8 font-orbitron">{t('adminNoPlayers')}</div>}
            </div>
          )}

          {/* CHAT LOGS */}
          {tab === 'chat' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-white/30 font-orbitron">{t('adminLastMessages')}</p>
                <button onClick={loadChat} className="text-[10px] text-white/30 hover:text-white/60 font-orbitron">↻ {t('adminRefresh')}</button>
              </div>
              {chatLogs.map(m => (
                <div key={m.id} className="flex items-start justify-between p-2.5 rounded-lg group"
                  style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold mr-1.5" style={{ color: '#38bdf8' }}>{m.username}:</span>
                    <span className="text-xs text-white/60 break-all">{m.message}</span>
                    <div className="text-[9px] text-white/20 mt-0.5">{new Date(m.created_at).toLocaleString()}</div>
                  </div>
                  <button onClick={() => deleteMessage(m.id)}
                    className="ml-2 opacity-0 group-hover:opacity-100 text-red-400/70 hover:text-red-400 text-xs transition-opacity shrink-0">
                    🗑
                  </button>
                </div>
              ))}
              {chatLogs.length === 0 && <div className="text-center text-white/20 text-xs py-8 font-orbitron">{t('adminNoMessages')}</div>}
            </div>
          )}

          {/* WORLD DEBUG */}
          {tab === 'world' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <p className="text-[10px] text-white/30 font-orbitron uppercase tracking-wider">{t('adminWorldState')}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    [t('adminWorldSeed'), state.worldSeed],
                    [t('adminChunksLoaded'), state.chunks.size],
                    [t('adminEnemies'), state.enemies.size],
                    [t('adminSpawners'), state.spawners.size],
                    [t('adminParticles'), state.particles.length],
                    [t('adminWeather'), state.weather],
                    [t('adminDayPhase'), ((state.dayTime / state.dayLength) * 100).toFixed(1) + '%'],
                    [t('adminConveyors'), state.conveyors.size],
                  ].map(([k, v]) => (
                    <div key={String(k)} className="flex justify-between p-2 rounded-lg"
                      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <span className="text-white/30">{k}</span>
                      <span className="text-white/70 font-bold">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] text-white/30 font-orbitron uppercase tracking-wider">{t('adminResearchStatus')}</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {Array.from(state.research.entries()).map(([key, r]) => (
                    <div key={key} className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg"
                      style={{ background: 'rgba(255,255,255,0.025)' }}>
                      <span className="text-white/50">{key.replace(/_/g, ' ')}</span>
                      <span style={{ color: r.unlocked ? '#4ade80' : '#ef4444' }}>{r.unlocked ? '✓' : '✗'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Przycisk akcji administracyjnej z kolorowym obramowaniem i tłem. */
function AdminBtn({ onClick, color, label }: { onClick: () => void; color: string; label: string }) {
  return (
    <button onClick={onClick}
      className="px-3 py-2.5 rounded-xl text-xs font-bold text-left transition-all hover:opacity-80"
      style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
      {label}
    </button>
  );
}
