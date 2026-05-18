import { useState } from 'react';
import { t, LangCode, setLang, getLang } from '../lib/i18n';

const LANGUAGES: { code: LangCode; flag: string; name: string }[] = [
  { code: 'en', flag: '🇬🇧', name: 'EN' },
  { code: 'pl', flag: '🇵🇱', name: 'PL' },
  { code: 'de', flag: '🇩🇪', name: 'DE' },
  { code: 'fr', flag: '🇫🇷', name: 'FR' },
  { code: 'es', flag: '🇪🇸', name: 'ES' },
  { code: 'it', flag: '🇮🇹', name: 'IT' },
  { code: 'nl', flag: '🇳🇱', name: 'NL' },
  { code: 'pt', flag: '🇵🇹', name: 'PT' },
  { code: 'cs', flag: '🇨🇿', name: 'CS' },
  { code: 'sk', flag: '🇸🇰', name: 'SK' },
  { code: 'hu', flag: '🇭🇺', name: 'HU' },
  { code: 'ro', flag: '🇷🇴', name: 'RO' },
  { code: 'sv', flag: '🇸🇪', name: 'SV' },
  { code: 'da', flag: '🇩🇰', name: 'DA' },
  { code: 'no', flag: '🇳🇴', name: 'NO' },
  { code: 'fi', flag: '🇫🇮', name: 'FI' },
  { code: 'hr', flag: '🇭🇷', name: 'HR' },
  { code: 'bg', flag: '🇧🇬', name: 'BG' },
  { code: 'el', flag: '🇬🇷', name: 'EL' },
  { code: 'et', flag: '🇪🇪', name: 'ET' },
  { code: 'lv', flag: '🇱🇻', name: 'LV' },
  { code: 'lt', flag: '🇱🇹', name: 'LT' },
  { code: 'sl', flag: '🇸🇮', name: 'SL' },
];

interface Props {
  /** When true, positions the selector fixed in bottom-right corner */
  fixed?: boolean;
}

export default function LangSelector({ fixed = false }: Props) {
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find(l => l.code === getLang()) ?? LANGUAGES[0];

  const handleSelect = (code: LangCode) => {
    setLang(code);
    window.location.reload();
  };

  return (
    <div
      className="relative"
      style={fixed ? { position: 'fixed', bottom: '16px', right: '16px', zIndex: 60 } : {}}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-orbitron transition-all"
        style={{
          background: 'rgba(10,14,20,0.9)',
          border: '1px solid rgba(216,128,16,0.25)',
          color: 'rgba(255,255,255,0.5)',
        }}
        title={t('language')}
      >
        <span>{current.flag}</span>
        <span className="tracking-wider">{current.name}</span>
        <span style={{ fontSize: '8px', opacity: 0.5 }}>▼</span>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-50" onClick={() => setOpen(false)} />
          <div
            className="absolute z-50 rounded-xl overflow-hidden"
            style={{
              bottom: 'calc(100% + 8px)',
              right: 0,
              background: 'linear-gradient(180deg, #111820 0%, #0c1016 100%)',
              border: '1px solid rgba(216,128,16,0.25)',
              boxShadow: '0 0 30px rgba(0,0,0,0.8)',
              width: '200px',
            }}
          >
            <div className="p-2 grid grid-cols-4 gap-1">
              {LANGUAGES.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => handleSelect(lang.code)}
                  className="flex flex-col items-center gap-0.5 p-1.5 rounded-lg text-center transition-all hover:bg-white/10"
                  style={{
                    background: lang.code === current.code ? 'rgba(216,128,16,0.15)' : 'transparent',
                    border: lang.code === current.code ? '1px solid rgba(216,128,16,0.3)' : '1px solid transparent',
                    color: lang.code === current.code ? '#d88010' : 'rgba(255,255,255,0.5)',
                  }}
                  title={lang.name}
                >
                  <span style={{ fontSize: '14px' }}>{lang.flag}</span>
                  <span className="text-[9px] font-orbitron tracking-wider">{lang.name}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
