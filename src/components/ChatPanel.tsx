import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentUser, getCurrentUserId } from '../lib/auth';
import { t } from '../lib/i18n';
import type { RealtimeChannel } from '@supabase/supabase-js';

const MAX_MSG_LEN = 200;
const HISTORY_LIMIT = 50;

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
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const minimizedRef = useRef(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const username = getCurrentUser();
  const isMobile = window.innerWidth < 768;

  useEffect(() => { minimizedRef.current = minimized; }, [minimized]);

  useEffect(() => {
    // Fetch last HISTORY_LIMIT messages from DB (global history)
    supabase
      .from('chat_messages')
      .select('id,username,message,created_at')
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT)
      .then(({ data }) => {
        if (data) setMessages((data as ChatMessage[]).reverse());
      });

    // Single channel instance — reused for both subscribe AND send
    const channel = supabase
      .channel('global-chat', { config: { broadcast: { self: true } } })
      .on('broadcast', { event: 'msg' }, ({ payload }) => {
        const msg = payload as ChatMessage;
        setMessages(prev => {
          // Deduplicate by id (own message arrives via broadcast too now)
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev.slice(-(HISTORY_LIMIT - 1)), msg];
        });
        if (minimizedRef.current) setUnread(u => u + 1);
      })
      .subscribe();

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); channelRef.current = null; };
  }, []);

  useEffect(() => {
    if (!minimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setUnread(0);
    }
  }, [messages, minimized]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !username || sending) return;
    const msg = input.trim().slice(0, MAX_MSG_LEN);
    setInput('');
    setSendError('');
    setSending(true);

    const newMsg: ChatMessage = {
      id: crypto.randomUUID(),
      username,
      message: msg,
      created_at: new Date().toISOString(),
    };

    // 1. Broadcast via the subscribed channel (instant delivery to all online)
    channelRef.current?.send({ type: 'broadcast', event: 'msg', payload: newMsg });

    // 2. Persist to DB for history (new players fetching on connect will see it)
    const { error } = await supabase.from('chat_messages').insert({
      id: newMsg.id,
      username,
      message: msg,
      user_id: getCurrentUserId(),
    });

    if (error) {
      // Non-fatal: message was broadcast already, just warn about history
      setSendError('⚠ Not saved to history');
      setTimeout(() => setSendError(''), 3000);
    }

    setSending(false);
  }, [input, username, sending]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  if (minimized) {
    return (
      <div
        className="fixed z-25 cursor-pointer"
        style={{ bottom: isMobile ? '160px' : '96px', right: isMobile ? '8px' : '16px' }}
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
      className="fixed z-25 flex flex-col overflow-hidden font-exo"
      style={{
        background: 'linear-gradient(180deg, rgba(10,14,20,0.97) 0%, rgba(6,8,12,0.97) 100%)',
        border: '1px solid rgba(216,128,16,0.2)',
        borderTop: '1px solid rgba(216,128,16,0.4)',
        boxShadow: '0 0 40px rgba(0,0,0,0.8)',
        ...(isMobile ? {
          bottom: 0,
          right: 0,
          left: 0,
          width: '100%',
          height: '45vh',
          borderRadius: '20px 20px 0 0',
        } : {
          bottom: '96px',
          right: '16px',
          width: '288px',
          height: '280px',
          borderRadius: '16px',
        }),
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
        {sendError && <div className="text-[10px] text-yellow-400/80 mb-1 px-1">{sendError}</div>}
        <div className="flex gap-1.5">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={username ? t('typeMessage') : 'Login to chat'}
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
