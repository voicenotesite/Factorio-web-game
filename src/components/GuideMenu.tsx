import { t } from '../lib/i18n';

/** Props menu poradnika — callback zamknięcia. */
interface Props {
  onClose: () => void;
}

/** Lista budowli opisywanych w poradniku. */
const buildings = [
  { key: 'miner', icon: '⛏', name: 'Miner', descKey: 'desc_miner' },
  { key: 'furnace', icon: '🔥', name: 'Furnace', descKey: 'desc_furnace' },
  { key: 'assembler', icon: '⚙️', name: 'Assembler', descKey: 'desc_assembler' },
  { key: 'conveyor', icon: '➡️', name: 'Conveyor', descKey: 'desc_conveyor' },
  { key: 'inserter', icon: '🔄', name: 'Inserter', descKey: 'desc_inserter' },
  { key: 'splitter', icon: '🔀', name: 'Splitter', descKey: 'desc_splitter' },
  { key: 'underground_belt', icon: '⬇️', name: 'Underground Belt', descKey: 'desc_underground_belt' },
  { key: 'storage', icon: '📦', name: 'Storage', descKey: 'desc_storage' },
  { key: 'pipe', icon: '🌊', name: 'Pipe', descKey: 'desc_pipe' },
  { key: 'boiler', icon: '💧', name: 'Boiler', descKey: 'desc_boiler' },
  { key: 'steam_engine', icon: '⚡', name: 'Steam Engine', descKey: 'desc_steam_engine' },
  { key: 'power_pole', icon: '🔌', name: 'Power Pole', descKey: 'desc_power_pole' },
  { key: 'lab', icon: '🔬', name: 'Lab', descKey: 'desc_lab' },
  { key: 'radar', icon: '📡', name: 'Radar', descKey: 'desc_radar' },
  { key: 'turret', icon: '🎯', name: 'Turret', descKey: 'desc_turret' },
  { key: 'wall', icon: '🧱', name: 'Wall', descKey: 'desc_wall' },
  { key: 'refinery', icon: '🛢️', name: 'Refinery', descKey: 'desc_refinery' },
  { key: 'chemical_plant', icon: '🧪', name: 'Chemical Plant', descKey: 'desc_chemical_plant' },
  { key: 'pumpjack', icon: '🪝', name: 'Pumpjack', descKey: 'desc_pumpjack' },
];

