import { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from '../game/engine';

interface Props {
  engine: GameEngine;
  currentUser: string;
  onBuild: () => void;
  onCraft: () => void;
  onResearch: () => void;
  onStats: () => void;
  onSave: () => void;
  onFriends: () => void;
  onAdmin: () => void;
}

export default function MobileControls({
  engine, currentUser, onBuild, onCraft, onResearch, onStats, onSave, onFriends, onAdmin,
}: Props) {
  const joystickRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const [joystickActive, setJoystickActive] = useState(false);
  const joystickOrigin = useRef({ x: 0, y: 0 });
  const joystickDelta = useRef({ x: 0, y: 0 });
  const animFrameRef = useRef<number>(0);

  const joystickActiveRef = useRef(false);

  useEffect(() => {
    const tick = () => {
      if (joystickActiveRef.current && engine) {
        const { x, y } = joystickDelta.current;
        const speed = 0.18;
        if (Math.abs(x) > 0.05 || Math.abs(y) > 0.05) {
          engine.state.player.x += x * speed;
          engine.state.player.y += y * speed;
          // camera is handled by engine.updateCamera() — do NOT set it here
        }
      }
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [engine]); // only re-run if engine changes, not on joystick toggle

  const handleJoystickStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const rect = joystickRef.current!.getBoundingClientRect();
    joystickOrigin.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    joystickActiveRef.current = true;
    setJoystickActive(true);
  }, []);

  const handleJoystickMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (!joystickActiveRef.current) return;
    const touch = e.touches[0];
    const maxDist = 40;
    let dx = touch.clientX - joystickOrigin.current.x;
    let dy = touch.clientY - joystickOrigin.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > maxDist) {
      dx = (dx / dist) * maxDist;
      dy = (dy / dist) * maxDist;
    }
    joystickDelta.current = { x: dx / maxDist, y: dy / maxDist };
    if (knobRef.current) {
      knobRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
    }
  }, [joystickActive]);

  const handleJoystickEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    joystickActiveRef.current = false;
    setJoystickActive(false);
    joystickDelta.current = { x: 0, y: 0 };
    if (knobRef.current) {
      knobRef.current.style.transform = 'translate(0, 0)';
    }
  }, []);

  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);

  // Poll engine for selected building
  useEffect(() => {
    const id = setInterval(() => {
      setSelectedBuilding(engine.selectedBuilding);
    }, 100);
    return () => clearInterval(id);
  }, [engine]);

  const isAdmin = currentUser.toUpperCase() === 'ADMIN';

  return (
    <div className="fixed inset-0 z-10 pointer-events-none" style={{ userSelect: 'none' }}>

      {/* ── Top action bar ── */}
      <div
        className="absolute top-14 left-0 right-0 flex justify-center gap-2 pointer-events-auto px-3"
        style={{ zIndex: 11 }}
      >
        <TopBtn label="BUILD" icon="🔨" color="#f59e0b" onClick={onBuild} />
        <TopBtn label="CRAFT" icon="⚙️" color="#22c55e" onClick={onCraft} />
        <TopBtn label="TECH" icon="🔬" color="#38bdf8" onClick={onResearch} />
        <TopBtn label="STATS" icon="📊" color="#a78bfa" onClick={onStats} />
        <TopBtn label="FRIENDS" icon="👥" color="#f472b6" onClick={onFriends} />
        {isAdmin && (
          <TopBtn label="ADMIN" icon="🛡️" color="#ef4444" onClick={onAdmin} />
        )}
      </div>

      {/* ── Virtual Joystick — bottom left ── */}
      <div
        ref={joystickRef}
        className="absolute pointer-events-auto"
        style={{
          bottom: '28px',
          left: '28px',
          width: '108px',
          height: '108px',
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.5)',
          border: '2px solid rgba(216,128,16,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          touchAction: 'none',
          boxShadow: '0 0 24px rgba(0,0,0,0.6)',
        }}
        onTouchStart={handleJoystickStart}
        onTouchMove={handleJoystickMove}
        onTouchEnd={handleJoystickEnd}
      >
        <div
          ref={knobRef}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: joystickActive ? 'rgba(216,128,16,0.75)' : 'rgba(216,128,16,0.45)',
            border: '2px solid rgba(216,128,16,0.9)',
            transition: joystickActive ? 'none' : 'transform 0.15s ease',
            boxShadow: joystickActive ? '0 0 20px rgba(216,128,16,0.6)' : '0 0 10px rgba(216,128,16,0.2)',
          }}
        />
      </div>

      {/* ── Mine + Attack buttons — bottom right ── */}
      <div
        className="absolute pointer-events-auto flex flex-col gap-3"
        style={{ bottom: '28px', right: '20px' }}
      >
        <AttackHoldBtn engine={engine} />
        <MineHoldBtn engine={engine} />
      </div>

      {/* ── Save button — right side, mid ── */}
      <div
        className="absolute pointer-events-auto"
        style={{ bottom: '160px', right: '20px' }}
      >
        <SideBtn icon="💾" color="#94a3b8" onClick={onSave} label="SAVE" />
      </div>

      {/* ── Cancel building banner ── */}
      {selectedBuilding && (
        <div
          className="absolute pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-2xl"
          style={{
            bottom: '155px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, #0f1418, #0a0d11)',
            border: '1.5px solid rgba(56,189,248,0.5)',
            boxShadow: '0 0 20px rgba(56,189,248,0.2)',
            zIndex: 15,
          }}
        >
          <span className="text-xs text-white/50 font-exo">Placing:</span>
          <span className="text-sm font-bold text-sky-400 font-exo">{selectedBuilding.replace(/_/g, ' ')}</span>
          <button
            className="ml-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
            style={{
              background: 'rgba(239,68,68,0.25)',
              border: '1px solid rgba(239,68,68,0.5)',
              color: '#f87171',
              touchAction: 'none',
            }}
            onTouchEnd={(e) => { e.preventDefault(); engine.cancelBuilding(); }}
            onClick={() => engine.cancelBuilding()}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

function AttackHoldBtn({ engine }: { engine: import('../game/engine').GameEngine }) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [pressed, setPressed] = useState(false);
  const [flash, setFlash] = useState(false);

  const start = (e: React.TouchEvent) => {
    e.preventDefault();
    setPressed(true);
    const hit = engine.attackNearestEnemy();
    if (hit) { setFlash(true); setTimeout(() => setFlash(false), 120); }
    intervalRef.current = setInterval(() => {
      const h = engine.attackNearestEnemy();
      if (h) { setFlash(true); setTimeout(() => setFlash(false), 120); }
    }, 350);
  };

  const stop = (e: React.TouchEvent) => {
    e.preventDefault();
    setPressed(false);
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  };

  return (
    <button
      style={{
        width: '64px', height: '64px', borderRadius: '50%',
        background: flash ? 'rgba(251,191,36,0.7)' : pressed ? 'rgba(251,191,36,0.45)' : 'rgba(251,191,36,0.2)',
        border: '2px solid rgba(251,191,36,0.7)', color: 'white', fontSize: '26px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none',
        boxShadow: pressed ? '0 0 28px rgba(251,191,36,0.6)' : '0 0 14px rgba(251,191,36,0.2)',
        transform: pressed ? 'scale(0.88)' : 'scale(1)',
        transition: 'transform 0.08s ease, box-shadow 0.08s ease, background 0.08s ease',
      }}
      onTouchStart={start} onTouchEnd={stop} onTouchCancel={stop}
    >⚔️</button>
  );
}

function MineHoldBtn({ engine }: { engine: import('../game/engine').GameEngine }) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [pressed, setPressed] = useState(false);

  const start = (e: React.TouchEvent) => {
    e.preventDefault();
    setPressed(true);
    engine.mineInFront();
    intervalRef.current = setInterval(() => engine.mineInFront(), 200);
  };

  const stop = (e: React.TouchEvent) => {
    e.preventDefault();
    setPressed(false);
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  };

  return (
    <button
      style={{
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        background: pressed ? 'rgba(220,38,38,0.55)' : 'rgba(220,38,38,0.35)',
        border: '2px solid rgba(220,38,38,0.6)',
        color: 'white',
        fontSize: '22px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        touchAction: 'none',
        boxShadow: pressed ? '0 0 25px rgba(220,38,38,0.5)' : '0 0 15px rgba(220,38,38,0.2)',
        transform: pressed ? 'scale(0.88)' : 'scale(1)',
        transition: 'transform 0.08s ease, box-shadow 0.08s ease, background 0.08s ease',
      }}
      onTouchStart={start}
      onTouchEnd={stop}
      onTouchCancel={stop}
    >
      ⛏
    </button>
  );
}


function TopBtn({ label, icon, color, onClick }: { label: string; icon: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        maxWidth: '72px',
        height: '44px',
        borderRadius: '10px',
        background: 'rgba(0,0,0,0.65)',
        border: `1.5px solid ${color}44`,
        color,
        fontSize: '16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2px',
        touchAction: 'none',
        boxShadow: `0 0 10px ${color}22`,
      }}
    >
      <span>{icon}</span>
      <span style={{ fontSize: '6px', fontFamily: 'Orbitron', letterSpacing: '0.05em', opacity: 0.65 }}>{label}</span>
    </button>
  );
}

function SideBtn({ icon, color, onClick, label }: { icon: string; color: string; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '44px',
        height: '44px',
        borderRadius: '10px',
        background: 'rgba(0,0,0,0.65)',
        border: `1.5px solid ${color}44`,
        color,
        fontSize: '18px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1px',
        touchAction: 'none',
      }}
    >
      <span>{icon}</span>
      <span style={{ fontSize: '6px', fontFamily: 'Orbitron', opacity: 0.5 }}>{label}</span>
    </button>
  );
}

