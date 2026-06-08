'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import IsoTile from './IsoTile';

export function squareToGrid(idx, gridN) {
  const n = gridN;
  if (idx < n)            return { row: n - 1,              col: idx                     };
  if (idx < 2 * n - 1)   return { row: n - 1 - (idx - n + 1), col: n - 1               };
  if (idx < 3 * n - 2)   return { row: 0,                   col: n - 1 - (idx - (2*n-1) + 1) };
  return                         { row: idx - (3*n-2) + 1,  col: 0                      };
}

const PAD = 40;

const CTRL_BTN = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 32, height: 32,
  background: 'rgba(10,22,40,0.82)',
  color: '#00ffe6',
  border: '1px solid rgba(0,255,230,0.28)',
  borderRadius: 8,
  fontSize: 16,
  cursor: 'pointer',
  userSelect: 'none',
  boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
};

export default function Board({ gameState, myPlayerId, selectedSquareId, onTileClick }) {
  const [pan,    setPan]    = useState({ x: 0, y: 0 });
  const [scale,  setScale]  = useState(1);
  const [rotate, setRotate] = useState(0);

  const containerRef = useRef(null);
  const isDragging   = useRef(false);
  const isRotating   = useRef(false);
  const lastPos      = useRef({ x: 0, y: 0 });
  const dragDist     = useRef(0);   // pour distinguer click vs drag

  // Zoom molette — listener non-passif pour pouvoir appeler preventDefault
  const onWheel = useCallback((e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setScale(s => Math.max(0.15, Math.min(5, s * factor)));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  const onMouseDown = useCallback((e) => {
    dragDist.current = 0;
    lastPos.current  = { x: e.clientX, y: e.clientY };
    if (e.button === 2) {
      e.preventDefault();
      isRotating.current = true;
    } else {
      isDragging.current = true;
    }
  }, []);

  const onMouseMove = useCallback((e) => {
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    dragDist.current += Math.abs(dx) + Math.abs(dy);
    lastPos.current   = { x: e.clientX, y: e.clientY };

    if (isDragging.current)  setPan(p => ({ x: p.x + dx, y: p.y + dy }));
    if (isRotating.current)  setRotate(r => r + dx * 0.35);
  }, []);

  const onMouseUp = useCallback(() => {
    isDragging.current  = false;
    isRotating.current  = false;
  }, []);

  function handleReset(e) {
    e.stopPropagation();
    setPan({ x: 0, y: 0 });
    setScale(1);
    setRotate(0);
  }

  function zoomIn(e) {
    e.stopPropagation();
    setScale(s => Math.min(5, s * 1.2));
  }

  function zoomOut(e) {
    e.stopPropagation();
    setScale(s => Math.max(0.15, s / 1.2));
  }

  if (!gameState) return null;

  const boardSize = gameState.boardSize;
  const gridN     = boardSize / 4 + 1;

  const W = Math.max(32, Math.floor(800 / gridN));
  const H = Math.floor(W * 0.55);
  const D = Math.max(6, Math.floor(H * 0.28));

  const svgW = (gridN - 1) * W + W + PAD * 2;
  const svgH = (gridN - 1) * H + H + D + PAD * 2;
  const offX = (gridN - 1) * W / 2 + W / 2 + PAD;
  const offY = H / 2 + PAD;

  const playersByPos = useMemo(() => {
    const map = {};
    for (const p of gameState.players) {
      if (!p.alive) continue;
      if (!map[p.position]) map[p.position] = [];
      map[p.position].push(p);
    }
    return map;
  }, [gameState.players]);

  const playersById = useMemo(() => {
    const map = {};
    for (const p of gameState.players) map[p.id] = p;
    return map;
  }, [gameState.players]);

  const tiles = useMemo(() => {
    return gameState.board.map((sq, idx) => {
      const { row, col } = squareToGrid(idx, gridN);
      const isoX    = (col - row) * W / 2;
      const isoY    = (col + row) * H / 2;
      const screenX = offX + isoX;
      const screenY = offY + isoY;
      return { sq, screenX, screenY, idx };
    });
  }, [gameState.board, gridN, W, H, offX, offY]);

  const sortedTiles = useMemo(
    () => [...tiles].sort((a, b) => a.screenY - b.screenY || a.screenX - b.screenX),
    [tiles]
  );

  const centerX = offX;
  const centerY = offY + (gridN - 1) * H / 2;

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
      style={{ position: 'relative' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onContextMenu={e => e.preventDefault()}
      data-testid="board"
    >
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        preserveAspectRatio="xMidYMid meet"
        style={{
          width: '95%', height: '95%',
          userSelect: 'none',
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale}) rotate(${rotate}deg)`,
          transformOrigin: 'center center',
          willChange: 'transform',
        }}
      >
        {sortedTiles.map(({ sq, screenX, screenY, idx }) => (
          <IsoTile
            key={sq.id ?? idx}
            sq={sq}
            cx={screenX}
            cy={screenY}
            W={W}
            H={H}
            D={D}
            players={playersByPos[idx] ?? []}
            ownerPlayer={sq.ownerId ? (playersById[sq.ownerId] ?? null) : null}
            colocPlayers={(sq.coOwners ?? []).map(id => playersById[id]).filter(Boolean)}
            isSelected={sq.id === selectedSquareId}
            isNight={gameState?.isNight ?? false}
            onClick={() => {
              if (dragDist.current < 6) onTileClick?.(sq);
            }}
          />
        ))}

        <g transform={`translate(${centerX}, ${centerY})`} style={{ pointerEvents: 'none' }}>
          <ellipse rx={W * 1.8} ry={H * 1.8} fill="rgba(22,33,62,0.85)" />
          <ellipse rx={W * 1.8} ry={H * 1.8} fill="none" stroke="rgba(245,166,35,0.2)" strokeWidth="1" />
          <text
            y={-H * 0.25}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={Math.round(W * 0.48)}
            fill="#f5a623"
            style={{ fontFamily: 'var(--font-bebas), Impact, sans-serif', letterSpacing: '0.08em' }}
            data-testid="board-logo"
          >
            PROPRIO
          </text>
          <text
            y={H * 0.55}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={Math.round(H * 0.65)}
            data-testid="day-night-icon"
          >
            {gameState.isNight ? '🌙' : '☀️'}
          </text>
        </g>
      </svg>

      {/* Contrôles plateau */}
      <div style={{
        position: 'absolute', bottom: 92, right: 14,
        display: 'flex', flexDirection: 'column', gap: 5,
        zIndex: 10,
      }}>
        <button style={CTRL_BTN} onClick={zoomIn}  title="Zoom +">＋</button>
        <button style={CTRL_BTN} onClick={zoomOut} title="Zoom −">－</button>
        <button style={{ ...CTRL_BTN, fontSize: 18 }} onClick={handleReset} title="Réinitialiser">↺</button>
      </div>
    </div>
  );
}
