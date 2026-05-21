import { t } from '../lib/i18n';

const PREMIUM_TIERS = [
  {
    id: 'free' as const,
    name: 'FREE',
    price: '0 zł',
    color: '#94a3b8',
    features: ['Basic inventory (30 slots)', '1 save slot', '5 friends max', 'Standard chat'],
  },
  {
    id: 'starter' as const,
    name: 'STARTER',
    price: '9.99 zł/mies.',
    color: '#f59e0b',
    features: ['50 inventory slots', '3 save slots', '20 friends', 'Priority chat', '+1 gem/level'],
  },
  {
    id: 'premium' as const,
    name: 'PREMIUM',
    price: '24.99 zł/mies.',
    color: '#a78bfa',
    features: ['Unlimited inventory', '10 save slots', 'Unlimited friends', 'Custom chat color', 'All cosmetics', '+2 gems/level'],
  },
];

/** Props popupu premium — callbacki zamknięcia, "nie pytaj więcej" i zakupu. */
interface Props {
  onClose: () => void;
  onDontAsk: () => void;
  onBuyPremium: () => void;
}

/** Popup premium — pokazuje się po 3 sekundach dla graczy z darmowym tierem. */
export default function PremiumPopup({ onClose, onDontAsk, onBuyPremium }: Props) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="panel-glass rounded-2xl p-6 max-w-md w-full mx-4 animate-slide-up font-exo"
        onClick={e => e.stopPropagation()}
        style={{
          background: 'linear-gradient(180deg, #111820 0%, #0c1016 100%)',
          border: '1px solid rgba(167,139,250,0.3)',
          borderTop: '1px solid rgba(167,139,250,0.5)',
          boxShadow: '0 0 60px rgba(167,139,250,0.15), 0 0 0 1px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div className="text-center mb-5">
          <div className="text-3xl mb-2">👑</div>
          <h2
            className="font-orbitron font-black text-xl tracking-widest mb-1"
            style={{ color: '#a78bfa', textShadow: '0 0 20px rgba(167,139,250,0.5)' }}
          >
            {t('premiumPopupTitle').toUpperCase()}
          </h2>
          <p className="text-xs text-white/40 font-exo">{t('premiumPopupSubtitle')}</p>
        </div>

        {/* Tier cards (compact) */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {PREMIUM_TIERS.map(tier => (
            <div
              key={tier.id}
              className="rounded-xl p-3 text-center"
              style={{
                background: `${tier.color}08`,
                border: `1px solid ${tier.color}30`,
              }}
            >
              <div
                className="font-orbitron font-bold text-[11px] tracking-wider mb-1"
                style={{ color: tier.color }}
              >
                {tier.name}
              </div>
              <div className="font-mono text-[10px] mb-2" style={{ color: tier.color }}>
                {tier.price}
              </div>
              <ul className="space-y-0.5">
                {tier.features.slice(0, 3).map((f, i) => (
                  <li key={i} className="text-[9px] text-white/30 leading-tight text-left">
                    <span style={{ color: tier.color }}>✓ </span>{f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={() => {
            if (onBuyPremium) onBuyPremium();
            onClose();
          }}
          className="w-full py-3 rounded-xl font-orbitron font-bold text-sm tracking-widest mb-3 transition-all hover:opacity-90 active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg, rgba(126,105,200,0.9), rgba(167,139,250,0.9))',
            color: 'white',
            boxShadow: '0 0 25px rgba(167,139,250,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
            border: '1px solid rgba(167,139,250,0.5)',
          }}
        >
          👑 {t('upgradeToPremium').toUpperCase()}
        </button>

        {/* Secondary actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={onDontAsk}
            className="text-[10px] text-white/25 hover:text-white/50 transition-colors underline"
          >
            {t('doNotAskAgain')}
          </button>
          <button
            onClick={onClose}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all hover:bg-white/10"
            style={{ color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            {t('noThanks')}
          </button>
        </div>
      </div>
    </div>
  );
}
