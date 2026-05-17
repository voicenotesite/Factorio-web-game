import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Props {
  friendId: string;
  friendName: string;
  onClose: () => void;
}

export default function VisitWorldView({ friendId, friendName, onClose }: Props) {
  const [status, setStatus] = useState<'loading' | 'noSave' | 'loaded'>('loading');
  const [saveInfo, setSaveInfo] = useState<{ tick: number; buildings: number; timestamp: number } | null>(null);

  useEffect(() => {
    supabase
      .from('world_snapshots')
      .select('tick, building_count, updated_at')
      .eq('user_id', friendId)
      .single()
      .then(({ data }) => {
        if (data) {
          setSaveInfo({ tick: data.tick, buildings: data.building_count, timestamp: new Date(data.updated_at).getTime() });
          setStatus('loaded');
        } else {
          setStatus('noSave');
        }
      });
  }, [friendId]);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-md" onClick={onClose}>
      <div
        className="rounded-2xl p-6 w-full max-w-sm mx-4 font-exo"
        style={{
          background: 'linear-gradient(180deg, #0f1418 0%, #0a0d11 100%)',
          border: '1px solid rgba(56,189,248,0.2)',
          borderTop: '1px solid rgba(56,189,248,0.4)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2 className="font-orbitron font-bold text-base text-white/80 tracking-wider mb-4">🌍 World: {friendName}</h2>
        {status === 'loading' && <div className="text-white/40 text-sm text-center py-6">Loading...</div>}
        {status === 'noSave' && <div className="text-white/40 text-sm text-center py-6">This player hasn't shared their world yet.</div>}
        {status === 'loaded' && saveInfo && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl text-xs font-mono" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-white/40">Tick: <span className="text-white/70">{saveInfo.tick}</span></div>
              <div className="text-white/40">Buildings: <span className="text-white/70">{saveInfo.buildings}</span></div>
              <div className="text-white/40">Last save: <span className="text-white/70">{new Date(saveInfo.timestamp).toLocaleString()}</span></div>
            </div>
            <p className="text-xs text-white/30 text-center">Full world visiting — coming soon!</p>
          </div>
        )}
        <button onClick={onClose} className="w-full mt-4 py-2.5 rounded-xl text-sm font-orbitron text-white/40 hover:text-white/70 transition-colors" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
          Close
        </button>
      </div>
    </div>
  );
}
