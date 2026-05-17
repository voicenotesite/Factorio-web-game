import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentUser, getCurrentUserId } from '../lib/auth';
import { GameEngine } from '../game/engine';

interface Props {
  friendId: string;
  friendName: string;
  onClose: () => void;
}

const VISITOR_COLORS = ['#f472b6', '#34d399', '#60a5fa', '#fbbf24', '#a78bfa', '#fb923c'];
function colorFromId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
  return VISITOR_COLORS[Math.abs(h) % VISITOR_COLORS.length];
}

export default function VisitWorldView({ friendId, friendName, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [status, setStatus] = useState<'loading' | 'noSave' | 'loaded' | 'error'>('loading');
  const [visitorCount, setVisitorCount] = useState(0);
  const myId = getCurrentUserId() || 'anon';
  const myName = getCurrentUser() || 'Visitor';
  const myColor = colorFromId(myId);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener('resize', resize);

    let cleanup: (() => void) | undefined;

    supabase
      .from('world_snapshots')
      .select('world_data, tick, building_count, username')
      .eq('user_id', friendId)
      .single()
      .then(({ data, error }) => {
        if (error || !data?.world_data) { setStatus('noSave'); return; }

        try {
          const worldData = JSON.parse(data.world_data);

          const engine = new GameEngine(canvas);
          engine.loadWorldData(worldData);
          engine.start();
          engineRef.current = engine;
          setStatus('loaded');

          const channel = supabase
            .channel(`coop-${friendId}`, { config: { broadcast: { self: false } } })
            .on('broadcast', { event: 'pos' }, ({ payload }) => {
              const { id, username, x, y, color } = payload as any;
              if (id !== myId) {
                engine.updateCoopVisitor(id, username, x, y, color);
                setVisitorCount(engine.state.coopVisitors?.size ?? 0);
              }
            })
            .on('broadcast', { event: 'leave' }, ({ payload }) => {
              engine.removeCoopVisitor((payload as any).id);
              setVisitorCount(engine.state.coopVisitors?.size ?? 0);
            })
            .subscribe();

          const posInterval = setInterval(() => {
            if (!engine.running) return;
            channel.send({
              type: 'broadcast', event: 'pos',
              payload: { id: myId, username: myName, x: engine.state.player.x, y: engine.state.player.y, color: myColor },
            });
          }, 500);

          channel.send({ type: 'broadcast', event: 'pos', payload: { id: myId, username: myName, x: 0, y: 0, color: myColor } });

          cleanup = () => {
            clearInterval(posInterval);
            channel.send({ type: 'broadcast', event: 'leave', payload: { id: myId } });
            supabase.removeChannel(channel);
            engine.stop();
          };
        } catch {
          setStatus('error');
        }
      });

    return () => {
      window.removeEventListener('resize', resize);
      cleanup?.();
    };
  }, [friendId]);

  const isMobile = window.innerWidth < 768;

  return (
    <div className="fixed inset-0 z-40">
      {status === 'loading' && (
        <div className="fixed inset-0 flex items-center justify-center bg-black z-50">
          <div className="text-white/60 font-orbitron text-sm animate-pulse">🌍 Loading {friendName}'s world...</div>
        </div>
      )}
      {status === 'noSave' && (
        <div className="fixed inset-0 flex items-center justify-center bg-black z-50">
          <div className="text-center space-y-4">
            <div className="text-white/50 font-orbitron text-sm">{friendName} hasn't saved a world yet.</div>
            <button onClick={onClose} className="px-6 py-2 rounded-xl font-orbitron text-sm text-white/60 border border-white/10 hover:text-white/80">← Back</button>
          </div>
        </div>
      )}
      {status === 'error' && (
        <div className="fixed inset-0 flex items-center justify-center bg-black z-50">
          <div className="text-center space-y-4">
            <div className="text-red-400 font-orbitron text-sm">Failed to load world</div>
            <button onClick={onClose} className="px-6 py-2 rounded-xl font-orbitron text-sm text-white/60 border border-white/10">← Back</button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="fixed inset-0 w-full h-full" style={{ cursor: 'crosshair' }} />

      {status === 'loaded' && (
        <>
          <div
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2 rounded-xl font-orbitron text-xs"
            style={{ background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(56,189,248,0.3)', color: 'rgba(56,189,248,0.9)' }}
          >
            🌍 Visiting: <span className="font-bold text-white">{friendName}</span>
            {visitorCount > 0 && <span className="text-green-400">· {visitorCount + 1} online</span>}
          </div>

          <button
            onClick={onClose}
            className="fixed top-4 right-4 z-50 px-4 py-2 rounded-xl font-orbitron text-xs text-white/60 hover:text-white/90 transition-colors"
            style={{ background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            ✕ Leave
          </button>

          {!isMobile && (
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 text-[10px] text-white/25 font-orbitron">
              WASD to move · Read-only visit mode
            </div>
          )}
        </>
      )}
    </div>
  );
}
