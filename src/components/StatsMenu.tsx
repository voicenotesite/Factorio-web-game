import { GameState } from '../game/types';
import { ACHIEVEMENT_CATALOG } from '../game/systems';

interface Props {
  state: GameState;
  onClose: () => void;
}

export default function StatsMenu({ state, onClose }: Props) {
  const { statistics, player } = state;

  const formatTime = (ticks: number) => {
    const seconds = Math.floor(ticks / 60);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md" onClick={onClose}>
      <div
        className="panel-glass rounded-t-2xl sm:rounded-2xl p-4 sm:p-5 w-full sm:max-w-lg sm:mx-4 max-h-[85vh] overflow-y-auto animate-slide-up font-exo"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5 pb-3" style={{ borderBottom: '1px solid rgba(167,139,250,0.15)' }}>
          <h2 className="font-orbitron font-bold text-lg tracking-wider" style={{ color: '#a78bfa' }}>STATISTICS</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-all text-sm font-orbitron">✕</button>
        </div>

        <div className="space-y-5">
          <Section title="General" color="#a78bfa">
            <StatRow label="Time Played" value={formatTime(statistics.timePlayed)} />
            <StatRow label="Buildings Placed" value={statistics.buildingsPlaced.toString()} />
            <StatRow label="Enemies Killed" value={statistics.enemiesKilled.toString()} />
            <StatRow label="Evolution" value={`${(state.evolution * 100).toFixed(1)}%`} color="#f97316" />
            <StatRow label="Pollution" value={state.pollution.toFixed(0)} color="#eab308" />
          </Section>

          <Section title="Player" color="#38bdf8">
            <StatRow label="Level" value={player.level.toString()} color="#818cf8" />
            <StatRow label="Experience" value={`${player.xp} / ${player.level * 500}`} />
            <StatRow label="Złote" value={`${(player.premiumCurrency * 0.25).toFixed(2)} zł`} color="#06b6d4" />
            <StatRow label="Health" value={`${Math.ceil(player.health)} / ${player.maxHealth}`} color={player.health / player.maxHealth > 0.5 ? '#22c55e' : '#ef4444'} />
            <StatRow label="Speed" value={player.speed.toFixed(2)} />
            <StatRow label="Mining Speed" value={`×${player.miningSpeed.toFixed(1)}`} />
            <StatRow label="Crafting Speed" value={`×${player.craftingSpeed.toFixed(1)}`} />
            <StatRow label="Reach" value={`${player.reach} tiles`} />
          </Section>

          <Section title="Achievements" color="#fbbf24">
            {ACHIEVEMENT_CATALOG.map(def => {
              const unlocked = player.achievements.includes(def.id);
              return (
                <div key={def.id} className={`text-xs py-0.5 flex items-center gap-2 ${unlocked ? '' : 'opacity-30'}`}>
                  <span>{unlocked ? '🏆' : '🔒'}</span>
                  <span className={unlocked ? 'text-amber-300' : 'text-white/50'}>
                    <strong>{def.name}</strong> — {def.description}
                  </span>
                </div>
              );
            })}
          </Section>

          <Section title="World" color="#22c55e">
            <StatRow label="Buildings" value={state.buildings.size.toString()} />
            <StatRow label="NPCs" value={state.npcs.size.toString()} />
            <StatRow label="Enemies" value={state.enemies.size.toString()} color="#ef4444" />
            <StatRow label="Spawners" value={state.spawners.size.toString()} />
            <StatRow label="Chunks Loaded" value={state.chunks.size.toString()} />
          </Section>

          {Object.entries(statistics.itemsProduced).length > 0 && (
            <Section title="Items Produced" color="#f97316">
              {Object.entries(statistics.itemsProduced)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([item, count]) => (
                  <StatRow key={item} label={item.replace(/_/g, ' ')} value={count.toLocaleString()} />
                ))}
            </Section>
          )}

          <Section title="Research" color="#38bdf8">
            {Array.from(state.research.entries()).filter(([, r]) => r.unlocked).map(([id, r]) => (
              <div key={id} className="text-xs py-0.5 flex items-center gap-2">
                <span className="text-emerald-400/60">✓</span>
                <span className="text-emerald-400/80">{r.name}</span>
              </div>
            ))}
            {Array.from(state.research.entries()).filter(([, r]) => r.unlocked).length === 0 && (
              <div className="text-white/20 text-xs py-2">No research completed yet</div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 5px ${color}` }} />
        <span className="text-[10px] font-orbitron tracking-[0.2em] uppercase" style={{ color: `${color}80` }}>{title}</span>
        <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, ${color}20, transparent)` }} />
      </div>
      <div className="space-y-1 pl-4">{children}</div>
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between text-xs py-0.5">
      <span className="text-white/35 font-exo">{label}</span>
      <span className="font-mono tabular-nums font-medium" style={{ color: color || 'rgba(255,255,255,0.65)', textShadow: color ? `0 0 8px ${color}60` : 'none' }}>{value}</span>
    </div>
  );
}
