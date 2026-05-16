import { useRef, useEffect } from 'react';
import { GameState } from '../game/types';
import { BUILDING_COLORS, RESOURCE_COLORS } from '../game/constants';

interface Props {
  state: GameState;
  notifications: { text: string; timer: number }[];
}

const RESOURCE_ICONS: Record<string, string> = {
  iron: '⬡', copper: '◆', stone: '▲', coal: '◼', wood: '⬟',
  iron_plate: '▣', copper_plate: '◈', steel_plate: '⬠', gear: '⚙',
  circuit: '⊞', ammo: '◉', science_red: '⬢', science_green: '⬡',
  science_blue: '◎', oil: '⬭', uranium: '⬬',
};

export default function HUD({ state, notifications }: Props) {
  const dayProgress = state.dayTime / state.dayLength;
  const isDay = dayProgress > 0.25 && dayProgress < 0.75;
  const hpPct = (state.player.health / state.player.maxHealth) * 100;
  const xpPct = (state.player.xp / (state.player.level * 100)) * 100;

  const hpColor = hpPct > 50
    ? 'from-emerald-500 to-green-400'
    : hpPct > 25
    ? 'from-amber-500 to-yellow-400'
    : 'from-red-600 to-red-400';

  const hpGlow = hpPct > 50 ? 'bar-glow-green' : hpPct > 25 ? 'bar-glow-amber' : 'bar-glow-red';

  return (
    <div className="fixed top-0 left-0 right-0 pointer-events-none z-10 font-exo">
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{
          background: 'linear-gradient(to bottom, rgba(6,10,18,0.9) 0%, rgba(6,10,18,0.5) 70%, transparent 100%)',
          borderBottom: 'none',
        }}
      >
        {/* Left: Health, XP, Currency, Time */}
        <div className="flex items-center gap-3">
          {/* HP */}
          <div className="flex items-center gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill={hpPct > 50 ? '#22c55e' : hpPct > 25 ? '#f59e0b' : '#ef4444'} className="flex-shrink-0" style={{ filter: `drop-shadow(0 0 4px ${hpPct > 50 ? '#22c55e' : hpPct > 25 ? '#f59e0b' : '#ef4444'})` }}>
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <div className="w-24 h-2 hud-bar">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${hpColor} ${hpGlow} transition-all duration-500`}
                style={{ width: `${hpPct}%` }}
              />
            </div>
            <span className="text-[10px] text-white/40 font-mono tabular-nums w-14">
              {Math.ceil(state.player.health)}<span className="text-white/20">/{state.player.maxHealth}</span>
            </span>
          </div>

          {/* XP */}
          <div className="flex items-center gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0" style={{ filter: 'drop-shadow(0 0 4px #818cf8)' }}>
              <polygon points="13,2 3,14 12,14 11,22 21,10 12,10" />
            </svg>
            <div className="w-24 h-2 hud-bar">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-400 bar-glow-blue transition-all duration-500"
                style={{ width: `${xpPct}%` }}
              />
            </div>
            <span className="text-[10px] text-white/40 font-mono">
              <span className="text-violet-400/80">Lv{state.player.level}</span>
            </span>
          </div>

          {/* Premium */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md" style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.15)' }}>
            <span className="text-cyan-400 text-xs" style={{ filter: 'drop-shadow(0 0 4px #06b6d4)' }}>◆</span>
            <span className="text-[11px] text-cyan-300/80 font-mono tabular-nums">{state.player.premiumCurrency}</span>
          </div>

          {/* Day/Night */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md" style={{ background: 'rgba(6,10,18,0.6)', border: '1px solid rgba(255,255,255,0.05)' }}>
            {isDay ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="#fbbf24" style={{ filter: 'drop-shadow(0 0 4px #fbbf24)' }}>
                <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" stroke="#fbbf24" strokeWidth="2" /><line x1="12" y1="21" x2="12" y2="23" stroke="#fbbf24" strokeWidth="2" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="#fbbf24" strokeWidth="2" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="#fbbf24" strokeWidth="2" /><line x1="1" y1="12" x2="3" y2="12" stroke="#fbbf24" strokeWidth="2" /><line x1="21" y1="12" x2="23" y2="12" stroke="#fbbf24" strokeWidth="2" />
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="#818cf8" style={{ filter: 'drop-shadow(0 0 4px #818cf8)' }}>
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
            <span className="text-[10px] font-orbitron" style={{ color: isDay ? '#fbbf24' : '#818cf8' }}>
              {isDay ? 'DAY' : 'NIGHT'}
            </span>
          </div>

          {/* Weather */}
          <span className="text-[10px] text-white/25 font-exo capitalize">{state.weather}</span>
        </div>

        {/* Center: Key metrics */}
        <div className="flex items-center gap-4">
          <MetricBadge label="TICK" value={state.tick.toString()} />
          <MetricBadge label="EVOL" value={`${(state.evolution * 100).toFixed(1)}%`} color="#f97316" glow="rgba(249,115,22,0.4)" />
          <MetricBadge label="SMOG" value={state.pollution.toFixed(0)} color="#eab308" glow="rgba(234,179,8,0.4)" />
        </div>

        {/* Right: Resources */}
        <div className="flex items-center gap-1.5 flex-wrap justify-end max-w-xs">
          {state.player.inventory.slice(0, 8).map((slot, i) => (
            <div
              key={i}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md transition-colors"
              style={{
                background: 'rgba(6,10,18,0.7)',
                border: `1px solid ${RESOURCE_COLORS[slot.itemId] || '#888'}22`,
              }}
            >
              <div
                className="w-2 h-2 rounded-sm flex-shrink-0"
                style={{
                  backgroundColor: RESOURCE_COLORS[slot.itemId] || '#888',
                  boxShadow: `0 0 4px ${RESOURCE_COLORS[slot.itemId] || '#888'}`,
                }}
              />
              <span className="text-[10px] text-white/60 font-mono tabular-nums">{slot.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Notifications */}
      <div className="absolute top-14 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 pointer-events-none" style={{ minWidth: 260 }}>
        {notifications.map((n, i) => (
          <div
            key={i}
            className="px-5 py-2 text-sm font-exo rounded-lg notify-enter"
            style={{
              background: 'rgba(6,10,18,0.92)',
              border: '1px solid rgba(245,158,11,0.25)',
              boxShadow: '0 0 20px rgba(245,158,11,0.1), 0 4px 20px rgba(0,0,0,0.5)',
              color: 'rgba(255,255,255,0.9)',
              opacity: Math.min(1, n.timer / 30),
              backdropFilter: 'blur(12px)',
              transform: `translateX(-50%)`,
              position: 'relative',
              left: '50%',
            }}
          >
            <span className="text-amber-400/70 mr-2">⚡</span>{n.text}
          </div>
        ))}
      </div>

      {/* Minimap */}
      <div
        className="absolute top-14 right-4 w-44 h-44 rounded-xl overflow-hidden shadow-2xl"
        style={{
          background: 'rgba(6,10,18,0.85)',
          border: '1px solid rgba(245,158,11,0.15)',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.5), 0 8px 32px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div className="absolute top-1 left-2 text-[8px] font-orbitron text-amber-500/40 tracking-widest z-10">MAP</div>
        <Minimap state={state} />
      </div>

      {/* Controls hint */}
      <div className="absolute bottom-16 left-4 text-[9px] text-white/15 pointer-events-none space-y-0.5 font-exo">
        <div>WASD Move · Q Rotate · B Build · R Research · I Inventory</div>
        <div>LMB Mine/Place · RMB Remove · Scroll Zoom · Tab Stats</div>
      </div>
    </div>
  );
}

function MetricBadge({ label, value, color, glow }: { label: string; value: string; color?: string; glow?: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[8px] font-orbitron tracking-widest text-white/20 mb-0.5">{label}</span>
      <span
        className="text-[11px] font-mono tabular-nums font-semibold"
        style={{
          color: color || 'rgba(255,255,255,0.55)',
          textShadow: glow ? `0 0 10px ${glow}` : 'none',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Minimap({ state }: { state: GameState }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, 0, 176, 176);

    const scale = 2;
    const px = state.player.x;
    const py = state.player.y;

    for (const [, chunk] of state.chunks) {
      for (let y = 0; y < chunk.length; y++) {
        for (let x = 0; x < chunk[y].length; x++) {
          const tile = chunk[y][x];
          if (tile.visibility < 0.5) continue;
          const mx = (tile.x - px) * scale + 88;
          const my = (tile.y - py) * scale + 88;
          if (mx < -2 || mx > 178 || my < -2 || my > 178) continue;

          if (tile.building) {
            ctx.fillStyle = BUILDING_COLORS[tile.building.type] || '#888';
          } else if (tile.resource) {
            ctx.fillStyle = RESOURCE_COLORS[tile.resource] || '#888';
          } else {
            const colors: Record<string, string> = {
              grass: '#0f2a14', desert: '#3a2a1a', snow: '#2a3040',
              forest: '#0a2010', swamp: '#121a12', volcanic: '#1a0f0a',
            };
            ctx.fillStyle = colors[tile.biome] || '#0f2a14';
          }
          ctx.fillRect(mx, my, scale, scale);
        }
      }
    }

    // Player glow
    const gradient = ctx.createRadialGradient(88, 88, 0, 88, 88, 8);
    gradient.addColorStop(0, 'rgba(56,189,248,0.8)');
    gradient.addColorStop(1, 'rgba(56,189,248,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(80, 80, 16, 16);

    ctx.fillStyle = '#38bdf8';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(88, 88, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Enemies
    for (const [, enemy] of state.enemies) {
      const ex = (enemy.x - px) * scale + 88;
      const ey = (enemy.y - py) * scale + 88;
      if (ex < 0 || ex > 176 || ey < 0 || ey > 176) continue;
      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 3;
      ctx.fillRect(ex - 1, ey - 1, 3, 3);
      ctx.shadowBlur = 0;
    }

    // NPCs
    for (const [, npc] of state.npcs) {
      const nx = (npc.x - px) * scale + 88;
      const ny = (npc.y - py) * scale + 88;
      if (nx < 0 || nx > 176 || ny < 0 || ny > 176) continue;
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(nx - 1, ny - 1, 2, 2);
    }
  }, [state.tick]);

  return <canvas ref={canvasRef} width={176} height={176} className="w-full h-full" />;
}

