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
import GuideMenu from './components/GuideMenu';
import LangSelector from './components/LangSelector';
import { GameEngine } from './game/engine';
import { GameState } from './game/types';
import { getCurrentUser, logout, getCurrentUserId } from './lib/auth';
import { saveGame, loadGame, hasSave } from './lib/saveSystem';
import { supabase } from './lib/supabase';
import { t } from './lib/i18n';

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;

function App() {
  const engineRef = useRef<GameEngine | null>(null);

  useEffect(() => { document.title = t('gameTitle'); }, []);
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
  const [showGuide, setShowGuide] = useState(false);
  const [saveCooldown, setSaveCooldown] = useState(0);
  const [showSaveOverlay, setShowSaveOverlay] = useState(false);
  const [coopMode, setCoopMode] = useState(false);
  const [coopOnline, setCoopOnline] = useState(0);
  const coopChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const coopPosIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveCooldownRef = useRef(0);
  const coopModeRef = useRef(false);
  saveCooldownRef.current = saveCooldown;
  coopModeRef.current = coopMode;

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
    engine.onBuildingAction = (action, type, x, y, dir) => {
      if (!coopModeRef.current || !coopChannelRef.current) return;
      const myId = getCurrentUserId();
      if (!myId) return;
      coopChannelRef.current.send({
        type: 'broadcast', event: action === 'place' ? 'build_place' : 'build_remove',
        payload: { type, x, y, dir, senderId: myId },
      });
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
    if (!started || !currentUser) return;
    const interval = setInterval(() => {
      if (engineRef.current && saveCooldownRef.current <= 0) {
        setSaveCooldown(10);
        saveGame(currentUser, engineRef.current.state);
      }
    }, 10000);
    const handleUnload = () => {
      if (engineRef.current && currentUser) {
        saveGame(currentUser, engineRef.current.state);
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [started, currentUser]);

  useEffect(() => {
    if (!started || !hasSaveData || !currentUser) return;
    // Wait for engine to be ready (GameCanvas effect runs before App effects)
    const tryLoad = () => {
      const eng = engineRef.current;
      if (!eng) { setTimeout(tryLoad, 100); return; }
      const save = loadGame(currentUser);
      if (save) {
        eng.loadFromSave(save);
      }
    };
    setTimeout(tryLoad, 300);
    setHasSaveData(false);
  }, [started, hasSaveData, currentUser]);

  // Save cooldown countdown effect
  useEffect(() => {
    if (saveCooldown <= 0) return;
    const t2 = setInterval(() => {
      setSaveCooldown(prev => {
        if (prev <= 1) {
          setShowSaveOverlay(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t2);
  }, [saveCooldown]);

  const triggerSave = useCallback(() => {
    if (!currentUser || !engineRef.current || saveCooldown > 0) return;
    setSaveCooldown(10);
    setShowSaveOverlay(true);
    saveGame(currentUser, engineRef.current.state);
  }, [currentUser, saveCooldown]);

  // Co-op: real-time multiplayer via Supabase Realtime
  useEffect(() => {
    if (!started || !currentUser || !engine) return;
    const myId = getCurrentUserId();
    if (!myId) return;

    const channel = supabase
      .channel(`coop-${myId}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'pos' }, ({ payload }) => {
        const { id, username, x, y, color } = payload as any;
        if (id !== myId) engine.updateCoopVisitor(id, username, x, y, color);
      })
      .on('broadcast', { event: 'leave' }, ({ payload }) => {
        engine.removeCoopVisitor((payload as any).id);
      })
      .on('broadcast', { event: 'build_place' }, ({ payload }) => {
        const { type, x, y, dir, senderId } = payload as any;
        if (senderId !== myId) engine.placeBuildingFromCoop(type, x, y, dir);
      })
      .on('broadcast', { event: 'build_remove' }, ({ payload }) => {
        const { x, y, senderId } = payload as any;
        if (senderId !== myId) engine.removeBuildingFromCoop(x, y);
      })
      .subscribe();

    coopChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      coopChannelRef.current = null;
    };
  }, [started, currentUser, engine]);

  // Co-op: periodic position broadcast
  useEffect(() => {
    if (!started || !currentUser || !coopMode || !engine) return;
    const myId = getCurrentUserId();
    if (!myId) return;
    const myColor = '#3388ee';

    const interval = setInterval(() => {
      if (!engine.running || !coopChannelRef.current) return;
      coopChannelRef.current.send({
        type: 'broadcast', event: 'pos',
        payload: { id: myId, username: currentUser, x: engine.state.player.x, y: engine.state.player.y, color: myColor },
      });
    }, 200);
    coopPosIntervalRef.current = interval;

    return () => {
      clearInterval(interval);
      coopPosIntervalRef.current = null;
    };
  }, [started, currentUser, coopMode, engine]);

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
      {currentUser && started && isMobile && engine && gameState && (
        <MobileControls
          engine={engine}
          gameState={gameState}
          currentUser={currentUser}
          onBuild={() => setShowBuild(true)}
          onCraft={() => setShowInventory(true)}
          onResearch={() => setShowResearch(true)}
          onStats={() => setShowStats(true)}
          onSave={() => setShowSaveLoad(true)}
          onFriends={() => setShowFriends(true)}
          onAdmin={() => setShowAdmin(true)}
          onGuide={() => setShowGuide(true)}
          onLogout={() => { logout(); setCurrentUser(null); setStarted(false); }}
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
          <ActionBarBtn label={t('actionBuild')} shortcut="B" onClick={() => setShowBuild(true)} active={showBuild}
            icon={<WrenchIcon />} color="#f59e0b" />
          <ActionBarBtn label={t('actionResearch')} shortcut="R" onClick={() => setShowResearch(true)} active={showResearch}
            icon={<FlaskIcon />} color="#38bdf8" />
          <ActionBarBtn label={t('actionCraft')} shortcut="I" onClick={() => setShowInventory(true)} active={showInventory}
            icon={<PackageIcon />} color="#22c55e" />
          <ActionBarBtn label={t('actionStats')} shortcut="Tab" onClick={() => setShowStats(true)} active={showStats}
            icon={<ChartIcon />} color="#a78bfa" />
          <ActionBarBtn label={t('actionRanks')} shortcut="L" onClick={() => setShowLeaderboard(true)} active={showLeaderboard}
            icon={<TrophyIcon />} color="#fbbf24" />
          <ActionBarBtn label={t('actionShop')} shortcut="P" onClick={() => setShowShop(true)} active={showShop}
            icon={<GemIcon />} color="#06b6d4" />
          <ActionBarBtn label={t('actionFriends')} shortcut="" onClick={() => setShowFriends(true)} active={showFriends}
            icon={<FriendsIcon />} color="#f472b6" />
          {currentUser?.toUpperCase() === 'ADMIN' && (
            <>
              <div className="w-px h-6 mx-1" style={{ background: 'rgba(220,38,38,0.3)' }} />
              <ActionBarBtn label={t('actionAdmin')} shortcut="" onClick={() => setShowAdmin(true)} active={showAdmin}
                icon={<span>🛡️</span>} color="#ef4444" />
            </>
          )}
          <div className="w-px h-6 mx-1" style={{ background: 'rgba(245,158,11,0.15)' }} />
          <ActionBarBtn label={t('guide')} shortcut="" onClick={() => setShowGuide(true)} active={showGuide}
            icon={<span>📖</span>} color="#22d3ee" />
          <div className="w-px h-6 mx-1" style={{ background: 'rgba(245,158,11,0.15)' }} />
          <ActionBarBtn label={saveCooldown > 0 ? `⏳ ${saveCooldown}s` : t('actionSave')} shortcut="" onClick={triggerSave} active={saveCooldown > 0}
            icon={<SaveIcon />} color={saveCooldown > 0 ? '#22c55e' : '#94a3b8'} />
          <ActionBarBtn label={t('actionLoad')} shortcut="" onClick={() => setShowSaveLoad(true)} active={showSaveLoad}
            icon={<span>📂</span>} color="#60a5fa" />
          <div className="w-px h-6 mx-1" style={{ background: 'rgba(245,158,11,0.15)' }} />
          <ActionBarBtn label={t(coopMode ? 'actionCoopOn' : 'actionCoop')} shortcut="" onClick={() => {
            if (coopMode && coopChannelRef.current) {
              const myId = getCurrentUserId();
              coopChannelRef.current.send({ type: 'broadcast', event: 'leave', payload: { id: myId } });
            }
            setCoopMode(p => !p);
          }} active={coopMode}
            icon={<span>🌐</span>} color="#f472b6" />
          <div className="w-px h-6 mx-1" style={{ background: 'rgba(245,158,11,0.15)' }} />
          <button
            onClick={() => { logout(); setCurrentUser(null); setStarted(false); }}
            className="btn-factory flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all"
            style={{ background: 'transparent', border: '1px solid transparent' }}
            title={`${t('actionLogout')} (${currentUser})`}
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
          <div className="w-px h-6 mx-1" style={{ background: 'rgba(245,158,11,0.15)' }} />
          <LangSelector />
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
          <span className="text-white/40">{t('placing')}</span>
          <span className="font-semibold text-emerald-400">{engine.selectedBuilding.replace(/_/g, ' ')}</span>
          <span className="text-white/25 ml-2">· {t('direction')}: <span className="text-white/40">{engine.selectedDirection.toUpperCase()}</span></span>
          <span className="text-white/20 ml-2 text-xs">{t('rotateHint')}</span>
        </div>
      )}

      {/* Menus */}
      {showBuild && engine && gameState && <BuildMenu engine={engine} state={gameState} onClose={() => setShowBuild(false)} />}
      {showResearch && engine && gameState && <ResearchMenu engine={engine} state={gameState} onClose={() => setShowResearch(false)} />}
      {showInventory && engine && gameState && <InventoryMenu engine={engine} state={gameState} onClose={() => setShowInventory(false)} />}
      {showStats && gameState && <StatsMenu state={gameState} onClose={() => setShowStats(false)} />}
      {showLeaderboard && <LeaderboardMenu onClose={() => setShowLeaderboard(false)} />}
      {showShop && engine && gameState && <ShopMenu engine={engine} state={gameState} onClose={() => setShowShop(false)} />}
      {showSaveLoad && engine && <SaveLoad engine={engine} onClose={() => setShowSaveLoad(false)} saveCooldown={saveCooldown} onSave={triggerSave} />}
      {showFriends && <FriendsPanel onClose={() => setShowFriends(false)} onVisitWorld={(id, name) => setVisitingWorld({ id, name })} />}
      {showAdmin && engine && gameState && <AdminPanel engine={engine} state={gameState} onClose={() => setShowAdmin(false)} />}
      {visitingWorld && <VisitWorldView friendId={visitingWorld.id} friendName={visitingWorld.name} onClose={() => setVisitingWorld(null)} />}
      {showGuide && <GuideMenu onClose={() => setShowGuide(false)} />}
      {showPremiumPopup && (
        <PremiumPopup
          onClose={() => setShowPremiumPopup(false)}
          onDontAsk={() => { localStorage.setItem('novactorio_no_premium_popup', '1'); setShowPremiumPopup(false); }}
          onBuyPremium={() => setShowShop(true)}
        />
      )}

      {/* Save cooldown overlay */}
      {showSaveOverlay && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
          <div className="animate-slide-up text-center" style={{
            background: 'rgba(0,0,0,0.75)',
            border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: '20px',
            padding: '30px 50px',
            boxShadow: '0 0 60px rgba(34,197,94,0.15), inset 0 1px 0 rgba(34,197,94,0.08)',
            backdropFilter: 'blur(8px)',
          }}>
            <div className="font-orbitron font-black text-sm tracking-[0.3em] mb-1" style={{ color: '#4ade80' }}>
              ZAPISYWANIE STANU GRY
            </div>
            <div className="font-mono text-5xl font-bold animate-pulse" style={{ color: '#22c55e' }}>
              {saveCooldown}s
            </div>
            <div className="w-full h-1 mt-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div className="h-full rounded-full transition-all duration-1000 ease-linear"
                style={{
                  width: `${(saveCooldown / 10) * 100}%`,
                  background: 'linear-gradient(90deg, #166534, #22c55e)',
                  boxShadow: '0 0 8px rgba(34,197,94,0.5)',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* COOP mode indicator */}
      {coopMode && started && currentUser && (
        <div className="fixed bottom-24 left-4 z-20 px-3 py-1.5 rounded-xl text-[10px] font-orbitron tracking-wider"
          style={{
            background: 'rgba(244,114,182,0.12)',
            border: '1px solid rgba(244,114,182,0.3)',
            color: '#f472b6',
            boxShadow: '0 0 15px rgba(244,114,182,0.1)',
          }}
        >
          🌐 {t('coopActive')}
        </div>
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
            <div className="text-red-400 text-2xl mb-3 font-orbitron">{t('gameError')}</div>
            <div className="text-white/50 text-sm mb-4 max-w-xs">{this.state.error}</div>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 rounded-lg text-sm font-orbitron"
              style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171' }}
            >
              {t('reloadGame')}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

