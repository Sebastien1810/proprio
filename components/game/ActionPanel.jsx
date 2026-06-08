'use client';

export default function ActionPanel({
  gameState, myPlayerId,
  pendingPropertyId,
  lastAction,
  onRollDice, onBuy, onRefuse, onSkip, onEndTurn,
  onOpenTrade, onOpenAlliance,
}) {
  const me = gameState?.players?.find(p => p.id === myPlayerId);
  if (!me || !gameState) return null;

  const isMyTurn = gameState.players[gameState.currentPlayerIndex]?.id === myPlayerId;
  if (!isMyTurn) {
    const active = gameState.players[gameState.currentPlayerIndex];
    return (
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-proprio-dark/80 backdrop-blur-sm border-t border-white/10">
        <div className="max-w-lg mx-auto px-4 py-3 text-center">
          <p className="text-gray-500 text-sm">
            En attente de <span className="text-white font-medium">{active?.name}</span>…
          </p>
        </div>
      </div>
    );
  }

  const hasRolled   = lastAction?.rolled;
  const mustRollAgain = lastAction?.mustRollAgain;
  const sq          = me ? gameState.board[me.position] : null;
  const pendingSq   = pendingPropertyId ? gameState.board.find(s => s.id === pendingPropertyId) : null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 bg-proprio-card/95 backdrop-blur-sm border-t border-white/20 shadow-2xl"
      style={{ animation: 'slideUp 0.3s ease-out' }}
      data-testid="action-panel"
    >
      <div className="max-w-xl mx-auto px-4 py-4">

        {/* Contexte du tour */}
        {!hasRolled && !mustRollAgain && (
          <div className="space-y-3">
            <button
              onClick={onRollDice}
              className="w-full bg-proprio-accent hover:bg-red-600 text-white py-4 rounded-xl transition flex items-center justify-center gap-2 font-bebas tracking-widest text-2xl"
              data-testid="roll-dice-btn"
            >
              <span className="text-2xl">🎲</span>
              LANCER LES DÉS
            </button>

            <div className="flex gap-3">
              <button
                onClick={onOpenTrade}
                className="flex-1 bg-white/10 hover:bg-white/20 text-gray-300 font-medium py-2.5 rounded-xl transition text-sm"
                data-testid="open-trade-btn"
              >
                Trade
              </button>
              <button
                onClick={onOpenAlliance}
                className="flex-1 bg-white/10 hover:bg-white/20 text-gray-300 font-medium py-2.5 rounded-xl transition text-sm"
                data-testid="open-alliance-btn"
              >
                Alliance
              </button>
            </div>
          </div>
        )}

        {/* Double — relancer */}
        {mustRollAgain && (
          <div className="space-y-3">
            <div className="bg-green-900/40 border border-green-500/30 rounded-xl px-4 py-3 text-center">
              <p className="text-green-300 font-bold">Double ! Tu rejoues.</p>
            </div>
            <button
              onClick={onRollDice}
              className="w-full bg-proprio-accent hover:bg-red-600 text-white py-4 rounded-xl transition flex items-center justify-center gap-2 font-bebas tracking-widest text-2xl"
              data-testid="roll-again-btn"
            >
              <span className="text-2xl">🎲</span>
              LANCER À NOUVEAU
            </button>
          </div>
        )}

        {/* Après le lancer — prop disponible */}
        {hasRolled && !mustRollAgain && pendingSq && (
          <div className="space-y-2">
            <div className="bg-blue-900/40 border border-blue-500/30 rounded-xl px-4 py-3">
              <p className="text-sm text-gray-300 mb-0.5">
                Tu es sur <strong className="text-white">{pendingSq.name}</strong> — {pendingSq.price}€
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => onBuy?.(pendingSq.id)}
                className="flex-1 bg-proprio-accent hover:bg-red-600 text-white py-3 rounded-xl transition font-bebas tracking-wider text-xl"
                data-testid="buy-btn"
              >
                ACHETER · {pendingSq.price}€
              </button>
              <button
                onClick={() => onRefuse?.(pendingSq.id)}
                className="flex-1 bg-white/10 hover:bg-white/20 text-gray-300 font-medium py-3 rounded-xl transition text-sm"
                data-testid="refuse-btn"
              >
                Passer aux enchères
              </button>
            </div>
            <button
              onClick={() => onSkip?.()}
              className="w-full text-gray-500 hover:text-gray-400 text-sm py-1.5 transition"
              data-testid="skip-btn"
            >
              Ne pas acheter
            </button>
          </div>
        )}

        {/* Après le lancer — loyer payé */}
        {hasRolled && !mustRollAgain && lastAction?.action === 'pay_rent' && (
          <div className="space-y-3">
            <div className="bg-red-900/30 border border-red-500/20 rounded-xl px-4 py-3 text-center">
              <p className="text-red-300 text-sm">
                Loyer payé : <strong className="font-mono">{lastAction.rent}€</strong> à {lastAction.ownerName}
              </p>
            </div>
            <EndTurnRow onEndTurn={onEndTurn} onOpenTrade={onOpenTrade} onOpenAlliance={onOpenAlliance} />
          </div>
        )}

        {/* Après le lancer — autre action (taxe, prison, etc.) */}
        {hasRolled && !mustRollAgain && !pendingSq && lastAction?.action !== 'pay_rent' && (
          <EndTurnRow onEndTurn={onEndTurn} onOpenTrade={onOpenTrade} onOpenAlliance={onOpenAlliance} />
        )}
      </div>
    </div>
  );
}

function EndTurnRow({ onEndTurn, onOpenTrade, onOpenAlliance }) {
  return (
    <div className="flex gap-3">
      <button
        onClick={onOpenTrade}
        className="flex-1 bg-white/10 hover:bg-white/20 text-gray-300 font-medium py-2.5 rounded-xl transition text-sm"
        data-testid="open-trade-btn"
      >
        Trade
      </button>
      <button
        onClick={onOpenAlliance}
        className="flex-1 bg-white/10 hover:bg-white/20 text-gray-300 font-medium py-2.5 rounded-xl transition text-sm"
        data-testid="open-alliance-btn"
      >
        Alliance
      </button>
      <button
        onClick={onEndTurn}
        className="flex-1 bg-white/15 hover:bg-white/25 text-white font-bold py-2.5 rounded-xl transition"
        data-testid="end-turn-btn"
      >
        Fin de tour
      </button>
    </div>
  );
}