/** Poradnik gry z sekcjami: rozpoczęcie, łańcuch produkcyjny, energia, badania, obrona i referencja budowli. */
export default function GuideMenu({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-40 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="min-h-screen flex items-start justify-center py-8 px-4"
      >
        <div
          className="w-full max-w-2xl rounded-2xl font-exo"
          style={{
            background: 'linear-gradient(180deg, #111820 0%, #0c1016 100%)',
            border: '1px solid rgba(216,128,16,0.18)',
            boxShadow: '0 0 60px rgba(0,0,0,0.9)',
          }}
        >
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ borderBottom: '1px solid rgba(216,128,16,0.15)' }}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">📖</span>
              <h1 className="text-xl font-orbitron tracking-widest" style={{ color: '#d88010' }}>
                {t('guide')}
              </h1>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all hover:bg-white/10"
              style={{ color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              ✕
            </button>
          </div>

          <div className="px-6 py-5 space-y-8">

            <Section title={t('guideGettingStarted')} icon="🚀">
              <p className="text-sm text-white/60 leading-relaxed mb-3">
                Welcome to <span className="text-amber-400 font-semibold">Novactorio</span> — a factory-building game where you mine resources, build production chains, research technology, and defend against enemies.
              </p>
              <DiagramBox>
                <div className="font-mono text-xs text-center space-y-1">
                  <div className="text-white/50">{t('guideMovement')}</div>
                  <div className="text-amber-400">W</div>
                  <div className="flex justify-center gap-2 text-amber-400">
                    <span>A</span><span>S</span><span>D</span>
                  </div>
                  <div className="text-white/30 mt-2"><span className="text-sky-400">{t('guideHoldMine')}</span></div>
                </div>
              </DiagramBox>
              <p className="text-xs text-white/40 mt-2">
                Open the <span className="text-amber-400">Build</span> menu (B), select a building, then click on the map to place it. Press <span className="text-amber-400">Q</span> to rotate, <span className="text-amber-400">ESC</span> to cancel.
              </p>
            </Section>

            <Section title={t('guideResourceChain')} icon="⛓️">
              <p className="text-sm text-white/60 leading-relaxed mb-3">
                {t('guideChainDesc')}
              </p>
              <DiagramBox>
                <div className="font-mono text-xs text-center">
                  <div className="flex items-center justify-center gap-1 flex-wrap">
                    <Chip color="#f59e0b">⛏ MINER</Chip>
                    <Arrow />
                    <Chip color="#f97316">➡ BELT</Chip>
                    <Arrow />
                    <Chip color="#ef4444">🔥 FURNACE</Chip>
                    <Arrow />
                    <Chip color="#f97316">➡ BELT</Chip>
                    <Arrow />
                    <Chip color="#3b82f6">⚙️ ASSEMBLER</Chip>
                  </div>
                </div>
              </DiagramBox>
              <p className="text-xs text-white/40 mt-2">
                Place a <span className="text-amber-400">Miner</span> on ore. Connect with <span className="text-orange-400">Conveyor Belts</span>. Use <span className="text-amber-400">Inserters</span> to load/unload buildings. The Furnace produces plates; the Assembler turns them into components.
              </p>
            </Section>

            <Section title={t('guidePowerSystem')} icon="⚡">
              <p className="text-sm text-white/60 leading-relaxed mb-3">
                {t('guidePowerDesc')}
              </p>
              <DiagramBox>
                <div className="font-mono text-xs text-center">
                  <div className="flex items-center justify-center gap-1 flex-wrap">
                    <Chip color="#6b7280">💧 BOILER</Chip>
                    <Arrow label={t('guideSteam')} />
                    <Chip color="#fbbf24">⚡ ENGINE</Chip>
                    <Arrow label={t('guidePower')} />
                    <Chip color="#facc15">🔌 POLE</Chip>
                    <Arrow />
                    <Chip color="#94a3b8">🏭 BUILDINGS</Chip>
                  </div>
                </div>
              </DiagramBox>
              <p className="text-xs text-white/40 mt-2">
                Connect a <span className="text-amber-400">Boiler</span> (needs coal + water pipe) to a <span className="text-yellow-400">Steam Engine</span>. Place <span className="text-yellow-300">Power Poles</span> to extend the grid to your buildings.
              </p>
            </Section>

            <Section title={t('guideResearchSection')} icon="🔬">
              <p className="text-sm text-white/60 leading-relaxed mb-3">
                {t('guideResearchDesc')}
              </p>
              <DiagramBox>
                <div className="font-mono text-xs text-center">
                  <div className="flex items-center justify-center gap-1 flex-wrap">
                    <Chip color="#a855f7">🔬 LAB</Chip>
                    <span className="text-white/30 mx-1">{t('guideNeeds')}</span>
                    <Chip color="#ec4899">🧪 SCIENCE PACKS</Chip>
                    <Arrow />
                    <Chip color="#22d3ee">📋 TECH TREE</Chip>
                  </div>
                </div>
              </DiagramBox>
              <p className="text-xs text-white/40 mt-2">
                Build a <span className="text-purple-400">Lab</span> and supply it with science packs via inserters and belts. Open <span className="text-amber-400">Research</span> menu (R) to choose what to research.
              </p>
            </Section>

            <Section title={t('guideDefense')} icon="🛡️">
              <p className="text-sm text-white/60 leading-relaxed mb-3">
                {t('guideDefenseDesc')}
              </p>
              <DiagramBox>
                <div className="font-mono text-xs text-center space-y-1">
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    <Chip color="#6b7280">🧱 WALLS</Chip>
                    <span className="text-white/30">+</span>
                    <Chip color="#dc2626">🎯 TURRETS</Chip>
                    <span className="text-white/30">{t('guideNeed')}</span>
                    <Chip color="#f59e0b">🔫 AMMO</Chip>
                  </div>
                </div>
              </DiagramBox>
              <p className="text-xs text-white/40 mt-2">
                Place <span className="text-gray-400">Walls</span> to slow enemies, and <span className="text-red-400">Turrets</span> (supplied with ammo via inserters) to shoot them. Build <span className="text-cyan-400">Radar</span> to reveal the map.
              </p>
            </Section>

            <Section title={t('guideBuildingsRef')} icon="🏗️">
              <div className="grid grid-cols-2 gap-2">
                {buildings.map(b => (
                  <div
                    key={b.key}
                    className="p-3 rounded-xl"
                    style={{ border: '1px solid rgba(216,128,16,0.2)', background: 'rgba(0,0,0,0.3)' }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{b.icon}</span>
                      <span className="font-bold text-sm text-amber-400 font-orbitron">{b.name}</span>
                    </div>
                    <p className="text-xs text-white/60">{t(b.descKey as any)}</p>
                  </div>
                ))}
              </div>
            </Section>

          </div>

          <div
            className="px-6 py-4 flex justify-end"
            style={{ borderTop: '1px solid rgba(216,128,16,0.15)' }}
          >
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-lg text-sm font-orbitron tracking-wider transition-all hover:opacity-90"
              style={{
                background: 'rgba(216,128,16,0.15)',
                border: '1px solid rgba(216,128,16,0.35)',
                color: '#d88010',
              }}
            >
              {t('close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Sekcja poradnika z nagłówkiem (ikona + tytuł). */
function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-orbitron tracking-wider mb-3 flex items-center gap-2" style={{ color: '#d88010' }}>
        <span>{icon}</span>
        <span>{title}</span>
      </h2>
      {children}
    </div>
  );
}

/** Stylizowane pudełko na diagram łańcucha produkcyjnego. */
function DiagramBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-4 my-2"
      style={{
        background: 'rgba(0,0,0,0.4)',
        border: '1px solid rgba(216,128,16,0.12)',
      }}
    >
      {children}
    </div>
  );
}

/** Kolorowy badge/chip używany w diagramach. */
function Chip({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      className="px-2 py-0.5 rounded-md text-xs font-bold"
      style={{ background: `${color}22`, border: `1px solid ${color}55`, color }}
    >
      {children}
    </span>
  );
}

/** Strzałka kierunku w diagramie, opcjonalnie z etykietą. */
function Arrow({ label }: { label?: string }) {
  return (
    <span className="flex flex-col items-center text-white/30 mx-1">
      {label && <span className="text-[8px] text-white/20 mb-0.5">{label}</span>}
      <span>→</span>
    </span>
  );
}
