import { useState, useEffect } from 'react';
import { GameEngine } from '../game/engine';
import { supabase } from '../lib/supabase';

interface Props {
  engine: GameEngine;
  onClose: () => void;
}

export default function SaveLoad({ engine, onClose }: Props) {
  const [saves, setSaves] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => { loadSaves(); }, []);

  const loadSaves = async () => {
    const { data, error } = await supabase.from('game_saves').select('*').order('created_at', { ascending: false });
    if (error) { setMessage('Could not load saves'); return; }
    setSaves(data || []);
  };

  const handleSave = async () => {
    setSaving(true); setMessage('');
    const state = engine.getSerializableState();
    const { error } = await supabase.from('game_saves').insert({ save_data: state, name: `Save ${new Date().toLocaleString()}` });
    if (error) setMessage('Save failed: ' + error.message);
    else { setMessage('Game saved successfully!'); loadSaves(); }
    setSaving(false);
  };

  const handleLoad = async (id: string) => {
    setLoading(true); setMessage('');
    const { data, error } = await supabase.from('game_saves').select('save_data').eq('id', id).maybeSingle();
    if (error || !data) { setMessage('Load failed'); setLoading(false); return; }
    const saveData = data.save_data;
    if (saveData.player) engine.state.player = { ...engine.state.player, ...saveData.player };
    if (saveData.tick) engine.state.tick = saveData.tick;
    if (saveData.pollution !== undefined) engine.state.pollution = saveData.pollution;
    if (saveData.evolution !== undefined) engine.state.evolution = saveData.evolution;
    if (saveData.dayTime !== undefined) engine.state.dayTime = saveData.dayTime;
    if (saveData.weather) engine.state.weather = saveData.weather;
    if (saveData.statistics) engine.state.statistics = saveData.statistics;
    if (saveData.buildings) {
      engine.state.buildings.clear(); engine.state.conveyors.clear();
      for (const [key, building] of saveData.buildings) engine.state.buildings.set(key, building);
    }
    if (saveData.research) {
      for (const [key, val] of saveData.research) {
        const r = engine.state.research.get(key);
        if (r) Object.assign(r, val);
      }
    }
    setMessage('Game loaded!'); setLoading(false); onClose();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('game_saves').delete().eq('id', id);
    loadSaves();
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-md" onClick={onClose}>
      <div
        className="panel-glass rounded-2xl p-5 max-w-md w-full mx-4 animate-slide-up font-exo"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5 pb-3" style={{ borderBottom: '1px solid rgba(148,163,184,0.15)' }}>
          <h2 className="font-orbitron font-bold text-lg text-white/80 tracking-wider">SAVE / LOAD</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-all text-sm font-orbitron">✕</button>
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-shine w-full py-3 mb-4 text-sm font-bold rounded-xl transition-all disabled:opacity-40 hover:opacity-90 active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #166534, #22c55e)',
            color: 'white',
            boxShadow: '0 0 20px rgba(34,197,94,0.2)',
          }}
        >
          {saving ? '⏳ Saving...' : '💾 Save Game'}
        </button>

        {message && (
          <div
            className="text-xs text-center mb-4 py-1.5 rounded-lg font-semibold"
            style={{
              background: message.includes('fail') ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
              color: message.includes('fail') ? '#f87171' : '#4ade80',
              border: `1px solid ${message.includes('fail') ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`,
            }}
          >{message}</div>
        )}

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {saves.length === 0 && (
            <div className="text-center py-8">
              <div className="text-white/15 text-sm">No saves found</div>
              <div className="text-white/10 text-xs mt-1">Create your first save above</div>
            </div>
          )}
          {saves.map(save => (
            <div key={save.id} className="flex items-center justify-between p-3 rounded-xl transition-all"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-white/80 font-medium truncate">{save.name}</div>
                <div className="text-[10px] text-white/25 font-mono mt-0.5">{new Date(save.created_at).toLocaleString()}</div>
              </div>
              <div className="flex gap-1.5 ml-3 flex-shrink-0">
                <button onClick={() => handleLoad(save.id)} disabled={loading}
                  className="px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all hover:opacity-90"
                  style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.25)' }}>
                  Load
                </button>
                <button onClick={() => handleDelete(save.id)}
                  className="px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all hover:opacity-90"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                  Del
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
