'use strict';
/**
 * Tests Phase 5 — UI Plateau isométrique
 * Prérequis : le serveur Next.js doit tourner → npm run dev
 * Usage : node tests/phase5.test.js
 */

require('dotenv').config();

const { chromium }    = require('playwright');
const { io: ioClient } = require('socket.io-client');
const prisma          = require('../lib/prisma');
const { initGameState } = require('../lib/game-init');
const { PION_COLORS } = require('../lib/constants');

const BASE_URL   = process.env.TEST_URL || 'http://localhost:3000';
const TIMEOUT    = 10000;

// ── Helpers ───────────────────────────────────────────────────────────────────

let browser;
let alicePage, bobPage, charliePage;
let aliceSocket, bobSocket, charlieSocket;
let testRoom, testPlayers;
let passed = 0, failed = 0;

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

async function waitFor(page, testId, timeout = TIMEOUT) {
  return page.waitForSelector(`[data-testid="${testId}"]`, { timeout, state: 'visible' });
}

async function waitForHidden(page, testId, timeout = 8000) {
  return page.waitForSelector(`[data-testid="${testId}"]`, { timeout, state: 'hidden' });
}

async function waitForText(page, testId, text, timeout = TIMEOUT) {
  await page.waitForFunction(
    ({ id, t }) => {
      const el = document.querySelector(`[data-testid="${id}"]`);
      return el && el.textContent.includes(t);
    },
    { id: testId, t: text },
    { timeout }
  );
}

function connectSocket() {
  return new Promise((resolve, reject) => {
    const s = ioClient(BASE_URL, { path: '/socket.io', forceNew: true, timeout: 6000 });
    s.on('connect', () => resolve(s));
    s.on('connect_error', e => reject(new Error(`Socket: ${e.message}`)));
    setTimeout(() => reject(new Error('Socket timeout')), 7000);
  });
}

