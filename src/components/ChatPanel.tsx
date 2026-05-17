import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentUser, getCurrentUserId } from '../lib/auth';

interface ChatMessage {
  id: string;
  username: string;
  message: string;
  created_at: string;
}

interface Props {
  onClose?: () => void;
}

export default function ChatPanel({ onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [minimized, setMinimized] = useState(false);
  const [unread, setUnread] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const username = getCurrentUser();

  useEffect(() => {
    supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setMessages(data.reverse() as ChatMessage[]);
      });

    const channel = supabase
      .channel('global-chat')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
      }, (payload) => {
        const msg = payload.new as ChatMessage;
        setMessages(prev => [...prev.slice(-99), msg]);
        if (minimized) setUnread(u => u + 1);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [minimized]);

  useEffect(() => {
    if (!minimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setUnread(0);
    }
  }, [messages, minimized]);

  const sendMessage = async () => {
    if (!input.trim() || !username) return;
    const msg = input.trim();
    setInput('');
    await supabase.from('chat_messages').insert({
      username,
      message: msg,
      user_id: getCurrentUserId(),
    });
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  if (minimized) {
    return (
      <div
        className="fixed bottom-24 right-4 z-25 cursor-pointer"
        onClick={() => { setMinimized(false); setUnread(0); }}
      >
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl font-orbitron text-xs"
          style={{
            background: 'rgba(10,14,20,0.95)',
            border: '1px solid rgba(216,128,16,0.3)',
            color: 'rgba(205,197,178,0.7)',
          }}
        >
          💬 Chat {unread > 0 && <span className="bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px]">{unread}</span>}
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed bottom-24 right-4 z-25 w-72 flex flex-col rounded-2xl overflow-hidden font-exo"
      style={{
        background: 'linear-gradient(180deg, rgba(10,14,20,0.97) 0%, rgba(6,8,12,0.97) 100%)',
        border: '1px solid rgba(216,128,16,0.2)',
        borderTop: '1px solid rgba(216,128,16,0.4)',
        boxShadow: '0 0 40px rgba(0,0,0,0.8)',
        height: '280px',
      }}
    >
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="font-orbitron text-xs tracking-wider" style={{ color: 'rgba(216,128,16,0.8)' }}>💬 GLOBAL CHAT</span>
        <div className="flex gap-1">
          <button onClick={() => setMinimized(true)} className="text-white/30 hover:text-white/60 text-xs px-1">—</button>
          {onClose && <button onClick={onClose} className="text-white/30 hover:text-white/60 text-xs px-1">✕</button>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
        {messages.length === 0 && (
          <div className="text-center text-white/20 text-xs mt-4 font-orbitron">No messages yet...</div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className="text-xs leading-relaxed">
            <span
              className="font-semibold mr-1.5"
              style={{ color: msg.username === username ? '#d88010' : 'rgba(56,189,248,0.8)' }}
            >
              {msg.username}:
            </span>
            <span style={{ color: 'rgba(205,197,178,0.8)' }}>{msg.message}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-2 py-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex gap-1.5">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={username ? "Type a message..." : "Login to chat"}
            disabled={!username}
            className="flex-1 px-2 py-1.5 text-xs rounded-lg outline-none"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.8)',
              caretColor: '#d88010',
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || !username}
            className="px-2.5 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 transition-all"
            style={{ background: 'rgba(216,128,16,0.2)', color: '#d88010', border: '1px solid rgba(216,128,16,0.3)' }}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
