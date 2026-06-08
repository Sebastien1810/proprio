'use client';

import { useEffect, useRef, useState } from 'react';

const FACE_ROTATIONS = {
  1: { x:   0, y:   0 },
  2: { x: -90, y:   0 },
  3: { x:   0, y: -90 },
  4: { x:   0, y:  90 },
  5: { x:  90, y:   0 },
  6: { x:   0, y: 180 },
};

const DOT_LAYOUTS = {
  1: ['center'],
  2: ['top-left', 'bottom-right'],
  3: ['top-left', 'center', 'bottom-right'],
  4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
  5: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
  6: ['top-left', 'top-right', 'mid-left', 'mid-right', 'bottom-left', 'bottom-right'],
};

// [row, col] dans une grille 3×3
const GRID_POS = {
  'top-left':     [1, 1],
  'top-right':    [1, 3],
  'mid-left':     [2, 1],
  'center':       [2, 2],
  'mid-right':    [2, 3],
  'bottom-left':  [3, 1],
  'bottom-right': [3, 3],
};

const CUBE_FACES = [
  { value: 1, tx: 'translateZ(45px)' },
  { value: 6, tx: 'rotateY(180deg) translateZ(45px)' },
  { value: 3, tx: 'rotateY(90deg) translateZ(45px)' },
  { value: 4, tx: 'rotateY(-90deg) translateZ(45px)' },
  { value: 2, tx: 'rotateX(90deg) translateZ(45px)' },
  { value: 5, tx: 'rotateX(-90deg) translateZ(45px)' },
];

function DiceFace({ value, tx }) {
  const active = new Set(DOT_LAYOUTS[value] || []);
  return (
    <div style={{
      position: 'absolute', width: 90, height: 90,
      background: '#0a1628',
      border: '1.5px solid rgba(0, 255, 230, 0.25)',
      borderRadius: 14,
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gridTemplateRows: 'repeat(3, 1fr)',
      padding: 10,
      boxSizing: 'border-box',
      transform: tx,
      boxShadow: '0 0 12px rgba(0,255,200,0.15), inset 0 0 8px rgba(0,255,200,0.05)',
    }}>
      {Object.entries(GRID_POS).map(([pos, [row, col]]) => (
        <div
          key={pos}
          style={{ gridRow: row, gridColumn: col, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {active.has(pos) && (
            <div style={{
              width: 14, height: 14, borderRadius: '50%',
              background: '#00ffe6',
              boxShadow: '0 0 6px #00ffe6, 0 0 12px rgba(0,255,230,0.6)',
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

function Cube3D({ cubeRef, duration }) {
  return (
    <div style={{ width: 90, height: 90, perspective: 500 }}>
      <div
        ref={cubeRef}
        style={{
          width: 90, height: 90,
          position: 'relative',
          transformStyle: 'preserve-3d',
          transition: `transform ${duration}s cubic-bezier(0.15, 0.5, 0.1, 1)`,
        }}
      >
        {CUBE_FACES.map(({ value, tx }) => (
          <DiceFace key={value} value={value} tx={tx} />
        ))}
      </div>
    </div>
  );
}

export default function DiceRoll({ result, onDone }) {
  const cube1Ref   = useRef(null);
  const cube2Ref   = useRef(null);
  const onDoneRef  = useRef(onDone);
  const [visible,  setVisible]  = useState(false);
  const [showBadge, setShowBadge] = useState(false);

  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    if (!result) return;

    setVisible(true);
    setShowBadge(false);

    const [v1, v2] = result.diceValues ?? [1, 1];
    const r1 = FACE_ROTATIONS[v1] ?? { x: 0, y: 0 };
    const r2 = FACE_ROTATIONS[v2] ?? { x: 0, y: 0 };

    // Rotations fixes (non cumulatives) — 2 et 3 tours complets
    const tx1 = r1.x + 2 * 360;
    const ty1 = r1.y + 2 * 360;
    const tx2 = r2.x + 3 * 360;
    const ty2 = r2.y + 3 * 360;

    // Étape 1 : reset instantané vers position neutre (sans transition)
    [cube1Ref, cube2Ref].forEach(ref => {
      if (ref.current) {
        ref.current.style.transition = 'none';
        ref.current.style.transform  = 'rotateX(0deg) rotateY(0deg)';
      }
    });

    // Étape 2 : deux rAF pour garantir le rendu avant d'animer
    let raf2;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (cube1Ref.current) {
          cube1Ref.current.style.transition = 'transform 1.4s cubic-bezier(0.15, 0.5, 0.1, 1)';
          cube1Ref.current.style.transform  = `rotateX(${tx1}deg) rotateY(${ty1}deg)`;
        }
        if (cube2Ref.current) {
          cube2Ref.current.style.transition = 'transform 1.6s cubic-bezier(0.15, 0.5, 0.1, 1)';
          cube2Ref.current.style.transform  = `rotateX(${tx2}deg) rotateY(${ty2}deg)`;
        }
      });
    });

    const t1 = setTimeout(() => setShowBadge(true), 1600);
    const t2 = setTimeout(() => {
      setVisible(false);
      setShowBadge(false);
      onDoneRef.current?.();
    }, 2400);

    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [result]);

  if (!visible || !result) return null;

  const [d1, d2] = result.diceValues ?? [1, 1];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
      data-testid="dice-roll-overlay"
    >
      <div className="flex flex-col items-center gap-6">
        <div className="flex gap-8 items-center">
          <Cube3D cubeRef={cube1Ref} duration={1.4} />
          <Cube3D cubeRef={cube2Ref} duration={1.6} />
        </div>

        {showBadge && (
          <div className="flex flex-col items-center gap-2">
            <span className="text-white/60 text-sm font-mono tabular-nums">{d1 + d2}</span>

            {result.sentToJail && (
              <span
                data-testid="badge-jail"
                style={{
                  background: 'rgba(239,68,68,0.12)',
                  color: '#ff4444',
                  border: '1px solid rgba(239,68,68,0.3)',
                  textShadow: '0 0 8px #ff4444',
                  fontFamily: 'var(--font-bebas), Impact, sans-serif',
                  letterSpacing: '0.12em',
                  padding: '6px 20px',
                  borderRadius: 999,
                  fontSize: 18,
                }}
              >
                🚔 PRISON
              </span>
            )}
            {result.isDouble && !result.sentToJail && (
              <span
                data-testid="badge-double"
                style={{
                  background: 'rgba(0,255,200,0.12)',
                  color: '#00ffe6',
                  border: '1px solid rgba(0,255,200,0.3)',
                  textShadow: '0 0 8px #00ffe6',
                  fontFamily: 'var(--font-bebas), Impact, sans-serif',
                  letterSpacing: '0.12em',
                  padding: '6px 20px',
                  borderRadius: 999,
                  fontSize: 18,
                }}
              >
                ✦ DOUBLE — TU REJOUES
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
