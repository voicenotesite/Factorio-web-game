import { useState, useEffect, useRef } from 'react';

interface Props {
  onStart: () => void;
}

const PARTICLES = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: 2 + Math.random() * 4,
  duration: 4 + Math.random() * 8,
  delay: Math.random() * 6,
  color: i % 3 === 0 ? '#f59e0b' : i % 3 === 1 ? '#22c55e' : '#38bdf8',
}));

export default function StartScreen({ onStart }: Props) {
  const [opacity, setOpacity] = useState(0);
  const [titleVisible, setTitleVisible] = useState(false);
  const [subtitleVisible, setSubtitleVisible] = useState(false);
  const [btnVisible, setBtnVisible] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => setOpacity(1));
    setTimeout(() => setTitleVisible(true), 200);
    setTimeout(() => setSubtitleVisible(true), 600);
    setTimeout(() => setBtnVisible(true), 900);
  }, []);

  // Animated canvas gears/factory background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;
    let raf: number;

    const drawGear = (x: number, y: number, r: number, teeth: number, angle: number, color: string) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < teeth; i++) {
        const a1 = (i / teeth) * Math.PI * 2;
        const a2 = ((i + 0.4) / teeth) * Math.PI * 2;
        const a3 = ((i + 0.5) / teeth) * Math.PI * 2;
        const a4 = ((i + 0.9) / teeth) * Math.PI * 2;
        ctx.moveTo(Math.cos(a1) * r, Math.sin(a1) * r);
        ctx.lineTo(Math.cos(a1) * (r + 8), Math.sin(a1) * (r + 8));
        ctx.lineTo(Math.cos(a2) * (r + 8), Math.sin(a2) * (r + 8));
        ctx.lineTo(Math.cos(a3) * r, Math.sin(a3) * r);
        ctx.lineTo(Math.cos(a4) * r, Math.sin(a4) * r);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    };

    const render = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const t = frame * 0.005;
      const alpha = 0.07;

      // Large gear bottom-left
      ctx.globalAlpha = alpha;
      drawGear(80, canvas.height - 80, 60, 12, t, '#f59e0b');
      // Medium gear bottom-left inner
      drawGear(175, canvas.height - 55, 35, 8, -t * 1.7, '#22c55e');
      // Large gear top-right
      drawGear(canvas.width - 100, 100, 70, 14, -t * 0.8, '#38bdf8');
      // Small gear top-right inner
      drawGear(canvas.width - 200, 60, 28, 7, t * 2, '#f59e0b');
      // Center subtle gear
      drawGear(canvas.width / 2, canvas.height * 0.75, 45, 10, t * 0.6, '#22c55e');

      ctx.globalAlpha = 1;
      frame++;
      raf = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center transition-opacity duration-700"
      style={{
        opacity,
        background: 'radial-gradient(ellipse at 30% 40%, #0d1f0e 0%, #060a12 45%, #07090f 100%)',
      }}
    >
      {/* Animated gear canvas background */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Grid overlay */}
      <div className="absolute inset-0 bg-factory-grid opacity-30 pointer-events-none" />

      {/* Radial glow spots */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-[500px] h-[500px] rounded-full opacity-20"
          style={{ top: '10%', left: '15%', background: 'radial-gradient(circle, rgba(34,197,94,0.25) 0%, transparent 70%)' }} />
        <div className="absolute w-[400px] h-[400px] rounded-full opacity-15"
          style={{ bottom: '15%', right: '10%', background: 'radial-gradient(circle, rgba(245,158,11,0.3) 0%, transparent 70%)' }} />
        <div className="absolute w-[300px] h-[300px] rounded-full opacity-10"
          style={{ top: '50%', right: '25%', background: 'radial-gradient(circle, rgba(56,189,248,0.25) 0%, transparent 70%)' }} />
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {PARTICLES.map(p => (
          <div
            key={p.id}
            className="particle"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
              opacity: 0.5,
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 text-center px-8">

        {/* Factory icon */}
        <div className={`mb-6 transition-all duration-700 ${titleVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-4"
            style={{
              background: 'linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(34,197,94,0.15) 100%)',
              border: '1px solid rgba(245,158,11,0.3)',
              boxShadow: '0 0 30px rgba(245,158,11,0.2), inset 0 1px 0 rgba(255,255,255,0.08)',
            }}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="url(#iconGrad)" strokeWidth="1.5" strokeLinecap="round">
              <defs>
                <linearGradient id="iconGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#22c55e" />
                </linearGradient>
              </defs>
              <path d="M2 20V10l5-3v3l5-3v3l5-3v13H2z" />
              <path d="M6 20v-4h3v4" />
              <path d="M11 20v-4h3v4" />
              <path d="M16 20v-4h3v4" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <div className={`transition-all duration-700 delay-100 ${titleVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <h1
            className="font-orbitron font-black text-7xl tracking-tight leading-none"
            style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 40%, #22c55e 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 30px rgba(245,158,11,0.4))',
            }}
          >
            FACTORY
          </h1>
          <h2
            className="font-orbitron font-light text-4xl tracking-[0.5em] mt-1"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(56,189,248,0.8) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            WORLD
          </h2>
        </div>

        {/* Divider */}
        <div className={`flex items-center gap-3 my-6 transition-all duration-700 delay-200 ${subtitleVisible ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
          <span className="text-amber-500/50 text-[10px] font-orbitron tracking-[0.4em]">BUILD · AUTOMATE · SURVIVE</span>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
        </div>

        {/* Start button */}
        <div className={`transition-all duration-700 delay-300 ${btnVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <button
            onClick={onStart}
            className="btn-shine group relative px-16 py-4 text-base font-orbitron font-bold text-white rounded-xl overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95 tracking-widest"
            style={{
              background: 'linear-gradient(135deg, #d97706 0%, #b45309 40%, #166534 100%)',
              boxShadow: '0 0 30px rgba(217,119,6,0.35), 0 4px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15)',
              border: '1px solid rgba(245,158,11,0.3)',
            }}
          >
            <span className="relative z-10 flex items-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polygon points="5,3 19,12 5,21" />
              </svg>
              START GAME
            </span>
          </button>

          <p className="text-white/20 text-xs mt-4 font-exo tracking-wider">Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/35 font-exo text-[10px]">ENTER</kbd> to begin</p>
        </div>

        {/* Controls grid */}
        <div className={`mt-12 transition-all duration-700 delay-500 ${btnVisible ? 'opacity-100' : 'opacity-0'}`}>
          <div
            className="inline-block p-4 rounded-xl"
            style={{
              background: 'rgba(6,10,18,0.7)',
              border: '1px solid rgba(255,255,255,0.05)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div className="text-[9px] font-orbitron tracking-[0.3em] text-white/20 uppercase mb-3">Controls</div>
            <div className="grid grid-cols-4 gap-x-8 gap-y-2 text-xs text-white/30 font-exo">
              {[
                ['WASD', 'Move'],
                ['B', 'Build'],
                ['R', 'Research'],
                ['I', 'Inventory'],
                ['Q', 'Rotate'],
                ['LMB', 'Mine/Place'],
                ['RMB', 'Remove'],
                ['Scroll', 'Zoom'],
              ].map(([key, action]) => (
                <div key={key} className="flex items-center gap-2">
                  <kbd className="px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-amber-400/60 text-[10px] font-orbitron min-w-[28px] text-center">{key}</kbd>
                  <span className="text-white/25">{action}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
