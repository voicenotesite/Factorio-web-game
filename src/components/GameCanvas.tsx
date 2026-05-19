import { useEffect, useRef } from 'react';
import { GameEngine } from '../game/engine';

/** Props komponentu GameCanvas — ref do silnika i callback po inicjalizacji. */
interface Props {
  engineRef: React.MutableRefObject<GameEngine | null>;
  onEngineReady: (engine: GameEngine) => void;
}

/** Główne płótno Canvas — tworzy GameEngine, zarządza resizingiem okna i czyści przy odmontowaniu. */
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

    return () => {
      engine.stop();
      window.removeEventListener('resize', resize);
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
