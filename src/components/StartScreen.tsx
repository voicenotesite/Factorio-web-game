import { useState, useEffect, useRef } from 'react';

interface Props {
  onStart: () => void;
}

export default function StartScreen({ onStart }: Props) {
  const [opacity, setOpacity] = useState(0);
  const [contentVisible, setContentVisible] = useState(false);
  const [btnVisible, setBtnVisible] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => setOpacity(1));
    setTimeout(() => setContentVisible(true), 300);
    setTimeout(() => setBtnVisible(true), 700);
  }, []);

  // Industrial background: solid metal gears + pipes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;
    let raf: number;

    const drawGear = (x: number, y: number, r: number, teeth: number, angle: number, alpha: number) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      ctx.rotate(angle);

      ctx.beginPath();
      for (let i = 0; i < teeth; i++) {
        const a1 = (i / teeth) * Math.PI * 2;
        const a2 = ((i + 0.35) / teeth) * Math.PI * 2;
        const a3 = ((i + 0.5) / teeth) * Math.PI * 2;
        const a4 = ((i + 0.85) / teeth) * Math.PI * 2;
        if (i === 0) ctx.moveTo(Math.cos(a1) * r, Math.sin(a1) * r);
        else ctx.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
        ctx.lineTo(Math.cos(a1) * (r + 10), Math.sin(a1) * (r + 10));
        ctx.lineTo(Math.cos(a2) * (r + 10), Math.sin(a2) * (r + 10));
        ctx.lineTo(Math.cos(a3) * r, Math.sin(a3) * r);
        ctx.lineTo(Math.cos(a4) * r, Math.sin(a4) * r);
      }
      ctx.closePath();

      const grad = ctx.createRadialGradient(0, -r * 0.3, 0, 0, 0, r + 12);
      grad.addColorStop(0, 'rgba(48,58,70,0.9)');
      grad.addColorStop(1, 'rgba(18,22,28,0.9)');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(70,88,105,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(6,8,10,0.9)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(70,88,105,0.4)';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, r * 0.1, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(110,130,155,0.6)';
      ctx.fill();

      ctx.restore();
    };

    const drawPipe = (x1: number, y1: number, x2: number, y2: number, w: number, alpha: number) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const len = Math.hypot(x2 - x1, y2 - y1);
      ctx.translate(x1, y1);
      ctx.rotate(angle);

      const g = ctx.createLinearGradient(0, -w, 0, w);
      g.addColorStop(0, 'rgba(60,74,88,0.8)');
      g.addColorStop(0.4, 'rgba(35,44,55,0.8)');
      g.addColorStop(1, 'rgba(12,16,20,0.8)');
      ctx.fillStyle = g;
      ctx.fillRect(0, -w, len, w * 2);

      ctx.fillStyle = 'rgba(70,88,105,0.4)';
      ctx.fillRect(0, -w, len, 1);

      ctx.restore();
    };

    const render = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const t = frame * 0.003;
      const W = canvas.width;
      const H = canvas.height;

      drawPipe(0, H * 0.28, W * 0.22, H * 0.28, 9, 0.4);
      drawPipe(W * 0.78, H * 0.72, W, H * 0.72, 9, 0.4);
      drawPipe(W * 0.12, 0, W * 0.12, H * 0.32, 7, 0.3);
      drawPipe(W * 0.88, H * 0.68, W * 0.88, H, 7, 0.3);
      drawPipe(W * 0.2, H * 0.85, W * 0.55, H * 0.85, 5, 0.2);

      drawGear(72, H - 92, 56, 12, t, 0.55);
      drawGear(170, H - 52, 31, 8, -t * 1.82, 0.5);
      drawGear(W - 88, 88, 66, 14, -t * 0.72, 0.5);
      drawGear(W - 198, 48, 28, 7, t * 1.95, 0.45);
      drawGear(W * 0.5, H * 0.8, 42, 10, t * 0.48, 0.3);

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
        background: 'linear-gradient(160deg, #090c0f 0%, #06080a 55%, #080a0d 100%)',
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Blueprint grid */}
      <div className="absolute inset-0 bg-factory-grid pointer-events-none" />

      {/* CRT scanlines */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 4px)',
        }}
      />

      {/* Top hazard stripe */}
      <div
        className="absolute top-0 left-0 right-0 h-1 pointer-events-none"
        style={{ background: 'repeating-linear-gradient(90deg, #c8890a 0px, #c8890a 18px, #06080a 18px, #06080a 36px)' }}
      />
      {/* Bottom hazard stripe */}
      <div
        className="absolute bottom-0 left-0 right-0 h-1 pointer-events-none"
        style={{ background: 'repeating-linear-gradient(90deg, #c8890a 0px, #c8890a 18px, #06080a 18px, #06080a 36px)' }}
      />

      {/* Main content */}
      <div className="relative z-10 text-center px-8 select-none">

        {/* System status */}
        <div className={`mb-8 transition-all duration-500 ${contentVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
          <div
            className="inline-flex items-center gap-2.5 px-4 py-1.5"
            style={{
              background: 'rgba(200,137,10,0.08)',
              border: '1px solid rgba(200,137,10,0.25)',
              borderRadius: '2px',
            }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" style={{ boxShadow: '0 0 6px #c8890a' }} />
            <span className="font-orbitron text-[9px] tracking-[0.45em]" style={{ color: 'rgba(200,137,10,0.75)' }}>
              SYSTEM ONLINE
            </span>
          </div>
        </div>

        {/* Title */}
        <div className={`transition-all duration-600 ${contentVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <h1
            className="font-orbitron font-black leading-none tracking-tight"
            style={{
              fontSize: 'clamp(4rem, 10vw, 6.5rem)',
              color: '#d8dde4',
              textShadow: '0 0 40px rgba(200,137,10,0.25), 3px 3px 0px rgba(0,0,0,0.95), 1px 1px 0px rgba(0,0,0,0.8)',
              letterSpacing: '-0.02em',
            }}
          >
            FACTORY
          </h1>
          <h2
            className="font-orbitron font-light tracking-[0.55em] mt-2"
            style={{
              fontSize: 'clamp(1.4rem, 3vw, 2rem)',
              color: 'rgba(200,137,10,0.75)',
              textShadow: '0 0 20px rgba(200,137,10,0.2)',
            }}
          >
            WORLD
          </h2>
        </div>

        {/* Rule */}
        <div className={`flex items-center gap-4 my-7 transition-all duration-500 ${contentVisible ? 'opacity-100' : 'opacity-0'}`}>
          <div
            className="flex-1 h-px"
            style={{ background: 'linear-gradient(to right, transparent, rgba(42,54,66,0.9))' }}
          />
          <span
            className="font-orbitron"
            style={{ fontSize: '8px', letterSpacing: '0.45em', color: 'rgba(200,137,10,0.35)' }}
          >
            BUILD · AUTOMATE · SURVIVE
          </span>
          <div
            className="flex-1 h-px"
            style={{ background: 'linear-gradient(to left, transparent, rgba(42,54,66,0.9))' }}
          />
        </div>

        {/* Start button */}
        <div className={`transition-all duration-500 ${btnVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
          <button
            onClick={onStart}
            className="btn-shine group px-16 py-4 font-orbitron font-bold tracking-widest transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            style={{
              fontSize: '13px',
              color: '#d4a030',
              borderRadius: '3px',
              clipPath: 'polygon(7px 0%, calc(100% - 7px) 0%, 100% 7px, 100% calc(100% - 7px), calc(100% - 7px) 100%, 7px 100%, 0% calc(100% - 7px), 0% 7px)',
            }}
          >
            <span className="flex items-center gap-3">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,3 19,12 5,21" />
              </svg>
              INITIALIZE
            </span>
          </button>

          <p
            className="font-exo mt-4"
            style={{ fontSize: '11px', color: 'rgba(255,255,255,0.12)', letterSpacing: '0.08em' }}
          >
            Press{' '}
            <kbd
              style={{
                padding: '2px 7px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '2px',
                color: 'rgba(255,255,255,0.25)',
                fontSize: '10px',
                fontFamily: 'Orbitron, sans-serif',
              }}
            >
              ENTER
            </kbd>{' '}
            to begin
          </p>
        </div>

        {/* Controls reference */}
        <div className={`mt-10 transition-all duration-500 ${btnVisible ? 'opacity-100' : 'opacity-0'}`}>
          <div
            className="inline-block p-4"
            style={{
              background: 'rgba(8,10,13,0.85)',
              border: '1px solid rgba(40,52,64,0.7)',
              borderRadius: '3px',
            }}
          >
            <div
              className="font-orbitron mb-3"
              style={{ fontSize: '8px', letterSpacing: '0.35em', color: 'rgba(200,137,10,0.35)' }}
            >
              CONTROL REFERENCE
            </div>
            <div className="grid grid-cols-4 gap-x-8 gap-y-1.5 font-exo text-xs">
              {[
                ['WASD', 'Move'], ['B', 'Build'], ['R', 'Research'], ['I', 'Inventory'],
                ['Q', 'Rotate'], ['LMB', 'Mine/Place'], ['RMB', 'Remove'], ['Scroll', 'Zoom'],
              ].map(([key, action]) => (
                <div key={key} className="flex items-center gap-2">
                  <kbd
                    style={{
                      padding: '1px 6px',
                      background: 'rgba(200,137,10,0.07)',
                      border: '1px solid rgba(200,137,10,0.18)',
                      borderRadius: '2px',
                      color: 'rgba(200,137,10,0.55)',
                      fontSize: '8px',
                      fontFamily: 'Orbitron, sans-serif',
                      minWidth: '26px',
                      textAlign: 'center',
                    }}
                  >
                    {key}
                  </kbd>
                  <span style={{ color: 'rgba(176,186,196,0.3)' }}>{action}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

