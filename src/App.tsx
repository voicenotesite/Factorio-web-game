import { useRef, useState, useCallback, useEffect, Component, ReactNode } from 'react';
import GameCanvas from './components/GameCanvas';
import HUD from './components/HUD';
import BuildMenu from './components/BuildMenu';
import ResearchMenu from './components/ResearchMenu';
import InventoryMenu from './components/InventoryMenu';
import StatsMenu from './components/StatsMenu';
import LeaderboardMenu from './components/LeaderboardMenu';
import ShopMenu from './components/ShopMenu';
import BuildingInfo from './components/BuildingInfo';
import SaveLoad from './components/SaveLoad';
import StartScreen from './components/StartScreen';
import AuthScreen from './components/AuthScreen';
import ChatPanel from './components/ChatPanel';
import FriendsPanel from './components/FriendsPanel';
import VisitWorldView from './components/VisitWorldView';
import MobileControls from './components/MobileControls';
import PremiumPopup from './components/PremiumPopup';
import AdminPanel from './components/AdminPanel';
import { GameEngine } from './game/engine';
import { GameState } from './game/types';
import { getCurrentUser, logout, getCurrentUserId } from './lib/auth';
import { saveGame, loadGame, hasSave } from './lib/saveSystem';
import { supabase } from './lib/supabase';

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;

