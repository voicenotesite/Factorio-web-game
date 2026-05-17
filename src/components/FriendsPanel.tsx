import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentUser, getCurrentUserId } from '../lib/auth';

interface FriendRequest {
  id: string;
  user_id: string;
  user_username: string;  // actual DB column name (the sender)
  status: 'pending' | 'accepted';
}

interface Friend {
  username: string;
  user_id: string;
  online: boolean;
}

interface Props {
  onClose: () => void;
  onVisitWorld?: (friendId: string, friendName: string) => void;
}

export default function FriendsPanel({ onClose, onVisitWorld }: Props) {
  const [tab, setTab] = useState<'friends' | 'requests' | 'add'>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [addUsername, setAddUsername] = useState('');
  const [msg, setMsg] = useState('');
  const myId = getCurrentUserId();
  const myName = getCurrentUser();

  useEffect(() => {
    loadFriends();
    loadRequests();
  }, []);

  const loadFriends = async () => {
    if (!myId) return;
    const { data } = await supabase
      .from('friendships')
      .select('*')
      .or(`user_id.eq.${myId},friend_id.eq.${myId}`)
      .eq('status', 'accepted');

    if (data) {
      const friendList: Friend[] = data.map((f: any) => ({
        username: f.user_id === myId ? f.friend_username : f.user_username,
        user_id: f.user_id === myId ? f.friend_id : f.user_id,
        online: false,
      }));
      setFriends(friendList);
    }
  };

  const loadRequests = async () => {
    if (!myId) return;
    const { data } = await supabase
      .from('friendships')
      .select('*')
      .eq('friend_id', myId)
      .eq('status', 'pending');
    if (data) setRequests(data as FriendRequest[]);
  };

  const sendFriendRequest = async () => {
    if (!addUsername.trim() || !myId || !myName) return;
    setMsg('');

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, username')
      .ilike('username', addUsername.trim())
      .single();

    if (!profile) { setMsg('User not found'); return; }
    if (profile.id === myId) { setMsg("Can't add yourself"); return; }

    const { error } = await supabase.from('friendships').insert({
      user_id: myId,
      friend_id: profile.id,
      user_username: myName,
      friend_username: profile.username,
      status: 'pending',
    });

    if (error) setMsg(error.message.includes('duplicate') ? 'Already sent' : error.message);
    else { setMsg('Request sent!'); setAddUsername(''); }
  };

  const acceptRequest = async (req: FriendRequest) => {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', req.id);
    loadFriends();
    loadRequests();
  };

  const declineRequest = async (req: FriendRequest) => {
    await supabase.from('friendships').delete().eq('id', req.id);
    loadRequests();
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-md" onClick={onClose}>
      <div
        className="rounded-2xl w-full max-w-sm mx-4 overflow-hidden font-exo"
        style={{
          background: 'linear-gradient(180deg, #0f1418 0%, #0a0d11 100%)',
          border: '1px solid rgba(216,128,16,0.2)',
          borderTop: '1px solid rgba(216,128,16,0.4)',
          boxShadow: '0 0 60px rgba(0,0,0,0.8)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 className="font-orbitron font-bold text-base text-white/80 tracking-wider">👥 FRIENDS</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors font-orbitron text-sm">✕</button>
        </div>

        <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {(['friends', 'requests', 'add'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-2.5 text-[10px] font-orbitron tracking-wider uppercase transition-colors"
              style={{
                color: tab === t ? '#d88010' : 'rgba(255,255,255,0.3)',
                borderBottom: tab === t ? '2px solid #d88010' : '2px solid transparent',
              }}
            >
              {t === 'friends' ? `Friends (${friends.length})` : t === 'requests' ? `Requests ${requests.length > 0 ? `(${requests.length})` : ''}` : '+ Add'}
            </button>
          ))}
        </div>

        <div className="p-4 min-h-[200px]">
          {tab === 'friends' && (
            <div className="space-y-2">
              {friends.length === 0 && <div className="text-center text-white/25 text-xs py-8 font-orbitron">No friends yet</div>}
              {friends.map(f => (
                <div
                  key={f.user_id}
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: f.online ? '#22c55e' : '#374151' }} />
                    <span className="text-sm text-white/70 font-semibold">{f.username}</span>
                  </div>
                  {onVisitWorld && (
                    <button
                      onClick={() => onVisitWorld(f.user_id, f.username)}
                      className="text-[9px] px-2 py-1 rounded-lg font-orbitron transition-all hover:opacity-80"
                      style={{ background: 'rgba(56,189,248,0.1)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.2)' }}
                    >
                      🌍 Visit
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === 'requests' && (
            <div className="space-y-2">
              {requests.length === 0 && <div className="text-center text-white/25 text-xs py-8 font-orbitron">No requests</div>}
              {requests.map(req => (
                <div
                  key={req.id}
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <span className="text-sm text-white/70">{req.user_username}</span>
                  <div className="flex gap-1.5">
                    <button onClick={() => acceptRequest(req)} className="text-xs px-2 py-1 rounded-lg" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}>✓</button>
                    <button onClick={() => declineRequest(req)} className="text-xs px-2 py-1 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'add' && (
            <div className="space-y-3 py-2">
              <input
                value={addUsername}
                onChange={e => setAddUsername(e.target.value)}
                onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') sendFriendRequest(); }}
                placeholder="Enter player name..."
                className="w-full px-3 py-2.5 text-sm rounded-lg outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)' }}
              />
              <button
                onClick={sendFriendRequest}
                disabled={!addUsername.trim()}
                className="w-full py-2.5 text-sm font-bold rounded-xl disabled:opacity-40 transition-all"
                style={{ background: 'linear-gradient(135deg, rgba(180,90,0,0.9), rgba(216,128,16,0.9))', color: 'white', border: '1px solid rgba(216,128,16,0.4)' }}
              >
                Send Request
              </button>
              {msg && (
                <div className="text-center text-xs py-1.5 rounded-lg" style={{ color: msg.includes('sent') || msg.includes('Request') ? '#4ade80' : '#f87171' }}>
                  {msg}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
