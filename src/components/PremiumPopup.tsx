import { t } from '../lib/i18n';

/** Definicja taryf premium: FREE, STARTER, PREMIUM. */
const PREMIUM_TIERS = [
  {
    id: 'free' as const,
    nameKey: 'FREE',
    priceKey: 'priceFree',
    color: '#94a3b8',
    featureKeys: ['featureInventory30', 'featureSave1', 'featureFriends5', 'featureStandardChat'],
  },
  {
    id: 'starter' as const,
    nameKey: 'STARTER',
    priceKey: 'priceStarter',
    color: '#f59e0b',
    featureKeys: ['featureInventory50', 'featureSave3', 'featureFriends20', 'featurePriorityChat', 'featureGem1'],
  },
  {
    id: 'premium' as const,
    nameKey: 'PREMIUM',
    priceKey: 'pricePremium',
    color: '#a78bfa',
    featureKeys: ['featureInventoryUnlimited', 'featureSave10', 'featureFriendsUnlimited', 'featureChatColor', 'featureAllCosmetics', 'featureGem2'],
  },
];

/** Props popupa premium — zamykanie, "nie pytaj więcej" i przekierowanie do zakupu. */
interface Props {
  onClose: () => void;
  onDontAsk: () => void;
  onBuyPremium?: () => void;
}

/** Popup zachęcający do wykupienia subskrypcji premium z tabelą taryf i przyciskiem zakupu. */
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
                {t(tier.nameKey)}
              </div>
              <div className="font-mono text-[10px] mb-2" style={{ color: tier.color }}>
                {t(tier.priceKey)}
              </div>
              <ul className="space-y-0.5">
                {tier.featureKeys.slice(0, 3).map((fk, i) => (
                  <li key={i} className="text-[9px] text-white/30 leading-tight text-left">
                    <span style={{ color: tier.color }}>✓ </span>{t(fk)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

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