function App() {
  const engineRef = useRef<GameEngine | null>(null);

  useEffect(() => { document.title = 'Novactorio'; }, []);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [started, setStarted] = useState(false);
  const [showBuild, setShowBuild] = useState(false);
  const [showResearch, setShowResearch] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showSaveLoad, setShowSaveLoad] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [visitingWorld, setVisitingWorld] = useState<{ id: string; name: string } | null>(null);
  const [notifications, setNotifications] = useState<{ text: string; timer: number; type?: string }[]>([]);
  const [currentUser, setCurrentUser] = useState<string | null>(getCurrentUser);
  const [hasSaveData, setHasSaveData] = useState(false);
  const [showPremiumPopup, setShowPremiumPopup] = useState(false);

  const engine = engineRef.current;

  const handleEngineReady = useCallback((engine: GameEngine) => {
    engineRef.current = engine;
    engine.onStateChange = (state) => {
      setGameState({ ...state });
      setNotifications([...engine.notifications]);
      if (engine.keys.has('b')) { setShowBuild(prev => !prev); engine.keys.delete('b'); }
      if (engine.keys.has('r')) { setShowResearch(prev => !prev); engine.keys.delete('r'); }
      if (engine.keys.has('i')) { setShowInventory(prev => !prev); engine.keys.delete('i'); }
    };
  }, []);

  const handleAuth = useCallback((username: string, hasSaveDataArg: boolean) => {
    setCurrentUser(username);
    setHasSaveData(hasSaveDataArg);
    // Set world seed based on username so each player gets a unique world
    if (engineRef.current) {
      engineRef.current.setSeedFromUsername(username);
    }
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Don't fire shortcuts when user is typing in any input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'Tab') { e.preventDefault(); setShowStats(prev => !prev); }
      if (e.key === 'l') setShowLeaderboard(prev => !prev);
      if (e.key === 'p') setShowShop(prev => !prev);
      if (e.key === 'Enter' && !started) setStarted(true);
      if (e.key === 'Escape') {
        setShowBuild(false); setShowResearch(false); setShowInventory(false);
        setShowStats(false); setShowLeaderboard(false); setShowShop(false); setShowSaveLoad(false);
        setShowFriends(false);
        if (engineRef.current) engineRef.current.selectedBuilding = null;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [started]);

  useEffect(() => {
    if (currentUser && started && gameState) {
      const noPopup = localStorage.getItem('novactorio_no_premium_popup') === '1';
      if (!noPopup && gameState.player.premiumTier === 'free') {
        const timer = setTimeout(() => setShowPremiumPopup(true), 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [currentUser, started, gameState?.player.premiumTier]);

  useEffect(() => {
    if (!started || !currentUser || !engineRef.current) return;
    const interval = setInterval(() => {
      if (engineRef.current && currentUser) {
        saveGame(currentUser, engineRef.current.state);
        engineRef.current.addNotification('Auto-saved', 'info');
      }
    }, 120000);
    return () => clearInterval(interval);
  }, [started, currentUser]);

  useEffect(() => {
    if (started && hasSaveData && currentUser && engineRef.current) {
      const save = loadGame(currentUser);
      if (save) {
        setTimeout(() => {
          if (engineRef.current) {
            engineRef.current.loadFromSave(save);
          }
        }, 500);
      }
      setHasSaveData(false);
    }
  }, [started, hasSaveData, currentUser]);

  // Co-op: receive visitors in own world
  useEffect(() => {
    if (!started || !currentUser || !engine) return;
    const myId = getCurrentUserId();
    if (!myId) return;

    const channel = supabase
      .channel(`coop-${myId}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'pos' }, ({ payload }) => {
        const { id, username, x, y, color } = payload as any;
        engine.updateCoopVisitor(id, username, x, y, color);
      })
      .on('broadcast', { event: 'leave' }, ({ payload }) => {
        engine.removeCoopVisitor((payload as any).id);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [started, currentUser, engine]);

  return (
    <div className="w-screen h-screen overflow-hidden select-none font-exo" style={{ background: 'var(--bg)' }}>
      {!currentUser && <AuthScreen onAuth={handleAuth} />}
      {currentUser && !started && <StartScreen onStart={() => setStarted(true)} />}
      {currentUser && started && (
        <ErrorBoundary>
          <GameCanvas engineRef={engineRef} onEngineReady={handleEngineReady} />
        </ErrorBoundary>
      )}
      {currentUser && started && gameState && <HUD state={gameState} notifications={notifications} />}
      {currentUser && started && gameState && engine && <BuildingInfo engine={engine} state={gameState} />}

      {/* Mobile controls */}
      {currentUser && started && isMobile && engine && (
        <MobileControls
          engine={engine}
          onBuild={() => setShowBuild(true)}
          onCraft={() => setShowInventory(true)}
          onResearch={() => setShowResearch(true)}
          onStats={() => setShowStats(true)}
          onSave={() => setShowSaveLoad(true)}
        />
      )}

      {/* Chat */}
      {currentUser && started && <ChatPanel />}

      {/* Bottom action bar */}
      {currentUser && started && !isMobile && (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 animate-slide-up"
          style={{
            background: 'linear-gradient(180deg, #111820 0%, #0c1016 100%)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(216,128,16,0.18)',
            borderTop: '1px solid rgba(216,128,16,0.35)',
            borderRadius: '3px',
            padding: '6px 10px',
            boxShadow: 'inset 0 1px 0 rgba(216,128,16,0.08), 0 0 0 1px rgba(0,0,0,0.7), 0 -8px 40px rgba(0,0,0,0.9), 0 0 40px rgba(216,128,16,0.04)',
          }}
        >
          <ActionBarBtn label="Build" shortcut="B" onClick={() => setShowBuild(true)} active={showBuild}
            icon={<WrenchIcon />} color="#f59e0b" />
          <ActionBarBtn label="Research" shortcut="R" onClick={() => setShowResearch(true)} active={showResearch}
            icon={<FlaskIcon />} color="#38bdf8" />
          <ActionBarBtn label="Craft" shortcut="I" onClick={() => setShowInventory(true)} active={showInventory}
            icon={<PackageIcon />} color="#22c55e" />
          <ActionBarBtn label="Stats" shortcut="Tab" onClick={() => setShowStats(true)} active={showStats}
            icon={<ChartIcon />} color="#a78bfa" />
          <ActionBarBtn label="Ranks" shortcut="L" onClick={() => setShowLeaderboard(true)} active={showLeaderboard}
            icon={<TrophyIcon />} color="#fbbf24" />
          <ActionBarBtn label="Shop" shortcut="P" onClick={() => setShowShop(true)} active={showShop}
            icon={<GemIcon />} color="#06b6d4" />
          <ActionBarBtn label="Friends" shortcut="" onClick={() => setShowFriends(true)} active={showFriends}
            icon={<FriendsIcon />} color="#f472b6" />
          {currentUser?.toUpperCase() === 'ADMIN' && (
            <>
              <div className="w-px h-6 mx-1" style={{ background: 'rgba(220,38,38,0.3)' }} />
              <ActionBarBtn label="Admin" shortcut="" onClick={() => setShowAdmin(true)} active={showAdmin}
                icon={<span>🛡️</span>} color="#ef4444" />
            </>
          )}
          <div className="w-px h-6 mx-1" style={{ background: 'rgba(245,158,11,0.15)' }} />
          <ActionBarBtn label="Save" shortcut="" onClick={() => setShowSaveLoad(true)} active={showSaveLoad}
            icon={<SaveIcon />} color="#94a3b8" />
          <div className="w-px h-6 mx-1" style={{ background: 'rgba(245,158,11,0.15)' }} />
          <button
            onClick={() => { logout(); setCurrentUser(null); setStarted(false); }}
            className="btn-factory flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all"
            style={{ background: 'transparent', border: '1px solid transparent' }}
            title={`Logout (${currentUser})`}
          >
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </span>
            <span className="text-[9px] font-orbitron tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>
              {currentUser?.substring(0, 6) || 'OUT'}
            </span>
          </button>
        </div>
      )}

      {/* Placing indicator */}
      {currentUser && engine?.selectedBuilding && (
        <div
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-20 text-sm px-5 py-2.5 rounded-xl font-exo animate-fade-in"
          style={{
            background: 'linear-gradient(180deg, #0f1418 0%, #0a0d11 100%)',
            border: '1px solid rgba(42,54,66,0.9)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 20px rgba(0,0,0,0.6)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <span className="text-white/40">Placing: </span>
          <span className="font-semibold text-emerald-400">{engine.selectedBuilding.replace(/_/g, ' ')}</span>
          <span className="text-white/25 ml-2">· Dir: <span className="text-white/40">{engine.selectedDirection.toUpperCase()}</span></span>
          <span className="text-white/20 ml-2 text-xs">(Q rotate · ESC cancel)</span>
        </div>
      )}

      {/* Menus */}
      {showBuild && engine && gameState && <BuildMenu engine={engine} state={gameState} onClose={() => setShowBuild(false)} />}
      {showResearch && engine && gameState && <ResearchMenu engine={engine} state={gameState} onClose={() => setShowResearch(false)} />}
      {showInventory && engine && gameState && <InventoryMenu engine={engine} state={gameState} onClose={() => setShowInventory(false)} />}
      {showStats && gameState && <StatsMenu state={gameState} onClose={() => setShowStats(false)} />}
      {showLeaderboard && <LeaderboardMenu onClose={() => setShowLeaderboard(false)} />}
      {showShop && engine && gameState && <ShopMenu engine={engine} state={gameState} onClose={() => setShowShop(false)} />}
      {showSaveLoad && engine && <SaveLoad engine={engine} onClose={() => setShowSaveLoad(false)} />}
      {showFriends && <FriendsPanel onClose={() => setShowFriends(false)} onVisitWorld={(id, name) => setVisitingWorld({ id, name })} />}
      {showAdmin && engine && gameState && <AdminPanel engine={engine} state={gameState} onClose={() => setShowAdmin(false)} />}
      {visitingWorld && <VisitWorldView friendId={visitingWorld.id} friendName={visitingWorld.name} onClose={() => setVisitingWorld(null)} />}
      {showPremiumPopup && (
        <PremiumPopup
          onClose={() => setShowPremiumPopup(false)}
          onDontAsk={() => { localStorage.setItem('novactorio_no_premium_popup', '1'); setShowPremiumPopup(false); }}
          onBuyPremium={() => setShowShop(true)}
        />
      )}
    </div>
  );
}

function ActionBarBtn({ label, shortcut, onClick, icon, color, active }: {
  label: string; shortcut: string; onClick: () => void; icon: React.ReactNode; color: string; active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="btn-factory flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-150 group"
      style={{
        background: active ? `${color}18` : 'transparent',
        border: `1px solid ${active ? `${color}40` : 'transparent'}`,
        boxShadow: active ? `0 0 15px ${color}20` : 'none',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = `rgba(216,128,16,0.08)`;
        (e.currentTarget as HTMLElement).style.border = `1px solid rgba(216,128,16,0.25)`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = active ? `${color}14` : 'transparent';
        (e.currentTarget as HTMLElement).style.border = `1px solid ${active ? `${color}35` : 'transparent'}`;
      }}
    >
      <span style={{ color: active ? color : 'rgba(255,255,255,0.5)', filter: active ? `drop-shadow(0 0 6px ${color})` : 'none' }}>
        {icon}
      </span>
      <span className="text-[9px] font-orbitron tracking-wider" style={{ color: active ? color : 'rgba(255,255,255,0.35)' }}>
        {label}
      </span>
      {shortcut && (
        <span className="text-[8px] px-1 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.2)' }}>
          {shortcut}
        </span>
      )}
    </button>
  );
}

const WrenchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);
const FlaskIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 3h6l1 9H8L9 3z" /><path d="M6.4 18.3a2 2 0 0 0 1.8 1.7h7.6a2 2 0 0 0 1.8-1.7L18 12H6l.4 6.3z" />
  </svg>
);
const PackageIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" /><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27,6.96 12,12.01 20.73,6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);
const ChartIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);
const TrophyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="14,9 12,11 10,9" /><path d="M21 4H3v4a9 9 0 0 0 18 0V4z" /><path d="M12 17v4" /><line x1="8" y1="21" x2="16" y2="21" />
  </svg>
);
const GemIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5" /><line x1="12" y1="22" x2="12" y2="15.5" /><polyline points="22,8.5 12,15.5 2,8.5" /><polyline points="2,8.5 12,2 22,8.5" />
  </svg>
);
const SaveIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17,21 17,13 7,13 7,21" /><polyline points="7,3 7,8 15,8" />
  </svg>
);
const FriendsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

export default App;

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-black/90 z-50 font-exo">
          <div className="text-center p-8 rounded-2xl" style={{ background: '#0c1016', border: '1px solid rgba(239,68,68,0.3)' }}>
            <div className="text-red-400 text-2xl mb-3 font-orbitron">⚠ Game Error</div>
            <div className="text-white/50 text-sm mb-4 max-w-xs">{this.state.error}</div>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 rounded-lg text-sm font-orbitron"
              style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171' }}
            >
              Reload Game
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

