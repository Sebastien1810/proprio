'use strict';
/**
 * Validation Correctif 1 — Fin de tour sans blocage
 * 2 joueurs, 10 tours complets en alternance (tests sockets + UI)
 * Usage : node tests/validate_fix1.js
 */

require('dotenv').config();

const { chromium }      = require('playwright');
const { io: ioClient }  = require('socket.io-client');
const prisma            = require('../lib/prisma');
const { initGameState } = require('../lib/game-init');
const { PION_COLORS }   = require('../lib/constants');

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

let passed = 0, failed = 0;

function connectSocket() {
  return new Promise((resolve, reject) => {
    const s = ioClient(BASE_URL, { path: '/socket.io', forceNew: true, timeout: 6000 });
    s.on('connect',       () => resolve(s));
    s.on('connect_error', e  => reject(new Error(`Socket: ${e.message}`)));
    setTimeout(() => reject(new Error('Socket connect timeout')), 7000);
  });
}

function waitEvent(socket, event, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout waiting for "${event}"`)), timeout);
    socket.once(event, data => { clearTimeout(t); resolve(data); });
  });
}

async function run(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ❌ ${name}`);
    console.error(`     ${e.message.split('\n')[0]}`);
    failed++;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function doTurn(socket, playerId, roomId, forceDice) {
  // Roll dice
  const diceP = waitEvent(socket, 'dice_rolled');
  socket.emit('roll_dice', { roomId, playerId, forceDice });
  const diceData = await diceP;

  if (diceData.sentToJail) {
    // Envoyé en prison : fin de tour immédiat
    const updP = waitEvent(socket, 'game_updated');
    socket.emit('end_turn', { roomId, playerId });
    await updP;
    return;
  }

  if (diceData.mustRollAgain) {
    // Double ! relancer une fois (forcer non-double cette fois)
    const dice2P = waitEvent(socket, 'dice_rolled');
    socket.emit('roll_dice', { roomId, playerId, forceDice: [1, 2] });
    await dice2P;
  }

  // S'il y a une propriété disponible, la refuser (→ enchères qui se terminent tout seules)
  await new Promise(r => setTimeout(r, 150));

  const updP = waitEvent(socket, 'game_updated');
  socket.emit('end_turn', { roomId, playerId });
  await updP;
}

// ── Test 1 : Socket uniquement — 10 tours en alternance ───────────────────────

async function test_socket_10_turns() {
  let room, players;

  // Setup DB
  await prisma.room.deleteMany({ where: { code: 'FIX1' } });
  room = await prisma.room.create({ data: { code: 'FIX1', status: 'waiting' } });
  players = await Promise.all([
    prisma.player.create({ data: { roomId: room.id, name: 'Alice', color: PION_COLORS[0] } }),
    prisma.player.create({ data: { roomId: room.id, name: 'Bob',   color: PION_COLORS[1] } }),
  ]);
  const gs = initGameState(players);
  await prisma.room.update({ where: { id: room.id }, data: { status: 'playing', gameState: gs } });

  const sA = await connectSocket();
  const sB = await connectSocket();

  try {
    sA.emit('join_room', { roomId: room.id, playerId: players[0].id });
    sB.emit('join_room', { roomId: room.id, playerId: players[1].id });
    await new Promise(r => setTimeout(r, 400));

    for (let turn = 0; turn < 10; turn++) {
      const expectedPlayer = players[turn % 2];
      const sock           = turn % 2 === 0 ? sA : sB;

      // Vérifier que le gameState en DB correspond au bon joueur
      const dbRoom = await prisma.room.findUnique({ where: { id: room.id } });
      const currentId = dbRoom.gameState.players[dbRoom.gameState.currentPlayerIndex].id;
      if (currentId !== expectedPlayer.id) {
        throw new Error(
          `Tour ${turn + 1}: attendu ${expectedPlayer.name} (${expectedPlayer.id}) ` +
          `mais currentPlayer = ${currentId}`
        );
      }

      // Effectuer le tour (forcer dés [2,3] = non-double, case neutre probable)
      await doTurn(sock, expectedPlayer.id, room.id, [2, 3]);
    }

    // Vérifier que le tour final est bien retourné au bon joueur (tour 11 = Alice de nouveau)
    const dbRoom = await prisma.room.findUnique({ where: { id: room.id } });
    const finalIdx = dbRoom.gameState.currentPlayerIndex;
    if (finalIdx !== 0) {
      throw new Error(`Après 10 tours (pair), attendu index=0 (Alice), obtenu=${finalIdx}`);
    }

  } finally {
    sA.disconnect();
    sB.disconnect();
    await prisma.player.deleteMany({ where: { roomId: room.id } });
    await prisma.room.delete({ where: { id: room.id } });
  }
}

