import { t } from '../lib/i18n';
import { GameState } from '../game/types';
import { BUILDING_COLORS, RESOURCE_COLORS, RECIPES, CHUNK_SIZE } from '../game/constants';
import { GameEngine } from '../game/engine';
import { canAffordUpgrade, getUpgradeCost, upgradeBuilding } from '../game/systems';

/** Props info budynku — silnik i stan gry (hoveredTile z engine). */
interface Props {
  engine: GameEngine;
  state: GameState;
}

/** Przyjazne nazwy surowców. */
const ITEM_NAMES: Record<string, string> = {
  iron: 'Iron', copper: 'Copper', stone: 'Stone', coal: 'Coal', wood: 'Wood',
  iron_plate: 'Iron Plate', copper_plate: 'Cu Plate', steel_plate: 'Steel Plate',
  gear: 'Gear', circuit: 'Circuit', advanced_circuit: 'Adv. Circuit',
  ammo: 'Ammo', pipe: 'Pipe',
};

/** Tooltip/popup info o budynku pod kursorem — zdrowie, poziom, upgrade, recipe progress, input/output inventory. */
export default function BuildingInfo({ engine, state }: Props) {
  const { hoveredTile } = engine;
  if (!hoveredTile) return null;

  const key = `${hoveredTile.x},${hoveredTile.y}`;
  const building = state.buildings.get(key);
  if (!building) return null;

  const cx = Math.floor(hoveredTile.x / CHUNK_SIZE);
  const cy = Math.floor(hoveredTile.y / CHUNK_SIZE);
  const chunkKey = `${cx},${cy}`;
  const chunk = state.chunks.get(chunkKey);
  const lx = ((hoveredTile.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  const ly = ((hoveredTile.y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  const tile = chunk?.[ly]?.[lx];

  const canUpgrade = building.level < 3 && canAffordUpgrade(state, building.level);
  const upgradeCost = building.level < 3 ? getUpgradeCost(building.level) : [];
  const hpPct = (building.health / building.maxHealth) * 100;
  const bColor = BUILDING_COLORS[building.type] || '#888';

  return (
    <div
      className="fixed bottom-20 right-4 z-20 rounded-xl p-4 w-64 animate-fade-in font-exo"
      style={{
        background: 'rgba(6,10,18,0.92)',
        border: `1px solid ${bColor}25`,
        boxShadow: `0 0 20px ${bColor}10, 0 8px 32px rgba(0,0,0,0.5)`,
        backdropFilter: 'blur(16px)',
      }}
    >
      <div className="flex items-center gap-2.5 mb-3 pb-2.5" style={{ borderBottom: `1px solid ${bColor}15` }}>
        <div
          className="w-9 h-9 rounded-xl flex-shrink-0"
          style={{
            background: `${bColor}18`,
            border: `1px solid ${bColor}40`,
            boxShadow: `0 0 12px ${bColor}25`,
          }}
        >
          <div className="w-full h-full rounded-xl" style={{ background: bColor, opacity: 0.65, borderRadius: 'inherit' }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-sm capitalize leading-tight">{building.type.replace(/_/g, ' ')}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-white/30 font-mono">Lv.{building.level}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-orbitron ${building.isActive ? 'text-emerald-400/70' : 'text-white/20'}`}
              style={{ background: building.isActive ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)' }}>
              {building.isActive ? t('bldgActive') : t('bldgIdle')}
            </span>
          </div>
        </div>
        {building.level < 3 && (
          <button
            onClick={() => {
              if (upgradeBuilding(state, hoveredTile!.x, hoveredTile!.y)) {
                engine.addNotification(t('buildingUpgraded'));
              } else {
                engine.addNotification(t('cannotAffordUpgrade'));
              }
            }}
            disabled={!canUpgrade}
            className="text-[10px] px-2.5 py-1.5 rounded-lg font-semibold transition-all flex-shrink-0"
            style={{
              background: canUpgrade ? 'linear-gradient(135deg, #92400e, #d97706)' : 'rgba(255,255,255,0.03)',
              color: canUpgrade ? 'white' : 'rgba(255,255,255,0.2)',
              border: `1px solid ${canUpgrade ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.05)'}`,
              cursor: canUpgrade ? 'pointer' : 'not-allowed',
              boxShadow: canUpgrade ? '0 0 10px rgba(217,119,6,0.2)' : 'none',
            }}
          >
            {t('bldgUpgrade')}
          </button>
        )}
      </div>

      {building.level < 3 && upgradeCost.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {upgradeCost.map(c => {
            const slot = state.player.inventory.find(s => s.itemId === c.itemId);
            const have = slot ? slot.count : 0;
            const enough = have >= c.count;
            return (
              <span
                key={c.itemId}
                className="text-[10px] px-1.5 py-0.5 rounded-md font-mono"
                style={{
                  background: enough ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  color: enough ? 'rgba(34,197,94,0.8)' : 'rgba(239,68,68,0.8)',
                  border: `1px solid ${enough ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                }}
              >
                {ITEM_NAMES[c.itemId] || c.itemId}: {have}/{c.count}
              </span>
            );
          })}
        </div>
      )}

      <div className="mb-3">
        <div className="flex items-center justify-between text-[10px] mb-1.5">
          <span className="text-white/30">{t('bldgHealth')}</span>
          <span className="text-white/50 tabular-nums font-mono">{Math.ceil(building.health)}/{building.maxHealth}</span>
        </div>
        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${hpPct}%`,
              background: hpPct > 50
                ? 'linear-gradient(90deg, #16a34a, #22c55e)'
                : hpPct > 25
                ? 'linear-gradient(90deg, #d97706, #fbbf24)'
                : 'linear-gradient(90deg, #b91c1c, #ef4444)',
              boxShadow: hpPct > 50 ? '0 0 6px rgba(34,197,94,0.5)' : hpPct > 25 ? '0 0 6px rgba(245,158,11,0.5)' : '0 0 6px rgba(239,68,68,0.5)',
            }}
          />
        </div>
      </div>

      {building.recipe && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-[10px] mb-1.5">
            <span className="text-white/30">{t('bldgRecipe')}</span>
            <span className="text-blue-300/60 font-medium">{building.recipe.name}</span>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(building.progress / building.recipe.craftTime) * 100}%`,
                background: 'linear-gradient(90deg, #2563eb, #38bdf8)',
                boxShadow: '0 0 6px rgba(56,189,248,0.4)',
              }}
            />
          </div>
        </div>
      )}

      {building.inventory.length > 0 && (
        <div className="mb-2">
          <div className="text-[10px] text-white/25 mb-1">{t('bldgInput')}</div>
          <div className="flex flex-wrap gap-1">
            {building.inventory.map((slot, i) => (
              <div key={i} className="flex items-center gap-1 px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: RESOURCE_COLORS[slot.itemId] || '#888' }} />
                <span className="text-[10px] text-white/50 tabular-nums font-mono">{slot.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {building.outputInventory.length > 0 && (
        <div className="mb-2">
          <div className="text-[10px] text-white/25 mb-1">{t('bldgOutput')}</div>
          <div className="flex flex-wrap gap-1">
            {building.outputInventory.map((slot, i) => (
              <div key={i} className="flex items-center gap-1 px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: RESOURCE_COLORS[slot.itemId] || '#888' }} />
                <span className="text-[10px] text-white/50 tabular-nums font-mono">{slot.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {building.type === 'assembler' && (
        <div className="mt-3 pt-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="text-[10px] text-white/25 mb-1.5 font-orbitron tracking-wider">{t('bldgSetRecipe')}</div>
          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
            {Object.values(RECIPES).filter(r => r.category !== 'smelting').map(r => (
              <button
                key={r.id}
                onClick={() => engine.setRecipeForBuilding(hoveredTile!.x, hoveredTile!.y, r.id)}
                className="text-[10px] px-2 py-1 rounded-md transition-all"
                style={{
                  background: building.recipe?.id === r.id ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.04)',
                  color: building.recipe?.id === r.id ? '#38bdf8' : 'rgba(255,255,255,0.35)',
                  border: `1px solid ${building.recipe?.id === r.id ? 'rgba(56,189,248,0.3)' : 'rgba(255,255,255,0.06)'}`,
                }}
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-2 pt-2 text-[9px] text-white/15" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        {t('direction')} <span className="text-white/25">{building.direction.toUpperCase()}</span>
        {tile && (
          <span className="ml-2">
            · {tile.biome}
            {tile.resource && (
              <span> · <span className="text-white/30">{tile.resource}: {tile.resourceAmount}</span>
                {tile.resourceYield !== 'normal' && (
                  <span className={`ml-1 ${tile.resourceYield === 'very_rich' ? 'text-red-400/60' : tile.resourceYield === 'rich' ? 'text-amber-400/60' : 'text-white/20'}`}>
                    ({tile.resourceYield.replace('_', ' ')})
                  </span>
                )}
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
