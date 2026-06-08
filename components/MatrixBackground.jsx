'use client';

import { useEffect, useRef } from 'react';

const NAMES = [
  'BabinskiGoy', 'Samuel', 'Sxb', 'Pichichi', 'Yanma',
  'Rocket', 'Inss', 'Weez', 'Rbz', 'Sannael',
  'Yorick', 'Biggy', 'Louis', 'LOA', 'Joker',
];
// Flat sequence of letters, cycled through by each column
const SEQ     = NAMES.join('');
const FONT_SZ = 12;
const TRAIL   = 22; // characters in each falling stream

export default function MatrixBackground({ opacity = 0.4 }) {
  const canvasRef = useRef(null);

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
        // scatter: some columns start mid-screen, some above
        headPx: Math.random() * (h + TRAIL * FONT_SZ) - TRAIL * FONT_SZ,
        speed:  0.3 + Math.random() * 0.2,           // px / frame
        seqPos: Math.floor(Math.random() * SEQ.length),
        trail:  [],   // [{ row, charIdx }], index 0 = head (bottom)
      }));
    }

    function resize() {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      init(canvas.width, canvas.height);
    }

    function frame() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font      = `${FONT_SZ}px monospace`;
      ctx.textAlign = 'center';

      for (const col of cols) {
        col.headPx += col.speed;

        const headRow = Math.floor(col.headPx / FONT_SZ);
        const prevRow = col.trail.length > 0 ? col.trail[0].row : headRow - 1;

        // Extend trail for every new row the head has entered this frame
        // (at most 1 per frame since speed ≤ 0.5 px/frame and FONT_SZ = 12)
        for (let r = prevRow + 1; r <= headRow; r++) {
          col.trail.unshift({ row: r, charIdx: col.seqPos });
          col.seqPos = (col.seqPos + 1) % SEQ.length;
        }
        if (col.trail.length > TRAIL) col.trail.length = TRAIL;

        // Reset once the whole stream has scrolled past the bottom
        if (col.headPx > canvas.height + TRAIL * FONT_SZ) {
          col.headPx = -FONT_SZ - Math.random() * TRAIL * FONT_SZ;
          col.trail  = [];
          // seqPos keeps advancing naturally through the sequence
        }

        // Draw each character in the stream
        for (let j = 0; j < col.trail.length; j++) {
          const { row, charIdx } = col.trail[j];
          const py = row * FONT_SZ;
          if (py + FONT_SZ < 0 || py > canvas.height) continue;

          // j=0 → head → white; j>0 → teal fading to transparent
          ctx.fillStyle = j === 0
            ? '#ffffff'
            : `rgba(0,255,200,${Math.pow((TRAIL - j) / TRAIL, 1.5).toFixed(3)})`;

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