// ── Test 2 : UI — le bouton "Lancer les dés" réapparaît chez le joueur suivant ─

async function test_ui_roll_button_reappears() {
  let room, players, browser, ctxA, ctxB, pageA, pageB;
  const sA = await connectSocket();
  const sB = await connectSocket();

  try {
    // Setup DB
    await prisma.room.deleteMany({ where: { code: 'FIX2' } });
    room = await prisma.room.create({ data: { code: 'FIX2', status: 'waiting' } });
    players = await Promise.all([
      prisma.player.create({ data: { roomId: room.id, name: 'Alice', color: PION_COLORS[0] } }),
      prisma.player.create({ data: { roomId: room.id, name: 'Bob',   color: PION_COLORS[1] } }),
    ]);
    const gs = initGameState(players);
    await prisma.room.update({ where: { id: room.id }, data: { status: 'playing', gameState: gs } });

    // Test sockets join (pour la room)
    sA.emit('join_room', { roomId: room.id, playerId: players[0].id });
    sB.emit('join_room', { roomId: room.id, playerId: players[1].id });
    await new Promise(r => setTimeout(r, 300));

    // Ouvrir les browsers
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    ctxA = await browser.newContext();
    ctxB = await browser.newContext();
    pageA = await ctxA.newPage();
    pageB = await ctxB.newPage();

    const url = pid => `${BASE_URL}/game/${room.id}?playerId=${pid}`;
    await Promise.all([
      pageA.goto(url(players[0].id)),
      pageB.goto(url(players[1].id)),
    ]);

    // Attendre que les boards soient affichés
    await Promise.all([
      pageA.waitForSelector('[data-testid="board"]',     { timeout: 15000 }),
      pageB.waitForSelector('[data-testid="board"]',     { timeout: 15000 }),
    ]);
    // Attendre que les browsers overwrite les socketIds
    await new Promise(r => setTimeout(r, 800));

    // Étape 1 : Bouton "Lancer les dés" visible chez Alice (tour 1)
    await pageA.waitForSelector('[data-testid="roll-dice-btn"]', { timeout: 8000 });

    // Alice roule les dés via socket (forcé [1,2] = non-double)
    sA.emit('roll_dice', { roomId: room.id, playerId: players[0].id, forceDice: [1, 2] });
    await new Promise(r => setTimeout(r, 1000));

    // Alice termine son tour
    sA.emit('end_turn', { roomId: room.id, playerId: players[0].id });
    await new Promise(r => setTimeout(r, 800));

    // Étape 2 : Bouton "Lancer les dés" doit apparaître chez Bob (tour 2)
    await pageB.waitForSelector('[data-testid="roll-dice-btn"]', { timeout: 8000,
      state: 'visible' });

    // Et Alice ne doit plus voir le bouton (c'est le tour de Bob)
    const aliceRollBtn = await pageA.$('[data-testid="roll-dice-btn"]');
    if (aliceRollBtn) {
      const vis = await aliceRollBtn.isVisible();
      if (vis) throw new Error('Bouton "Lancer les dés" toujours visible chez Alice alors que c\'est le tour de Bob');
    }

    // Bob roule ses dés et termine
    sB.emit('roll_dice', { roomId: room.id, playerId: players[1].id, forceDice: [1, 2] });
    await new Promise(r => setTimeout(r, 1000));
    sB.emit('end_turn', { roomId: room.id, playerId: players[1].id });
    await new Promise(r => setTimeout(r, 800));

    // Étape 3 : Le bouton réapparaît chez Alice (tour 3)
    await pageA.waitForSelector('[data-testid="roll-dice-btn"]', { timeout: 8000,
      state: 'visible' });

  } finally {
    sA.disconnect();
    sB.disconnect();
    try { await ctxA?.close(); } catch {}
    try { await ctxB?.close(); } catch {}
    try { await browser?.close(); } catch {}
    try { await prisma.player.deleteMany({ where: { roomId: room?.id } }); } catch {}
    try { await prisma.room.deleteMany({ where: { code: 'FIX2' } }); } catch {}
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n════════════════════════════════════════════');
  console.log('    Correctif 1 — Fin de tour sans blocage');
  console.log(`    Serveur : ${BASE_URL}`);
  console.log('════════════════════════════════════════════\n');

  await run('10 tours socket en alternance Alice/Bob sans blocage', test_socket_10_turns);
  await run('UI : bouton "Lancer les dés" réapparaît chez le joueur suivant', test_ui_roll_button_reappears);

  console.log('\n────────────────────────────────────────────');
  const total = passed + failed;
  console.log(`  ${total} tests  —  ${passed} ✅  ${failed} ❌`);
  console.log('────────────────────────────────────────────\n');

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error(e);
  prisma.$disconnect().then(() => process.exit(1));
});