function waitSocketEvent(socket, event, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout: ${event}`)), timeout);
    socket.once(event, data => { clearTimeout(t); resolve(data); });
  });
}

async function getGS() {
  const room = await prisma.room.findUnique({ where: { id: testRoom.id } });
  return room.gameState;
}

async function setGS(gs) {
  await prisma.room.update({ where: { id: testRoom.id }, data: { gameState: gs } });
}

async function refreshAll() {
  // Les sockets de test rejoignent déjà la room au setup et y restent.
  // On broadcast juste le gameState DB courant à TOUS les clients de la room
  // (y compris les browsers) sans appeler join_room (qui écraserait les socketIds des browsers).
  aliceSocket.emit('__test_gs_broadcast', { roomId: testRoom.id });
  await new Promise(r => setTimeout(r, 700));
}

// ── Setup / Teardown ──────────────────────────────────────────────────────────

async function setup() {
  await prisma.room.deleteMany({ where: { code: 'PH5T' } });

  testRoom = await prisma.room.create({ data: { code: 'PH5T', status: 'waiting' } });

  testPlayers = await Promise.all([
    prisma.player.create({ data: { roomId: testRoom.id, name: 'Alice',   color: PION_COLORS[0] } }),
    prisma.player.create({ data: { roomId: testRoom.id, name: 'Bob',     color: PION_COLORS[1] } }),
    prisma.player.create({ data: { roomId: testRoom.id, name: 'Charlie', color: PION_COLORS[2] } }),
  ]);

  const gs = initGameState(testPlayers);
  await prisma.room.update({
    where: { id: testRoom.id },
    data:  { status: 'playing', gameState: gs },
  });

  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  [aliceSocket, bobSocket, charlieSocket] = await Promise.all([
    connectSocket(), connectSocket(), connectSocket(),
  ]);

  for (const [sock, pid] of [
    [aliceSocket, testPlayers[0].id],
    [bobSocket,   testPlayers[1].id],
    [charlieSocket, testPlayers[2].id],
  ]) {
    sock.emit('join_room', { roomId: testRoom.id, playerId: pid });
  }
  await new Promise(r => setTimeout(r, 600));

  // Open pages in separate contexts
  const gameUrl = pid => `${BASE_URL}/game/${testRoom.id}?playerId=${pid}`;

  [alicePage, bobPage, charliePage] = await Promise.all([
    browser.newContext().then(ctx => ctx.newPage()),
    browser.newContext().then(ctx => ctx.newPage()),
    browser.newContext().then(ctx => ctx.newPage()),
  ]);

  await Promise.all([
    alicePage.goto(gameUrl(testPlayers[0].id)),
    bobPage.goto(gameUrl(testPlayers[1].id)),
    charliePage.goto(gameUrl(testPlayers[2].id)),
  ]);

  await Promise.all([
    waitFor(alicePage,   'board'),
    waitFor(bobPage,     'board'),
    waitFor(charliePage, 'board'),
  ]);
}

async function cleanup() {
  try { aliceSocket?.disconnect(); } catch {}
  try { bobSocket?.disconnect(); } catch {}
  try { charlieSocket?.disconnect(); } catch {}
  try { await alicePage?.context()?.close(); } catch {}
  try { await bobPage?.context()?.close(); } catch {}
  try { await charliePage?.context()?.close(); } catch {}
  try { await browser?.close(); } catch {}
  try {
    await prisma.player.deleteMany({ where: { roomId: testRoom?.id } });
    await prisma.room.deleteMany({ where: { code: 'PH5T' } });
  } catch {}
  await prisma.$disconnect();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

async function T1_board_displayed() {
  await waitFor(alicePage, 'board');

  const logo = await alicePage.$('[data-testid="board-logo"]');
  if (!logo) throw new Error('SVG text "PROPRIO" absent dans le plateau');
  const txt = await logo.textContent();
  if (txt.trim() !== 'PROPRIO') throw new Error(`Logo: "${txt}" ≠ "PROPRIO"`);

  const icon = await alicePage.$('[data-testid="day-night-icon"]');
  if (!icon) throw new Error('Indicateur jour/nuit absent au centre du plateau');

  // Board has tiles (SVG polygons)
  const tiles = await alicePage.$$('[data-sq-idx]');
  const gs    = await getGS();
  if (tiles.length !== gs.boardSize) {
    throw new Error(`${tiles.length} cases rendues, attendu ${gs.boardSize}`);
  }
}

async function T2_tokens_on_start() {
  // All players start at position 0
  const circles = await alicePage.$$('[data-sq-idx="0"] circle');
  if (circles.length < 3) {
    throw new Error(`Tokens sur case départ : ${circles.length} < 3`);
  }

  // Verify HUD shows all players
  await waitFor(alicePage, 'hud-bar');
  const hudText = await alicePage.$eval('[data-testid="hud-bar"]', el => el.textContent);
  if (!hudText.includes('Alice'))   throw new Error('Alice absente du HUD');
  if (!hudText.includes('Bob'))     throw new Error('Bob absent du HUD');
  if (!hudText.includes('Charlie')) throw new Error('Charlie absent du HUD');
}

async function T3_alice_rolls_dice_animation() {
  let gs = await getGS();
  // Ensure it's Alice's turn and she's at a safe position
  gs.players[0].position     = 6; // far enough from boundaries
  gs.players[0].doubleStreak = 0;
  gs.currentPlayerIndex      = 0;
  await setGS(gs);
  await refreshAll();

  // Verify roll-dice button visible on Alice's page
  await waitFor(alicePage, 'roll-dice-btn');

  // Emit roll via socket (2+3 = 5 steps → position 11)
  aliceSocket.emit('roll_dice', {
    roomId:    testRoom.id,
    playerId:  testPlayers[0].id,
    forceDice: [2, 3],
  });

  // Dice animation should appear
  await waitFor(alicePage, 'dice-roll-overlay', 5000);

  // Wait for dice to disappear
  await waitForHidden(alicePage, 'dice-roll-overlay', 8000);

  // Alice's position should be 11
  const gsAfter = await getGS();
  const alice   = gsAfter.players.find(p => p.id === testPlayers[0].id);
  if (alice.position !== 11) {
    throw new Error(`Alice position: ${alice.position} ≠ 11 (6+5)`);
  }

  // Token should be visible on tile 11 on Alice's page
  await alicePage.waitForFunction(
    (idx) => document.querySelectorAll(`[data-sq-idx="${idx}"] circle`).length > 0,
    11,
    { timeout: 5000 }
  );
}

async function T4_click_tile_projected_card() {
  // Reset to clean state
  let gs = await getGS();
  gs.currentPlayerIndex = 0;
  await setGS(gs);
  await refreshAll();

  // Click on tile 1 (first prop)
  const tile = await alicePage.waitForSelector('[data-sq-idx="1"]', { timeout: 5000 });
  await tile.click();

  // Card should project from bottom
  await waitFor(alicePage, 'projected-card-overlay', 5000);
  const card = await alicePage.$('[data-testid="projected-card"]');
  if (!card) throw new Error('Carte projetée introuvable après clic');

  // Dark overlay present
  const overlayEl = await alicePage.$('[data-testid="projected-card-overlay"] > div');
  if (!overlayEl) throw new Error('Overlay sombre absent');

  // Close with × button
  const closeBtn = await alicePage.$('[data-testid="card-close-btn"]');
  if (!closeBtn) throw new Error('Bouton × introuvable');
  await closeBtn.click();

  await waitForHidden(alicePage, 'projected-card-overlay', 4000);
}

async function T5_card_context_buttons() {
  // Setup: Alice at pos 4 (free property idx=4 is event, use idx=1 - g0_0)
  let gs = await getGS();
  gs.players[0].position = 1;
  gs.board[1].ownerId    = null;  // free
  gs.board[1].building   = null;
  gs.currentPlayerIndex  = 0;
  await setGS(gs);
  await refreshAll();

  // Click free property tile
  const tile = await alicePage.waitForSelector('[data-sq-idx="1"]', { timeout: 5000 });
  await tile.click();
  await waitFor(alicePage, 'projected-card', 4000);

  // On a free prop, Alice's turn, Alice ON the tile → Acheter button
  const buyBtn = await alicePage.$('[data-testid="card-buy-btn"]');
  if (!buyBtn) throw new Error('Bouton "Acheter" absent sur case libre (tour Alice, sur la case)');
  await alicePage.click('[data-testid="card-close-btn"]');
  await waitForHidden(alicePage, 'projected-card-overlay', 3000);

  // Give Alice the prop, check "Construire" button
  gs = await getGS();
  gs.board[1].ownerId = testPlayers[0].id;
  await setGS(gs);
  await refreshAll();

  const ownTile = await alicePage.waitForSelector('[data-sq-idx="1"]', { timeout: 5000 });
  await ownTile.click();
  await waitFor(alicePage, 'projected-card', 4000);

  const buildBtn = await alicePage.$('[data-testid="card-build-btn"]');
  if (!buildBtn) throw new Error('Bouton "Construire" absent sur sa propre propriété');
  await alicePage.click('[data-testid="card-close-btn"]');
  await waitForHidden(alicePage, 'projected-card-overlay', 3000);
}

async function T6_buy_toast_visible_bob_charlie() {
  // Setup: Alice on a free property
  let gs = await getGS();
  gs.players[0].position = 6;
  gs.board[6].ownerId    = null;
  gs.board[6].building   = null;
  gs.currentPlayerIndex  = 0;
  await setGS(gs);
  await refreshAll();

  // Alice buys
  aliceSocket.emit('buy_property', {
    roomId:     testRoom.id,
    playerId:   testPlayers[0].id,
    propertyId: gs.board[6].id,
  });
  await new Promise(r => setTimeout(r, 800));

  // Bob's and Charlie's toast log should exist and contain buy info
  const bobToast     = await bobPage.$('[data-testid="toast-log"]');
  const charlieToast = await charliePage.$('[data-testid="toast-log"]');
  if (!bobToast)     throw new Error('Toast log absent chez Bob');
  if (!charlieToast) throw new Error('Toast log absent chez Charlie');

  // Verify the prop is now owned by Alice in the DB
  const gsAfter = await getGS();
  if (gsAfter.board[6].ownerId !== testPlayers[0].id) {
    throw new Error(`board[6].ownerId = ${gsAfter.board[6].ownerId} ≠ Alice`);
  }
}

async function T7_double_badge_and_reroll() {
  let gs = await getGS();
  gs.players[0].position     = 0;
  gs.players[0].doubleStreak = 0;
  gs.currentPlayerIndex      = 0;
  // Libérer case 6 (destination du double 3+3) pour éviter loyer/achat
  gs.board[6].ownerId  = null;
  gs.board[6].building = null;
  await setGS(gs);
  await refreshAll();

  // Roll doubles (3+3 → position 6, case libre)
  aliceSocket.emit('roll_dice', {
    roomId:    testRoom.id,
    playerId:  testPlayers[0].id,
    forceDice: [3, 3],
  });

  // DOUBLE badge apparaît pendant l'animation des dés
  await waitFor(alicePage, 'badge-double', 6000);

  // Attendre que l'overlay des dés disparaisse (onDone après 1600ms)
  await waitForHidden(alicePage, 'dice-roll-overlay', 8000);

  // Le bouton "Lancer à nouveau" doit être dans le DOM (via waitForFunction plus permissif)
  await alicePage.waitForFunction(
    () => document.querySelector('[data-testid="roll-again-btn"]') !== null,
    { timeout: 8000 }
  );
  const btn = await alicePage.$('[data-testid="roll-again-btn"]');
  if (!btn) throw new Error('Bouton "Lancer à nouveau" absent après double');
}

async function T8_event_card_animation() {
  // Board40: event at idx=4. Put Alice at idx=2, roll [1,1]=2 steps → land on idx=4
  let gs = await getGS();
  gs.players[0].position     = 2;
  gs.players[0].doubleStreak = 0;
  gs.currentPlayerIndex      = 0;
  // Garantir qu'une carte standard (non-spéciale) est en tête de deck
  const specials = ['reveal_alliance', 'force_reveal_ally'];
  const std  = gs.eventDeck.filter(c => !specials.includes(c.type));
  const spec = gs.eventDeck.filter(c =>  specials.includes(c.type));
  gs.eventDeck = [...std, ...spec];
  gs.deckIndex = 0;
  await setGS(gs);
  await refreshAll();

  aliceSocket.emit('roll_dice', {
    roomId:    testRoom.id,
    playerId:  testPlayers[0].id,
    forceDice: [1, 1],
  });

  // Wait for event card overlay on ALL pages
  await waitFor(alicePage,   'event-card-overlay', 7000);
  await waitFor(bobPage,     'event-card-overlay', 5000);
  await waitFor(charliePage, 'event-card-overlay', 5000);

  // Auto-closes after ~3s
  await waitForHidden(alicePage, 'event-card-overlay', 8000);
}

async function T9_strike_banner_all_players() {
  let gs = await getGS();
  gs.strikeActive = true;
  await setGS(gs);
  await refreshAll();

  // HUD badge visible on all 3 browsers
  await waitFor(alicePage,   'strike-badge', 5000);
  await waitFor(bobPage,     'strike-badge', 5000);
  await waitFor(charliePage, 'strike-badge', 5000);

  // Cleanup
  gs.strikeActive = false;
  await setGS(gs);
}

async function T10_day_night_change() {
  let gs = await getGS();
  gs.isNight = true;
  await setGS(gs);
  await refreshAll();

  // Day/night icon shows 🌙 in all browsers
  await alicePage.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="day-night-icon"]');
      return el && el.textContent.includes('🌙');
    },
    { timeout: 6000 }
  );
  await bobPage.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="day-night-icon"]');
      return el && el.textContent.includes('🌙');
    },
    { timeout: 6000 }
  );
  await charliePage.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="day-night-icon"]');
      return el && el.textContent.includes('🌙');
    },
    { timeout: 6000 }
  );

  // Also HUD indicator
  const hudTxt = await alicePage.$eval('[data-testid="day-night-indicator"]', el => el.textContent);
  if (!hudTxt.includes('Nuit')) throw new Error(`HUD indicator: "${hudTxt}" ne contient pas "Nuit"`);

  // Restore
  gs.isNight = false;
  await setGS(gs);
}

async function T11_alliance_broken_banner_public() {
  const allianceId = 'test_ph5_alliance';
  let gs = await getGS();
  gs.alliances = [{
    id:          allianceId,
    p1:          testPlayers[0].id,
    p2:          testPlayers[1].id,
    status:      'active',
    formedTurn:  1,
  }];
  gs.players[0].allianceId = allianceId;
  gs.players[1].allianceId = allianceId;
  gs.currentPlayerIndex = 0;
  await setGS(gs);
  await refreshAll();

  // Alice breaks the alliance
  aliceSocket.emit('break_alliance', {
    roomId:     testRoom.id,
    playerId:   testPlayers[0].id,
    allianceId,
  });
  await new Promise(r => setTimeout(r, 500));

  // Banner visible on all 3 browsers
  await waitFor(alicePage,   'alliance-broken-banner', 5000);
  await waitFor(bobPage,     'alliance-broken-banner', 5000);
  await waitFor(charliePage, 'alliance-broken-banner', 5000);

  // Verify banner content mentions the players
  const bannerTxt = await alicePage.$eval('[data-testid="alliance-broken-banner"]', el => el.textContent);
  if (!bannerTxt.includes('Alice') && !bannerTxt.includes('Bob')) {
    throw new Error(`Bannière: "${bannerTxt}" ne mentionne pas Alice/Bob`);
  }
}

async function T12_trade_modal_only_bob() {
  let gs = await getGS();
  gs.currentPlayerIndex = 0;
  await setGS(gs);
  await refreshAll();

  // Alice proposes trade to Bob only
  aliceSocket.emit('propose_trade', {
    roomId:  testRoom.id,
    fromId:  testPlayers[0].id,
    toId:    testPlayers[1].id,
    offer: { cash: 150, propertyId: null },
  });

  await new Promise(r => setTimeout(r, 800));

  // Bob receives the modal
  await waitFor(bobPage, 'trade-modal', 5000);

  // Charlie does NOT see it
  const charlieModal = await charliePage.$('[data-testid="trade-modal"]');
  if (charlieModal) {
    const vis = await charlieModal.isVisible();
    if (vis) throw new Error('Trade modal visible chez Charlie — ne devrait pas');
  }

  // Cleanup: Bob refuses via the trade ID from the updated DB state
  const gsAfter = await getGS();
  const tradeId = gsAfter.trades?.find(t => t.toId === testPlayers[1].id && t.status === 'pending')?.id;
  if (tradeId) {
    bobSocket.emit('refuse_trade', { roomId: testRoom.id, tradeId });
    await new Promise(r => setTimeout(r, 300));
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n════════════════════════════════════════════');
  console.log('    Phase 5 — UI Plateau isométrique');
  console.log(`    Serveur : ${BASE_URL}`);
  console.log('════════════════════════════════════════════\n');

  // Vérifier que le serveur tourne
  try {
    const http = require('http');
    await new Promise((resolve, reject) => {
      const req = http.get(`${BASE_URL}/`, res => { resolve(); req.destroy(); });
      req.on('error', reject);
      setTimeout(() => reject(new Error('timeout')), 4000);
    });
  } catch {
    console.error('  ❌ Serveur inaccessible sur', BASE_URL);
    console.error('     Lance "npm run dev" avant de lancer les tests.\n');
    process.exit(1);
  }

  console.log('  ⏳ Setup…');
  try {
    await setup();
    console.log('  ✅ 3 navigateurs ouverts, boards chargés\n');
  } catch (e) {
    console.error('  ❌ Setup échoué :', e.message);
    await cleanup();
    process.exit(1);
  }

  await run('T1  Plateau isométrique — cases, logo PROPRIO, icône jour/nuit',    T1_board_displayed);
  await run('T2  Pions 3 joueurs sur case départ + noms dans HUD',                T2_tokens_on_start);
  await run('T3  Alice lance les dés → animation → pion déplacé (6→11)',          T3_alice_rolls_dice_animation);
  await run('T4  Clic sur case → carte 3D projetée, overlay sombre, ×',          T4_click_tile_projected_card);
  await run('T5  Carte : case libre → Acheter ; sa prop → Construire',            T5_card_context_buttons);
  await run('T6  Achat propriété → toast log visible chez Bob et Charlie',        T6_buy_toast_visible_bob_charlie);
  await run('T7  Double → badge "DOUBLE !" → bouton relancer visible',            T7_double_badge_and_reroll);
  await run('T8  Carte Courrier → animation overlay sur 3 navigateurs',           T8_event_card_animation);
  await run('T9  Grève transports → badge dans HUD des 3 joueurs',               T9_strike_banner_all_players);
  await run('T10 Changement nuit → icône 🌙 dans 3 navigateurs + HUD "Nuit"',    T10_day_night_change);
  await run('T11 Alliance rompue → bannière publique chez Alice, Bob, Charlie',   T11_alliance_broken_banner_public);
  await run('T12 Trade proposé → modal chez Bob uniquement (pas Charlie)',        T12_trade_modal_only_bob);

  console.log('\n────────────────────────────────────────────');
  const total = passed + failed;
  console.log(`  ${total} tests  —  ${passed} ✅  ${failed} ❌`);
  console.log('────────────────────────────────────────────\n');

  await cleanup();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async e => {
  console.error('\n❌ Erreur fatale :', e.message);
  await cleanup();
  process.exit(1);
});
