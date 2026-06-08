'use client';

import { useEffect, useRef } from 'react';

const NAMES = [
  'BabinskiGoy', 'Samuel', 'Sxb', 'Pichichi', 'Yanma',
  'Rocket', 'Inss', 'Weez', 'Rbz', 'Sannael',
  'Yorick', 'Biggy', 'Louis', 'LOA', 'Joker',
];
const SEQ     = NAMES.join('');
const FONT_SZ = 12;
const TRAIL   = 22;

// Day palette:  bg #1c1c24 (dark gray), trail #00ffc8
// Night palette: bg #04091c (deep navy blue), trail #a855f7
const DAY_BG    = [28,  28,  36];  // #1c1c24 — dark gray
const NIGHT_BG  = [4,    9,  28];  // #04091c — deep navy blue
const DAY_TRAIL = [0,   255, 200];  // #00ffc8
const NIGHT_TRAIL = [168, 85, 247]; // #a855f7

function lerp(a, b, t) { return a + (b - a) * t; }

export default function MatrixBackground({ opacity = 0.4, isNight = false }) {
  const canvasRef    = useRef(null);
  const isNightRef   = useRef(isNight);
  const nightFactor  = useRef(isNight ? 1 : 0);  // 0=day, 1=night, interpolated

  // Keep isNightRef in sync without restarting the animation loop
  useEffect(() => {
    isNightRef.current = isNight;
  }, [isNight]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let rafId;
    let cols = [];

    function init(w, h) {
      const n = Math.ceil(w / FONT_SZ);
      cols = Array.from({ length: n }, (_, i) => ({
        x:      i * FONT_SZ + FONT_SZ / 2,
        headPx: Math.random() * (h + TRAIL * FONT_SZ) - TRAIL * FONT_SZ,
        speed:  0.3 + Math.random() * 0.2,
        seqPos: Math.floor(Math.random() * SEQ.length),
        trail:  [],
      }));
    }

    function resize() {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      init(canvas.width, canvas.height);
    }

    function frame() {
      // Smooth lerp toward target night state (k≈0.03 → ~2s transition at 60fps)
      const target = isNightRef.current ? 1 : 0;
      nightFactor.current += (target - nightFactor.current) * 0.03;
      const nf = nightFactor.current;

      // Background fill with interpolated color
      const bgR = Math.round(lerp(DAY_BG[0],    NIGHT_BG[0],    nf));
      const bgG = Math.round(lerp(DAY_BG[1],    NIGHT_BG[1],    nf));
      const bgB = Math.round(lerp(DAY_BG[2],    NIGHT_BG[2],    nf));
      ctx.fillStyle = `rgb(${bgR},${bgG},${bgB})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Trail color
      const tR = Math.round(lerp(DAY_TRAIL[0],   NIGHT_TRAIL[0],  nf));
      const tG = Math.round(lerp(DAY_TRAIL[1],   NIGHT_TRAIL[1],  nf));
      const tB = Math.round(lerp(DAY_TRAIL[2],   NIGHT_TRAIL[2],  nf));

      ctx.font      = `${FONT_SZ}px monospace`;
      ctx.textAlign = 'center';

      for (const col of cols) {
        col.headPx += col.speed;

        const headRow = Math.floor(col.headPx / FONT_SZ);
        const prevRow = col.trail.length > 0 ? col.trail[0].row : headRow - 1;

        for (let r = prevRow + 1; r <= headRow; r++) {
          col.trail.unshift({ row: r, charIdx: col.seqPos });
          col.seqPos = (col.seqPos + 1) % SEQ.length;
        }
        if (col.trail.length > TRAIL) col.trail.length = TRAIL;

        if (col.headPx > canvas.height + TRAIL * FONT_SZ) {
          col.headPx = -FONT_SZ - Math.random() * TRAIL * FONT_SZ;
          col.trail  = [];
        }

        for (let j = 0; j < col.trail.length; j++) {
          const { row, charIdx } = col.trail[j];
          const py = row * FONT_SZ;
          if (py + FONT_SZ < 0 || py > canvas.height) continue;

          if (j === 0) {
            ctx.fillStyle = '#ffffff';
          } else {
            const alpha = Math.pow((TRAIL - j) / TRAIL, 1.7).toFixed(3);
            ctx.fillStyle = `rgba(${tR},${tG},${tB},${alpha})`;
          }
          ctx.fillText(SEQ[charIdx], col.x, py + FONT_SZ);
        }
      }

      rafId = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener('resize', resize);
    frame();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position:      'fixed',
        inset:         0,
        width:         '100%',
        height:        '100%',
        zIndex:        -1,
        opacity,
        pointerEvents: 'none',
      }}
    />
  );
}
