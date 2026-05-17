import { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from '../game/engine';

interface Props {
  engine: GameEngine;
  onBuild: () => void;
  onCraft: () => void;
  onResearch: () => void;
  onStats: () => void;
  onSave: () => void;
}

export default function MobileControls({ engine, onBuild, onCraft, onResearch, onStats, onSave }: Props) {
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
          engine.state.camera.x = engine.state.player.x;
          engine.state.camera.y = engine.state.player.y;
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

  return (
    <div className="fixed inset-0 z-10 pointer-events-none" style={{ userSelect: 'none' }}>
      {/* Virtual Joystick - bottom left */}
      <div
        ref={joystickRef}
        className="absolute pointer-events-auto"
        style={{
          bottom: '90px',
          left: '28px',
          width: '100px',
          height: '100px',
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.45)',
          border: '2px solid rgba(216,128,16,0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          touchAction: 'none',
          boxShadow: '0 0 20px rgba(0,0,0,0.5)',
        }}
        onTouchStart={handleJoystickStart}
        onTouchMove={handleJoystickMove}
        onTouchEnd={handleJoystickEnd}
      >
        <div
          ref={knobRef}
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: joystickActive ? 'rgba(216,128,16,0.7)' : 'rgba(216,128,16,0.4)',
            border: '2px solid rgba(216,128,16,0.8)',
            transition: joystickActive ? 'none' : 'transform 0.15s ease',
            boxShadow: '0 0 10px rgba(216,128,16,0.3)',
          }}
        />
      </div>

      {/* Right side action buttons */}
      <div
        className="absolute pointer-events-auto flex flex-col gap-3"
        style={{ bottom: '90px', right: '16px' }}
      >
        <MobileBtn label="BUILD" color="#f59e0b" onClick={onBuild} icon="🔨" />
        <MobileBtn label="CRAFT" color="#22c55e" onClick={onCraft} icon="⚙️" />
        <MobileBtn label="TECH" color="#38bdf8" onClick={onResearch} icon="🔬" />
        <MobileBtn label="STATS" color="#a78bfa" onClick={onStats} icon="📊" />
        <MobileBtn label="SAVE" color="#94a3b8" onClick={onSave} icon="💾" />
      </div>

      {/* Attack/interact button - bottom right center */}
      <div
        className="absolute pointer-events-auto"
        style={{ bottom: '90px', right: '100px' }}
      >
        <button
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'rgba(220,38,38,0.35)',
            border: '2px solid rgba(220,38,38,0.6)',
            color: 'white',
            fontSize: '22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            touchAction: 'none',
            boxShadow: '0 0 15px rgba(220,38,38,0.2)',
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
            document.dispatchEvent(event);
          }}
        >
          ⛏
        </button>
      </div>
    </div>
  );
}

function MobileBtn({ label, color, onClick, icon }: { label: string; color: string; onClick: () => void; icon: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '64px',
        height: '48px',
        borderRadius: '12px',
        background: `rgba(0,0,0,0.55)`,
        border: `1.5px solid ${color}55`,
        color,
        fontSize: '18px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2px',
        touchAction: 'none',
      }}
    >
      <span>{icon}</span>
      <span style={{ fontSize: '7px', fontFamily: 'Orbitron', letterSpacing: '0.05em', opacity: 0.7 }}>{label}</span>
    </button>
  );
}
