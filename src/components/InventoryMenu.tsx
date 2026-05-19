import { t } from '../lib/i18n';
import { GameState } from '../game/types';
import { RESOURCE_COLORS, RECIPES } from '../game/constants';
import { GameEngine } from '../game/engine';

/** Props menu ekwipunku — silnik, stan gry i callback zamknięcia. */
interface Props {
  engine: GameEngine;
  state: GameState;
  onClose: () => void;
}

/** Menu ekwipunku i craftingu — siatka inventory + lista przepisów z możliwością craftowania. */
export default function InventoryMenu({ engine, state, onClose }: Props) {
  const { player } = state;

  /** Próbuje wykonać przepis: sprawdza inputy, odejmuje je i dodaje outputy. */
  const handleCraft = (recipeId: string) => {
    const recipe = RECIPES[recipeId];
    if (!recipe) return;
    for (const input of recipe.inputs) {
      const slot = player.inventory.find(s => s.itemId === input.itemId);
      if (!slot || slot.count < input.count) {
        engine.addNotification(`Not enough ${input.itemId.replace(/_/g, ' ')}`);
        return;
      }
    }
    for (const input of recipe.inputs) {
      const slot = player.inventory.find(s => s.itemId === input.itemId);
      if (slot) { slot.count -= input.count; if (slot.count <= 0) player.inventory = player.inventory.filter(s => s.count > 0); }
    }
    for (const output of recipe.outputs) {
      const slot = player.inventory.find(s => s.itemId === output.itemId);
      if (slot) { slot.count += output.count; } else { player.inventory.push({ itemId: output.itemId, count: output.count }); }
    }
    engine.addNotification(`Crafted ${recipe.name}`);
  };

  /** Sprawdza czy gracz ma wszystkie wymagane surowce dla przepisu. */
  const canCraft = (recipeId: string) => {
    const recipe = RECIPES[recipeId];
    if (!recipe) return false;
    return recipe.inputs.every(input => {
      const slot = player.inventory.find(s => s.itemId === input.itemId);
      return slot && slot.count >= input.count;
    });
  };

  const recipes = Object.values(RECIPES);
  const categories = ['smelting', 'crafting', 'chemistry', 'military'];
  const categoryColors: Record<string, string> = {
    smelting: '#f97316', crafting: '#22c55e', chemistry: '#a78bfa', military: '#ef4444',
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md" onClick={onClose}>
      <div
        className="panel-glass rounded-t-2xl sm:rounded-2xl p-4 sm:p-5 w-full sm:max-w-4xl sm:mx-4 max-h-[85vh] overflow-y-auto animate-slide-up font-exo"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5 pb-3" style={{ borderBottom: '1px solid rgba(216,128,16,0.18)' }}>
          <div>
            <h2 className="font-orbitron font-bold text-lg text-white tracking-wider">{t('inventoryTitle')}</h2>
            <p className="text-xs text-white/30 mt-1">{t('inventorySubtitle')}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-all text-sm font-orbitron">✕</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full" style={{ background: '#d88010', boxShadow: '0 0 6px #d88010' }} />
              <span className="text-[10px] font-orbitron tracking-[0.2em] uppercase" style={{ color: 'rgba(216,128,16,0.6)' }}>{t('inventory')}</span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {player.inventory.map((slot, i) => (
                <div
                  key={i}
                  className="p-2 rounded-xl text-center transition-all cursor-default group"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: `1px solid ${RESOURCE_COLORS[slot.itemId] || '#888'}20`,
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = `${RESOURCE_COLORS[slot.itemId] || '#888'}10`;
                    (e.currentTarget as HTMLElement).style.borderColor = `${RESOURCE_COLORS[slot.itemId] || '#888'}40`;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)';
                    (e.currentTarget as HTMLElement).style.borderColor = `${RESOURCE_COLORS[slot.itemId] || '#888'}20`;
                  }}
                >
                  <div
                    className="w-8 h-8 mx-auto mb-1 rounded-lg"
                    style={{
                      backgroundColor: `${RESOURCE_COLORS[slot.itemId] || '#888'}30`,
                      border: `1px solid ${RESOURCE_COLORS[slot.itemId] || '#888'}50`,
                      boxShadow: `0 0 8px ${RESOURCE_COLORS[slot.itemId] || '#888'}20`,
                    }}
                  >
                    <div className="w-full h-full rounded-lg" style={{ background: RESOURCE_COLORS[slot.itemId] || '#888', opacity: 0.6, borderRadius: 'inherit' }} />
                  </div>
                  <div className="text-[9px] text-white/40 truncate mb-0.5">{slot.itemId.replace(/_/g, ' ')}</div>
                  <div className="text-xs text-white font-mono font-bold tabular-nums" style={{ textShadow: `0 0 8px ${RESOURCE_COLORS[slot.itemId] || '#888'}` }}>{slot.count.toLocaleString()}</div>
                </div>
              ))}
              {player.inventory.length === 0 && (
                <div className="col-span-5 text-center py-10">
                  <div className="text-white/15 text-sm font-exo">{t('inventoryEmpty')}</div>
                  <div className="text-white/10 text-xs mt-1">{t('inventoryEmptyHint')}</div>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-amber-400" style={{ boxShadow: '0 0 6px #f59e0b' }} />
              <span className="text-[10px] font-orbitron tracking-[0.2em] text-amber-400/60 uppercase">{t('crafting')}</span>
            </div>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {categories.map(cat => {
                const catRecipes = recipes.filter(r => r.category === cat);
                if (catRecipes.length === 0) return null;
                const catColor = categoryColors[cat] || '#888';
                return (
                  <div key={cat} className="mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: catColor }} />
                      <span className="text-[9px] font-orbitron tracking-[0.2em] uppercase" style={{ color: `${catColor}80` }}>{cat}</span>
                    </div>
                    {catRecipes.map(recipe => {
                      const craftable = canCraft(recipe.id);
                      return (
                        <div
                          key={recipe.id}
                          className="p-2.5 rounded-xl mb-1.5 transition-all duration-150"
                          style={{
                            background: craftable ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.005)',
                            border: craftable ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.02)',
                            opacity: craftable ? 1 : 0.5,
                          }}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              {recipe.outputs.map((out, i) => (
                                <div key={i} className="flex items-center gap-1.5">
                                  <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: RESOURCE_COLORS[out.itemId] || '#888', boxShadow: `0 0 4px ${RESOURCE_COLORS[out.itemId] || '#888'}` }} />
                                  <span className="text-xs text-white/80 font-medium">{out.count}× <span className="text-white/60">{out.itemId.replace(/_/g, ' ')}</span></span>
                                </div>
                              ))}
                            </div>
                            {craftable && (
                              <button
                                onClick={() => handleCraft(recipe.id)}
                                className="btn-shine px-3 py-1 text-[11px] font-semibold rounded-lg transition-all hover:opacity-90 active:scale-95 flex-shrink-0"
                                style={{
                                   background: 'linear-gradient(180deg, #1e1408 0%, #120e06 100%)',
                                   color: '#f0c060',
                                   boxShadow: '0 0 10px rgba(216,128,16,0.2)',
                                }}
                              >
                                {t('craftButton')}
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-white/25 flex-wrap">
                            {recipe.inputs.map((input, i) => (
                              <span key={i} className="flex items-center gap-0.5">
                                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: RESOURCE_COLORS[input.itemId] || '#888' }} />
                                <span className="font-mono">{input.count}</span>
                              </span>
                            ))}
                            <span className="text-white/15">·</span>
                            <span className="font-mono">{(recipe.craftTime / 60).toFixed(1)}s</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
