'use client';

import { useState } from 'react';

export default function AllianceModal({ gameState, myPlayerId, incoming, onPropose, onAccept, onBreak, onClose }) {
  const [targetId, setTargetId] = useState('');

  const others     = gameState?.players?.filter(p => p.id !== myPlayerId && p.alive) ?? [];
  const myAlliance = gameState?.alliances?.find(a =>
    a.status === 'active' && (a.p1 === myPlayerId || a.p2 === myPlayerId)
  );
  const allyId  = myAlliance ? (myAlliance.p1 === myPlayerId ? myAlliance.p2 : myAlliance.p1) : null;
  const ally    = allyId ? gameState?.players?.find(p => p.id === allyId) : null;

  // ── Incoming proposal view ────────────────────────────────────────────────
  if (incoming) {
    const fromPlayer = gameState?.players?.find(p => p.id === incoming.from);
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" data-testid="alliance-modal">
        <div className="absolute inset-0 bg-black/60" />
        <div
          className="relative rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl z-10 text-center"
          style={{
            background:  '#0d0e1a',
            border:      '1px solid rgba(168,85,247,0.45)',
            boxShadow:   '0 0 32px rgba(168,85,247,0.25)',
            animation:   'fadeIn 0.25s ease-out',
          }}
        >
          <div className="text-4xl mb-3">🤝</div>
          <h3 className="text-lg font-bold text-white mb-1">Proposition d'alliance</h3>
          <p className="text-gray-400 text-sm mb-2">
            <strong className="text-white">{fromPlayer?.name ?? '?'}</strong> te propose une alliance secrète.
          </p>
          <p className="text-xs mb-5" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Les loyers entre alliés seront exonérés.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => onClose?.()}
              className="flex-1 font-bold py-3 rounded-xl transition text-sm border"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.1)' }}
            >
              Refuser
            </button>
            <button
              onClick={() => { onAccept?.(incoming.allianceId); onClose?.(); }}
              className="flex-1 font-bold py-3 rounded-xl transition text-sm"
              style={{ background: '#a855f7', color: '#fff' }}
              data-testid="alliance-accept-btn"
            >
              Accepter ✓
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Propose / manage view ─────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" data-testid="alliance-modal">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl z-10"
        style={{ background: '#0d0e1a', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white text-xl transition"
        >
          ×
        </button>
        <h3 className="text-lg font-bold text-white mb-4">Alliance</h3>

        {myAlliance && ally ? (
          /* ── Active alliance ── */
          <div className="text-center">
            <div className="text-3xl mb-3">🤝</div>
            <p className="text-sm text-gray-300 mb-1">
              Allié avec <strong className="text-white">{ally.name}</strong> depuis le tour {myAlliance.formedTurn}.
            </p>
            <p className="text-xs mb-5" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Loyers mutuels exonérés.
            </p>
            <button
              onClick={() => { onBreak?.(myAlliance.id); onClose?.(); }}
              className="w-full py-3 rounded-xl transition text-sm font-bold border"
              style={{ background: 'rgba(239,68,68,0.12)', color: '#fca5a5', borderColor: 'rgba(239,68,68,0.3)' }}
              data-testid="break-alliance-btn"
            >
              💔 Rompre l'alliance
            </button>
          </div>
        ) : (
          /* ── Propose view ── */
          <>
            <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Seul ton allié verra la proposition.
            </p>

            <label className="block text-xs mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Choisir un allié
            </label>

            {others.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Aucun joueur disponible
              </p>
            ) : (
              <div className="space-y-2 mb-4">
                {others.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setTargetId(p.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition text-left"
                    style={{
                      background:  targetId === p.id ? `${p.color}18` : 'rgba(255,255,255,0.04)',
                      border:      `1px solid ${targetId === p.id ? p.color + '55' : 'rgba(255,255,255,0.07)'}`,
                      boxShadow:   targetId === p.id ? `0 0 10px ${p.color}22` : 'none',
                    }}
                  >
                    <span
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                      style={{
                        backgroundColor: p.color,
                        boxShadow:       targetId === p.id ? `0 0 8px ${p.color}` : 'none',
                      }}
                    >
                      {p.pion?.emoji ?? '●'}
                    </span>
                    <span className="flex-1 font-medium text-sm text-white">{p.name}</span>
                    {targetId === p.id && (
                      <span className="text-xs font-bold flex-shrink-0" style={{ color: p.color }}>✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => { if (targetId) { onPropose?.(targetId); onClose?.(); } }}
              disabled={!targetId}
              className="w-full font-bold py-3 rounded-xl transition text-sm"
              style={{
                background: targetId ? '#a855f7' : 'rgba(168,85,247,0.2)',
                color:      targetId ? '#fff' : 'rgba(255,255,255,0.3)',
              }}
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
