import { useState } from 'react';
import { GameEngine } from '../game/engine';
import { GameState } from '../game/types';

interface Props {
  engine: GameEngine;
  state: GameState;
  onClose: () => void;
}

const SKIN_COLORS = [
  { id: 'default', name: 'Steel Blue', color: '#3388ee', cost: 0 },
  { id: 'crimson', name: 'Crimson', color: '#cc2233', cost: 10 },
  { id: 'emerald', name: 'Emerald', color: '#22aa55', cost: 10 },
  { id: 'gold', name: 'Gold', color: '#cc9922', cost: 15 },
  { id: 'obsidian', name: 'Obsidian', color: '#334', cost: 20 },
  { id: 'arctic', name: 'Arctic', color: '#88ccee', cost: 25 },
];

const HAT_TYPES = [
  { id: 'none', name: 'None', cost: 0 },
  { id: 'hardhat', name: 'Hard Hat', cost: 15 },
  { id: 'crown', name: 'Crown', cost: 50 },
  { id: 'beret', name: 'Beret', cost: 20 },
  { id: 'helmet', name: 'Mil. Helmet', cost: 30 },
];

const TRAIL_EFFECTS = [
  { id: 'none', name: 'None', cost: 0 },
  { id: 'sparkle', name: 'Sparkle', cost: 20 },
  { id: 'flame', name: 'Flame', cost: 30 },
  { id: 'electric', name: 'Electric', cost: 40 },
  { id: 'rainbow', name: 'Rainbow', cost: 60 },
];

const BOOST_PACKS = [
  { id: 'speed_boost', name: 'Speed Boost', desc: '+25% movement for 5 min', cost: 5, icon: '⚡', color: '#fbbf24' },
  { id: 'mining_boost', name: 'Mining Boost', desc: '+50% mining for 5 min', cost: 5, icon: '⛏', color: '#f97316' },
  { id: 'xp_boost', name: 'XP Boost', desc: '+100% XP for 5 min', cost: 8, icon: '⭐', color: '#a78bfa' },
  { id: 'shield', name: 'Shield', desc: 'Immunity for 2 min', cost: 10, icon: '🛡', color: '#38bdf8' },
];

