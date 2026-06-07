'use client';

import { useEffect, useRef, useState } from 'react';

const GROUP_NAMES = [
  'Grande couronne', 'Banlieue éloignée', 'Banlieue moyenne', 'Petite couronne',
  'Paris populaire',  'Paris tendance',    'Paris bourgeois',  'Paris premium',
];
const GROUP_COLORS = [
  '#7C3AED','#0891B2','#92400E','#EA580C',
  '#DC2626','#CA8A04','#16A34A','#2563EB',
];

const BUILD_LEVELS = ['studio', 'appart', 'immeuble', 'nightclub'];
const BUILD_LABELS = { studio: 'Studio', appart: 'Appart', immeuble: 'Immeuble', nightclub: 'Boîte de nuit' };
const BUILD_COSTS_PCT = { studio: 0.50, appart: 0.75, immeuble: 1.00, nightclub: 1.20 };

export default function ProjectedCard({ sq, gameState, myPlayerId, isMyTurn, onBuy, onBuild, onSellBuilding, onMortgage, onUnmortgage, onProposeTrade, onClose }) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (sq) {
      setClosing(false);
      const t = setTimeout(() => setVisible(true), 16);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [sq?.id]);

  function handleClose() {
    setClosing(true);
    setTimeout(() => { setVisible(false); onClose?.(); }, 280);
  }

  if (!sq) return null;

  const me     = gameState?.players?.find(p => p.id === myPlayerId);
  const owner  = sq.ownerId ? gameState?.players?.find(p => p.id === sq.ownerId) : null;
  const isOnThisTile = me?.position === sq.idx;
  const isMine = sq.ownerId === myPlayerId;
  const isFree = !sq.ownerId && ['prop', 'transport', 'nightclub_spot'].includes(sq.type);
  const isOther = sq.ownerId && sq.ownerId !== myPlayerId;

  const myAlliance = gameState?.alliances?.find(a =>
    a.status === 'active' && (
      (a.p1 === myPlayerId && a.p2 === sq.ownerId) ||
      (a.p2 === myPlayerId && a.p1 === sq.ownerId)
    )
  );

  // Build costs
  const buildCost = sq.price ? Math.round(sq.price * BUILD_COSTS_PCT[BUILD_LEVELS[BUILD_LEVELS.indexOf(sq.building) + 1]] ?? 0) : 0;
  const nextLevel = sq.building ? BUILD_LEVELS[BUILD_LEVELS.indexOf(sq.building) + 1] : BUILD_LEVELS[0];
  const currentLevelIdx = BUILD_LEVELS.indexOf(sq.building);
  const canBuildNext = nextLevel && isMine && isMyTurn;
  const canSell = isMine && sq.building && isMyTurn;
  const canMortgage = isMine && !sq.mortgaged && !sq.building && isMyTurn;
  const canUnmortgage = isMine && sq.mortgaged && isMyTurn;

  const RENT_RATES = { bare: 0.10, studio: 0.16, appart: 0.25, immeuble: 0.40, nightclub: 0 };
  const rent = sq.mortgaged ? 0 : Math.round((sq.price ?? 0) * (RENT_RATES[sq.building ?? 'bare'] ?? 0.10));
  const rentNight = sq.type === 'nightclub_spot' && sq.building === 'nightclub'
    ? Math.round((sq.price ?? 0) * 0.60)
    : null;

  const cardStyle = {
    transform: closing
      ? 'perspective(600px) rotateX(-40deg) translateY(-30px) scale(0.85)'
      : visible
        ? 'perspective(600px) rotateX(0deg) translateY(0px) scale(1)'
        : 'perspective(600px) rotateX(60deg) translateY(40px) scale(0.8)',
    opacity: closing ? 0 : visible ? 1 : 0,
    transition: closing
      ? 'transform 0.25s ease, opacity 0.2s ease'
      : 'transform 0.4s cubic-bezier(0.34,1.4,0.64,1), opacity 0.35s ease',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" data-testid="projected-card-overlay">
      {/* Dark overlay */}
      <div
        className="absolute inset-0 bg-black/35 transition-opacity duration-300"
        style={{ opacity: visible && !closing ? 1 : 0 }}
        onClick={handleClose}
      />

      {/* Card */}
      <div
        style={cardStyle}
        className="relative bg-proprio-card border border-white/20 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl z-10"
        data-testid="projected-card"
      >
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white text-xl font-bold transition"
          data-testid="card-close-btn"
        >
          ×
        </button>

        {/* Group color strip */}
        {sq.type === 'prop' && (
          <div
            className="absolute top-0 left-0 right-0 h-1.5 rounded-t-2xl"
            style={{ backgroundColor: GROUP_COLORS[sq.group] }}
          />
        )}

        {/* Header */}
        <div className="mb-4 mt-1">
          <div className="flex items-center gap-2 mb-1">
            {sq.type === 'prop' && (
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: GROUP_COLORS[sq.group] }}
              />
            )}
            <h3 className="font-bebas tracking-wider text-2xl text-white leading-tight">{sq.name ?? sq.id}</h3>
          </div>
          {sq.type === 'prop' && (
            <p className="text-xs text-gray-500">{GROUP_NAMES[sq.group]}</p>
          )}
          {sq.type === 'transport' && <p className="text-xs text-gray-500">🚇 Transport</p>}
          {sq.type === 'nightclub_spot' && <p className="text-xs text-gray-500">🌙 Boîte de nuit</p>}
        </div>

        {/* Mortgage badge */}
        {sq.mortgaged && (
          <div className="bg-gray-700/60 border border-gray-500/30 text-gray-400 text-xs px-3 py-1 rounded-full inline-block mb-3">
            🔒 Hypothéquée
          </div>
        )}

        {/* Alliance badge */}
        {myAlliance && (
          <div className="bg-purple-900/60 border border-purple-500/30 text-purple-300 text-xs px-3 py-1 rounded-full inline-block mb-3">
            🤝 Alliance active — loyer exonéré
          </div>
        )}

        {/* Owner info */}
        {owner && (
          <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 mb-4">
            <span className="w-5 h-5 rounded-full flex-shrink-0 text-xs flex items-center justify-center"
              style={{ backgroundColor: owner.color }}>
              {owner.pion?.emoji ?? '●'}
            </span>
            <span className="text-sm text-white font-medium">{owner.name}</span>
            {isMine && <span className="ml-auto text-xs text-gray-500">(toi)</span>}
          </div>
        )}

        {/* Price / Rent info */}
        {sq.price && (
          <div className="bg-white/5 rounded-xl p-3 mb-4 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Prix</span>
              <span className="font-mono text-white">{sq.price}€</span>
            </div>
            {!sq.mortgaged && (
              <div className="flex justify-between">
                <span className="text-gray-400">Loyer {gameState?.isNight && sq.type !== 'nightclub_spot' ? '(nuit)' : ''}</span>
                <span className={`font-mono ${gameState?.isNight ? 'text-orange-300' : 'text-white'}`}>
                  {rent}€
                </span>
              </div>
            )}
            {rentNight !== null && (
              <div className="flex justify-between">
                <span className="text-gray-400">Loyer nuit (boîte)</span>
                <span className="font-mono text-orange-300">{rentNight}€</span>
              </div>
            )}
            {sq.building && (
              <div className="flex justify-between">
                <span className="text-gray-400">Niveau</span>
                <span className="text-white">{BUILD_LABELS[sq.building]}</span>
              </div>
            )}
            {sq.isColoc && sq.coOwners?.length > 1 && (
              <div className="text-xs text-gray-500">Loyer partagé 50/50</div>
            )}
          </div>
        )}

        {/* Special squares info */}
        {sq.type === 'tax' && (
          <p className="text-sm text-red-300 mb-4">Taxe : {sq.amount}€ à payer</p>
        )}
        {sq.type === 'start' && (
          <p className="text-sm text-teal-300 mb-4">Passer par la case Départ : +300€</p>
        )}
        {sq.type === 'jail' && (
          <p className="text-sm text-orange-300 mb-4">Prison / En visite. Amende : 200€</p>
        )}
        {sq.type === 'parking' && (
          <p className="text-sm text-blue-300 mb-4">Parking — caisse commune : {gameState?.parkingCash ?? 0}€</p>
        )}
        {sq.type === 'event' && (
          <p className="text-sm text-yellow-300 mb-4">Tirez une carte Courrier du Jour</p>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-2">
          {/* Buy */}
          {isFree && isMyTurn && isOnThisTile && !sq.mortgaged && (
            <button
              onClick={() => { onBuy?.(sq.id); handleClose(); }}
              className="w-full bg-proprio-accent hover:bg-red-600 text-white font-bold py-3 rounded-xl transition"
              data-testid="card-buy-btn"
            >
              Acheter · {sq.price}€
            </button>
          )}

          {/* Build */}
          {canBuildNext && nextLevel && (
            <button
              onClick={() => { onBuild?.(sq.id, nextLevel); handleClose(); }}
              className="w-full bg-proprio-green hover:bg-green-500 text-white font-bold py-3 rounded-xl transition"
              data-testid="card-build-btn"
            >
              Construire {BUILD_LABELS[nextLevel]} · {Math.round(sq.price * BUILD_COSTS_PCT[nextLevel])}€
            </button>
          )}

          {/* Sell building */}
          {canSell && (
            <button
              onClick={() => { onSellBuilding?.(sq.id); handleClose(); }}
              className="w-full bg-white/10 hover:bg-white/20 text-gray-300 font-medium py-2.5 rounded-xl transition text-sm"
              data-testid="card-sell-building-btn"
            >
              Vendre bâtiment · +{Math.round(sq.price * BUILD_COSTS_PCT[sq.building] * 0.5)}€
            </button>
          )}

          {/* Mortgage */}
          {canMortgage && (
            <button
              onClick={() => { onMortgage?.(sq.id); handleClose(); }}
              className="w-full bg-white/10 hover:bg-white/20 text-gray-300 font-medium py-2.5 rounded-xl transition text-sm"
              data-testid="card-mortgage-btn"
            >
              Hypothéquer · +{Math.round(sq.price * 0.5)}€
            </button>
          )}

          {/* Unmortgage */}
          {canUnmortgage && (
            <button
              onClick={() => { onUnmortgage?.(sq.id); handleClose(); }}
              className="w-full bg-white/10 hover:bg-white/20 text-gray-300 font-medium py-2.5 rounded-xl transition text-sm"
              data-testid="card-unmortgage-btn"
            >
              Lever l'hypothèque · -{Math.round(sq.price * 0.6)}€
            </button>
          )}

          {/* Trade */}
          {(isMine || isOther) && (
            <button
              onClick={() => { onProposeTrade?.(sq); handleClose(); }}
              className="w-full bg-white/8 hover:bg-white/15 text-gray-400 hover:text-gray-200 font-medium py-2.5 rounded-xl transition text-sm border border-white/10"
              data-testid="card-trade-btn"
            >
              Proposer un trade
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
