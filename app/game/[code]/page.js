'use client';

import { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getSocket } from '../../../lib/socket';

import Board           from '../../../components/game/Board';
import HudBar          from '../../../components/game/HudBar';
import ActionPanel     from '../../../components/game/ActionPanel';
import ProjectedCard   from '../../../components/game/ProjectedCard';
import DiceRoll        from '../../../components/game/DiceRoll';
import EventCardReveal from '../../../components/game/EventCardReveal';
import AuctionPanel    from '../../../components/game/AuctionPanel';
import TradeModal      from '../../../components/game/TradeModal';
import AllianceModal   from '../../../components/game/AllianceModal';
import ColocModal      from '../../../components/game/ColocModal';
import ToastLog        from '../../../components/game/ToastLog';
import RulesPanel      from '../../../components/game/RulesPanel';
import GameLog         from '../../../components/game/GameLog';
import MatrixBackground from '../../../components/MatrixBackground';

let toastCounter = 0;
function mkToast(message, type = 'info') {
  return { id: ++toastCounter, message, type };
}

function GameContent({ roomId }) {
  const searchParams = useSearchParams();
  const playerId     = searchParams.get('playerId');

  const [gameState,       setGameState]       = useState(null);
  const [connected,       setConnected]       = useState(false);
  const [selectedSquare,  setSelectedSquare]  = useState(null);
  const [diceResult,      setDiceResult]      = useState(null);
  const [eventCard,       setEventCard]       = useState(null);
  const [auctionInfo,     setAuctionInfo]     = useState(null);
  const [tradeModal,      setTradeModal]      = useState(null);  // null | 'send' | { incoming }
  const [allianceModal,   setAllianceModal]   = useState(null);  // null | 'propose' | { incoming }
  const [colocModal,      setColocModal]      = useState(null);
  const [allianceBanner,  setAllianceBanner]  = useState(null);
  const [strikeBanner,    setStrikeBanner]    = useState(false);
  const [indicModal,      setIndicModal]      = useState(null);
  const [toasts,          setToasts]          = useState([]);
  const [lastAction,      setLastAction]      = useState(null);
  const [pendingPropId,   setPendingPropId]   = useState(null);
  const [gameLogOpen,     setGameLogOpen]     = useState(false);

  const prevCashMap  = useRef({});
  const gsRef        = useRef(null);

  const addToast = useCallback((message, type = 'info') => {
    setToasts(prev => [...prev.slice(-3), mkToast(message, type)]);
    setTimeout(() => setToasts(prev => prev.slice(1)), 3200);
  }, []);

  // ── Socket setup ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!playerId || !roomId) return;

    const socket = getSocket();
    socket.connect();

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join_room', { roomId, playerId });
    });

    socket.on('game_updated', ({ gameState: gs }) => {
      // Snapshot cash avant mise à jour
      if (gsRef.current) {
        const map = {};
        for (const p of gsRef.current.players) map[p.id] = p.cash;
        prevCashMap.current = map;
        // Tour suivant : réinitialiser les états d'action locaux
        if (gsRef.current.currentPlayerIndex !== gs.currentPlayerIndex) {
          setLastAction(null);
          setPendingPropId(null);
        }
      }
      gsRef.current = gs;
      setGameState(gs);
    });

    socket.on('dice_rolled', ({ playerId: pid, diceValues, isDouble, sentToJail, mustRollAgain, action }) => {
      setDiceResult({ diceValues, isDouble, sentToJail });
      setLastAction({ rolled: true, mustRollAgain, action });
      // Propriété en attente incompatible avec un double ou une mise en prison : on efface
      if (mustRollAgain || sentToJail) {
        setPendingPropId(null);
      }
      if (mustRollAgain) {
        const gs = gsRef.current;
        const p = gs?.players?.find(p => p.id === pid);
        if (p) addToast(`${p.name} fait un double !`, 'info');
      }
    });

    socket.on('event_card_drawn', ({ card, playerId: pid }) => {
      const gs  = gsRef.current;
      const p   = gs?.players?.find(p => p.id === pid);
      setEventCard({ card, playerName: p?.name });
      if (p) addToast(`${p.name} tire une carte Courrier du Jour`, 'info');
    });

    socket.on('property_available', ({ propertyId }) => {
      setPendingPropId(propertyId);
      setLastAction(prev => ({ ...prev, hasPendingProp: true }));
    });

    socket.on('auction_started', ({ auctionId, propertyId }) => {
      setAuctionInfo({ auctionId, propertyId });
      setPendingPropId(null);
      const gs = gsRef.current;
      const sq = gs?.board?.find(s => s.id === propertyId);
      if (sq) addToast(`Enchères sur ${sq.name}`, 'warn');
    });

    socket.on('auction_closed', ({ winner, finalPrice, propertyId }) => {
      setAuctionInfo(null);
      const gs = gsRef.current;
      const sq = gs?.board?.find(s => s.id === propertyId);
      const w  = winner ? gs?.players?.find(p => p.id === winner) : null;
      if (w && sq)  addToast(`${w.name} remporte ${sq.name} pour ${finalPrice}€`, 'buy');
      else if (sq)  addToast(`${sq.name} non vendue`, 'info');
    });

    socket.on('bid_placed', ({ playerId: pid, amount, propertyId }) => {
      const gs = gsRef.current;
      const p  = gs?.players?.find(p => p.id === pid);
      if (p) addToast(`${p.name} enchérit ${amount}€`, 'info');
    });

    socket.on('trade_proposed', ({ tradeId, from, offer }) => {
      setTradeModal({ incoming: { tradeId, from, offer } });
    });

    socket.on('alliance_proposed', ({ allianceId, from }) => {
      setAllianceModal({ incoming: { allianceId, from } });
    });

    socket.on('alliance_formed', () => {
      addToast('Alliance secrète formée 🤝', 'alliance');
    });

    socket.on('alliance_broken', ({ p1, p2, formedTurn, brokenTurn }) => {
      const gs = gsRef.current;
      const n1 = gs?.players?.find(p => p.id === p1)?.name ?? p1;
      const n2 = gs?.players?.find(p => p.id === p2)?.name ?? p2;
      setAllianceBanner({ n1, n2, formedTurn });
      addToast(`💔 Alliance rompue : ${n1} et ${n2}`, 'alliance');
      setTimeout(() => setAllianceBanner(null), 4000);
    });

    socket.on('force_trade_done', ({ fromId, toId, propertyId, price }) => {
      const gs = gsRef.current;
      const from = gs?.players?.find(p => p.id === fromId)?.name ?? fromId;
      const to   = gs?.players?.find(p => p.id === toId)?.name ?? toId;
      const sq   = gs?.board?.find(s => s.id === propertyId);
      if (sq) addToast(`Trade forcé : ${from} prend ${sq.name} à ${to} pour ${price}€`, 'warn');
    });

    socket.on('transport_strike', ({ active }) => {
      setStrikeBanner(active);
      addToast(active ? '🚇 Grève des transports !' : '🚇 Grève terminée', 'strike');
    });

    socket.on('day_night_changed', ({ isNight }) => {
      addToast(isNight ? '🌙 La nuit tombe — les boîtes de nuit ouvrent' : '☀️ Le jour se lève', 'night');
    });

    socket.on('indic_result', ({ alliance }) => {
      setIndicModal({ alliance });
    });

    socket.on('indic_drawn', ({ playerId: pid }) => {
      const gs = gsRef.current;
      const p  = gs?.players?.find(p => p.id === pid);
      if (p) addToast(`${p.name} tire la carte Indic…`, 'info');
    });

    socket.on('rumeur_answer', ({ targetId, hasAlliance }) => {
      const gs  = gsRef.current;
      const tgt = gs?.players?.find(p => p.id === targetId);
      addToast(`${tgt?.name ?? targetId} ${hasAlliance ? 'a une alliance' : 'n\'a pas d\'alliance'}`, 'info');
    });

    socket.on('player_disconnected', ({ playerId: pid }) => {
      const gs = gsRef.current;
      const p  = gs?.players?.find(p => p.id === pid);
      if (p) addToast(`${p.name} s'est déconnecté`, 'warn');
    });

    socket.on('player_reconnected', ({ playerId: pid }) => {
      const gs = gsRef.current;
      const p  = gs?.players?.find(p => p.id === pid);
      if (p) addToast(`${p.name} s'est reconnecté`, 'info');
    });

    socket.on('coloc_negotiation', (data) => {
      setColocModal(data);
    });

    socket.on('game_over', ({ winner, reason }) => {
      const gs = gsRef.current;
      const w  = gs?.players?.find(p => p.id === winner);
      addToast(`🏆 Partie terminée — ${w?.name ?? 'Victoire'} gagne !`, 'buy');
    });

    socket.on('error', ({ message }) => {
      addToast(`⚠ ${message}`, 'warn');
    });

    socket.on('disconnect', () => setConnected(false));

    return () => {
      [
        'game_updated','dice_rolled','event_card_drawn','property_available',
        'auction_started','auction_closed','bid_placed','trade_proposed',
        'alliance_proposed','alliance_formed','alliance_broken','force_trade_done',
        'transport_strike','day_night_changed','indic_result','indic_drawn',
        'rumeur_answer','player_disconnected','player_reconnected','coloc_negotiation',
        'game_over','error','disconnect','connect',
      ].forEach(ev => socket.off(ev));
      socket.disconnect();
    };
  }, [playerId, roomId, addToast]);

  // ── Actions ───────────────────────────────────────────────────────────────────
  function emit(event, payload) {
    getSocket().emit(event, { roomId, playerId, ...payload });
  }

  function handleRollDice() {
    setDiceResult(null);
    setLastAction(null);
    setPendingPropId(null);
    emit('roll_dice');
  }

  function handleBuy(propertyId) {
    setPendingPropId(null);
    emit('buy_property', { propertyId });
    const sq = gameState?.board?.find(s => s.id === propertyId);
    const me = gameState?.players?.find(p => p.id === playerId);
    if (sq && me) addToast(`${me.name} achète ${sq.name} pour ${sq.price}€`, 'buy');
  }

  function handleRefuse(propertyId) {
    setPendingPropId(null);
    emit('refuse_purchase', { propertyId });
  }

  function handleSkip() {
    setPendingPropId(null);
  }

  function handleEndTurn() {
    setLastAction(null);
    setPendingPropId(null);
    emit('end_turn');
  }

  function handleBuild(propertyId, buildingType) {
    emit('build', { propertyId, buildingType });
    const sq = gameState?.board?.find(s => s.id === propertyId);
    const me = gameState?.players?.find(p => p.id === playerId);
    if (sq && me) addToast(`${me.name} construit un ${buildingType} sur ${sq.name}`, 'build');
  }

  function handleMortgage(propertyId) {
    emit('mortgage', { propertyId });
  }

  function handleUnmortgage(propertyId) {
    emit('unmortgage', { propertyId });
  }

  function handleSellBuilding(propertyId) {
    emit('sell_building', { propertyId });
  }

  function handleBid(auctionId, amount) {
    emit('place_bid', { auctionId, amount });
  }

  function handleSendTrade({ toId, cashOffer, wantPropertyId, givePropertyId }) {
    emit('propose_trade', {
      fromId: playerId,
      toId,
      offer: { cash: cashOffer || 0, propertyId: givePropertyId || null },
    });
  }

  function handleAcceptTrade(tradeId) {
    emit('accept_trade', { tradeId });
  }

  function handleRefuseTrade(tradeId) {
    emit('refuse_trade', { tradeId });
  }

  function handleForceTrade({ targetId: toId, propertyId }) {
    emit('force_trade', { toId, propertyId });
  }

  function handleProposeAlliance(toId) {
    emit('propose_alliance', { toId });
  }

  function handleAcceptAlliance(allianceId) {
    emit('accept_alliance', { allianceId });
  }

  function handleBreakAlliance(allianceId) {
    emit('break_alliance', { allianceId });
  }

  const isMyTurn = gameState?.players?.[gameState?.currentPlayerIndex]?.id === playerId;

  if (!gameState) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl font-black text-proprio-gold mb-3">PROPRIO</div>
          <p className="text-gray-500 text-sm">{connected ? 'Chargement de la partie…' : 'Connexion…'}</p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-proprio-dark flex flex-col overflow-hidden" data-testid="game-page">
      <MatrixBackground opacity={0.12} />

      {/* HUD */}
      <HudBar
        gameState={gameState}
        myPlayerId={playerId}
        prevCashMap={prevCashMap.current}
      />

      {/* Strike banner */}
      {strikeBanner && (
        <div
          className="fixed top-14 left-0 right-0 z-40 bg-orange-600 text-white text-center py-2 text-sm font-bold shadow-xl"
          style={{ animation: 'slideDown 0.4s ease-out' }}
          data-testid="strike-banner"
        >
          🚇 Grève des transports en cours — déplacements bloqués
        </div>
      )}

      {/* Alliance broken banner */}
      {allianceBanner && (
        <div
          className="fixed top-0 left-0 right-0 z-50 bg-gray-900 text-white text-center py-3 text-sm font-bold shadow-2xl border-b border-red-500/50"
          style={{ animation: 'slideDown 0.4s ease-out' }}
          data-testid="alliance-broken-banner"
        >
          💔 {allianceBanner.n1} et {allianceBanner.n2} étaient alliés depuis le tour {allianceBanner.formedTurn}
        </div>
      )}

      {/* Board */}
      <div className="flex-1 pt-14 pb-20">
        <Board
          gameState={gameState}
          myPlayerId={playerId}
          selectedSquareId={selectedSquare?.id}
          onTileClick={(sq) => setSelectedSquare(sq)}
        />
      </div>

      {/* Projected card overlay */}
      {selectedSquare && (
        <ProjectedCard
          sq={selectedSquare}
          gameState={gameState}
          myPlayerId={playerId}
          isMyTurn={isMyTurn}
          onBuy={handleBuy}
          onBuild={handleBuild}
          onSellBuilding={handleSellBuilding}
          onMortgage={handleMortgage}
          onUnmortgage={handleUnmortgage}
          onProposeTrade={(sq) => { setSelectedSquare(null); setTradeModal('send'); }}
          onClose={() => setSelectedSquare(null)}
        />
      )}

      {/* Action panel */}
      {!selectedSquare && !auctionInfo && !tradeModal && !allianceModal && (
        <ActionPanel
          gameState={gameState}
          myPlayerId={playerId}
          pendingPropertyId={pendingPropId}
          lastAction={lastAction}
          onRollDice={handleRollDice}
          onBuy={handleBuy}
          onRefuse={handleRefuse}
          onSkip={handleSkip}
          onEndTurn={handleEndTurn}
          onOpenTrade={() => setTradeModal('send')}
          onOpenAlliance={() => setAllianceModal('propose')}
        />
      )}

      {/* Dice roll animation */}
      {diceResult && (
        <DiceRoll
          result={diceResult}
          onDone={() => setDiceResult(null)}
        />
      )}

      {/* Event card animation */}
      {eventCard && (
        <EventCardReveal
          card={eventCard.card}
          playerName={eventCard.playerName}
          onDone={() => setEventCard(null)}
        />
      )}

      {/* Auction panel */}
      {auctionInfo && (
        <AuctionPanel
          auction={auctionInfo}
          gameState={gameState}
          myPlayerId={playerId}
          onBid={handleBid}
          onClose={() => setAuctionInfo(null)}
        />
      )}

      {/* Trade modal */}
      {tradeModal && (
        <TradeModal
          gameState={gameState}
          myPlayerId={playerId}
          incoming={tradeModal?.incoming ?? null}
          onSend={handleSendTrade}
          onAccept={handleAcceptTrade}
          onRefuse={handleRefuseTrade}
          onForce={handleForceTrade}
          onClose={() => setTradeModal(null)}
        />
      )}

      {/* Alliance modal */}
      {allianceModal && (
        <AllianceModal
          gameState={gameState}
          myPlayerId={playerId}
          incoming={allianceModal?.incoming ?? null}
          onPropose={handleProposeAlliance}
          onAccept={handleAcceptAlliance}
          onBreak={handleBreakAlliance}
          onClose={() => setAllianceModal(null)}
        />
      )}

      {/* Coloc modal */}
      {colocModal && (
        <ColocModal
          data={colocModal}
          gameState={gameState}
          myPlayerId={playerId}
          onOffer={(d) => emit('coloc_offer', d)}
          onAccept={(d) => emit('coloc_accept', d)}
          onAuction={() => { setColocModal(null); emit('leave_coloc', { propertyId: colocModal.propertyId }); }}
          onClose={() => setColocModal(null)}
        />
      )}

      {/* Indic modal */}
      {indicModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" data-testid="indic-modal">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIndicModal(null)} />
          <div className="relative bg-proprio-card rounded-2xl p-6 max-w-sm w-full mx-4 border border-white/20 shadow-2xl z-10 text-center">
            <div className="text-4xl mb-3">🕵️</div>
            <h3 className="text-lg font-bold text-white mb-2">Informateur</h3>
            {indicModal.alliance ? (
              <p className="text-gray-300 text-sm">
                Tu apprends secrètement :
                <br/>
                <strong className="text-purple-300">
                  {gameState.players.find(p => p.id === indicModal.alliance.p1)?.name} et{' '}
                  {gameState.players.find(p => p.id === indicModal.alliance.p2)?.name} sont alliés
                </strong>
              </p>
            ) : (
              <p className="text-gray-400 text-sm">Aucune alliance secrète détectée.</p>
            )}
            <button
              onClick={() => setIndicModal(null)}
              className="mt-4 bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-xl transition text-sm"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Toast log */}
      <ToastLog toasts={toasts} />

      {/* Bouton fil du jeu */}
      <button
        onClick={() => setGameLogOpen(true)}
        className="fixed bottom-24 right-4 z-30 w-10 h-10 rounded-full flex items-center justify-center text-lg transition"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
        title="Fil du jeu"
      >
        📋
      </button>

      {/* Panneau fil du jeu */}
      <GameLog
        gameState={gameState}
        isOpen={gameLogOpen}
        onClose={() => setGameLogOpen(false)}
      />

      {/* Panneau règles */}
      <RulesPanel activeModals={{
        trade:    !!tradeModal,
        coloc:    !!colocModal,
        alliance: !!allianceModal,
        auction:  !!auctionInfo,
      }} />
    </div>
  );
}

export default function GamePage({ params }) {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Chargement…</p>
      </main>
    }>
      <GameContent roomId={params.code} />
    </Suspense>
  );
}