export default function ShopMenu({ engine, state, onClose }: Props) {
  const [tab, setTab] = useState<'cosmetics' | 'boosts'>('cosmetics');
  const [message, setMessage] = useState('');
  const currency = state.player.premiumCurrency;

  const purchase = (cost: number, callback: () => void) => {
    if (currency < cost) { setMessage('Not enough gems!'); return; }
    state.player.premiumCurrency -= cost;
    callback();
    setMessage('Purchased!');
    engine.addNotification('Item purchased from shop!');
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-md" onClick={onClose}>
      <div
        className="panel-glass rounded-2xl p-5 max-w-lg w-full mx-4 max-h-[82vh] overflow-y-auto animate-slide-up font-exo"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-3" style={{ borderBottom: '1px solid rgba(6,182,212,0.15)' }}>
          <div>
            <h2 className="font-orbitron font-bold text-lg tracking-wider" style={{ color: '#06b6d4' }}>SHOP</h2>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-cyan-400 text-sm" style={{ filter: 'drop-shadow(0 0 4px #06b6d4)' }}>◆</span>
              <span className="text-cyan-300 font-mono font-bold tabular-nums">{currency}</span>
              <span className="text-white/20 text-xs">gems · earn by leveling up</span>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-all text-sm font-orbitron">✕</button>
        </div>

        {/* Feedback message */}
        {message && (
          <div
            className="text-xs text-center mb-3 py-1.5 rounded-lg font-semibold"
            style={{
              background: message.includes('Not') ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
              color: message.includes('Not') ? '#f87171' : '#4ade80',
              border: `1px solid ${message.includes('Not') ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`,
            }}
          >{message}</div>
        )}

        {/* Tab switcher */}
        <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ background: 'rgba(0,0,0,0.3)' }}>
          {(['cosmetics', 'boosts'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setMessage(''); }}
              className="flex-1 py-2 px-4 text-sm font-semibold rounded-lg transition-all duration-200 font-exo capitalize"
              style={{
                background: tab === t ? 'rgba(6,182,212,0.15)' : 'transparent',
                color: tab === t ? '#06b6d4' : 'rgba(255,255,255,0.35)',
                border: `1px solid ${tab === t ? 'rgba(6,182,212,0.3)' : 'transparent'}`,
                boxShadow: tab === t ? '0 0 15px rgba(6,182,212,0.1)' : 'none',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'cosmetics' && (
          <div className="space-y-5">
            <CosmeticSection title="Skin Color">
              <div className="grid grid-cols-3 gap-2">
                {SKIN_COLORS.map(skin => {
                  const owned = state.player.cosmetics.skinColor === skin.color;
                  return (
                    <button key={skin.id} onClick={() => purchase(skin.cost, () => { state.player.cosmetics.skinColor = skin.color; })}
                      className="p-3 rounded-xl text-center transition-all"
                      style={{
                        background: owned ? `${skin.color}18` : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${owned ? `${skin.color}50` : 'rgba(255,255,255,0.06)'}`,
                        boxShadow: owned ? `0 0 12px ${skin.color}20` : 'none',
                      }}
                    >
                      <div className="w-8 h-8 rounded-full mx-auto mb-1.5" style={{ backgroundColor: skin.color, boxShadow: `0 0 12px ${skin.color}60` }} />
                      <div className="text-[11px] text-white/70 font-medium">{skin.name}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: '#06b6d488' }}>{skin.cost === 0 ? 'Free' : `${skin.cost} ◆`}</div>
                    </button>
                  );
                })}
              </div>
            </CosmeticSection>

            <CosmeticSection title="Hat">
              <div className="grid grid-cols-3 gap-2">
                {HAT_TYPES.map(hat => {
                  const owned = state.player.cosmetics.hatType === hat.id;
                  return (
                    <button key={hat.id} onClick={() => purchase(hat.cost, () => { state.player.cosmetics.hatType = hat.id; })}
                      className="p-3 rounded-xl text-center transition-all"
                      style={{
                        background: owned ? 'rgba(6,182,212,0.12)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${owned ? 'rgba(6,182,212,0.35)' : 'rgba(255,255,255,0.06)'}`,
                      }}
                    >
                      <div className="text-xl mb-1">🎩</div>
                      <div className="text-[11px] text-white/70 font-medium">{hat.name}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: '#06b6d488' }}>{hat.cost === 0 ? 'Free' : `${hat.cost} ◆`}</div>
                    </button>
                  );
                })}
              </div>
            </CosmeticSection>

            <CosmeticSection title="Trail Effect">
              <div className="grid grid-cols-3 gap-2">
                {TRAIL_EFFECTS.map(trail => {
                  const owned = state.player.cosmetics.trailEffect === trail.id;
                  return (
                    <button key={trail.id} onClick={() => purchase(trail.cost, () => { state.player.cosmetics.trailEffect = trail.id; })}
                      className="p-3 rounded-xl text-center transition-all"
                      style={{
                        background: owned ? 'rgba(6,182,212,0.12)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${owned ? 'rgba(6,182,212,0.35)' : 'rgba(255,255,255,0.06)'}`,
                      }}
                    >
                      <div className="text-[11px] text-white/70 font-medium">{trail.name}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: '#06b6d488' }}>{trail.cost === 0 ? 'Free' : `${trail.cost} ◆`}</div>
                    </button>
                  );
                })}
              </div>
            </CosmeticSection>
          </div>
        )}

        {tab === 'boosts' && (
          <div className="grid grid-cols-2 gap-2.5">
            {BOOST_PACKS.map(pack => (
              <button
                key={pack.id}
                onClick={() => purchase(pack.cost, () => {
                  switch (pack.id) {
                    case 'speed_boost': state.player.speed *= 1.25; break;
                    case 'mining_boost': state.player.miningSpeed *= 1.5; break;
                    case 'xp_boost': state.player.craftingSpeed *= 2; break;
                    case 'shield': state.player.health = state.player.maxHealth; break;
                  }
                })}
                className="p-4 rounded-xl text-left transition-all hover:opacity-90 active:scale-95"
                style={{
                  background: `${pack.color}08`,
                  border: `1px solid ${pack.color}25`,
                  boxShadow: `0 0 15px ${pack.color}08`,
                }}
              >
                <div className="text-2xl mb-2">{pack.icon}</div>
                <div className="text-sm text-white/85 font-semibold">{pack.name}</div>
                <div className="text-[11px] text-white/30 mt-1 leading-tight">{pack.desc}</div>
                <div className="text-[11px] mt-2 font-bold font-mono" style={{ color: pack.color }}>{pack.cost} ◆</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CosmeticSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" style={{ boxShadow: '0 0 5px #06b6d4' }} />
        <span className="text-[10px] font-orbitron tracking-[0.2em] text-cyan-400/50 uppercase">{title}</span>
      </div>
      {children}
    </div>
  );
}
