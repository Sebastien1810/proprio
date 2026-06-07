'use strict';

/**
 * Phase 4 — Tests d'intégration Socket.IO
 *
 * Simule 3 "onglets navigateurs" (Alice, Bob, Charlie) via socket.io-client.
 * Prérequis : node tests/phase4-server.js doit tourner en parallèle.
 *
 * Les dice sont forcés via forceDice:[d1,d2] (autorisé hors production).
 * On positionne les joueurs en amont pour contrôler les atterrissages.
 */

const { io: ioc }     = require('socket.io-client');
const prisma          = require('../lib/prisma');
const engine          = require('../lib/game-engine');
const { initGameState } = require('../lib/game-init');

const SERVER_URL = process.env.TEST_SERVER_URL || 'http://localhost:3099';
const TIMEOUT    = 8000;

// ── Mini runner ───────────────────────────────────────────────────────────────

let passed = 0, failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅  ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌  ${name}`);
    console.log(`       → ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg ?? 'assertion échouée');
}

function eq(a, b, msg) {
  if (a !== b) throw new Error(msg ?? `attendu ${JSON.stringify(b)}, reçu ${JSON.stringify(a)}`);
}

function waitFor(socket, event, ms = TIMEOUT) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout ${ms}ms attendant '${event}'`)),
      ms
    );
    socket.once(event, (data) => { clearTimeout(timer); resolve(data); });
  });
}

// Vérifie qu'un event n'arrive PAS dans le délai donné
function waitNotReceived(socket, event, ms = 900) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(true), ms);
    socket.once(event, () => {
      clearTimeout(timer);
      reject(new Error(`Event '${event}' reçu alors qu'il ne devrait pas l'être`));
    });
  });
}

function waitAll(sockets, event, ms = TIMEOUT) {
  return Promise.all(sockets.map(s => waitFor(s, event, ms)));
}

// ── Helpers DB ────────────────────────────────────────────────────────────────

async function createTestGame() {
  const room = await prisma.room.create({
    data: {
      code:      'PH4T',
      status:    'playing',
      gameState: {},
      players: {
        createMany: {
          data: [
            { name: 'Alice',   color: '#e74c3c' },
            { name: 'Bob',     color: '#3498db' },
            { name: 'Charlie', color: '#2ecc71' },
          ],
        },
      },
    },
    include: { players: { orderBy: { id: 'asc' } } },
  });

  const gs = initGameState(room.players);
  await prisma.room.update({ where: { id: room.id }, data: { gameState: gs } });

  return { roomId: room.id, players: room.players, gs };
}

async function getGS(roomId) {
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  return room.gameState;
}

async function setGS(roomId, gs) {
  await prisma.room.update({ where: { id: roomId }, data: { gameState: gs } });
}

async function cleanup(roomId) {
  await prisma.player.deleteMany({ where: { roomId } });
  await prisma.room.delete({ where: { id: roomId } });
}

// ── Connexion sockets ─────────────────────────────────────────────────────────

function connect() {
  return ioc(SERVER_URL, { transports: ['websocket'], reconnection: false });
}

async function joinRoom(socket, roomId, playerId) {
  const p = waitFor(socket, 'room_updated');
  socket.emit('join_room', { roomId, playerId });
  await p;
}

// ── Emit + attendre game_updated ──────────────────────────────────────────────

function rollForced(socket, roomId, playerId, d1, d2) {
  socket.emit('roll_dice', { roomId, playerId, forceDice: [d1, d2] });
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Phase 4 — Tests intégration Socket.IO ────────────────────────\n');
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  // Nettoyer si room test existe déjà
  const existing = await prisma.room.findUnique({ where: { code: 'PH4T' } });
  if (existing) await cleanup(existing.id);

  const setup    = await createTestGame();
  const roomId   = setup.roomId;
  const aliceId  = setup.players[0].id;
  const bobId    = setup.players[1].id;
  const charlieId= setup.players[2].id;

  let sA = connect(), sB = connect(), sC = connect();
  await Promise.all([waitFor(sA,'connect'), waitFor(sB,'connect'), waitFor(sC,'connect')]);
  await joinRoom(sA, roomId, aliceId);
  await joinRoom(sB, roomId, bobId);
  await joinRoom(sC, roomId, charlieId);

  // ── Helpers ───────────────────────────────────────────────────────────────

  async function setCurrentPlayer(idx) {
    const gs = await getGS(roomId);
    gs.currentPlayerIndex = idx;
    await setGS(roomId, gs);
  }

  async function setAliceTurn() { await setCurrentPlayer(0); }

  // ── T1 : Triple double → prison ───────────────────────────────────────────
  await test('T1 — Triple double → sentToJail=true, mustRollAgain=false (3 onglets)', async () => {
    await setAliceTurn();
    const gs = await getGS(roomId);
    gs.players[0].jailTurns    = 0;
    gs.players[0].doubleStreak = 2;  // déjà 2 doubles consécutifs
    gs.players[0].position     = 5;  // position arbitraire (pas en prison)
    await setGS(roomId, gs);

    const allDice = waitAll([sA, sB, sC], 'dice_rolled');
    // forceDice [2,2] → double → streaks = 3 → prison
    rollForced(sA, roomId, aliceId, 2, 2);
    const results = await allDice;

    for (const r of results) {
      assert(r.sentToJail    === true,  `sentToJail devrait être true, reçu : ${JSON.stringify(r)}`);
      assert(r.mustRollAgain === false, `mustRollAgain devrait être false après 3ème double`);
    }

    const gsAfter = await getGS(roomId);
    const jailPos = gsAfter.board.findIndex(s => s.type === 'jail');
    eq(gsAfter.players[0].position, jailPos, `Alice devrait être en prison (idx ${jailPos})`);
    assert(gsAfter.players[0].jailTurns > 0, `jailTurns devrait être > 0`);
  });

  // ── T2 : Prop libre → property_available seulement chez Alice ─────────────
  await test('T2 — Atterrir sur prop libre → property_available seulement chez Alice', async () => {
    await setAliceTurn();
    const gs = await getGS(roomId);

    // Trouver une prop libre, placer Alice 2 cases avant avec doubleStreak=0
    const propSq = gs.board.find(s => s.type === 'prop' && !s.ownerId);
    assert(propSq, 'Aucune prop libre sur le plateau');

    gs.players[0].jailTurns    = 0;
    gs.players[0].doubleStreak = 0;
    // Position = idx - 2 (les dés forcés = [1,1] → steps=2 → atterrit sur propSq)
    gs.players[0].position = (propSq.idx - 2 + gs.board.length) % gs.board.length;
    await setGS(roomId, gs);

    const alicePropAvail  = waitFor(sA, 'property_available');
    const charlieNoEvent  = waitNotReceived(sC, 'property_available', 900);

    // forceDice [1,1] → steps=2 → Alice atterrit sur propSq, isDouble=true mais
    // property_available est émis avant mustRollAgain
    rollForced(sA, roomId, aliceId, 1, 1);

    const [propEvent] = await Promise.all([alicePropAvail, charlieNoEvent]);
    eq(propEvent.propertyId, propSq.id, `propertyId devrait être ${propSq.id}`);
  });

  // ── T3 : Refus → enchères sur 3 onglets ───────────────────────────────────
  await test('T3 — Refus achat → auction_started sur les 3 onglets', async () => {
    const gs = await getGS(roomId);
    const propSq = gs.board.find(s => s.type === 'prop' && !s.ownerId);
    assert(propSq, 'Aucune prop libre');

    const allAuction = waitAll([sA, sB, sC], 'auction_started');
    sA.emit('refuse_purchase', { roomId, playerId: aliceId, propertyId: propSq.id });
    const results = await allAuction;

    for (const r of results) {
      assert(r.auctionId,        `auctionId devrait être défini`);
      eq(r.propertyId, propSq.id, `propertyId correct`);
      eq(r.startingBid, 1,        `startingBid = 1`);
    }

    // Stocker l'auctionId pour T4
    sA._testAuctionId  = results[0].auctionId;
    sA._testAuctionProp = propSq.id;
  });

  // ── T4 : Bob enchérit → currentBid mis à jour ─────────────────────────────
  await test('T4 — Bob enchérit → bid_placed sur 3 onglets en temps réel', async () => {
    const auctionId = sA._testAuctionId;
    assert(auctionId, 'auctionId non disponible (T3 doit passer)');

    const allBid = waitAll([sA, sB, sC], 'bid_placed');
    sB.emit('place_bid', { roomId, playerId: bobId, auctionId, amount: 50 });
    const results = await allBid;

    for (const r of results) {
      eq(r.playerId,   bobId,      `playerId = Bob`);
      eq(r.currentBid, 50,         `currentBid = 50`);
      eq(r.auctionId,  auctionId,  `auctionId correct`);
    }

    const gsAfter = await getGS(roomId);
    const a = gsAfter.auctions?.find(a => a.id === auctionId);
    eq(a?.currentBid,    50,   `currentBid en DB = 50`);
    eq(a?.currentBidder, bobId, `currentBidder = Bob`);
  });

  // ── T5 : Bob sur prop d'Alice → loyer débité/crédité ─────────────────────
  await test('T5 — Bob atterrit sur prop Alice → loyer débité/crédité sur 3 onglets', async () => {
    let gs = await getGS(roomId);

    // Utiliser une prop avec idx >= 4 pour éviter que Bob passe par la case départ
    // lors du déplacement de 2 cases (wrap-around accidentel)
    const propSq = gs.board.find(s => s.type === 'prop' && s.idx >= 4);
    assert(propSq, 'Aucune prop avec idx >= 4');
    propSq.ownerId   = aliceId;
    propSq.mortgaged = false;
    propSq.building  = null;

    // Positionner Bob exactement 2 cases avant la prop (pas de wrap)
    gs.players[1].position     = propSq.idx - 2;
    gs.players[1].jailTurns    = 0;
    gs.players[1].doubleStreak = 0;
    gs.currentPlayerIndex      = 1; // tour de Bob
    await setGS(roomId, gs);

    // Calculer le loyer attendu
    const rent = engine.calculateRent(gs, propSq.id, bobId);
    assert(rent > 0, `Le loyer calculé devrait être > 0 (obtenu ${rent})`);

    const cashAliceBefore = gs.players[0].cash;
    const cashBobBefore   = gs.players[1].cash;

    const allUpdated = waitAll([sA, sB, sC], 'game_updated');
    // forceDice [1,1] → steps=2 → Bob atterrit sur propSq
    rollForced(sB, roomId, bobId, 1, 1);
    await allUpdated;

    const gsAfter = await getGS(roomId);
    eq(gsAfter.players[0].cash, cashAliceBefore + rent, `Alice devrait avoir reçu ${rent}€`);
    eq(gsAfter.players[1].cash, cashBobBefore   - rent, `Bob devrait avoir payé ${rent}€`);
  });

  // ── T6 : Construction hybride ─────────────────────────────────────────────
  await test('T6 — Studio OK avec 1 prop ; immeuble refusé (pas assez de props groupe)', async () => {
    let gs = await getGS(roomId);

    const groupProps = gs.board.filter(s => s.type === 'prop' && s.group === 0);
    assert(groupProps.length >= 3, `Groupe 0 doit avoir ≥ 3 props`);

    const targetProp = groupProps[0];
    targetProp.ownerId  = aliceId;
    targetProp.building = null;
    groupProps.slice(1).forEach(p => { p.ownerId = null; p.building = null; });
    gs.players[0].cash = 5000;
    await setGS(roomId, gs);

    // Build studio → succès
    const studioOk = waitFor(sA, 'game_updated');
    sA.emit('build', { roomId, playerId: aliceId, propertyId: targetProp.id, buildingType: 'studio' });
    await studioOk;
    const gsStudio = await getGS(roomId);
    eq(gsStudio.board.find(s => s.id === targetProp.id)?.building, 'studio', `building = studio`);

    // Build immeuble → erreur
    const errPromise = waitFor(sA, 'error');
    sA.emit('build', { roomId, playerId: aliceId, propertyId: targetProp.id, buildingType: 'immeuble' });
    const err = await errPromise;
    assert(
      err.message.toLowerCase().includes('propri'),
      `Erreur doit mentionner les propriétés du groupe : "${err.message}"`
    );
  });

  // ── T7 : Hypothèque ───────────────────────────────────────────────────────
  await test('T7 — Alice hypothèque une prop → reçoit 50%, mortgaged=true', async () => {
    let gs = await getGS(roomId);

    // Garantir qu'Alice possède une prop sans bâtiment
    let propSq = gs.board.find(s => s.ownerId === aliceId && !s.building && !s.mortgaged);
    if (!propSq) {
      // Créer ce scénario
      propSq = gs.board.find(s => s.type === 'prop');
      propSq.ownerId  = aliceId;
      propSq.building = null;
      propSq.mortgaged = false;
    }
    assert(propSq, 'Alice doit posséder une prop sans bâtiment');

    const cashBefore = gs.players[0].cash;
    const expected   = Math.floor(propSq.price * 0.5);
    await setGS(roomId, gs);

    const allUpdated = waitAll([sA, sB, sC], 'game_updated');
    sA.emit('mortgage', { roomId, playerId: aliceId, propertyId: propSq.id });
    await allUpdated;

    const gsAfter = await getGS(roomId);
    eq(gsAfter.players[0].cash, cashBefore + expected, `Alice devrait avoir reçu ${expected}€`);
    assert(gsAfter.board.find(s => s.id === propSq.id)?.mortgaged === true, `mortgaged doit être true`);

    // Stocker l'id pour T8
    sA._mortgagedPropId = propSq.id;
  });

  // ── T8 : Lever l'hypothèque ───────────────────────────────────────────────
  await test('T8 — Alice lève hypothèque → paie 60%, mortgaged=false', async () => {
    const propId = sA._mortgagedPropId;
    assert(propId, 'propId non disponible (T7 doit passer)');

    const gs = await getGS(roomId);
    const propSq   = gs.board.find(s => s.id === propId);
    assert(propSq?.mortgaged === true, `La prop doit être hypothéquée`);

    const cashBefore = gs.players[0].cash;
    const expected   = Math.floor(propSq.price * 0.6);

    const allUpdated = waitAll([sA, sB, sC], 'game_updated');
    sA.emit('unmortgage', { roomId, playerId: aliceId, propertyId: propId });
    await allUpdated;

    const gsAfter = await getGS(roomId);
    eq(gsAfter.players[0].cash, cashBefore - expected, `Alice devrait avoir payé ${expected}€`);
    assert(gsAfter.board.find(s => s.id === propId)?.mortgaged === false, `mortgaged doit être false`);
  });

  // ── T9 : Proposition alliance secrète ─────────────────────────────────────
  await test('T9 — Alice propose alliance à Bob → Charlie ne reçoit rien', async () => {
    const bobGetsIt     = waitFor(sB, 'alliance_proposed');
    const charlieNotif  = waitNotReceived(sC, 'alliance_proposed', 900);
    const aliceNotif    = waitNotReceived(sA, 'alliance_proposed', 900);

    sA.emit('propose_alliance', { roomId, fromId: aliceId, toId: bobId });

    const [allianceEvent] = await Promise.all([bobGetsIt, charlieNotif, aliceNotif]);

    eq(allianceEvent.fromId, aliceId, `fromId = Alice`);
    assert(allianceEvent.allianceId, `allianceId défini`);
    sB._pendingAllianceId = allianceEvent.allianceId;
  });

  // ── T10 : Acceptation → seulement Alice et Bob voient alliance_formed ─────
  await test('T10 — Bob accepte → Alice+Bob reçoivent alliance_formed, Charlie rien', async () => {
    const allianceId   = sB._pendingAllianceId;
    assert(allianceId, 'allianceId non disponible (T9 doit passer)');

    const aliceFormed   = waitFor(sA, 'alliance_formed');
    const bobFormed     = waitFor(sB, 'alliance_formed');
    const charlieNoForm = waitNotReceived(sC, 'alliance_formed', 900);

    sB.emit('accept_alliance', { roomId, allianceId });
    await Promise.all([aliceFormed, bobFormed, charlieNoForm]);

    const gs = await getGS(roomId);
    assert(engine.isAllied(gs, aliceId, bobId), 'Alice et Bob doivent être alliés');
  });

  // ── T11 : Bob allié sur prop Alice → 0€ ──────────────────────────────────
  await test('T11 — Bob allié atterrit sur prop Alice → 0€ de loyer', async () => {
    let gs = await getGS(roomId);

    // S'assurer qu'Alice possède une prop avec idx >= 4 (éviter le wrap passGo)
    let propSq = gs.board.find(s => s.type === 'prop' && s.ownerId === aliceId && !s.mortgaged && s.idx >= 4);
    if (!propSq) {
      // Créer le scénario explicitement
      propSq = gs.board.find(s => s.type === 'prop' && s.idx >= 4);
      assert(propSq, 'Aucune prop avec idx >= 4');
      propSq.ownerId   = aliceId;
      propSq.mortgaged = false;
      propSq.building  = null;
    }

    gs.players[1].position     = propSq.idx - 2; // exactement 2 avant, pas de wrap
    gs.players[1].jailTurns    = 0;
    gs.players[1].doubleStreak = 0;
    gs.currentPlayerIndex      = 1;

    const cashBobBefore   = gs.players[1].cash;
    const cashAliceBefore = gs.players[0].cash;
    await setGS(roomId, gs);

    const allUpdated = waitAll([sA, sB, sC], 'game_updated');
    rollForced(sB, roomId, bobId, 1, 1);
    await allUpdated;

    const gsAfter = await getGS(roomId);
    eq(gsAfter.players[1].cash, cashBobBefore,   `Bob ne doit pas payer (allié)`);
    eq(gsAfter.players[0].cash, cashAliceBefore, `Alice ne doit pas recevoir`);
  });

  // ── T12 : Rupture alliance → révélation publique ──────────────────────────
  await test('T12 — Alice rompt → alliance_broken visible sur 3 onglets', async () => {
    const allBroken = waitAll([sA, sB, sC], 'alliance_broken');
    sA.emit('break_alliance', { roomId, playerId: aliceId });
    const results = await allBroken;

    for (const r of results) {
      assert(r.p1 && r.p2,              `p1 et p2 doivent être définis`);
      eq(r.initiator, aliceId,           `initiator = Alice`);
      assert(typeof r.formedTurn === 'number', `formedTurn est un nombre`);
      assert(typeof r.brokenTurn === 'number', `brokenTurn est un nombre`);
    }

    const gs = await getGS(roomId);
    assert(!engine.isAllied(gs, aliceId, bobId), 'Alice et Bob ne doivent plus être alliés');
  });

  // ── T13 : Trade volontaire → seul Bob reçoit la notif ────────────────────
  await test('T13 — Alice propose trade à Bob → seul Bob reçoit trade_proposed', async () => {
    const bobTrade     = waitFor(sB, 'trade_proposed');
    const charlieNoTr  = waitNotReceived(sC, 'trade_proposed', 900);
    const aliceNoTr    = waitNotReceived(sA, 'trade_proposed', 900);

    sA.emit('propose_trade', { roomId, fromId: aliceId, toId: bobId, offer: { cash: 100 } });

    const [tradeEvent] = await Promise.all([bobTrade, charlieNoTr, aliceNoTr]);

    assert(tradeEvent.tradeId, `tradeId défini`);
    eq(tradeEvent.fromId, aliceId, `fromId = Alice`);
    sB._pendingTradeId = tradeEvent.tradeId;
  });

  // ── T14 : Force trade → transfert + immunité 2 tours ─────────────────────
  await test('T14 — Alice force trade prop Bob (sans bâtiment) → transfert + immunité 2 tours', async () => {
    let gs = await getGS(roomId);

    // Bob possède une prop sans bâtiment dans un groupe différent de celui d'Alice (éviter monopole check)
    const bobProp = gs.board.find(s =>
      s.type === 'prop' && !s.building && s.ownerId !== aliceId
    );
    assert(bobProp, 'Il faut une prop sans bâtiment non possédée par Alice');
    bobProp.ownerId  = bobId;
    bobProp.building = null;
    gs.players[0].cash = 100000;
    await setGS(roomId, gs);

    const allForceDone = waitAll([sA, sB, sC], 'force_trade_done');
    sA.emit('force_trade', { roomId, fromId: aliceId, propertyId: bobProp.id });
    const results = await allForceDone;

    for (const r of results) {
      eq(r.fromId,        aliceId,    `fromId = Alice`);
      eq(r.toId,          bobId,      `toId = Bob`);
      eq(r.propertyId,    bobProp.id, `propertyId correct`);
      eq(r.immunityTurns, 2,          `immunityTurns = 2`);
    }

    const gsAfter = await getGS(roomId);
    eq(gsAfter.board.find(s => s.id === bobProp.id)?.ownerId, aliceId, `Prop appartient maintenant à Alice`);
    eq(gsAfter.players[1].immunities?.[bobProp.id], 2, `Bob a 2 tours d'immunité sur cette case`);
  });

  // ── T15 : Force trade sur prop avec bâtiment → erreur ────────────────────
  await test('T15 — Force trade sur prop avec bâtiment → refus avec message', async () => {
    let gs = await getGS(roomId);

    // Créer explicitement une prop pour Bob avec un bâtiment dans un groupe différent d'Alice
    // (pour éviter le check monopole sur le groupe d'Alice)
    const groupsOwnedByAlice = new Set(
      gs.board.filter(s => s.ownerId === aliceId && s.group !== undefined).map(s => s.group)
    );
    // Trouver une prop dans un groupe que Bob peut posséder sans qu'Alice ait le monopole
    let bobTarget = gs.board.find(s =>
      s.type === 'prop' &&
      s.ownerId !== aliceId &&
      !groupsOwnedByAlice.has(s.group)
    );
    if (!bobTarget) {
      // Fallback : n'importe quelle prop non possédée par Alice
      bobTarget = gs.board.find(s => s.type === 'prop' && s.ownerId !== aliceId);
    }
    assert(bobTarget, 'Aucune prop disponible pour le test T15');

    bobTarget.ownerId  = bobId;
    bobTarget.building = 'studio'; // force un bâtiment
    await setGS(roomId, gs);

    const errorPromise = waitFor(sA, 'error');
    sA.emit('force_trade', { roomId, fromId: aliceId, propertyId: bobTarget.id });
    const err = await errorPromise;

    assert(
      err.message.toLowerCase().includes('bâtiment') || err.message.toLowerCase().includes('batiment'),
      `Erreur doit mentionner le bâtiment : "${err.message}"`
    );
  });

  // ── T16 : Déconnexion Bob → grisé, tour skipé ────────────────────────────
  await test('T16 — Bob se déconnecte → player_disconnected, son tour skipé', async () => {
    // Mettre à jour socketId de Bob en DB pour le tracking disconnect
    await prisma.player.update({
      where: { id: bobId },
      data:  { socketId: sB.id },
    });

    const aliceDisco   = waitFor(sA, 'player_disconnected');
    const charlieDisco = waitFor(sC, 'player_disconnected');

    sB.disconnect();

    const [an, cn] = await Promise.all([aliceDisco, charlieDisco]);
    eq(an.playerId, bobId, `player_disconnected(Alice).playerId = Bob`);
    eq(cn.playerId, bobId, `player_disconnected(Charlie).playerId = Bob`);

    const gsAfter = await getGS(roomId);
    assert(gsAfter.players[1].disconnected === true, `Bob doit être marqué disconnected`);

    // Tour d'Alice → endTurn → le prochain doit être Charlie (index 2), pas Bob (index 1)
    await setCurrentPlayer(0);
    const aliceUpdate = waitFor(sA, 'game_updated');
    sA.emit('end_turn', { roomId, playerId: aliceId });
    await aliceUpdate;

    const gsEndTurn = await getGS(roomId);
    eq(gsEndTurn.currentPlayerIndex, 2, `Charlie (idx 2) doit être le prochain, pas Bob`);
  });

  // ── T17 : Reconnexion Bob → gameState restauré ───────────────────────────
  await test('T17 — Bob se reconnecte → gameState restauré, player_reconnected reçu', async () => {
    sB = connect();
    await waitFor(sB, 'connect');

    const aliceReco   = waitFor(sA, 'player_reconnected');
    const charlieReco = waitFor(sC, 'player_reconnected');
    const bobGS       = waitFor(sB, 'game_updated');

    await joinRoom(sB, roomId, bobId);

    const [an, cn, bobUpdate] = await Promise.all([aliceReco, charlieReco, bobGS]);

    eq(an.playerId, bobId, `player_reconnected(Alice).playerId = Bob`);
    eq(cn.playerId, bobId, `player_reconnected(Charlie).playerId = Bob`);
    assert(bobUpdate.gameState?.players?.length === 3, `Bob reçoit un gameState complet`);

    const gsAfter = await getGS(roomId);
    assert(gsAfter.players[1].disconnected === false, `Bob.disconnected doit être false`);
  });

  // ── Nettoyage ─────────────────────────────────────────────────────────────
  sA.disconnect();
  sB.disconnect();
  sC.disconnect();
  await cleanup(roomId);

  // ── Résumé ────────────────────────────────────────────────────────────────
  console.log(`\n─────────────────────────────────────────────────────────────────`);
  console.log(`  17 tests  —  ${passed} ✅  ${failed} ❌`);
  console.log(`─────────────────────────────────────────────────────────────────\n`);

  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error('\nErreur fatale :', err.message);
  process.exit(1);
});
