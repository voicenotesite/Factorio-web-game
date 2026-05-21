import { useState, useEffect, useRef } from 'react';
import { t } from '../lib/i18n';

/** Props ekranu startowego — callback rozpoczęcia gry. */
interface Props { onStart: () => void; }

interface Spark {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
}

const BUILDINGS = [
  { x: 0.00, y: 0.72, w: 0.14, h: 0.28, chimneys: [0.04, 0.11] },
  { x: 0.12, y: 0.62, w: 0.12, h: 0.38, chimneys: [0.17] },
  { x: 0.22, y: 0.69, w: 0.18, h: 0.31, chimneys: [0.27, 0.35] },
  { x: 0.38, y: 0.58, w: 0.14, h: 0.42, chimneys: [0.43, 0.48] },
  { x: 0.50, y: 0.67, w: 0.16, h: 0.33, chimneys: [0.55, 0.61] },
  { x: 0.64, y: 0.61, w: 0.14, h: 0.39, chimneys: [0.69, 0.75] },
  { x: 0.76, y: 0.70, w: 0.12, h: 0.30, chimneys: [0.80] },
  { x: 0.86, y: 0.64, w: 0.16, h: 0.36, chimneys: [0.90, 0.97] },
];

/** Ekran startowy — animowane miasto, przycisk "Enter Novactorio". */
export default function StartScreen({ onStart }: Props) {
  const [phase, setPhase] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparksRef = useRef<Spark[]>([]);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 100);
    const t2 = setTimeout(() => setPhase(2), 500);
    const t3 = setTimeout(() => setPhase(3), 950);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf: number;

    const emit = (W: number, H: number) => {
      for (const b of BUILDINGS) {
        for (const cx of b.chimneys) {
          if (Math.random() < 0.06) {
            sparksRef.current.push({
              x: cx * W + (Math.random() - 0.5) * 10,
              y: b.y * H - 4,
              vx: (Math.random() - 0.5) * 1.4,
              vy: -(1.0 + Math.random() * 2.8),
              life: 0,
              maxLife: 80 + Math.random() * 90,
              size: 0.8 + Math.random() * 2.2,
            });
          }
        }
      }
      if (sparksRef.current.length > 200) sparksRef.current = sparksRef.current.slice(-200);
    };

    const draw = () => {
      const W = canvas.width = canvas.offsetWidth;
      const H = canvas.height = canvas.offsetHeight;
      ctx.clearRect(0, 0, W, H);

      // Warm atmospheric glow from factory base
      const atm = ctx.createRadialGradient(W / 2, H * 1.1, 0, W / 2, H * 0.4, H);
      atm.addColorStop(0, 'rgba(180,90,8,0.20)');
      atm.addColorStop(0.3, 'rgba(140,65,5,0.10)');
      atm.addColorStop(0.6, 'rgba(80,35,3,0.04)');
      atm.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = atm;
      ctx.fillRect(0, 0, W, H);

      // Factory silhouettes
      for (const b of BUILDINGS) {
        const bx = b.x * W, by = b.y * H, bw = b.w * W, bh = b.h * H;
        ctx.fillStyle = '#06080a';
        ctx.fillRect(bx, by, bw, bh);
        const bg = ctx.createLinearGradient(bx, by, bx, by + bh * 0.3);
        bg.addColorStop(0, 'rgba(180,90,8,0.06)');
        bg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = bg;
        ctx.fillRect(bx, by, bw, bh * 0.3);
        for (const cx of b.chimneys) {
          const ch = H * 0.10;
          ctx.fillStyle = '#05070a';
          ctx.fillRect(cx * W - 5, by - ch, 10, ch + 2);
        }
        const cols = Math.floor(bw / 18);
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < cols; col++) {
            if ((Math.sin(bx + col * 7 + row * 13) + 1) * 0.5 > 0.45) {
              const alpha = 0.08 + (Math.sin(bx + col + row + Date.now() * 0.0002) + 1) * 0.04;
              ctx.fillStyle = `rgba(200,140,20,${alpha})`;
              ctx.fillRect(bx + col * 18 + 5, by + row * 16 + 10, 8, 7);
            }
          }
        }
        ctx.fillStyle = 'rgba(216,128,16,0.04)';
        ctx.fillRect(bx, by, 1, bh);
        ctx.fillRect(bx + bw - 1, by, 1, bh);
      }

      // Ground ambient
      const gnd = ctx.createLinearGradient(0, H * 0.90, 0, H);
      gnd.addColorStop(0, 'rgba(180,90,8,0.12)');
      gnd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gnd;
      ctx.fillRect(0, H * 0.90, W, H * 0.10);

      // Sparks / embers
      emit(W, H);
      const alive: Spark[] = [];
      for (const s of sparksRef.current) {
        const p = s.life / s.maxLife;
        const alpha = p < 0.15 ? p / 0.15 : (1 - p);
        if (alpha > 0.01) {
          ctx.save();
          ctx.globalAlpha = alpha * 0.85;
          const r = 255;
          const g = Math.round(180 * (1 - p * 0.8) + 20 * p);
          const bl = Math.round(15 * (1 - p));
          ctx.fillStyle = `rgb(${r},${g},${bl})`;
          ctx.shadowColor = `rgb(${r},${g},${bl})`;
          ctx.shadowBlur = 3;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size * (1 - p * 0.5), 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        s.x += s.vx; s.vx *= 0.99;
        s.y += s.vy; s.vy += 0.025;
        s.life++;
        if (s.life < s.maxLife) alive.push(s);
      }
      sparksRef.current = alive;

      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  const vis = (n: number, delay = 0): React.CSSProperties => ({
    opacity: phase >= n ? 1 : 0,
    transform: phase >= n ? 'none' : 'translateY(12px)',
    transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: '#07090b', opacity: phase >= 1 ? 1 : 0, transition: 'opacity 0.8s ease' }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
      <div className="absolute inset-0 bg-factory-grid pointer-events-none" />

      {/* Top & bottom hazard bars */}
      {(['top-0', 'bottom-0'] as const).map(pos => (
        <div key={pos} className={`absolute ${pos} left-0 right-0 h-[3px] pointer-events-none`}
          style={{ background: 'repeating-linear-gradient(90deg, #d88010 0, #d88010 18px, transparent 18px, transparent 36px)' }} />
      ))}

      {/* Corner brackets */}
      {([
        ['top-3 left-3',   'border-t-2 border-l-2'],
        ['top-3 right-3',  'border-t-2 border-r-2'],
        ['bottom-3 left-3',  'border-b-2 border-l-2'],
        ['bottom-3 right-3', 'border-b-2 border-r-2'],
      ] as const).map(([pos, border], i) => (
        <div key={i} className={`absolute w-8 h-8 ${pos} ${border}`}
          style={{ borderColor: 'rgba(216,128,16,0.4)' }} />
      ))}

      {/* Content */}
      <div className="relative z-10 text-center px-8">

        {/* Status badge */}
        <div style={{ ...vis(2), marginBottom: '28px', display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '6px 16px', background: 'rgba(216,128,16,0.08)', border: '1px solid rgba(216,128,16,0.25)', borderRadius: '2px' }}>
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#d88010', boxShadow: '0 0 8px #d88010' }} />
          <span className="font-orbitron" style={{ fontSize: '8px', letterSpacing: '0.55em', color: 'rgba(216,128,16,0.8)' }}>{t('systemOnline')}</span>
        </div>

        {/* Main title */}
        <div style={vis(2, 0.1)}>
          <h1 className="font-orbitron font-black" style={{
            fontSize: 'clamp(4.5rem, 11vw, 7.5rem)',
            lineHeight: 1,
            letterSpacing: '-0.02em',
            color: '#e8dcc8',
            textShadow: '0 0 60px rgba(216,128,16,0.45), 0 0 120px rgba(216,128,16,0.15), 4px 4px 0 rgba(0,0,0,0.95), 2px 2px 0 rgba(0,0,0,0.7)',
          }}>NOVACTORIO</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '6px' }}>
            <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, transparent, rgba(216,128,16,0.55))' }} />
            <h2 className="font-orbitron font-light" style={{
              fontSize: 'clamp(1.4rem, 3.5vw, 2.2rem)',
              letterSpacing: '0.65em',
              color: 'rgba(216,128,16,0.85)',
              textShadow: '0 0 25px rgba(216,128,16,0.35)',
            }}>INDUSTRIAL</h2>
            <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to left, transparent, rgba(216,128,16,0.55))' }} />
          </div>
        </div>

        {/* Tagline */}
        <div style={{ ...vis(2, 0.25), marginTop: '18px', marginBottom: '32px' }}>
          <span className="font-orbitron" style={{ fontSize: '9px', letterSpacing: '0.55em', color: 'rgba(205,197,178,0.25)' }}>
            {t('tagline')}
          </span>
        </div>

        {/* CTA button */}
        <div style={vis(3)}>
          <button
            onClick={onStart}
            className="font-orbitron font-bold tracking-widest"
            style={{
              padding: '14px 64px',
              fontSize: '13px',
              color: '#f0c060',
              background: 'linear-gradient(180deg, #1e1408 0%, #120e06 100%)',
              border: '1px solid rgba(216,128,16,0.45)',
              borderTop: '1px solid rgba(216,128,16,0.70)',
              borderRadius: '2px',
              cursor: 'pointer',
              clipPath: 'polygon(8px 0%, calc(100% - 8px) 0%, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0% calc(100% - 8px), 0% 8px)',
              boxShadow: 'inset 0 1px 0 rgba(255,200,80,0.08), inset 0 -1px 0 rgba(0,0,0,0.5), 0 0 30px rgba(216,128,16,0.18), 0 4px 20px rgba(0,0,0,0.8)',
              transition: 'all 0.15s ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.boxShadow = 'inset 0 1px 0 rgba(255,200,80,0.12), inset 0 -1px 0 rgba(0,0,0,0.5), 0 0 45px rgba(216,128,16,0.35), 0 4px 20px rgba(0,0,0,0.8)';
              (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.boxShadow = 'inset 0 1px 0 rgba(255,200,80,0.08), inset 0 -1px 0 rgba(0,0,0,0.5), 0 0 30px rgba(216,128,16,0.18), 0 4px 20px rgba(0,0,0,0.8)';
              (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
            {t('initialize')}
          </button>
          <p style={{ marginTop: '14px', color: 'rgba(205,197,178,0.15)', fontSize: '11px', fontFamily: 'Exo 2, sans-serif', letterSpacing: '0.08em' }}>
            {t('pressEnter')}
          </p>
        </div>

        {/* Controls */}
        <div style={{ ...vis(3, 0.2), marginTop: '32px' }}>
          <div style={{ display: 'inline-block', padding: '14px 20px', background: 'rgba(7,9,11,0.92)', border: '1px solid rgba(42,54,66,0.8)', borderRadius: '2px' }}>
            <div className="font-orbitron" style={{ fontSize: '8px', letterSpacing: '0.4em', color: 'rgba(216,128,16,0.35)', marginBottom: '10px' }}>{t('controlReference')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, auto)', gap: '6px 28px' }}>
              {[['WASD',t('ctrlMove')],['B',t('ctrlBuild')],['R',t('ctrlResearch')],['I',t('ctrlInventory')],['Q',t('ctrlRotate')],['LMB',t('ctrlMine')],['RMB',t('ctrlRemove')],['Scroll',t('ctrlZoom')]].map(([k,a]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <kbd style={{ padding: '1px 5px', background: 'rgba(216,128,16,0.07)', border: '1px solid rgba(216,128,16,0.18)', borderRadius: '2px', color: 'rgba(216,128,16,0.55)', fontSize: '8px', fontFamily: 'Orbitron, sans-serif', minWidth: '24px', textAlign: 'center' as const, display: 'inline-block' }}>{k}</kbd>
                  <span style={{ fontSize: '11px', color: 'rgba(205,197,178,0.22)', fontFamily: 'Exo 2, sans-serif' }}>{a}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
