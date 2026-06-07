'use client';

import { useEffect, useState } from 'react';

export default function ColocModal({ data, gameState, myPlayerId, onOffer, onAccept, onAuction, onClose }) {
  // data: { propertyId, leavingPlayerId, stayingPlayerId, negotiationId }
  const [amount,   setAmount]   = useState('');
  const [timeLeft, setTimeLeft] = useState(60);
  const [error,    setError]    = useState('');

  const sq      = gameState?.board?.find(s => s.id === data?.propertyId);
  const leaving = gameState?.players?.find(p => p.id === data?.leavingPlayerId);
  const staying = gameState?.players?.find(p => p.id === data?.stayingPlayerId);
  const isLeaving = data?.leavingPlayerId === myPlayerId;
  const isStaying = data?.stayingPlayerId === myPlayerId;

  const neg = gameState?.negotiations?.find(n => n.id === data?.negotiationId);
  const currentOffer = neg?.offer ?? null;
  const offeror = currentOffer !== null
    ? gameState?.players?.find(p => p.id === neg?.fromId)
    : null;

  useEffect(() => {
    if (!data) return;
    const t = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(t); onAuction?.(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [data?.negotiationId]);

  if (!data || !sq) return null;

  const timerColor = timeLeft <= 10 ? '#ef4444' : timeLeft <= 20 ? '#f59e0b' : '#22c55e';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" data-testid="coloc-modal">
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative bg-proprio-card rounded-2xl p-6 max-w-md w-full mx-4 border border-white/20 shadow-2xl z-10">
        {/* Timer */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white">Colocation — {sq.name}</h3>
          <span className="text-xl font-mono font-bold" style={{ color: timerColor }}>{timeLeft}s</span>
        </div>

        <div className="h-1 bg-white/10 rounded-full mb-4 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${(timeLeft / 60) * 100}%`, backgroundColor: timerColor }}
          />
        </div>

        {/* Leaving player view */}
        {isLeaving && (
          <div>
            <p className="text-sm text-gray-300 mb-4">
              Tu quittes la coloc avec <strong>{staying?.name}</strong>. Propose un prix de rachat.
            </p>
            {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
            <div className="flex gap-3">
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="Montant (€)"
                className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-3 text-white focus:outline-none focus:border-proprio-gold font-mono"
              />
              <button
                onClick={() => {
                  const n = parseInt(amount, 10);
                  if (!n || n <= 0) { setError('Montant invalide'); return; }
                  setError('');
                  onOffer?.({ negotiationId: data.negotiationId, amount: n });
                }}
                className="bg-proprio-accent hover:bg-red-600 text-white font-bold px-5 py-3 rounded-lg transition"
              >
                Proposer
              </button>
            </div>
            <button
              onClick={() => onAuction?.()}
              className="w-full mt-3 text-gray-500 hover:text-gray-300 text-xs py-2 transition"
            >
              Passer aux enchères
            </button>
          </div>
        )}

        {/* Staying player view */}
        {isStaying && (
          <div>
            <p className="text-sm text-gray-300 mb-4">
              <strong>{leaving?.name}</strong> veut quitter la coloc.
            </p>
            {currentOffer !== null ? (
              <>
                <div className="bg-white/5 rounded-xl p-4 mb-4 text-center">
                  <div className="text-xs text-gray-400 mb-1">Offre de rachat</div>
                  <div className="text-2xl font-mono font-bold text-proprio-gold">{currentOffer}€</div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => onAuction?.()}
                    className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition text-sm"
                  >
                    Enchères
                  </button>
                  <button
                    onClick={() => onAccept?.({ negotiationId: data.negotiationId })}
                    className="flex-1 bg-proprio-green hover:bg-green-500 text-white font-bold py-3 rounded-xl transition text-sm"
                  >
                    Accepter {currentOffer}€
                  </button>
                </div>
              </>
            ) : (
              <p className="text-center text-gray-500 text-sm py-4">
                En attente d'une offre…
              </p>
            )}
          </div>
        )}

        {/* Spectator view */}
        {!isLeaving && !isStaying && (
          <p className="text-center text-gray-400 text-sm py-4">
            {leaving?.name} et {staying?.name} négocient une coloc…
          </p>
        )}
      </div>
    </div>
  );
}
