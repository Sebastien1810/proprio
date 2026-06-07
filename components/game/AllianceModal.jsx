'use client';

import { useState } from 'react';

export default function AllianceModal({ gameState, myPlayerId, incoming, onPropose, onAccept, onBreak, onClose }) {
  const [targetId, setTargetId] = useState('');

  const me       = gameState?.players?.find(p => p.id === myPlayerId);
  const others   = gameState?.players?.filter(p => p.id !== myPlayerId && p.alive) ?? [];
  const myAlliance = gameState?.alliances?.find(a =>
    a.status === 'active' && (a.p1 === myPlayerId || a.p2 === myPlayerId)
  );
  const allyId = myAlliance
    ? (myAlliance.p1 === myPlayerId ? myAlliance.p2 : myAlliance.p1)
    : null;
  const ally = allyId ? gameState?.players?.find(p => p.id === allyId) : null;

  if (incoming) {
    const fromPlayer = gameState?.players?.find(p => p.id === incoming.from);
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" data-testid="alliance-modal">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-proprio-card rounded-2xl p-6 max-w-sm w-full mx-4 border border-purple-500/30 shadow-2xl z-10 text-center">
          <div className="text-4xl mb-3">🤝</div>
          <h3 className="text-lg font-bold text-white mb-1">Proposition d'alliance</h3>
          <p className="text-gray-400 text-sm mb-5">
            <strong className="text-white">{fromPlayer?.name}</strong> vous propose une alliance secrète.
            <br /><span className="text-xs text-gray-500">Les loyers entre alliés seront exonérés.</span>
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => { onClose?.(); }}
              className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition"
            >
              Refuser
            </button>
            <button
              onClick={() => { onAccept?.(incoming.allianceId); onClose?.(); }}
              className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl transition"
              data-testid="alliance-accept-btn"
            >
              Accepter
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" data-testid="alliance-modal">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-proprio-card rounded-2xl p-6 max-w-sm w-full mx-4 border border-white/20 shadow-2xl z-10">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white text-xl">×</button>
        <h3 className="text-lg font-bold text-white mb-4">Alliance</h3>

        {myAlliance && ally ? (
          <div className="text-center">
            <div className="text-3xl mb-3">🤝</div>
            <p className="text-sm text-gray-300 mb-2">
              Tu es allié avec <strong className="text-white">{ally.name}</strong> depuis le tour {myAlliance.formedTurn}.
            </p>
            <p className="text-xs text-gray-500 mb-5">Loyers mutuels exonérés tant que l'alliance tient.</p>
            <button
              onClick={() => { onBreak?.(myAlliance.id); onClose?.(); }}
              className="w-full bg-red-900/60 hover:bg-red-800 border border-red-500/30 text-red-300 font-bold py-3 rounded-xl transition text-sm"
              data-testid="break-alliance-btn"
            >
              💔 Rompre l'alliance
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-4">
              Votre proposition sera secrète. Seul votre allié la verra.
            </p>
            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-1">Allié proposé</label>
              <select
                value={targetId}
                onChange={e => setTargetId(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-proprio-gold"
              >
                <option value="">Sélectionner…</option>
                {others.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <button
              onClick={() => { if (targetId) { onPropose?.(targetId); onClose?.(); } }}
              disabled={!targetId}
              className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition"
              data-testid="propose-alliance-btn"
            >
              Proposer l'alliance
            </button>
          </>
        )}
      </div>
    </div>
  );
}
