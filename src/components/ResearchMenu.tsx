import { RESEARCH_TREE, RESOURCE_COLORS } from '../game/constants';
import { GameEngine } from '../game/engine';
import { GameState } from '../game/types';

interface Props {
  engine: GameEngine;
  state: GameState;
  onClose: () => void;
}

export default function ResearchMenu({ engine, state, onClose }: Props) {
  const researchList = Object.values(RESEARCH_TREE);

  const canResearch = (r: typeof researchList[0]) => {
    if (r.prerequisites.length === 0) return true;
    return r.prerequisites.every(p => state.research.get(p)?.unlocked);
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-md" onClick={onClose}>
      <div
        className="panel-glass rounded-2xl p-5 max-w-3xl w-full mx-4 max-h-[82vh] overflow-y-auto animate-slide-up font-exo"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5 pb-3" style={{ borderBottom: '1px solid rgba(216,128,16,0.18)' }}>
          <div>
            <h2 className="font-orbitron font-bold text-lg tracking-wider" style={{ color: 'rgba(216,128,16,0.85)' }}>RESEARCH TREE</h2>
            <p className="text-xs text-white/30 mt-1">Unlock technologies to advance your factory</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-all text-sm font-orbitron">✕</button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {researchList.map(r => {
            const research = state.research.get(r.id);
            const unlocked = research?.unlocked;
            const inProgress = research && research.progress > 0 && !research.unlocked;
            const available = canResearch(r) && !unlocked;
            const progressPct = inProgress ? (research!.progress / research!.time) * 100 : 0;

            return (
              <div
                key={r.id}
                className="p-4 rounded-xl transition-all duration-200"
                style={{
                  background: unlocked
                    ? 'rgba(216,128,16,0.05)'
                    : inProgress
                    ? 'rgba(216,128,16,0.08)'
                    : available
                    ? 'rgba(255,255,255,0.02)'
                    : 'rgba(255,255,255,0.005)',
                  border: unlocked
                    ? '1px solid rgba(216,128,16,0.25)'
                    : inProgress
                    ? '1px solid rgba(216,128,16,0.35)'
                    : available
                    ? '1px solid rgba(255,255,255,0.08)'
                    : '1px solid rgba(255,255,255,0.03)',
                  opacity: available || unlocked || inProgress ? 1 : 0.45,
                  boxShadow: unlocked ? '0 0 15px rgba(216,128,16,0.08)' : inProgress ? '0 0 15px rgba(216,128,16,0.12)' : 'none',
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm" style={{
                        color: unlocked ? '#e8c060' : inProgress ? '#d88010' : available ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)',
                      }}>
                        {r.name}
                      </h3>
                      {unlocked && (
                        <span className="text-[9px] font-orbitron px-2 py-0.5 rounded-full" style={{ background: 'rgba(216,128,16,0.15)', color: '#e8c060', border: '1px solid rgba(216,128,16,0.3)' }}>DONE</span>
                      )}
                    </div>
                    <p className="text-[11px] text-white/30 mt-0.5 leading-tight">{r.description}</p>
                  </div>
                  {inProgress && (
                    <span className="text-amber-400 text-sm font-orbitron font-bold tabular-nums" style={{ color: '#d88010' }}>
                      {progressPct.toFixed(0)}%
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                {inProgress && (
                  <div className="w-full h-1.5 rounded-full mb-3 overflow-hidden" style={{ background: 'rgba(0,0,0,0.4)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${progressPct}%`,
                        background: 'linear-gradient(90deg, #a06010, #d88010)',
                        boxShadow: '0 0 8px rgba(216,128,16,0.5)',
                      }}
                    />
                  </div>
                )}

                {/* Cost */}
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {r.cost.map((c, i) => (
                    <div key={i} className="flex items-center gap-1 text-[11px]">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: RESOURCE_COLORS[c.itemId] || '#888', boxShadow: `0 0 4px ${RESOURCE_COLORS[c.itemId] || '#888'}` }} />
                      <span className="text-white/40 font-mono">{c.count}</span>
                    </div>
                  ))}
                  <span className="text-[10px] text-white/20">· {Math.ceil(r.time / 60)}s</span>
                </div>

                {/* Prerequisites */}
                {r.prerequisites.length > 0 && (
                  <div className="text-[10px] text-white/20 mb-2">
                    Needs: <span className="text-white/35">{r.prerequisites.map(p => RESEARCH_TREE[p]?.name || p).join(', ')}</span>
                  </div>
                )}

                {/* Effects */}
                <div className="text-[10px] text-white/20 mb-3 font-mono">
                  {Object.entries(r.effects).map(([k, v]) => `${k}×${v}`).join(' · ')}
                </div>

                {/* Action */}
                {available && (
                  <button
                    onClick={() => engine.startResearch(r.id)}
                    className="btn-shine w-full py-1.5 text-xs font-semibold font-exo rounded-lg transition-all hover:opacity-90 active:scale-95"
                    style={{
                      background: 'linear-gradient(180deg, #1e1408 0%, #120e06 100%)',
                      color: '#f0c060',
                      boxShadow: '0 0 15px rgba(216,128,16,0.2)',
                    }}
                  >
                    Start Research
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
