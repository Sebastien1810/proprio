require('dotenv').config();
const { createServer } = require('http');
const { parse } = require('url');
const { Server } = require('socket.io');
const prisma = require('../lib/prisma');
const { getBoardConfig } = require('../lib/board-configs');
const { initGameState } = require('../lib/game-init');
const engine = require('../lib/game-engine');

// ── Helpers DB ────────────────────────────────────────────────────────────────

async function loadRoom(roomId) {
  return prisma.room.findUnique({ where: { id: roomId } });
}

async function saveGameState(roomId, gs) {
  await prisma.room.update({ where: { id: roomId }, data: { gameState: gs } })
    .catch(e => { if (e.code !== 'P2025') throw e; }); // ignorer room supprimée
}

async function saveAndBroadcast(io, roomId, gs) {
  await saveGameState(roomId, gs);
  io.to(roomId).emit('game_updated', { gameState: gs });
}

// ── Timers par room ───────────────────────────────────────────────────────────
// { roomId: { trade: timer, coloc: timer, auction: timer } }
const roomTimers = {};

function clearTimer(roomId, type) {
  if (roomTimers[roomId]?.[type]) {
    clearTimeout(roomTimers[roomId][type]);
    delete roomTimers[roomId][type];
  }
}

function setTimer(roomId, type, fn, delayMs) {
  if (!roomTimers[roomId]) roomTimers[roomId] = {};
  clearTimer(roomId, type);
  roomTimers[roomId][type] = setTimeout(fn, delayMs);
}

// ── Validation tour courant ───────────────────────────────────────────────────

function isCurrentTurn(gs, playerId) {
  return gs.players[gs.currentPlayerIndex]?.id === playerId;
}

// ── Payload room (lobby) ──────────────────────────────────────────────────────

async function buildRoomPayload(roomId) {
  const room = await prisma.room.findUnique({
    where:   { id: roomId },
    include: { players: { orderBy: { id: 'asc' } } },
  });
  if (!room) return null;
  const boardInfo = getBoardConfig(room.players.length);
  const lobbyPions  = room.gameState?.lobbyPions  ?? {};
  const lobbyColors = room.gameState?.lobbyColors ?? {};
  return {
    roomId:     room.id,
    code:       room.code,
    status:     room.status,
    hostId:     room.players[0]?.id ?? null,
    lobbyPions,
    lobbyColors,
    players:  room.players.map(p => ({
      id:        p.id,
      name:      p.name,
      color:     p.color,
      connected: !!p.socketId,
      pionId:    lobbyPions[p.id]  ?? null,
      colorId:   lobbyColors[p.id] ?? null,
    })),
    boardInfo,
  };
}

// ── Attachement des handlers Socket.IO ───────────────────────────────────────
// Séparé pour être réutilisable dans le test server

function attachHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`[Socket] Connexion : ${socket.id}`);

    // ── __test_gs_broadcast (test uniquement — hors production) ───────────
    if (process.env.NODE_ENV !== 'production') {
      socket.on('__test_gs_broadcast', async ({ roomId }) => {
        try {
          socket.join(roomId); // s'assure que le socket est dans la room
          const room = await loadRoom(roomId);
          if (!room) return;
          io.to(roomId).emit('game_updated', { gameState: room.gameState });
        } catch (err) {
          console.error('[__test_gs_broadcast]', err);
        }
      });
    }

    // ── join_room ─────────────────────────────────────────────────────────
    socket.on('join_room', async ({ roomId, playerId }) => {
      try {
        const room = await prisma.room.findUnique({
          where:   { id: roomId },
          include: { players: { orderBy: { id: 'asc' } } },
        });
        if (!room)   return socket.emit('error', { message: 'Room introuvable' });
        const player = room.players.find(p => p.id === playerId);
        if (!player) return socket.emit('error', { message: 'Joueur non trouvé' });

        await prisma.player.update({
          where: { id: playerId },
          data:  { socketId: socket.id },
        });
        socket.join(roomId);
        socket.data = { roomId, playerId };

        // Reconnexion en cours de partie
        if (room.status === 'playing') {
          const gs = room.gameState;
          const gp = gs.players?.find(p => p.id === playerId);
          if (gp) {
            gp.disconnected = false;
            await saveGameState(roomId, gs);
            socket.emit('game_updated', { gameState: gs });
            socket.to(roomId).emit('player_reconnected', { playerId });
          }
        }

        const payload = await buildRoomPayload(roomId);
        io.to(roomId).emit('room_updated', payload);
        console.log(`[Socket] ${player.name} → room ${room.code}`);
      } catch (err) {
        console.error('[join_room]', err);
        socket.emit('error', { message: 'Erreur serveur' });
      }
    });

    // ── pick_pion ─────────────────────────────────────────────────────────
    socket.on('pick_pion', async ({ roomId, playerId, pionId }) => {
      try {
        const room = await prisma.room.findUnique({ where: { id: roomId } });
        if (!room || room.status !== 'waiting') return;

        const existing = room.gameState?.lobbyPions ?? {};
        // Vérifier que le pion n'est pas déjà pris par quelqu'un d'autre
        const takenBy = Object.entries(existing).find(([pid, pid2]) => pid2 === pionId && pid !== playerId);
        if (takenBy) return socket.emit('error', { message: 'Ce pion est déjà pris' });

        const lobbyPions = { ...existing, [playerId]: pionId };
        const newGs = { ...(room.gameState ?? {}), lobbyPions };
        await prisma.room.update({ where: { id: roomId }, data: { gameState: newGs } });

        const payload = await buildRoomPayload(roomId);
        io.to(roomId).emit('room_updated', payload);
      } catch (err) {
        console.error('[pick_pion]', err);
      }
    });

    // ── pick_color ────────────────────────────────────────────────────────
    socket.on('pick_color', async ({ roomId, playerId, colorId }) => {
      try {
        const room = await prisma.room.findUnique({ where: { id: roomId } });
        if (!room || room.status !== 'waiting') return;

        const existing = room.gameState?.lobbyColors ?? {};
        const takenBy  = Object.entries(existing).find(([pid, cid]) => cid === colorId && pid !== playerId);
        if (takenBy) return socket.emit('error', { message: 'Cette couleur est déjà prise' });

        const lobbyColors = { ...existing, [playerId]: colorId };
        const newGs = { ...(room.gameState ?? {}), lobbyColors };
        await prisma.room.update({ where: { id: roomId }, data: { gameState: newGs } });

        const payload = await buildRoomPayload(roomId);
        io.to(roomId).emit('room_updated', payload);
      } catch (err) {
        console.error('[pick_color]', err);
      }
    });

    // ── start_game ────────────────────────────────────────────────────────
    socket.on('start_game', async ({ roomId }) => {
      try {
        const room = await prisma.room.findUnique({
          where:   { id: roomId },
          include: { players: { orderBy: { id: 'asc' } } },
        });
        if (!room)                   return socket.emit('error', { message: 'Room introuvable' });
        if (room.status !== 'waiting') return socket.emit('error', { message: 'Partie déjà démarrée' });
        if (room.players.length < 2) return socket.emit('error', { message: 'Il faut au moins 2 joueurs' });
        if (room.players[0].id !== socket.data?.playerId)
          return socket.emit('error', { message: "Seul l'hôte peut lancer la partie" });

        const pionChoices  = room.gameState?.lobbyPions  ?? {};
        const colorChoices = room.gameState?.lobbyColors ?? {};
        const gs = initGameState(room.players, undefined, undefined, pionChoices, colorChoices);
        await prisma.room.update({
          where: { id: roomId },
          data:  { status: 'playing', gameState: gs },
        });

        console.log(`[Socket] Partie lancée room ${room.code} — ${room.players.length}j`);
        io.to(roomId).emit('game_started', { roomId, gameState: gs });
      } catch (err) {
        console.error('[start_game]', err);
        socket.emit('error', { message: 'Erreur serveur' });
      }
    });

    // ── roll_dice ─────────────────────────────────────────────────────────
    socket.on('roll_dice', async ({ roomId, playerId, forceDice }) => {
      try {
        const room = await loadRoom(roomId);
        if (!room || room.status !== 'playing')
          return socket.emit('error', { message: 'Partie non active' });

        let gs = room.gameState;
        if (!isCurrentTurn(gs, playerId))
          return socket.emit('error', { message: "Ce n'est pas votre tour" });

        // forceDice uniquement autorisé hors production (pour les tests)
        const dice = (process.env.NODE_ENV !== 'production' && Array.isArray(forceDice))
          ? forceDice : undefined;
        const roll = engine.rollDice(gs, playerId, dice);
        if (roll.error) return socket.emit('error', { message: roll.error });
        gs = roll.gameState;

        // Envoyé en prison par triple double
        if (roll.sentToJail) {
          const landing = engine.processLanding(gs, playerId);
          gs = landing.gameState;
          await saveAndBroadcast(io, roomId, gs);
          io.to(roomId).emit('dice_rolled', {
            playerId,
            diceValues:    roll.diceValues,
            steps:         roll.steps,
            newPosition:   roll.newPosition,
            sentToJail:    true,
            mustRollAgain: false,
            isDouble:      true,
          });
          return;
        }

        // En prison — attente
        if (roll.jailWait) {
          await saveAndBroadcast(io, roomId, gs);
          io.to(roomId).emit('dice_rolled', {
            playerId,
            diceValues:  roll.diceValues,
            jailWait:    true,
            newPosition: roll.newPosition,
          });
          return;
        }

        // Traiter l'atterrissage
        const landing = engine.processLanding(gs, playerId);
        gs = landing.gameState;

        // Gérer les effets spéciaux
        if (landing.action === 'draw_card') {
          const { card, effect } = landing;

          if (card.type === 'reveal_alliance') {
            // Indic : révèle une alliance au seul joueur ayant tiré
            socket.emit('indic_result', { alliance: effect.revealedAlliance });
            io.to(roomId).emit('indic_drawn', { playerId });
          } else if (card.type === 'force_reveal_ally') {
            // Rumeur : demande au joueur de choisir une cible
            const targets = gs.players
              .filter(p => p.id !== playerId && p.alive)
              .map(p => p.id);
            socket.emit('rumeur_choose', { targets });
          } else {
            // Carte standard : broadcast à toute la room
            io.to(roomId).emit('event_card_drawn', { card, playerId });
          }

        } else if (landing.action === 'buy_available') {
          const player = gs.players.find(p => p.id === playerId);
          const sq     = gs.board[player.position];
          socket.emit('property_available', { propertyId: sq.id });
        }

        await saveAndBroadcast(io, roomId, gs);
        io.to(roomId).emit('dice_rolled', {
          playerId,
          diceValues:    roll.diceValues,
          steps:         roll.steps,
          newPosition:   roll.newPosition,
          passedGo:      roll.passedGo,
          isDouble:      roll.isDouble,
          mustRollAgain: roll.mustRollAgain,
          sentToJail:    false,
          action:        landing.action,
        });
      } catch (err) {
        console.error('[roll_dice]', err);
        socket.emit('error', { message: 'Erreur serveur' });
      }
    });

    // ── rumeur_target ─────────────────────────────────────────────────────
    socket.on('rumeur_target', async ({ roomId, playerId, targetId }) => {
      try {
        const room = await loadRoom(roomId);
        if (!room || room.status !== 'playing') return;
        const gs = room.gameState;

        const hasAlliance = gs.alliances.some(a =>
          a.status === 'active' && (a.p1 === targetId || a.p2 === targetId)
        );
        io.to(roomId).emit('rumeur_answer', { targetId, hasAlliance });
      } catch (err) {
        console.error('[rumeur_target]', err);
      }
    });

    // ── buy_property ──────────────────────────────────────────────────────
    socket.on('buy_property', async ({ roomId, playerId, propertyId }) => {
      try {
        const room = await loadRoom(roomId);
        if (!room || room.status !== 'playing')
          return socket.emit('error', { message: 'Partie non active' });

        let gs = room.gameState;
        if (!isCurrentTurn(gs, playerId))
          return socket.emit('error', { message: "Ce n'est pas votre tour" });

        const player   = engine.getPlayer(gs, playerId);
        const sq       = engine.getSquare(gs, propertyId);
        if (!player || !sq || player.position !== sq.idx)
          return socket.emit('error', { message: 'Vous devez être sur la case pour acheter' });

        const result = engine.buyProperty(gs, playerId, propertyId);
        if (!result.success) return socket.emit('error', { message: result.error });

        gs = result.gameState;
        await saveAndBroadcast(io, roomId, gs);
      } catch (err) {
        console.error('[buy_property]', err);
        socket.emit('error', { message: 'Erreur serveur' });
      }
    });

    // ── refuse_purchase ───────────────────────────────────────────────────
    socket.on('refuse_purchase', async ({ roomId, playerId, propertyId }) => {
      try {
        const room = await loadRoom(roomId);
        if (!room || room.status !== 'playing')
          return socket.emit('error', { message: 'Partie non active' });

        let gs = room.gameState;
        const result = engine.refusePurchase(gs, playerId, propertyId);
        if (result.error) return socket.emit('error', { message: result.error });

        gs = result.gameState;
        const { auctionId } = result;

        await saveGameState(roomId, gs);
        io.to(roomId).emit('auction_started', {
          auctionId,
          propertyId,
          startingBid: 1,
        });
        io.to(roomId).emit('game_updated', { gameState: gs });

        // Timer 30s → fermeture automatique
        setTimer(roomId, 'auction', async () => {
          try {
            const r2 = await loadRoom(roomId);
            if (!r2 || r2.status !== 'playing') return;
            let gs2 = r2.gameState;
            const closeResult = engine.closeAuction(gs2, auctionId);
            gs2 = closeResult.gameState;
            await saveGameState(roomId, gs2);
            io.to(roomId).emit('auction_closed', {
              auctionId,
              winner:     closeResult.winner,
              finalPrice: closeResult.finalPrice,
              propertyId,
            });
            io.to(roomId).emit('game_updated', { gameState: gs2 });
          } catch (e) {
            console.error('[auction timer]', e);
          }
        }, 30000);
      } catch (err) {
        console.error('[refuse_purchase]', err);
        socket.emit('error', { message: 'Erreur serveur' });
      }
    });

    // ── place_bid ─────────────────────────────────────────────────────────
    socket.on('place_bid', async ({ roomId, playerId, auctionId, amount }) => {
      try {
        const room = await loadRoom(roomId);
        if (!room || room.status !== 'playing') return;

        let gs = room.gameState;
        const result = engine.placeBid(gs, playerId, auctionId, amount);
        if (!result.success) return socket.emit('error', { message: result.error });

        gs = result.gameState;
        const auction = gs.auctions.find(a => a.id === auctionId);

        await saveGameState(roomId, gs);
        io.to(roomId).emit('bid_placed', {
          auctionId,
          playerId,
          amount,
          currentBid:    auction.currentBid,
          propertyId:    auction.propertyId,
        });
        io.to(roomId).emit('game_updated', { gameState: gs });

        // Reset le timer à 10s après chaque enchère
        setTimer(roomId, 'auction', async () => {
          try {
            const r2 = await loadRoom(roomId);
            if (!r2 || r2.status !== 'playing') return;
            let gs2    = r2.gameState;
            const a    = gs2.auctions?.find(a => a.id === auctionId);
            if (!a || a.status !== 'open') return;
            const closeResult = engine.closeAuction(gs2, auctionId);
            gs2 = closeResult.gameState;
            await saveGameState(roomId, gs2);
            io.to(roomId).emit('auction_closed', {
              auctionId,
              winner:     closeResult.winner,
              finalPrice: closeResult.finalPrice,
              propertyId: a.propertyId,
            });
            io.to(roomId).emit('game_updated', { gameState: gs2 });
          } catch (e) {
            console.error('[bid timer]', e);
          }
        }, 10000);
      } catch (err) {
        console.error('[place_bid]', err);
        socket.emit('error', { message: 'Erreur serveur' });
      }
    });

    // ── build ─────────────────────────────────────────────────────────────
    socket.on('build', async ({ roomId, playerId, propertyId, buildingType }) => {
      try {
        const room = await loadRoom(roomId);
        if (!room || room.status !== 'playing')
          return socket.emit('error', { message: 'Partie non active' });

        let gs = room.gameState;
        const result = engine.build(gs, playerId, propertyId, buildingType);
        if (!result.success) return socket.emit('error', { message: result.error });

        gs = result.gameState;
        await saveAndBroadcast(io, roomId, gs);
      } catch (err) {
        console.error('[build]', err);
        socket.emit('error', { message: 'Erreur serveur' });
      }
    });

    // ── mortgage ──────────────────────────────────────────────────────────
    socket.on('mortgage', async ({ roomId, playerId, propertyId }) => {
      try {
        const room = await loadRoom(roomId);
        if (!room || room.status !== 'playing')
          return socket.emit('error', { message: 'Partie non active' });

        let gs = room.gameState;
        const result = engine.mortgageProperty(gs, playerId, propertyId);
        if (!result.success) return socket.emit('error', { message: result.error });

        gs = result.gameState;
        await saveAndBroadcast(io, roomId, gs);
      } catch (err) {
        console.error('[mortgage]', err);
        socket.emit('error', { message: 'Erreur serveur' });
      }
    });

    // ── unmortgage ────────────────────────────────────────────────────────
    socket.on('unmortgage', async ({ roomId, playerId, propertyId }) => {
      try {
        const room = await loadRoom(roomId);
        if (!room || room.status !== 'playing')
          return socket.emit('error', { message: 'Partie non active' });

        let gs = room.gameState;
        const result = engine.unmortgageProperty(gs, playerId, propertyId);
        if (!result.success) return socket.emit('error', { message: result.error });

        gs = result.gameState;
        await saveAndBroadcast(io, roomId, gs);
      } catch (err) {
        console.error('[unmortgage]', err);
        socket.emit('error', { message: 'Erreur serveur' });
      }
    });

    // ── sell_building ─────────────────────────────────────────────────────
    socket.on('sell_building', async ({ roomId, playerId, propertyId }) => {
      try {
        const room = await loadRoom(roomId);
        if (!room || room.status !== 'playing')
          return socket.emit('error', { message: 'Partie non active' });

        let gs = room.gameState;
        const result = engine.sellBuilding(gs, playerId, propertyId);
        if (!result.success) return socket.emit('error', { message: result.error });

        gs = result.gameState;
        await saveAndBroadcast(io, roomId, gs);
      } catch (err) {
        console.error('[sell_building]', err);
        socket.emit('error', { message: 'Erreur serveur' });
      }
    });

    // ── end_turn ──────────────────────────────────────────────────────────
    socket.on('end_turn', async ({ roomId, playerId }) => {
      try {
        const room = await loadRoom(roomId);
        if (!room || room.status !== 'playing')
          return socket.emit('error', { message: 'Partie non active' });

        let gs = room.gameState;
        if (!isCurrentTurn(gs, playerId))
          return socket.emit('error', { message: "Ce n'est pas votre tour" });

        const endResult = engine.endTurn(gs);
        gs = endResult.gameState;

        if (endResult.dayNightChanged) {
          io.to(roomId).emit('day_night_changed', { isNight: endResult.isNight });
        }
        if (endResult.strikeChanged) {
          io.to(roomId).emit('transport_strike', { active: endResult.strikeActive });
        }

        const { winner, reason } = engine.checkVictory(gs);
        if (winner) {
          gs.phase = 'ended';
          await saveGameState(roomId, gs);
          io.to(roomId).emit('game_over', { winner, reason });
          io.to(roomId).emit('game_updated', { gameState: gs });
          return;
        }

        await saveAndBroadcast(io, roomId, gs);
      } catch (err) {
        console.error('[end_turn]', err);
        socket.emit('error', { message: 'Erreur serveur' });
      }
    });

    // ── propose_trade ─────────────────────────────────────────────────────
    socket.on('propose_trade', async ({ roomId, fromId, toId, offer }) => {
      try {
        const room = await loadRoom(roomId);
        if (!room || room.status !== 'playing') return;

        let gs = room.gameState;
        const result = engine.proposeTrade(gs, fromId, toId, offer);
        gs = result.gameState;

        await saveGameState(roomId, gs);

        // Émettre seulement au destinataire
        const toPlayer = await prisma.player.findUnique({ where: { id: toId } });
        if (toPlayer?.socketId) {
          io.to(toPlayer.socketId).emit('trade_proposed', {
            tradeId: result.tradeId,
            fromId,
            offer,
          });
        }

        // Timer 45s → refus automatique
        setTimer(roomId, `trade_${result.tradeId}`, async () => {
          try {
            const r2 = await loadRoom(roomId);
            if (!r2 || r2.status !== 'playing') return;
            let gs2 = r2.gameState;
            const t = gs2.trades?.find(t => t.id === result.tradeId);
            if (!t || t.status !== 'pending') return;
            engine.refuseTrade(gs2, result.tradeId);
            await saveGameState(roomId, gs2);
            io.to(roomId).emit('trade_result', { tradeId: result.tradeId, accepted: false });
          } catch (e) {
            console.error('[trade timer]', e);
          }
        }, 45000);
      } catch (err) {
        console.error('[propose_trade]', err);
        socket.emit('error', { message: 'Erreur serveur' });
      }
    });

    // ── accept_trade ──────────────────────────────────────────────────────
    socket.on('accept_trade', async ({ roomId, tradeId }) => {
      try {
        const room = await loadRoom(roomId);
        if (!room || room.status !== 'playing') return;

        let gs = room.gameState;
        clearTimer(roomId, `trade_${tradeId}`);

        const result = engine.acceptTrade(gs, tradeId);
        if (!result.success) return socket.emit('error', { message: result.error });

        gs = result.gameState;
        await saveAndBroadcast(io, roomId, gs);
        io.to(roomId).emit('trade_result', { tradeId, accepted: true });

        if (result.mortgageInherited) {
          const trade = gs.trades.find(t => t.id === tradeId);
          io.to(roomId).emit('mortgage_inherited', {
            propertyId: result.mortgageInherited,
            newOwner:   trade?.toId,
          });
        }
      } catch (err) {
        console.error('[accept_trade]', err);
        socket.emit('error', { message: 'Erreur serveur' });
      }
    });

    // ── refuse_trade ──────────────────────────────────────────────────────
    socket.on('refuse_trade', async ({ roomId, tradeId }) => {
      try {
        const room = await loadRoom(roomId);
        if (!room || room.status !== 'playing') return;

        let gs = room.gameState;
        clearTimer(roomId, `trade_${tradeId}`);
        engine.refuseTrade(gs, tradeId);
        await saveGameState(roomId, gs);
        io.to(roomId).emit('trade_result', { tradeId, accepted: false });
      } catch (err) {
        console.error('[refuse_trade]', err);
        socket.emit('error', { message: 'Erreur serveur' });
      }
    });

    // ── force_trade ───────────────────────────────────────────────────────
    socket.on('force_trade', async ({ roomId, fromId, propertyId }) => {
      try {
        const room = await loadRoom(roomId);
        if (!room || room.status !== 'playing')
          return socket.emit('error', { message: 'Partie non active' });

        let gs = room.gameState;
        const result = engine.forceTrade(gs, fromId, propertyId);
        if (!result.success) return socket.emit('error', { message: result.error });

        gs = result.gameState;
        await saveAndBroadcast(io, roomId, gs);

        const sq = engine.getSquare(gs, propertyId);
        io.to(roomId).emit('force_trade_done', {
          fromId,
          toId:         result.toId,
          propertyId,
          price:        sq.price * 3,
          immunityTurns: 2,
        });

        if (result.allianceBroken) {
          const a = result.allianceBroken;
          io.to(roomId).emit('alliance_broken', {
            p1:         a.p1,
            p2:         a.p2,
            formedTurn: a.formedTurn,
            brokenTurn: a.brokenTurn,
            initiator:  a.initiator,
          });
        }
      } catch (err) {
        console.error('[force_trade]', err);
        socket.emit('error', { message: 'Erreur serveur' });
      }
    });

    // ── propose_alliance ──────────────────────────────────────────────────
    socket.on('propose_alliance', async ({ roomId, fromId, toId }) => {
      try {
        const room = await loadRoom(roomId);
        if (!room || room.status !== 'playing') return;

        let gs = room.gameState;
        const result = engine.proposeAlliance(gs, fromId, toId);
        gs = result.gameState;
        await saveGameState(roomId, gs);

        // Émettre seulement au destinataire
        const toPlayer = await prisma.player.findUnique({ where: { id: toId } });
        if (toPlayer?.socketId) {
          io.to(toPlayer.socketId).emit('alliance_proposed', {
            allianceId: result.allianceId,
            fromId,
          });
        }
      } catch (err) {
        console.error('[propose_alliance]', err);
        socket.emit('error', { message: 'Erreur serveur' });
      }
    });

    // ── accept_alliance ───────────────────────────────────────────────────
    socket.on('accept_alliance', async ({ roomId, allianceId }) => {
      try {
        const room = await loadRoom(roomId);
        if (!room || room.status !== 'playing') return;

        let gs = room.gameState;
        const alliance = gs.alliances?.find(a => a.id === allianceId);
        if (!alliance) return socket.emit('error', { message: 'Alliance introuvable' });

        const result = engine.acceptAlliance(gs, allianceId);
        if (!result.success) return socket.emit('error', { message: result.error });

        gs = result.gameState;
        await saveGameState(roomId, gs);

        // Émettre les alliances brisées à TOUS
        for (const broken of result.brokenAlliances) {
          io.to(roomId).emit('alliance_broken', {
            p1:         broken.p1,
            p2:         broken.p2,
            formedTurn: broken.formedTurn,
            brokenTurn: broken.brokenTurn,
            initiator:  broken.initiator,
          });
        }

        // alliance_formed seulement aux deux membres
        const p1Player = await prisma.player.findUnique({ where: { id: alliance.p1 } });
        const p2Player = await prisma.player.findUnique({ where: { id: alliance.p2 } });
        const formed   = { allianceId, p1: alliance.p1, p2: alliance.p2 };
        if (p1Player?.socketId) io.to(p1Player.socketId).emit('alliance_formed', formed);
        if (p2Player?.socketId) io.to(p2Player.socketId).emit('alliance_formed', formed);

        io.to(roomId).emit('game_updated', { gameState: gs });
      } catch (err) {
        console.error('[accept_alliance]', err);
        socket.emit('error', { message: 'Erreur serveur' });
      }
    });

    // ── break_alliance ────────────────────────────────────────────────────
    socket.on('break_alliance', async ({ roomId, playerId }) => {
      try {
        const room = await loadRoom(roomId);
        if (!room || room.status !== 'playing') return;

        let gs = room.gameState;
        const result = engine.breakAlliance(gs, playerId);
        gs = result.gameState;
        await saveAndBroadcast(io, roomId, gs);

        if (result.revealedAlliance) {
          const a = result.revealedAlliance;
          io.to(roomId).emit('alliance_broken', {
            p1:         a.p1,
            p2:         a.p2,
            formedTurn: a.formedTurn,
            brokenTurn: a.brokenTurn,
            initiator:  a.initiator,
          });
        }
      } catch (err) {
        console.error('[break_alliance]', err);
        socket.emit('error', { message: 'Erreur serveur' });
      }
    });

    // ── propose_coloc ─────────────────────────────────────────────────────
    socket.on('propose_coloc', async ({ roomId, player1Id, player2Id, propertyId }) => {
      try {
        const room = await loadRoom(roomId);
        if (!room || room.status !== 'playing')
          return socket.emit('error', { message: 'Partie non active' });

        let gs = room.gameState;
        const result = engine.buyColoc(gs, player1Id, player2Id, propertyId);
        if (!result.success) return socket.emit('error', { message: result.error });

        gs = result.gameState;
        await saveAndBroadcast(io, roomId, gs);
      } catch (err) {
        console.error('[propose_coloc]', err);
        socket.emit('error', { message: 'Erreur serveur' });
      }
    });

    // ── leave_coloc ───────────────────────────────────────────────────────
    socket.on('leave_coloc', async ({ roomId, playerId, propertyId }) => {
      try {
        const room = await loadRoom(roomId);
        if (!room || room.status !== 'playing') return;

        let gs = room.gameState;
        const result = engine.leaveColoc(gs, playerId, propertyId);
        if (!result.success) return socket.emit('error', { message: result.error });

        gs = result.gameState;
        const { negotiationId } = result;
        const sq = engine.getSquare(gs, propertyId);

        await saveGameState(roomId, gs);

        // Émettre aux deux co-propriétaires
        for (const coOwnerId of (sq.coOwners || [])) {
          const coOwner = await prisma.player.findUnique({ where: { id: coOwnerId } });
          if (coOwner?.socketId) {
            io.to(coOwner.socketId).emit('coloc_negotiation', {
              negotiationId,
              propertyId,
              initiator: playerId,
              timeLeft:  60,
            });
          }
        }

        // Timer 60s → enchère automatique si pas d'accord
        setTimer(roomId, `coloc_${negotiationId}`, async () => {
          try {
            const r2 = await loadRoom(roomId);
            if (!r2 || r2.status !== 'playing') return;
            let gs2 = r2.gameState;
            const neg = gs2.negotiations?.find(n => n.id === negotiationId);
            if (!neg || neg.status !== 'pending') return;
            const aRes = engine.startAuction(gs2, propertyId);
            gs2 = aRes.gameState;
            await saveGameState(roomId, gs2);
            io.to(roomId).emit('auction_started', {
              auctionId: aRes.auctionId,
              propertyId,
              startingBid: 1,
            });
            io.to(roomId).emit('game_updated', { gameState: gs2 });
          } catch (e) {
            console.error('[coloc timer]', e);
          }
        }, 60000);
      } catch (err) {
        console.error('[leave_coloc]', err);
        socket.emit('error', { message: 'Erreur serveur' });
      }
    });

    // ── coloc_offer ───────────────────────────────────────────────────────
    socket.on('coloc_offer', async ({ roomId, playerId, negotiationId, amount }) => {
      try {
        const room = await loadRoom(roomId);
        if (!room || room.status !== 'playing') return;

        let gs = room.gameState;
        const neg = gs.negotiations?.find(n => n.id === negotiationId);
        if (!neg) return;

        engine.colocOffer(gs, playerId, negotiationId, amount);
        await saveGameState(roomId, gs);

        // Émettre à l'autre co-propriétaire
        const otherId = neg.p1 === playerId ? neg.p2 : neg.p1;
        const other   = await prisma.player.findUnique({ where: { id: otherId } });
        if (other?.socketId) {
          io.to(other.socketId).emit('coloc_offer_received', {
            negotiationId,
            amount,
            from: playerId,
          });
        }
      } catch (err) {
        console.error('[coloc_offer]', err);
        socket.emit('error', { message: 'Erreur serveur' });
      }
    });

    // ── coloc_accept ──────────────────────────────────────────────────────
    socket.on('coloc_accept', async ({ roomId, playerId, negotiationId }) => {
      try {
        const room = await loadRoom(roomId);
        if (!room || room.status !== 'playing') return;

        let gs = room.gameState;
        clearTimer(roomId, `coloc_${negotiationId}`);

        const result = engine.colocAccept(gs, playerId, negotiationId);
        if (!result.success) return socket.emit('error', { message: result.error });

        gs = result.gameState;
        await saveAndBroadcast(io, roomId, gs);
      } catch (err) {
        console.error('[coloc_accept]', err);
        socket.emit('error', { message: 'Erreur serveur' });
      }
    });

    // ── disconnect ────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      const { roomId, playerId } = socket.data ?? {};
      console.log(`[Socket] Déconnexion : ${socket.id}`);
      try {
        if (playerId) {
          await prisma.player.update({
            where: { id: playerId },
            data:  { socketId: null },
          }).catch(() => {});
        }

        if (roomId) {
          const room = await loadRoom(roomId);
          if (room?.status === 'playing') {
            const gs = room.gameState;
            const gp = gs.players?.find(p => p.id === playerId);
            if (gp) {
              gp.disconnected = true;
              await saveGameState(roomId, gs);
              io.to(roomId).emit('player_disconnected', { playerId });
              io.to(roomId).emit('game_updated', { gameState: gs });
            }
          } else {
            const payload = await buildRoomPayload(roomId);
            if (payload) io.to(roomId).emit('room_updated', payload);
          }
        }
      } catch (err) {
        console.error('[disconnect]', err);
      }
    });
  });
}

module.exports = { attachHandlers };

// ── Démarrage du serveur (uniquement si ce fichier est le point d'entrée) ─────
if (require.main === module) {
  const next = require('next');
  const dev  = process.env.NODE_ENV !== 'production';
  const port = parseInt(process.env.PORT || '3000', 10);
  const app  = next({ dev });

  app.prepare().then(() => {
    const handle     = app.getRequestHandler();
    const httpServer = createServer((req, res) => {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    });

    const io = new Server(httpServer, {
      cors: { origin: '*', methods: ['GET', 'POST'] },
    });

    attachHandlers(io);

    httpServer.listen(port, () => {
      console.log(`\n🏠  PROPRIO — serveur démarré`);
      console.log(`    → http://localhost:${port}`);
      console.log(`    → Mode : ${dev ? 'développement' : 'production'}\n`);
    });
  });
}
