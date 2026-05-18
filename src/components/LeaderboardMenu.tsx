import { useState, useEffect } from 'react';
import { t } from '../lib/i18n';
import { supabase } from '../lib/supabase';

interface LeaderboardEntry {
  id: string;
  player_name: string;
  level: number;
  score: number;
  time_played: number;
  buildings_placed: number;
  enemies_killed: number;
  research_completed: number;
}

const ACHIEVEMENTS = [
  { id: 'first_iron', name: 'First Iron', description: 'Mine your first iron ore', icon: '⛏' },
  { id: 'first_plate', name: 'First Plate', description: 'Smelt your first iron plate', icon: '▣' },
  { id: 'factory_10', name: 'Small Factory', description: 'Place 10 buildings', icon: '🏠' },
  { id: 'factory_50', name: 'Medium Factory', description: 'Place 50 buildings', icon: '🏢' },
  { id: 'factory_100', name: 'Large Factory', description: 'Place 100 buildings', icon: '🏭' },
  { id: 'first_kill', name: 'First Blood', description: 'Kill your first enemy', icon: '⚔' },
  { id: 'veteran', name: 'Veteran', description: 'Kill 100 enemies', icon: '🏅' },
  { id: 'researcher', name: 'Researcher', description: 'Complete first research', icon: '🔬' },
  { id: 'oil_baron', name: 'Oil Baron', description: 'Build a pumpjack', icon: '🏭' },
  { id: 'level_5', name: 'Rising Star', description: 'Reach level 5', icon: '⭐' },
  { id: 'level_10', name: 'Factory Master', description: 'Reach level 10', icon: '👑' },
  { id: 'level_25', name: 'Industrial Titan', description: 'Reach level 25', icon: '💎' },
  { id: 'marathon', name: 'Marathon', description: 'Play for 1 hour', icon: '⏱' },
  { id: 'rocket_science', name: 'Rocket Science', description: 'Complete all research', icon: '🚀' },
];

interface Props {
  onClose: () => void;
}

