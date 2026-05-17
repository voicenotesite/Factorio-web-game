import { useEffect, useRef } from 'react';
import { GameEngine } from '../game/engine';

interface Props {
  engineRef: React.MutableRefObject<GameEngine | null>;
  onEngineReady: (engine: GameEngine) => void;
}

export default function GameCanvas({ engineRef, onEngineReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const engine = new GameEngine(canvas);
    engineRef.current = engine;
    onEngineReady(engine);
    engine.start();

    // Touch handling
    let touchStartX = 0, touchStartY = 0, touchStartTime = 0;
    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchStartTime = Date.now();
    };
    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartX;
      const dy = touch.clientY - touchStartY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const elapsed = Date.now() - touchStartTime;
      if (dist < 10 && elapsed < 300) {
        const clickEvent = new MouseEvent('mousedown', {
          clientX: touch.clientX,
          clientY: touch.clientY,
          bubbles: true,
        });
        canvas.dispatchEvent(clickEvent);
        const upEvent = new MouseEvent('mouseup', {
          clientX: touch.clientX,
          clientY: touch.clientY,
          bubbles: true,
        });
        canvas.dispatchEvent(upEvent);
      }
    };
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      // two-finger pan reserved for future zoom
    };
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      engine.stop();
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full"
      style={{ cursor: 'crosshair' }}
    />
  );
}
