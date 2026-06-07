'use client';

import { useEffect, useRef, useState } from 'react';

export default function AuctionPanel({ auction, gameState, myPlayerId, onBid, onClose }) {
  // auction: { auctionId, propertyId, startingBid }
  const [bid,         setBid]         = useState('');
  const [timeLeft,    setTimeLeft]    = useState(30);
  const [error,       setError]       = useState('');
  const timerRef                      = useRef(null);

  const sq      = gameState?.board?.find(s => s.id === auction?.propertyId);
  const current = gameState?.auctions?.find(a => a.id === auction?.auctionId);

  // Timer countdown
  useEffect(() => {
    if (!auction) return;
    setTimeLeft(30);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); onClose?.(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [auction?.auctionId]);

  // Reset timer to 10 on new bid
  useEffect(() => {
    if (!current?.currentBid) return;
    clearInterval(timerRef.current);
    setTimeLeft(10);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
  }, [current?.currentBid]);

  if (!auction || !sq) return null;

  const me        = gameState?.players?.find(p => p.id === myPlayerId);
  const minBid    = (current?.currentBid ?? 0) + 1;
  const bidder    = current?.currentBidder
    ? gameState?.players?.find(p => p.id === current.currentBidder)
    : null;

  function handleBid() {
    const amount = parseInt(bid, 10);
    if (!amount || amount < minBid) { setError(`Enchère min : ${minBid}€`); return; }
    if (me && amount > me.cash) { setError('Pas assez d\'argent'); return; }
    setError('');
    onBid(auction.auctionId, amount);
    setBid('');
  }

  const timerPct = timeLeft / 30 * 100;
  const timerColor = timeLeft <= 5 ? '#ef4444' : timeLeft <= 10 ? '#f59e0b' : '#22c55e';

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 bg-proprio-card border-t border-white/20 shadow-2xl"
      style={{
        transform: 'translateY(0)',
        animation: 'slideUp 0.3s ease-out',
      }}
      data-testid="auction-panel"
    >
      <div className="max-w-lg mx-auto p-5">
        {/* Timer bar */}
        <div className="h-1 bg-white/10 rounded-full mb-4 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${timerPct}%`, backgroundColor: timerColor }}
          />
        </div>

        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-widest">Enchères</div>
            <div className="text-lg font-bold text-white">{sq.name}</div>
            <div className="text-sm text-gray-400">Prix de base : {sq.price}€</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-mono font-black text-proprio-gold">
              {current?.currentBid ? `${current.currentBid}€` : 'Mise de départ'}
            </div>
            {bidder && <div className="text-xs text-gray-400">{bidder.name} mène</div>}
            <div className="text-xs font-mono mt-1" style={{ color: timerColor }}>{timeLeft}s</div>
          </div>
        </div>

        {error && <p className="text-xs text-red-400 mb-2">{error}</p>}

        <div className="flex gap-3">
          <input
            type="number"
            value={bid}
            onChange={e => setBid(e.target.value)}
            placeholder={`Min ${minBid}€`}
            className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-proprio-gold font-mono"
            data-testid="auction-bid-input"
          />
          <button
            onClick={handleBid}
            className="bg-proprio-accent hover:bg-red-600 text-white font-bold px-6 py-3 rounded-lg transition"
            data-testid="auction-bid-btn"
          >
            Enchérir
          </button>
        </div>

        <p className="text-center text-xs text-gray-600 mt-3">
          {timeLeft <= 0 ? 'Enchères terminées' : `${timeLeft}s — sans enchère → propriété non vendue`}
        </p>
      </div>
    </div>
  );
}
