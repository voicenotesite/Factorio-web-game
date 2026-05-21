import { useEffect, useRef } from 'react';
import { GameEngine } from '../game/engine';

/** Props Canvas — ref do engine (wstrzykiwany z App) i callback po utworzeniu silnika. */
interface Props {
  engineRef: React.MutableRefObject<GameEngine | null>;
  onEngineReady: (engine: GameEngine) => void;
}

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
/** Skala renderowania — zmniejsza rozdzielczość canvas aby zredukować pixel fill rate. */
const RENDER_SCALE = isMobile ? 0.5 : 0.75;

/** Główny Canvas gry — tworzy GameEngine, podpina ref i callback onEngineReady. */
export default function GameCanvas({ engineRef, onEngineReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = Math.max(1, Math.round(window.innerWidth * RENDER_SCALE));
      canvas.height = Math.max(1, Math.round(window.innerHeight * RENDER_SCALE));
    };
    resize();
    window.addEventListener('resize', resize);

    const engine = new GameEngine(canvas);
    engineRef.current = engine;
    onEngineReady(engine);
    engine.start();

    return () => {
      engine.stop();
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full"
      style={{ cursor: 'crosshair', imageRendering: 'pixelated' }}
    />
  );
}
