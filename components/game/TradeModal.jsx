'use client';

import { useState } from 'react';

export default function TradeModal({ gameState, myPlayerId, incoming, onSend, onAccept, onRefuse, onForce, onClose }) {
  // incoming: { tradeId, from, offer } — trade proposé à moi
  const [mode,       setMode]       = useState('propose'); // propose | force
  const [targetId,   setTargetId]   = useState('');
  const [cashOffer,  setCashOffer]  = useState('');
  const [wantPropId, setWantPropId] = useState('');
  const [givePropId, setGivePropId] = useState('');
  const [forcePropId,setForcePropId]= useState('');
  const [timer,      setTimer]      = useState(45);

  const me      = gameState?.players?.find(p => p.id === myPlayerId);
  const others  = gameState?.players?.filter(p => p.id !== myPlayerId && p.alive) ?? [];
  const target  = gameState?.players?.find(p => p.id === targetId);

  const myProps = gameState?.board?.filter(s => s.ownerId === myPlayerId && !s.mortgaged) ?? [];
  const targetProps = target
    ? gameState?.board?.filter(s => s.ownerId === target.id && !s.mortgaged) ?? []
    : [];
  // Force trade eligible: no building, not creating monopoly for forcer
  const forceEligible = target
    ? targetProps.filter(s => !s.building)
    : [];

  function handlePropose() {
    if (!targetId) return;
    onSend?.({
      toId: targetId,
      cashOffer: parseInt(cashOffer || '0', 10),
      wantPropertyId: wantPropId || null,
      givePropertyId: givePropId || null,
    });
    onClose?.();
  }

  function handleForce() {
    if (!targetId || !forcePropId) return;
    onForce?.({ targetId, propertyId: forcePropId });
    onClose?.();
  }

  // Incoming trade view
  if (incoming) {
    const fromPlayer = gameState?.players?.find(p => p.id === incoming.from);
    const offeredProp = incoming.offer?.givePropertyId
      ? gameState?.board?.find(s => s.id === incoming.offer.givePropertyId)
      : null;
    const wantedProp = incoming.offer?.wantPropertyId
      ? gameState?.board?.find(s => s.id === incoming.offer.wantPropertyId)
      : null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" data-testid="trade-modal">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-proprio-card rounded-2xl p-6 max-w-md w-full mx-4 border border-white/20 shadow-2xl z-10">
          <h3 className="text-lg font-bold text-white mb-1">Proposition de trade</h3>
          <p className="text-gray-400 text-sm mb-4">{fromPlayer?.name} vous propose :</p>

          <div className="bg-white/5 rounded-xl p-4 space-y-2 mb-4 text-sm">
            {incoming.offer?.cashOffer > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-400">Offre cash</span>
                <span className="text-green-400 font-mono">{incoming.offer.cashOffer}€</span>
              </div>
            )}
            {offeredProp && (
              <div className="flex justify-between">
                <span className="text-gray-400">Vous reçevez</span>
                <span className="text-white">{offeredProp.name}</span>
              </div>
            )}
            {wantedProp && (
              <div className="flex justify-between">
                <span className="text-gray-400">En échange de</span>
                <span className="text-white">{wantedProp.name}</span>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { onRefuse?.(incoming.tradeId); onClose?.(); }}
              className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition"
            >
              Refuser
            </button>
            <button
              onClick={() => { onAccept?.(incoming.tradeId); onClose?.(); }}
              className="flex-1 bg-proprio-green hover:bg-green-500 text-white font-bold py-3 rounded-xl transition"
              data-testid="trade-accept-btn"
            >
              Accepter
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" data-testid="trade-modal">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-proprio-card rounded-2xl p-6 max-w-md w-full mx-4 border border-white/20 shadow-2xl z-10 max-h-[90vh] overflow-y-auto">

        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white text-xl">×</button>
        <h3 className="text-lg font-bold text-white mb-4">Trade</h3>

        {/* Mode tabs */}
        <div className="flex gap-2 mb-5">
          {['propose', 'force'].map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition
                ${mode === m ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              {m === 'propose' ? 'Volontaire' : 'Forcé'}
            </button>
          ))}
        </div>

        {/* Target */}
        <div className="mb-4">
          <label className="block text-xs text-gray-400 mb-1">Joueur ciblé</label>
          <select
            value={targetId}
            onChange={e => setTargetId(e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-proprio-gold"
          >
            <option value="">Sélectionner…</option>
            {others.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {mode === 'propose' ? (
          <>
            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-1">Offre cash (€)</label>
              <input
                type="number"
                value={cashOffer}
                onChange={e => setCashOffer(e.target.value)}
                placeholder="0"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-proprio-gold font-mono"
              />
            </div>

            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-1">Je donne (ma propriété)</label>
              <select
                value={givePropId}
                onChange={e => setGivePropId(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-proprio-gold"
              >
                <option value="">Aucune</option>
                {myProps.map(s => <option key={s.id} value={s.id}>{s.name} ({s.price}€)</option>)}
              </select>
            </div>

            <div className="mb-5">
              <label className="block text-xs text-gray-400 mb-1">Je veux (sa propriété)</label>
              <select
                value={wantPropId}
                onChange={e => setWantPropId(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-proprio-gold"
                disabled={!targetId}
              >
                <option value="">Aucune</option>
                {targetProps.map(s => <option key={s.id} value={s.id}>{s.name} ({s.price}€)</option>)}
              </select>
            </div>

            <button
              onClick={handlePropose}
              disabled={!targetId}
              className="w-full bg-proprio-accent hover:bg-red-600 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition"
              data-testid="trade-send-btn"
            >
              Envoyer la proposition
            </button>
          </>
        ) : (
          <>
            <p className="text-xs text-yellow-400/80 bg-yellow-900/30 rounded-lg p-3 mb-4">
              Le trade forcé coûte 3× le prix de base. La propriété choisie ne doit pas avoir de bâtiment.
            </p>

            <div className="mb-5">
              <label className="block text-xs text-gray-400 mb-1">Propriété à forcer (sans bâtiment)</label>
              <select
                value={forcePropId}
                onChange={e => setForcePropId(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-proprio-gold"
                disabled={!targetId}
              >
                <option value="">Sélectionner…</option>
                {forceEligible.map(s => <option key={s.id} value={s.id}>{s.name} → {s.price * 3}€</option>)}
              </select>
            </div>

            <button
              onClick={handleForce}
              disabled={!targetId || !forcePropId}
              className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition"
              data-testid="force-trade-btn"
            >
              Forcer le trade — {forcePropId && forceEligible.find(s => s.id === forcePropId)?.price * 3}€
            </button>
          </>
        )}
      </div>
    </div>
  );
}
