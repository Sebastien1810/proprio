'use client';

import { useEffect, useState } from 'react';

export default function EventCardReveal({ card, playerName, onDone }) {
  // card: { label, type, amount? }
  const [phase, setPhase] = useState('enter'); // enter | flip | show | exit

  useEffect(() => {
    if (!card) return;
    setPhase('enter');
    const t1 = setTimeout(() => setPhase('flip'),  400);
    const t2 = setTimeout(() => setPhase('show'),  800);
    const t3 = setTimeout(() => setPhase('exit'), 3000);
    const t4 = setTimeout(() => { onDone?.(); }, 3400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [card]);

  if (!card || phase === 'exit') return null;

  const isPositive = card.amount > 0 || ['cash', 'per_prop', 'half_next_build', 'collect_all_rents', 'rent_modifier'].includes(card.type) && (card.amount ?? 0) > 0 || ['cash_from_all', 'cash_from_richest', 'airbnb', 'heritage_oncle', 'secu', 'alloc'].includes(card.id);
  const bg = isPositive ? 'bg-green-900/95' : 'bg-red-900/95';

  const cardStyle = {
    transform: phase === 'enter'
      ? 'perspective(600px) rotateX(60deg) translateY(40px) scale(0.8)'
      : phase === 'show'
        ? 'perspective(600px) rotateX(0deg) translateY(0px) scale(1)'
        : 'perspective(600px) rotateX(60deg) translateY(40px) scale(0.8)',
    opacity: phase === 'enter' ? 0 : phase === 'show' ? 1 : 0,
    transition: 'transform 0.4s cubic-bezier(0.34,1.4,0.64,1), opacity 0.35s ease',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none" data-testid="event-card-overlay">
      <div style={cardStyle} className={`${bg} border border-white/20 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl text-center`}>
        <div className="text-5xl mb-4">✉️</div>
        <div className="text-xs text-gray-300 uppercase tracking-widest mb-2">Courrier du Jour</div>
        {playerName && <div className="text-sm text-gray-400 mb-3">{playerName} a tiré :</div>}
        <div className="text-xl font-bold text-white mb-2">{card.label}</div>
        {card.amount !== undefined && (
          <div className={`text-2xl font-mono font-black ${card.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {card.amount >= 0 ? '+' : ''}{card.amount}€
          </div>
        )}
      </div>
    </div>
  );
}
