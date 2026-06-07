'use client';

import { useEffect, useRef, useState } from 'react';

function CashChip({ player, isActive, isMe, prevCash }) {
  const [delta, setDelta]   = useState(null);
  const prevRef             = useRef(prevCash);

  useEffect(() => {
    if (prevRef.current !== null && prevRef.current !== player.cash) {
      const diff = player.cash - prevRef.current;
      setDelta(diff);
      prevRef.current = player.cash;
      const t = setTimeout(() => setDelta(null), 1800);
      return () => clearTimeout(t);
    }
    prevRef.current = player.cash;
  }, [player.cash]);

  return (
    <div
      className={`
        relative flex items-center gap-2 px-3 py-2 rounded-xl border transition-all
        ${isActive
          ? 'bg-proprio-gold/20 border-proprio-gold/60 shadow-lg shadow-proprio-gold/20'
          : player.disconnected
            ? 'bg-white/3 border-white/10 opacity-40'
            : 'bg-white/5 border-white/10'
        }
        ${isMe ? 'ring-1 ring-white/30' : ''}
      `}
    >
      <span
        className="w-4 h-4 rounded-full flex-shrink-0 text-xs flex items-center justify-center"
        style={{
          backgroundColor: player.color,
          boxShadow: isActive ? `0 0 8px ${player.color}` : 'none',
        }}
      >
        {player.pion?.emoji ?? '●'}
      </span>
      <div className="min-w-0">
        <div className={`text-xs font-semibold truncate max-w-[80px] ${isActive ? 'text-white' : 'text-gray-300'}`}>
          {player.name}{isMe ? ' (toi)' : ''}
        </div>
        <div className={`font-bebas tracking-wider text-sm ${isActive ? 'text-proprio-gold' : 'text-gray-400'}`}>
          {player.cash.toLocaleString()}€
        </div>
      </div>

      {/* Delta animation */}
      {delta !== null && (
        <span
          className={`absolute -top-4 right-1 text-xs font-bold animate-bounce
            ${delta > 0 ? 'text-green-400' : 'text-red-400'}`}
        >
          {delta > 0 ? '+' : ''}{delta}€
        </span>
      )}
    </div>
  );
}

export default function HudBar({ gameState, myPlayerId, prevCashMap }) {
  if (!gameState) return null;

  const { players, currentPlayerIndex, turn, isNight } = gameState;
  const activePlayer = players[currentPlayerIndex];

  return (
    <div
      className="fixed top-0 left-0 right-0 z-40 bg-proprio-dark/90 backdrop-blur-md border-b border-white/10"
      data-testid="hud-bar"
    >
      <div className="flex items-center gap-3 px-4 py-2 overflow-x-auto">
        {/* Players chips */}
        <div className="flex gap-2 flex-shrink-0">
          {players.filter(p => p.alive).map(p => (
            <CashChip
              key={p.id}
              player={p}
              isActive={p.id === activePlayer?.id}
              isMe={p.id === myPlayerId}
              prevCash={prevCashMap?.[p.id] ?? null}
            />
          ))}
        </div>

        {/* Center info */}
        <div className="flex-1 text-center flex-shrink-0 hidden sm:block">
          <div className="text-xs text-gray-400">Tour {turn + 1}</div>
          <div className="text-sm font-bold text-white">
            {activePlayer?.name} joue
          </div>
        </div>

        {/* Day/night */}
        <div
          className={`
            flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border
            transition-all duration-1000
            ${isNight
              ? 'bg-indigo-900/60 border-indigo-500/40 text-indigo-300'
              : 'bg-yellow-900/40 border-yellow-500/30 text-yellow-300'
            }
          `}
          data-testid="day-night-indicator"
        >
          <span className="text-base">{isNight ? '🌙' : '☀️'}</span>
          <span className="text-xs">{isNight ? 'Nuit' : 'Jour'}</span>
        </div>

        {/* Strike badge */}
        {gameState.strikeActive && (
          <div className="flex-shrink-0 bg-orange-900/70 border border-orange-500/50 text-orange-300 text-xs px-3 py-1.5 rounded-xl font-medium" data-testid="strike-badge">
            🚇 Grève
          </div>
        )}
      </div>
    </div>
  );
}
