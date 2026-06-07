'use strict';

const engine   = require('../lib/game-engine');
const { initGameState } = require('../lib/game-init');

// ── Mini test runner ──────────────────────────────────────────────────────────

let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
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

// ── Helpers ───────────────────────────────────────────────────────────────────

// Crée un gameState minimaliste avec N joueurs fictifs sur un plateau 40
function makeState(n = 2, cash = 2500) {
  const players = Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `Joueur ${i + 1}`, color: '#ccc' }));
  const gs = initGameState(players);
  gs.players.forEach(p => { p.cash = cash; });
  return gs;
}

// Force un lancer de dé à une valeur précise via injection de Math.random
function withDie(value, diceMax, fn) {
  const orig = Math.random;
  Math.random = () => (value - 1) / diceMax; // floor((rand * max)) + 1 == value
  try { return fn(); } finally { Math.random = orig; }
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Phase 3 — Tests moteur de jeu ────────────────────────────────\n');
// ─────────────────────────────────────────────────────────────────────────────

// ── TEST 1 : rollDice — passedGo + cash +300 ─────────────────────────────────
test('rollDice → passedGo=true quand on dépasse la case 0, cash +300€', () => {
  const gs = makeState();
  const p1 = gs.players[0];
  p1.position = 37;       // 3 cases de la fin du plateau 40
  const cashBefore = p1.cash;

  // Force un dé à 6 (dépasse le plateau : 37+6=43 → position 3, passedGo)
  const result = withDie(6, gs.diceMax, () => engine.rollDice(gs, 'p1'));

  assert(result.passedGo === true, `passedGo devrait être true (position 37, dé 6)`);
  assert(result.newPosition < 37,  `La nouvelle position doit être < 37 (wrap)`);

  const delta = p1.cash - cashBefore;
  assert(delta >= engine.ECONOMY.passGo, `Cash devrait augmenter d'au moins ${engine.ECONOMY.passGo}€ (reçu +${delta}€)`);
});

// ── TEST 2 : processLanding — case propriété libre ────────────────────────────
test("processLanding sur prop libre → action 'buy_available'", () => {
  const gs = makeState();
  const sq = gs.board.find(s => s.type === 'prop');
  assert(sq, 'Le plateau doit avoir au moins une propriété');

  gs.players[0].position = sq.idx;
  const { action } = engine.processLanding(gs, 'p1');
  eq(action, 'buy_available', `action devrait être 'buy_available', reçu '${action}'`);
});

// ── TEST 3 : processLanding — prop possédée → loyer débité ───────────────────
test('processLanding sur prop possédée → loyer débité des deux côtés', () => {
  const gs = makeState();
  const sq = gs.board.find(s => s.type === 'prop');
  sq.ownerId = 'p1';

  const cashP1Before = gs.players[0].cash;
  const cashP2Before = gs.players[1].cash;

  gs.players[1].position = sq.idx;
  const { action } = engine.processLanding(gs, 'p2');

  eq(action, 'pay_rent', `action devrait être 'pay_rent', reçu '${action}'`);

  const p1 = gs.players[0];
  const p2 = gs.players[1];
  const rent = cashP2Before - p2.cash;
  assert(rent > 0,                      `p2 devrait avoir payé du loyer (payé ${rent}€)`);
  eq(p1.cash, cashP1Before + rent,       `p1 devrait avoir reçu exactement le loyer (${rent}€)`);
});

// ── TEST 4 : build — construction studio sans prérequis groupe ────────────────
test('build → studio sur propriété possédée (pas besoin de monopole)', () => {
  const gs = makeState();
  const sq = gs.board.find(s => s.type === 'prop');
  sq.ownerId = 'p1';

  const cost = Math.floor(sq.price * engine.ECONOMY.buildCosts.studio);
  const cashBefore = gs.players[0].cash;

  const result = engine.build(gs, 'p1', sq.id, 'studio');
  assert(result.success, `build devrait réussir : ${result.error}`);

  const updatedSq = engine.getSquare(gs, sq.id);
  eq(updatedSq.building, 'studio', `Le bâtiment devrait être 'studio', reçu '${updatedSq.building}'`);
  eq(gs.players[0].cash, cashBefore - cost, `Cash devrait diminuer de ${cost}€`);
});

// ── TEST 5 : forceTrade — transfert, 3× prix, immunité 2 tours ───────────────
test('forceTrade → transfert propriété, 3× prix débité, immunité 2 tours posée', () => {
  const gs = makeState(2, 10000);
  const sq = gs.board.find(s => s.type === 'prop');
  sq.ownerId = 'p2';   // p2 possède la propriété

  const cost = sq.price * 3;
  const p1CashBefore = gs.players[0].cash;
  const p2CashBefore = gs.players[1].cash;

  const result = engine.forceTrade(gs, 'p1', sq.id);
  assert(result.success, `forceTrade devrait réussir : ${result.error}`);

  const updatedSq = engine.getSquare(gs, sq.id);
  eq(updatedSq.ownerId, 'p1',                `La propriété doit appartenir à p1`);
  eq(gs.players[0].cash, p1CashBefore - cost, `p1 doit avoir payé 3× le prix (${cost}€)`);
  eq(gs.players[1].cash, p2CashBefore + cost, `p2 doit avoir reçu 3× le prix (${cost}€)`);

  const p2Immunity = gs.players[1].immunities[sq.id];
  eq(p2Immunity, 2, `p2 doit avoir 2 tours d'immunité sur cette case`);
});

// ── TEST 6 : acceptAlliance — immunité mutuelle, loyer = 0 ───────────────────
test('acceptAlliance → immunité mutuelle active, loyer = 0 entre alliés', () => {
  const gs = makeState();
  const sq = gs.board.find(s => s.type === 'prop');
  sq.ownerId = 'p1';

  // Former une alliance
  const { allianceId } = engine.proposeAlliance(gs, 'p1', 'p2');
  const { success, error } = engine.acceptAlliance(gs, allianceId);
  assert(success, `acceptAlliance devrait réussir : ${error}`);
  assert(engine.isAllied(gs, 'p1', 'p2'), 'p1 et p2 devraient être alliés');

  // p2 atterrit sur la propriété de p1
  gs.players[1].position = sq.idx;
  const cashP1Before = gs.players[0].cash;
  const cashP2Before = gs.players[1].cash;

  const { action } = engine.processLanding(gs, 'p2');
  eq(action, 'nothing', `L'allié ne doit pas payer de loyer (action='${action}')`);
  eq(gs.players[1].cash, cashP2Before, 'Le cash de p2 ne doit pas changer');
  eq(gs.players[0].cash, cashP1Before, 'Le cash de p1 ne doit pas changer');
});

// ── TEST 7 : breakAlliance — revealedAlliance avec les bons champs ────────────
test('breakAlliance → revealedAlliance avec formedTurn, brokenTurn, initiator', () => {
  const gs = makeState();
  gs.turn = 5;

  const { allianceId } = engine.proposeAlliance(gs, 'p1', 'p2');
  engine.acceptAlliance(gs, allianceId);
  assert(engine.isAllied(gs, 'p1', 'p2'), 'Alliance doit être active avant la rupture');

  gs.turn = 8;
  const { revealedAlliance } = engine.breakAlliance(gs, 'p1');

  assert(revealedAlliance !== null, 'revealedAlliance ne doit pas être null');
  assert(
    (revealedAlliance.p1 === 'p1' && revealedAlliance.p2 === 'p2') ||
    (revealedAlliance.p1 === 'p2' && revealedAlliance.p2 === 'p1'),
    'Les deux joueurs doivent figurer dans revealedAlliance'
  );
  eq(revealedAlliance.formedTurn, 5,    `formedTurn devrait être 5, reçu ${revealedAlliance.formedTurn}`);
  eq(revealedAlliance.brokenTurn, 8,    `brokenTurn devrait être 8, reçu ${revealedAlliance.brokenTurn}`);
  eq(revealedAlliance.initiator,  'p1', `initiator devrait être 'p1', reçu '${revealedAlliance.initiator}'`);
  assert(!engine.isAllied(gs, 'p1', 'p2'), 'L\'alliance ne doit plus être active');
});

// ── TEST 8 : checkVictory — null avant tour 15, gagnant après ────────────────
test('checkVictory → null avant tour 15, winner après (dominance 4×)', () => {
  const gs = makeState(2, 2500);

  // Avant le tour minimum
  gs.turn = 10;
  const r1 = engine.checkVictory(gs);
  eq(r1.winner, null, `Pas de gagnant avant le tour ${engine.ECONOMY.dominanceMinTurn} (tour=${gs.turn})`);

  // Après le tour minimum, p1 écrase p2 en valeur nette
  gs.turn = 16;
  gs.players[0].cash = 80000; // net worth ≈ 80 000
  gs.players[1].cash = 500;   // net worth ≈ 500 → 4× avg = 4×500 = 2000

  const r2 = engine.checkVictory(gs);
  eq(r2.winner, 'p1',      `Le gagnant devrait être 'p1', reçu '${r2.winner}'`);
  eq(r2.reason, 'dominance', `La raison devrait être 'dominance', reçu '${r2.reason}'`);
});

// ── Résumé ────────────────────────────────────────────────────────────────────

console.log(`\n─────────────────────────────────────────────────────────────────`);
console.log(`  ${passed + failed} tests  —  ${passed} ✅  ${failed} ❌`);
console.log(`─────────────────────────────────────────────────────────────────\n`);

if (failed > 0) process.exit(1);
