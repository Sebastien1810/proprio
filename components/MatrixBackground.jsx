'use client';

import { useEffect, useRef } from 'react';

const NAMES = [
  'BabinskiGoy', 'Samuel', 'Sxb', 'Pichichi', 'Yanma',
  'Rocket', 'Inss', 'Weez', 'Rbz', 'Sannael',
  'Yorick', 'Biggy', 'Louis', 'LOA', 'Joker',
];

const FONT_SIZE   = 12;
const COL_WIDTH   = 90;
const LINE_GAP    = 32;
const STREAM_LEN  = 13;
const TAIL_H      = (STREAM_LEN - 1) * LINE_GAP; // 384 px

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function MatrixBackground({ opacity = 0.4 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let rafId;
    let cols = [];

    function buildCols(w, h) {
      const n = Math.ceil(w / COL_WIDTH);
      cols = Array.from({ length: n }, (_, i) => ({
        x:     i * COL_WIDTH + COL_WIDTH / 2,
        // scatter: some columns start mid-screen, others above
        y:     Math.random() * (h + TAIL_H) - TAIL_H,
        speed: 0.3 + Math.random() * 0.2,
        names: shuffle(NAMES),
      }));
    }

    function resize() {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      buildCols(canvas.width, canvas.height);
    }

    function tick() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font      = `${FONT_SIZE}px monospace`;
      ctx.textAlign = 'center';

      for (const col of cols) {
        col.y += col.speed;

        // Reset once the entire stream has scrolled past the bottom
        if (col.y - TAIL_H > canvas.height + FONT_SIZE) {
          col.y     = -FONT_SIZE - Math.random() * 200;
          col.names = shuffle(NAMES);
        }

        for (let j = 0; j < STREAM_LEN; j++) {
          const ny = col.y - j * LINE_GAP;
          if (ny < -FONT_SIZE || ny > canvas.height + FONT_SIZE) continue;

          if (j === 0) {
            ctx.fillStyle = '#ffffff';
          } else {
            // fade from bright teal to transparent toward the tail
            const t     = (STREAM_LEN - j) / STREAM_LEN;
            const alpha = Math.pow(t, 1.7).toFixed(3);
            ctx.fillStyle = `rgba(0,255,200,${alpha})`;
          }

          ctx.fillText(col.names[j % col.names.length], col.x, ny);
        }
      }

      rafId = requestAnimationFrame(tick);
    }

    resize();
    window.addEventListener('resize', resize);
    tick();

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
