// TODO: Replace with Stripe integration: https://stripe.com/docs/js
import { useState } from 'react';
import { t } from '../lib/i18n';

const PLANS = [
  { id: 'starter', name: 'STARTER', price: 9.99, color: '#f59e0b' },
  { id: 'premium', name: 'PREMIUM', price: 24.99, color: '#a78bfa' },
];

interface Props {
  onClose: () => void;
}

function formatCard(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

export default function PaymentModal({ onClose }: Props) {
  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'premium'>('starter');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const plan = PLANS.find(p => p.id === selectedPlan)!;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setDone(true);
    }, 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="rounded-2xl p-6 max-w-sm w-full mx-4 animate-slide-up font-exo"
        onClick={e => e.stopPropagation()}
        style={{
          background: 'linear-gradient(180deg, #111820 0%, #0c1016 100%)',
          border: '1px solid rgba(216,128,16,0.2)',
          borderTop: '1px solid rgba(216,128,16,0.4)',
          boxShadow: '0 0 60px rgba(0,0,0,0.8), inset 0 1px 0 rgba(216,128,16,0.06)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-orbitron font-bold tracking-wider text-base" style={{ color: '#d88010' }}>
            💳 {t('selectPlan').toUpperCase()}
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-all text-xs"
          >
            ✕
          </button>
        </div>

        {done ? (
          /* Success state */
          <div className="text-center py-6">
            <div
              className="text-5xl mb-4 animate-bounce"
              style={{ filter: 'drop-shadow(0 0 15px #4ade80)' }}
            >
              ✓
            </div>
            <p className="text-sm text-white/70 leading-relaxed font-exo">
              {t('paymentSimulated')}
            </p>
            <button
              onClick={onClose}
              className="mt-5 px-6 py-2 rounded-xl text-sm font-semibold font-orbitron tracking-wider transition-all hover:opacity-90"
              style={{
                background: 'rgba(34,197,94,0.15)',
                color: '#4ade80',
                border: '1px solid rgba(34,197,94,0.3)',
              }}
            >
              {t('close').toUpperCase()}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Plan selector */}
            <div>
              <label className="block text-[10px] font-orbitron tracking-widest text-white/30 mb-2 uppercase">
                {t('selectPlan')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PLANS.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPlan(p.id as 'starter' | 'premium')}
                    className="p-3 rounded-xl text-center transition-all"
                    style={{
                      background: selectedPlan === p.id ? `${p.color}15` : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${selectedPlan === p.id ? `${p.color}50` : `${p.color}20`}`,
                    }}
                  >
                    <div className="font-orbitron font-bold text-[11px] tracking-wider" style={{ color: p.color }}>
                      {p.name}
                    </div>
                    <div className="font-mono text-sm font-bold mt-0.5" style={{ color: p.color }}>
                      {p.price.toFixed(2)} zł
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Card number */}
            <div>
              <label className="block text-[10px] font-orbitron tracking-widest text-white/30 mb-1.5 uppercase">
                {t('cardNumber')}
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={cardNumber}
                onChange={e => setCardNumber(formatCard(e.target.value))}
                placeholder="0000 0000 0000 0000"
                maxLength={19}
                required
                className="w-full px-3 py-2.5 text-sm font-mono rounded-lg outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.85)',
                  caretColor: '#d88010',
                  letterSpacing: '0.1em',
                }}
                onFocus={e => (e.target.style.borderColor = 'rgba(216,128,16,0.4)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
              />
            </div>

            {/* Expiry + CVV */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-orbitron tracking-widest text-white/30 mb-1.5 uppercase">
                  {t('expiryDate')}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={expiry}
                  onChange={e => setExpiry(formatExpiry(e.target.value))}
                  placeholder="MM/YY"
                  maxLength={5}
                  required
                  className="w-full px-3 py-2.5 text-sm font-mono rounded-lg outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.85)',
                    caretColor: '#d88010',
                  }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(216,128,16,0.4)')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
                />
              </div>
              <div>
                <label className="block text-[10px] font-orbitron tracking-widest text-white/30 mb-1.5 uppercase">
                  {t('cvv')}
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={cvv}
                  onChange={e => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="•••"
                  maxLength={4}
                  required
                  className="w-full px-3 py-2.5 text-sm font-mono rounded-lg outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.85)',
                    caretColor: '#d88010',
                  }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(216,128,16,0.4)')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
                />
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-orbitron font-bold text-sm tracking-widest transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              style={{
                background: `linear-gradient(135deg, ${plan.color}cc, ${plan.color})`,
                color: 'white',
                boxShadow: `0 0 20px ${plan.color}30, inset 0 1px 0 rgba(255,255,255,0.1)`,
                border: `1px solid ${plan.color}60`,
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ...
                </span>
              ) : (
                t('payButton', { price: plan.price.toFixed(2) })
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