export default function LeaderboardMenu({ onClose }: Props) {
  const [tab, setTab] = useState<'leaderboard' | 'achievements'>('leaderboard');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [unlockedAchievements, setUnlockedAchievements] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tab === 'leaderboard') fetchLeaderboard();
    else fetchAchievements();
  }, [tab]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('leaderboards').select('*').order('score', { ascending: false }).limit(20);
    if (!error && data) setLeaderboard(data as LeaderboardEntry[]);
    setLoading(false);
  };

  const fetchAchievements = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('achievements').select('achievement_id');
    if (!error && data) setUnlockedAchievements(new Set(data.map((a: { achievement_id: string }) => a.achievement_id)));
    setLoading(false);
  };

  const formatTime = (ticks: number) => {
    const s = Math.floor(ticks / 60), m = Math.floor(s / 60), h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
  };

  const RANK_COLORS = ['#fbbf24', '#d1d5db', '#d97706', 'rgba(255,255,255,0.3)'];
  const RANK_ICONS = ['🥇', '🥈', '🥉'];

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-md" onClick={onClose}>
      <div
        className="panel-glass rounded-2xl p-5 max-w-2xl w-full mx-4 max-h-[82vh] overflow-hidden animate-slide-up font-exo flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(251,191,36,0.15)' }}>
          <div>
            <h2 className="font-orbitron font-bold text-lg tracking-wider" style={{ color: '#fbbf24' }}>{t('rankings')}</h2>
            <p className="text-xs text-white/30 mt-1">{t('leaderboardSubtitle')}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-all text-sm font-orbitron">✕</button>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 mb-4 p-1 rounded-xl flex-shrink-0" style={{ background: 'rgba(0,0,0,0.3)' }}>
          {(['leaderboard', 'achievements'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-2 px-4 text-sm font-semibold rounded-lg transition-all font-exo capitalize"
              style={{
                background: tab === t ? 'rgba(251,191,36,0.15)' : 'transparent',
                color: tab === t ? '#fbbf24' : 'rgba(255,255,255,0.35)',
                border: `1px solid ${tab === t ? 'rgba(251,191,36,0.3)' : 'transparent'}`,
              }}
            >{t}</button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 flex-col gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
              <div className="text-white/25 text-sm font-exo">{t('leaderboardLoading')}</div>
            </div>
          ) : tab === 'leaderboard' ? (
            leaderboard.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-white/20">
                <div className="text-4xl mb-3">🏆</div>
                <div className="text-sm font-exo">{t('leaderboardEmpty')}</div>
                <div className="text-xs text-white/10 mt-1">{t('leaderboardEmptyHint')}</div>
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-[44px_1fr_60px_90px_70px_60px] gap-2 px-3 pb-2 text-[9px] font-orbitron text-white/20 uppercase tracking-widest border-b border-white/[0.05]">
                  <span>{t('leaderboardRank')}</span><span>{t('leaderboardPlayer')}</span><span className="text-right">{t('leaderboardLevel')}</span>
                  <span className="text-right">{t('leaderboardScore')}</span><span className="text-right">{t('leaderboardTime')}</span><span className="text-right">{t('leaderboardBuildings')}</span>
                </div>
                <div className="space-y-0.5 mt-1">
                  {leaderboard.map((entry, index) => {
                    const rank = index + 1;
                    return (
                      <div key={entry.id}
                        className="grid grid-cols-[44px_1fr_60px_90px_70px_60px] gap-2 px-3 py-2.5 rounded-xl items-center transition-all"
                        style={{
                          background: rank <= 3 ? `${RANK_COLORS[rank - 1]}08` : 'transparent',
                          border: rank <= 3 ? `1px solid ${RANK_COLORS[rank - 1]}15` : '1px solid transparent',
                        }}
                      >
                        <span className="text-sm font-bold" style={{ color: RANK_COLORS[Math.min(rank - 1, 3)] }}>
                          {rank <= 3 ? RANK_ICONS[rank - 1] : rank}
                        </span>
                        <span className="text-sm text-white/80 font-medium truncate">{entry.player_name}</span>
                        <span className="text-right text-sm font-mono" style={{ color: '#4ade80' }}>{entry.level}</span>
                        <span className="text-right text-sm font-mono font-bold text-white/85">{entry.score.toLocaleString()}</span>
                        <span className="text-right text-xs font-mono text-white/30">{formatTime(entry.time_played)}</span>
                        <span className="text-right text-xs font-mono text-white/30">{entry.buildings_placed}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          ) : (
            <div>
              {/* Progress bar */}
              <div className="mb-4 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-white/35 font-exo">{t('achievementProgress')}</span>
                  <span className="text-xs text-amber-400/70 font-mono font-bold">{unlockedAchievements.size} / {ACHIEVEMENTS.length}</span>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.4)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${(unlockedAchievements.size / ACHIEVEMENTS.length) * 100}%`,
                      background: 'linear-gradient(90deg, #d97706, #fbbf24)',
                      boxShadow: '0 0 8px rgba(251,191,36,0.4)',
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ACHIEVEMENTS.map(ach => {
                  const unlocked = unlockedAchievements.has(ach.id);
                  return (
                    <div key={ach.id} className="p-3 rounded-xl flex items-center gap-3 transition-all"
                      style={{
                        background: unlocked ? 'rgba(251,191,36,0.07)' : 'rgba(255,255,255,0.01)',
                        border: unlocked ? '1px solid rgba(251,191,36,0.2)' : '1px solid rgba(255,255,255,0.03)',
                        opacity: unlocked ? 1 : 0.45,
                      }}
                    >
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                        style={{ background: unlocked ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.04)' }}>
                        {unlocked ? ach.icon : '?'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold" style={{ color: unlocked ? '#fbbf24' : 'rgba(255,255,255,0.3)' }}>{ach.name}</h3>
                        <p className="text-[11px] text-white/25 mt-0.5 leading-tight">{ach.description}</p>
                      </div>
                      {unlocked && (
                        <span className="text-[9px] font-orbitron px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
                          {t('achievementDone')}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
