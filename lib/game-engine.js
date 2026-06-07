'use strict';

// ── Paramètres économiques ────────────────────────────────────────────────────

const ECONOMY = {
  startCash:       2500,
  passGo:          300,
  passGoBonus:     200,    // atterrissage EXACT sur le départ
  carPrice:        250,
  jailFine:        200,
  taxes:           [130, 160, 200, 250],

  rentRates: {
    bare:      { solo: 0.10, group: 0.18 },
    studio:    { solo: 0.16, group: 0.25 },
    appart:    { solo: 0.25, group: 0.35 },
    immeuble:  { solo: 0.40, group: 0.52 },
    nightclub: { day: 0, night_solo: 0.60, night_group: 0.75 },
  },

  buildCosts: {
    studio:    0.50,
    appart:    0.75,
    immeuble:  1.00,
    nightclub: 1.20,
  },

  groupBonusThreshold: 4,
  dominanceMultiplier: 4,
  dominanceMinTurn:   15,
  maxTurns:           50,
  strikeChance:       0.08,
  dayNightCycle:      4,
};

// ── Deck Courrier du Jour (30 cartes) ─────────────────────────────────────────

const EVENT_DECK = [
  { id:'redressement',    type:'cash',              amount:-130, label:'Redressement fiscal' },
  { id:'pv',              type:'cash',              amount:-135, label:'PV de stationnement' },
  { id:'chaudiere',       type:'cash',              amount:-250, label:'Panne de chaudière' },
  { id:'arnaque',         type:'cash',              amount:-150, label:'Arnaque sur petites annonces' },
  { id:'loyers_baisse',   type:'rent_modifier',     value:-0.10, duration:2, label:'Loyers en baisse' },
  { id:'travaux',         type:'per_building',      amount:-100, label:'Travaux de copropriété' },
  { id:'degat',           type:'cash',              amount:-200, label:'Dégât des eaux' },
  { id:'convocation',     type:'go_to_jail',        label:"Convocation à l'Agence" },
  { id:'greve_surprise',  type:'skip_turn',         label:'Grève surprise' },
  { id:'coloc_parti',     type:'lose_building',     label:'Votre coloc est parti sans prévenir' },
  { id:'litige',          type:'cash_from_richest', amount:200,  label:'Litige entre voisins' },
  { id:'voiture',         type:'car_breakdown',     label:'Votre voiture est en panne' },
  { id:'inspection',      type:'per_building',      amount:-80,  label:'Inspection sanitaire' },
  { id:'facture',         type:'cash',              amount:-180, label:'Facture impayée' },
  { id:'urssaf',          type:'cash_percent',      percent:0.08,label:'Contrôle URSSAF' },
  { id:'secu',            type:'cash',              amount:180,  label:'Remboursement sécu' },
  { id:'alloc',           type:'cash',              amount:120,  label:'Prime allocations' },
  { id:'vinted',          type:'cash',              amount:200,  label:'Vente sur appli de revente' },
  { id:'heritage_oncle',  type:'cash',              amount:300,  label:"Héritage d'un oncle de province" },
  { id:'heritage',        type:'cash_from_all',     amount:100,  label:'Héritage surprise' },
  { id:'airbnb',          type:'per_prop',          amount:50,   label:'Votre Airbnb cartonne' },
  { id:'proces',          type:'cash',              amount:400,  label:'Procès gagné contre votre ancien proprio' },
  { id:'pouce',           type:'cash',              amount:250,  label:'Coup de pouce familial' },
  { id:'subvention',      type:'half_next_build',   label:'Subvention mairie — prochaine construction -50%' },
  { id:'nightlife',       type:'half_next_nightclub',label:'Subvention nightlife — prochaine boîte -50%' },
  { id:'avance',          type:'collect_all_rents', label:'Vos locataires paient en avance' },
  { id:'boom',            type:'rent_modifier',     value:0.20, duration:1, label:'Boom immobilier' },
  { id:'coloc_paie',      type:'cash',              amount:150,  label:'Votre coloc paie ses charges' },
  { id:'airbnb2',         type:'per_prop',          amount:80,   label:'Votre Airbnb explose ce weekend' },
  { id:'indic',           type:'reveal_alliance',   label:'Indic — vous apprenez une alliance secrète' },
  { id:'rumeur',          type:'force_reveal_ally', label:"Rumeur — un joueur doit dire s'il est allié" },
];

// ── Helpers internes ──────────────────────────────────────────────────────────

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function getPlayer(gs, playerId) {
  return gs.players.find(p => p.id === playerId) || null;
}

function getSquare(gs, squareId) {
  return gs.board.find(s => s.id === squareId) || null;
}

function getSquareAt(gs, position) {
  return gs.board[position] || null;
}

function jailIndex(gs) {
  return gs.board.findIndex(s => s.type === 'jail');
}

function isOwnedBy(sq, playerId) {
  return sq.ownerId === playerId || sq.coOwners?.includes(playerId);
}

function isAllied(gs, id1, id2) {
  return gs.alliances.some(a =>
    a.status === 'active' &&
    ((a.p1 === id1 && a.p2 === id2) || (a.p1 === id2 && a.p2 === id1))
  );
}

function isBuyable(sq) {
  return sq && ['prop', 'transport', 'nightclub_spot'].includes(sq.type);
}

function getPlayerProps(gs, playerId) {
  return gs.board.filter(s => isBuyable(s) && isOwnedBy(s, playerId));
}

function hasGroupBonus(gs, propId) {
  const prop = getSquare(gs, propId);
  if (!prop || prop.group === undefined || !prop.ownerId) return false;
  const allInGroup = gs.board.filter(s => s.group === prop.group && isBuyable(s));
  const ownedInGroup = allInGroup.filter(s => isOwnedBy(s, prop.ownerId));
  return ownedInGroup.length >= Math.ceil(allInGroup.length * 2 / 3);
}

function deductCash(gs, playerId, amount) {
  const player = getPlayer(gs, playerId);
  if (!player) return;
  player.cash -= amount;
  if (player.cash < 0) {
    player.alive = false;
    player.cash = 0;
    gs.log.push({ type: 'bankrupt', playerId, turn: gs.turn });
  }
}

function addCash(gs, playerId, amount) {
  const player = getPlayer(gs, playerId);
  if (player) player.cash += amount;
}

// ── INITIALISATION ────────────────────────────────────────────────────────────

function shuffleDeck() {
  const deck = [...EVENT_DECK];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// ── CONSTRUCTION — niveaux et helpers ────────────────────────────────────────

const BUILD_ORDER  = ['studio', 'appart', 'immeuble'];
const BUILD_LEVELS = ['studio', 'appart', 'immeuble', 'nightclub'];

function getGroupSize(gs, group) {
  return gs.board.filter(s => s.group === group && isBuyable(s)).length;
}

function countOwnedInGroup(gs, playerId, group) {
  return gs.board.filter(s => s.group === group && isBuyable(s) && isOwnedBy(s, playerId)).length;
}

// Niveau max de construction selon la part du groupe possédée
// Groupes de 3   : 1→studio  2→appart  3→nightclub
// Groupes de 4   : 1→studio  2→appart  3-4→immeuble/nightclub
// Groupes de 5-6 : thresholds à 2/3 (cf spec)
function getMaxBuildingLevel(gs, playerId, propertyId) {
  const prop = getSquare(gs, propertyId);
  // Transports et cases sans group : construction libre jusqu'à studio
  if (!prop || prop.group === undefined) return 'studio';

  const groupSize = getGroupSize(gs, prop.group);
  const owned     = countOwnedInGroup(gs, playerId, prop.group);

  if (owned >= groupSize) return 'nightclub'; // monopole complet

  // Pour les groupes de 3 : le seuil majorité = groupSize (toutes les props)
  // Pour les groupes de 4+ : ceil(2/3 × groupSize)
  const majorityThreshold = groupSize <= 3
    ? groupSize
    : Math.ceil(groupSize * 2 / 3);

  if (owned >= majorityThreshold) return 'immeuble';
  if (owned >= 2)                 return 'appart';
  return 'studio';
}

// ── TOUR DE JEU ───────────────────────────────────────────────────────────────

// Deux dés, gestion des doubles (streak) et envoi en prison au 3ème double
// forcedDice : [d1, d2] optionnel (usage test uniquement)
function rollDice(gs, playerId, forcedDice) {
  const player = getPlayer(gs, playerId);
  if (!player) return { error: 'Joueur introuvable', gameState: gs };
  if (!player.alive) return { error: 'Joueur éliminé', gameState: gs };

  const die1 = forcedDice ? forcedDice[0] : Math.floor(Math.random() * gs.diceMax) + 1;
  const die2 = forcedDice ? forcedDice[1] : Math.floor(Math.random() * gs.diceMax) + 1;
  const steps    = die1 + die2;
  const isDouble = die1 === die2;
  const diceValues = [die1, die2];

  // ── Joueur en prison ───────────────────────────────────────────────────────
  let jailEscapeDouble = false;
  if (player.jailTurns > 0) {
    if (!isDouble) {
      // Pas de double → reste en prison un tour de moins
      player.jailTurns--;
      gs.log.push({ type: 'jail_wait', playerId, jailTurns: player.jailTurns, diceValues, turn: gs.turn });
      return {
        gameState: gs, diceValues, steps: 0,
        newPosition: player.position, passedGo: false,
        isDouble: false, mustRollAgain: false, sentToJail: false, jailWait: true,
      };
    }
    // Double → sortie de prison, streak ne démarre pas et le joueur ne relance pas
    player.jailTurns = 0;
    player.doubleStreak = 0;
    jailEscapeDouble = true;
    gs.log.push({ type: 'jail_escape_double', playerId, diceValues, turn: gs.turn });
  } else {
    // ── Suivi des doubles hors prison ─────────────────────────────────────
    if (isDouble) {
      player.doubleStreak = (player.doubleStreak || 0) + 1;
    } else {
      player.doubleStreak = 0;
    }

    // 3ème double consécutif → prison directe
    if (isDouble && player.doubleStreak >= 3) {
      player.doubleStreak = 0;
      player.position = jailIndex(gs);
      player.jailTurns = 2;
      gs.log.push({ type: 'jail_triple_double', playerId, diceValues, turn: gs.turn });
      return {
        gameState: gs, diceValues, steps,
        newPosition: player.position, passedGo: false,
        isDouble: true, mustRollAgain: false, sentToJail: true,
      };
    }
  }

  // ── Déplacement ───────────────────────────────────────────────────────────
  const oldPos    = player.position;
  const boardSize = gs.board.length;
  const rawNew    = oldPos + steps;
  const newPos    = rawNew % boardSize;

  const passedGo    = rawNew >= boardSize;
  const exactOnStart = rawNew === boardSize;

  if (passedGo) {
    const bonus = ECONOMY.passGo + (exactOnStart ? ECONOMY.passGoBonus : 0);
    addCash(gs, playerId, bonus);
    gs.log.push({ type: 'pass_go', playerId, amount: bonus, turn: gs.turn });
  }

  player.position = newPos;
  gs.log.push({ type: 'roll', playerId, diceValues, steps, oldPos, newPos, turn: gs.turn });

  return {
    gameState:    gs,
    diceValues,
    steps,
    newPosition:  newPos,
    passedGo,
    isDouble,
    mustRollAgain: isDouble && !jailEscapeDouble, // sortie de prison avec double → pas de relance
    sentToJail:   false,
  };
}

// Traite l'atterrissage sur la case courante du joueur
function processLanding(gs, playerId) {
  const player = getPlayer(gs, playerId);
  if (!player) return { error: 'Joueur introuvable', gameState: gs };

  const sq = getSquareAt(gs, player.position);
  if (!sq) return { error: 'Case invalide', gameState: gs };

  let action = 'nothing';

  switch (sq.type) {
    case 'start':
      break;

    case 'prop':
    case 'transport':
    case 'nightclub_spot': {
      if (!sq.ownerId) {
        action = 'buy_available';
      } else if (isOwnedBy(sq, playerId)) {
        action = 'nothing';
      } else if (sq.mortgaged) {
        action = 'nothing'; // propriété hypothéquée → pas de loyer
      } else if (isAllied(gs, playerId, sq.ownerId)) {
        action = 'nothing'; // immunité alliance
      } else {
        const immunity = player.immunities[sq.id] || 0;
        if (immunity > 0) {
          action = 'nothing';
        } else {
          const rent = calculateRent(gs, sq.id, playerId);
          if (rent > 0) {
            deductCash(gs, playerId, rent);
            addCash(gs, sq.ownerId, rent);
            gs.log.push({ type: 'rent', playerId, ownerId: sq.ownerId, propId: sq.id, amount: rent, turn: gs.turn });
            action = 'pay_rent';
          }
        }
      }
      break;
    }

    case 'tax': {
      deductCash(gs, playerId, sq.amount);
      gs.log.push({ type: 'tax', playerId, amount: sq.amount, turn: gs.turn });
      action = 'pay_tax';
      break;
    }

    case 'event': {
      const card   = drawEventCard(gs);
      const effect = processEventCard(gs, playerId, card);
      gs.log.push({ type: 'event', playerId, cardId: card.id, turn: gs.turn });
      return { gameState: gs, action: 'draw_card', card, effect };
    }

    case 'jail':
      break;

    case 'parking': {
      action = 'parking_choice';
      break;
    }

    case 'free_parking': {
      if (gs.parkingCash > 0) {
        addCash(gs, playerId, gs.parkingCash);
        gs.log.push({ type: 'parking_collect', playerId, amount: gs.parkingCash, turn: gs.turn });
        gs.parkingCash = 0;
      }
      action = 'collect_parking';
      break;
    }
  }

  return { gameState: gs, action };
}

function drawEventCard(gs) {
  if (!gs.eventDeck || gs.eventDeck.length === 0) {
    gs.eventDeck = shuffleDeck();
    gs.deckIndex = 0;
  }
  const card = gs.eventDeck[gs.deckIndex % gs.eventDeck.length];
  gs.deckIndex = (gs.deckIndex + 1) % gs.eventDeck.length;
  return card;
}

function processEventCard(gs, playerId, card) {
  const player = getPlayer(gs, playerId);
  if (!player) return { error: 'Joueur introuvable' };

  switch (card.type) {
    case 'cash': {
      if (card.amount > 0) addCash(gs, playerId, card.amount);
      else deductCash(gs, playerId, -card.amount);
      return { cashDelta: card.amount };
    }

    case 'cash_percent': {
      const amount = Math.floor(player.cash * card.percent);
      deductCash(gs, playerId, amount);
      gs.parkingCash += amount;
      return { cashDelta: -amount };
    }

    case 'per_building': {
      const props = getPlayerProps(gs, playerId);
      const count = props.filter(s => s.building).length;
      const total = count * Math.abs(card.amount);
      if (card.amount < 0) {
        deductCash(gs, playerId, total);
        gs.parkingCash += total;
      } else {
        addCash(gs, playerId, total);
      }
      return { cashDelta: card.amount < 0 ? -total : total };
    }

    case 'per_prop': {
      const props = getPlayerProps(gs, playerId);
      const total = props.length * card.amount;
      addCash(gs, playerId, total);
      return { cashDelta: total };
    }

    case 'go_to_jail': {
      player.position = jailIndex(gs);
      player.jailTurns = 2;
      return { goToJail: true };
    }

    case 'skip_turn': {
      player.skipTurn = (player.skipTurn || 0) + 1;
      return { skipTurn: true };
    }

    case 'lose_building': {
      const owned = getPlayerProps(gs, playerId).filter(s => s.building);
      if (owned.length > 0) {
        owned[0].building = null;
        return { lostBuilding: owned[0].id };
      }
      return { lostBuilding: null };
    }

    case 'cash_from_richest': {
      const others = gs.players.filter(p => p.id !== playerId && p.alive);
      if (others.length === 0) return {};
      const richest = others.reduce((a, b) => a.cash > b.cash ? a : b);
      const amount  = Math.min(card.amount, richest.cash);
      deductCash(gs, richest.id, amount);
      addCash(gs, playerId, amount);
      return { from: richest.id, amount };
    }

    case 'cash_from_all': {
      let collected = 0;
      for (const p of gs.players) {
        if (p.id === playerId || !p.alive) continue;
        const amount = Math.min(card.amount, p.cash);
        deductCash(gs, p.id, amount);
        collected += amount;
      }
      addCash(gs, playerId, collected);
      return { cashDelta: collected };
    }

    case 'car_breakdown': {
      player.hasCar = false;
      return { carBreakdown: true };
    }

    case 'rent_modifier': {
      gs.rentModifiers = gs.rentModifiers || [];
      gs.rentModifiers.push({ value: card.value, duration: card.duration, appliedTurn: gs.turn });
      return { modifier: card.value, duration: card.duration };
    }

    case 'half_next_build': {
      gs.pendingBuildBonus = gs.pendingBuildBonus || {};
      gs.pendingBuildBonus[playerId] = 'half';
      return { buildBonus: 'half' };
    }

    case 'half_next_nightclub': {
      gs.pendingBuildBonus = gs.pendingBuildBonus || {};
      gs.pendingBuildBonus[playerId] = 'half_nightclub';
      return { buildBonus: 'half_nightclub' };
    }

    case 'collect_all_rents': {
      let total = 0;
      const owned = getPlayerProps(gs, playerId);
      for (const sq of owned) {
        for (const p of gs.players) {
          if (p.id === playerId || !p.alive) continue;
          const rent = calculateRent(gs, sq.id, p.id);
          if (rent > 0) {
            deductCash(gs, p.id, rent);
            total += rent;
          }
        }
      }
      addCash(gs, playerId, total);
      return { cashDelta: total };
    }

    case 'reveal_alliance': {
      const active = gs.alliances.filter(a => a.status === 'active');
      if (active.length > 0) {
        const random = active[Math.floor(Math.random() * active.length)];
        return { revealedAlliance: { p1: random.p1, p2: random.p2 } };
      }
      return { revealedAlliance: null };
    }

    case 'force_reveal_ally': {
      return { forceReveal: true };
    }

    default:
      return {};
  }
}

// Passe au joueur suivant
function endTurn(gs) {
  // Reset doubleStreak du joueur courant (sécurité)
  const currentPlayer = gs.players[gs.currentPlayerIndex];
  if (currentPlayer) currentPlayer.doubleStreak = 0;

  // Décrémenter les compteurs d'immunité
  for (const player of gs.players) {
    for (const propId in player.immunities) {
      player.immunities[propId]--;
      if (player.immunities[propId] <= 0) delete player.immunities[propId];
    }
  }

  // Décrémenter les modificateurs de loyer
  gs.rentModifiers = (gs.rentModifiers || []).filter(m => {
    m.duration--;
    return m.duration > 0;
  });

  gs.turn++;
  gs.currentPlayerIndex = nextAliveIndex(gs);

  const { changed: dayNightChanged } = updateDayNight(gs);
  if (dayNightChanged) {
    gs.log.push({ type: 'day_night_change', isNight: gs.isNight, turn: gs.turn });
  }

  const { strikeActive } = checkTransportStrike(gs);
  const strikeChanged = strikeActive !== gs.strikeActive;
  if (strikeChanged) {
    gs.strikeActive = strikeActive;
    gs.log.push({ type: 'strike_change', active: strikeActive, turn: gs.turn });
  }

  return { gameState: gs, dayNightChanged, isNight: gs.isNight, strikeChanged, strikeActive: gs.strikeActive };
}

function nextAliveIndex(gs) {
  const n = gs.players.length;
  let idx   = (gs.currentPlayerIndex + 1) % n;
  let tries = 0;
  while (tries < n) {
    const p = gs.players[idx];
    if (p.alive && !p.disconnected && p.skipTurn <= 0) return idx;
    if (p.alive && !p.disconnected && p.skipTurn > 0)  p.skipTurn--;
    // joueurs morts ou déconnectés : on passe sans toucher à skipTurn
    idx = (idx + 1) % n;
    tries++;
  }
  return gs.currentPlayerIndex; // fallback
}

// ── ACHATS & CONSTRUCTION ─────────────────────────────────────────────────────

function buyProperty(gs, playerId, propertyId) {
  const player = getPlayer(gs, playerId);
  const sq     = getSquare(gs, propertyId);

  if (!player)        return { success: false, error: 'Joueur introuvable', gameState: gs };
  if (!sq)            return { success: false, error: 'Case introuvable', gameState: gs };
  if (!isBuyable(sq)) return { success: false, error: 'Cette case ne peut pas être achetée', gameState: gs };
  if (sq.ownerId)     return { success: false, error: 'Propriété déjà achetée', gameState: gs };
  if (player.cash < sq.price) return { success: false, error: 'Fonds insuffisants', gameState: gs };

  deductCash(gs, playerId, sq.price);
  sq.ownerId = playerId;
  gs.log.push({ type: 'buy', playerId, propId: propertyId, price: sq.price, turn: gs.turn });

  return { success: true, gameState: gs };
}

function build(gs, playerId, propertyId, buildingType) {
  const player = getPlayer(gs, playerId);
  const sq     = getSquare(gs, propertyId);

  if (!player)                  return { success: false, error: 'Joueur introuvable', gameState: gs };
  if (!sq)                      return { success: false, error: 'Case introuvable', gameState: gs };
  if (!isBuyable(sq))           return { success: false, error: 'Non constructible', gameState: gs };
  if (!isOwnedBy(sq, playerId)) return { success: false, error: 'Vous ne possédez pas cette propriété', gameState: gs };

  // Vérifier le niveau max autorisé par la possession du groupe
  const maxLevel    = getMaxBuildingLevel(gs, playerId, propertyId);
  const maxLevelIdx = BUILD_LEVELS.indexOf(maxLevel);
  const targetIdx   = BUILD_LEVELS.indexOf(buildingType);

  if (targetIdx < 0) {
    return { success: false, error: `Type de construction invalide : ${buildingType}`, gameState: gs };
  }
  if (targetIdx > maxLevelIdx) {
    return {
      success: false,
      error:   `Vous devez posséder plus de propriétés du groupe pour construire un ${buildingType}`,
      gameState: gs,
    };
  }

  // Vérifier l'ordre obligatoire (step by step)
  const current = sq.building;
  if (buildingType === 'nightclub') {
    if (sq.type !== 'nightclub_spot') {
      return { success: false, error: 'Construction boîte uniquement sur emplacement dédié', gameState: gs };
    }
    if (current !== 'immeuble') {
      return { success: false, error: "Vous devez avoir un immeuble avant une boîte de nuit", gameState: gs };
    }
  } else {
    const currentIdx  = current ? BUILD_ORDER.indexOf(current) : -1;
    const targetBuildIdx = BUILD_ORDER.indexOf(buildingType);
    if (targetBuildIdx < 0) {
      return { success: false, error: `Type de construction invalide : ${buildingType}`, gameState: gs };
    }
    if (targetBuildIdx !== currentIdx + 1) {
      return { success: false, error: `Vous devez construire dans l'ordre : ${BUILD_ORDER.join(' → ')}`, gameState: gs };
    }
  }

  // Coût (avec éventuel bonus carte événement)
  let costRate = ECONOMY.buildCosts[buildingType];
  const bonus  = gs.pendingBuildBonus?.[playerId];
  if (bonus === 'half' || (bonus === 'half_nightclub' && buildingType === 'nightclub')) {
    costRate = costRate / 2;
    delete gs.pendingBuildBonus[playerId];
  }

  const cost = Math.floor(sq.price * costRate);
  if (player.cash < cost) {
    return { success: false, error: `Fonds insuffisants (coût : ${cost}€)`, gameState: gs };
  }

  deductCash(gs, playerId, cost);
  sq.building = buildingType;
  gs.log.push({ type: 'build', playerId, propId: propertyId, buildingType, cost, turn: gs.turn });

  return { success: true, gameState: gs };
}

// ── HYPOTHÈQUE ────────────────────────────────────────────────────────────────

function mortgageProperty(gs, playerId, propertyId) {
  const player = getPlayer(gs, playerId);
  const sq     = getSquare(gs, propertyId);

  if (!player)                  return { success: false, error: 'Joueur introuvable', gameState: gs };
  if (!sq || !isBuyable(sq))    return { success: false, error: 'Propriété invalide', gameState: gs };
  if (!isOwnedBy(sq, playerId)) return { success: false, error: 'Vous ne possédez pas cette propriété', gameState: gs };
  if (sq.building)              return { success: false, error: 'Vendez le bâtiment avant de pouvoir hypothéquer', gameState: gs };
  if (sq.mortgaged)             return { success: false, error: 'Propriété déjà hypothéquée', gameState: gs };

  const cashReceived = Math.floor(sq.price * 0.5);
  addCash(gs, playerId, cashReceived);
  sq.mortgaged = true;

  gs.log.push({ type: 'mortgage', playerId, propId: propertyId, cashReceived, turn: gs.turn });
  return { success: true, gameState: gs, cashReceived };
}

function unmortgageProperty(gs, playerId, propertyId) {
  const player = getPlayer(gs, playerId);
  const sq     = getSquare(gs, propertyId);

  if (!player)                  return { success: false, error: 'Joueur introuvable', gameState: gs };
  if (!sq || !isBuyable(sq))    return { success: false, error: 'Propriété invalide', gameState: gs };
  if (!isOwnedBy(sq, playerId)) return { success: false, error: 'Vous ne possédez pas cette propriété', gameState: gs };
  if (!sq.mortgaged)            return { success: false, error: "Cette propriété n'est pas hypothéquée", gameState: gs };

  const cashPaid = Math.floor(sq.price * 0.6); // 50% remboursé + 10% intérêts
  if (player.cash < cashPaid) {
    return { success: false, error: `Fonds insuffisants (coût : ${cashPaid}€)`, gameState: gs };
  }

  deductCash(gs, playerId, cashPaid);
  sq.mortgaged = false;

  gs.log.push({ type: 'unmortgage', playerId, propId: propertyId, cashPaid, turn: gs.turn });
  return { success: true, gameState: gs, cashPaid };
}

// Vend le bâtiment le plus récent sur la propriété (downgrade d'un niveau)
function sellBuilding(gs, playerId, propertyId) {
  const player = getPlayer(gs, playerId);
  const sq     = getSquare(gs, propertyId);

  if (!player)                  return { success: false, error: 'Joueur introuvable', gameState: gs };
  if (!sq || !isBuyable(sq))    return { success: false, error: 'Propriété invalide', gameState: gs };
  if (!isOwnedBy(sq, playerId)) return { success: false, error: 'Vous ne possédez pas cette propriété', gameState: gs };
  if (!sq.building)             return { success: false, error: 'Aucun bâtiment à vendre', gameState: gs };

  const prevBuilding = {
    studio:    null,
    appart:    'studio',
    immeuble:  'appart',
    nightclub: 'immeuble',
  }[sq.building];

  const cashReceived = Math.floor(sq.price * ECONOMY.buildCosts[sq.building] * 0.5);
  addCash(gs, playerId, cashReceived);
  const soldBuilding = sq.building;
  sq.building = prevBuilding;

  gs.log.push({ type: 'sell_building', playerId, propId: propertyId, soldBuilding, cashReceived, turn: gs.turn });
  return { success: true, gameState: gs, cashReceived };
}

// ── LOYERS & CALCULS ──────────────────────────────────────────────────────────

function calculateRent(gs, propertyId, payerId) {
  const sq = getSquare(gs, propertyId);
  if (!sq || !sq.ownerId) return 0;

  // Propriété hypothéquée → pas de loyer
  if (sq.mortgaged) return 0;

  // Alliance → loyer 0
  if (isAllied(gs, payerId, sq.ownerId)) return 0;

  // Immunité temporaire (post-forceTrade)
  const payer = getPlayer(gs, payerId);
  if (payer && (payer.immunities[propertyId] || 0) > 0) return 0;

  // Boîte de nuit : ne rapporte que la nuit
  if (sq.building === 'nightclub') {
    if (!gs.isNight) return 0;
    const bonus = hasGroupBonus(gs, propertyId);
    const rate  = bonus ? ECONOMY.rentRates.nightclub.night_group : ECONOMY.rentRates.nightclub.night_solo;
    return Math.floor(sq.price * applyRentModifiers(gs, rate));
  }

  // Transport : loyer progressif selon nombre de transports possédés
  if (sq.type === 'transport') {
    const ownedTransports = gs.board.filter(s => s.type === 'transport' && isOwnedBy(s, sq.ownerId)).length;
    const transportRates  = [0, 0.25, 0.40, 0.60, 0.80];
    return Math.floor(sq.price * (transportRates[ownedTransports] || 0.25));
  }

  const level = sq.building || 'bare';
  const rates = ECONOMY.rentRates[level];
  if (!rates) return 0;

  const bonus = hasGroupBonus(gs, propertyId);
  const rate  = bonus ? rates.group : rates.solo;
  return Math.floor(sq.price * applyRentModifiers(gs, rate));
}

function applyRentModifiers(gs, rate) {
  let modified = rate;
  for (const mod of gs.rentModifiers || []) modified += mod.value;
  return Math.max(0, modified);
}

function netWorth(gs, playerId) {
  const player = getPlayer(gs, playerId);
  if (!player) return 0;

  let worth = player.cash;
  for (const sq of gs.board) {
    if (!isBuyable(sq) || !isOwnedBy(sq, playerId)) continue;
    worth += sq.price;
    if (sq.building) worth += Math.floor(sq.price * ECONOMY.buildCosts[sq.building]);
  }
  return worth;
}

// ── MÉCANIQUES SPÉCIALES ──────────────────────────────────────────────────────

function checkTransportStrike(gs) {
  const active = Math.random() < ECONOMY.strikeChance;
  return { gameState: gs, strikeActive: active };
}

function updateDayNight(gs) {
  gs.dayNightCounter = (gs.dayNightCounter || 0) + 1;
  if (gs.dayNightCounter >= ECONOMY.dayNightCycle) {
    gs.dayNightCounter = 0;
    gs.isNight = !gs.isNight;
    return { gameState: gs, changed: true, isNight: gs.isNight };
  }
  return { gameState: gs, changed: false, isNight: gs.isNight };
}

function checkVictory(gs) {
  const alivePlayers = gs.players.filter(p => p.alive);
  if (alivePlayers.length === 1) {
    return { winner: alivePlayers[0].id, reason: 'last_standing' };
  }

  if (gs.turn >= ECONOMY.maxTurns) {
    const winner = alivePlayers.reduce((best, p) =>
      netWorth(gs, p.id) > netWorth(gs, best.id) ? p : best
    );
    return { winner: winner.id, reason: 'max_turns' };
  }

  if (gs.turn >= ECONOMY.dominanceMinTurn) {
    for (const player of alivePlayers) {
      const worth   = netWorth(gs, player.id);
      const others  = alivePlayers.filter(p => p.id !== player.id);
      if (others.length === 0) continue;
      const avgOthers = others.reduce((sum, p) => sum + netWorth(gs, p.id), 0) / others.length;
      if (worth >= ECONOMY.dominanceMultiplier * avgOthers) {
        return { winner: player.id, reason: 'dominance' };
      }
    }
  }

  return { winner: null, reason: null };
}

// ── ENCHÈRES ──────────────────────────────────────────────────────────────────

function startAuction(gs, propertyId) {
  const auctionId = uid();
  gs.auctions = gs.auctions || [];
  gs.auctions.push({
    id:            auctionId,
    propertyId,
    currentBid:    0,
    currentBidder: null,
    bids:          {},
    status:        'open',
    startTurn:     gs.turn,
  });
  return { gameState: gs, auctionId };
}

// Le joueur refuse d'acheter → déclenche une enchère ouverte à tous
function refusePurchase(gs, playerId, propertyId) {
  const player = getPlayer(gs, playerId);
  const sq     = getSquare(gs, propertyId);

  if (!player)             return { error: 'Joueur introuvable', gameState: gs };
  if (!sq || !isBuyable(sq)) return { error: 'Propriété invalide', gameState: gs };
  if (sq.ownerId)          return { error: 'Propriété déjà achetée', gameState: gs };

  gs.log.push({ type: 'purchase_refused', playerId, propId: propertyId, turn: gs.turn });
  return startAuction(gs, propertyId);
}

function placeBid(gs, playerId, auctionId, amount) {
  const player  = getPlayer(gs, playerId);
  const auction = (gs.auctions || []).find(a => a.id === auctionId);

  if (!player) return { success: false, error: 'Joueur introuvable', gameState: gs };
  if (!auction || auction.status !== 'open') {
    return { success: false, error: 'Enchère introuvable ou fermée', gameState: gs };
  }
  if (amount <= auction.currentBid) {
    return { success: false, error: `Enchère trop basse (minimum : ${auction.currentBid + 1}€)`, gameState: gs };
  }
  if (player.cash < amount) return { success: false, error: 'Fonds insuffisants', gameState: gs };

  auction.currentBid    = amount;
  auction.currentBidder = playerId;
  auction.bids[playerId] = amount;

  return { success: true, gameState: gs };
}

function closeAuction(gs, auctionId) {
  const auction = (gs.auctions || []).find(a => a.id === auctionId);
  if (!auction) return { gameState: gs, winner: null, finalPrice: 0 };
  if (auction.status === 'closed') return { gameState: gs, winner: auction.currentBidder, finalPrice: auction.currentBid };

  auction.status = 'closed';

  if (!auction.currentBidder) {
    return { gameState: gs, winner: null, finalPrice: 0 };
  }

  const winner     = auction.currentBidder;
  const finalPrice = auction.currentBid;
  const sq         = getSquare(gs, auction.propertyId);

  if (sq && !sq.ownerId) {
    deductCash(gs, winner, finalPrice);
    sq.ownerId = winner;
    gs.log.push({ type: 'auction_won', winner, propId: auction.propertyId, price: finalPrice, turn: gs.turn });
  }

  return { gameState: gs, winner, finalPrice };
}

// ── TRADES ────────────────────────────────────────────────────────────────────

function proposeTrade(gs, fromId, toId, offer) {
  const tradeId = uid();
  const trade   = {
    id:          tradeId,
    type:        'voluntary',
    fromId,
    toId,
    cash:        offer.cash || 0,
    propertyId:  offer.propertyId || null,
    status:      'pending',
    createdTurn: gs.turn,
  };
  gs.trades = gs.trades || [];
  gs.trades.push(trade);
  return { gameState: gs, tradeId };
}

function acceptTrade(gs, tradeId) {
  const trade = (gs.trades || []).find(t => t.id === tradeId);
  if (!trade || trade.status !== 'pending') {
    return { success: false, error: 'Trade introuvable', gameState: gs };
  }

  const from = getPlayer(gs, trade.fromId);
  const to   = getPlayer(gs, trade.toId);
  if (!from || !to) return { success: false, error: 'Joueur introuvable', gameState: gs };

  // Transfert cash
  if (trade.cash !== 0) {
    if (trade.cash > 0) {
      if (from.cash < trade.cash) return { success: false, error: 'Fonds insuffisants', gameState: gs };
      deductCash(gs, trade.fromId, trade.cash);
      addCash(gs, trade.toId, trade.cash);
    } else {
      const abs = Math.abs(trade.cash);
      if (to.cash < abs) return { success: false, error: 'Fonds insuffisants', gameState: gs };
      deductCash(gs, trade.toId, abs);
      addCash(gs, trade.fromId, abs);
    }
  }

  // Transfert propriété (l'acheteur hérite de l'hypothèque)
  let mortgageInherited = null;
  if (trade.propertyId) {
    const sq = getSquare(gs, trade.propertyId);
    if (sq && sq.ownerId === trade.fromId) {
      sq.ownerId = trade.toId;
      if (sq.mortgaged) mortgageInherited = trade.propertyId;
    }
  }

  trade.status = 'accepted';
  gs.log.push({ type: 'trade_accepted', ...trade, turn: gs.turn });
  return { success: true, gameState: gs, mortgageInherited };
}

function refuseTrade(gs, tradeId) {
  const trade = (gs.trades || []).find(t => t.id === tradeId);
  if (trade) trade.status = 'refused';
  return { gameState: gs };
}

function forceTrade(gs, fromId, propertyId) {
  const from = getPlayer(gs, fromId);
  const sq   = getSquare(gs, propertyId);

  if (!from) return { success: false, error: 'Joueur introuvable', gameState: gs };
  if (!sq)   return { success: false, error: 'Propriété introuvable', gameState: gs };
  if (!sq.ownerId || sq.ownerId === fromId) {
    return { success: false, error: 'Propriété non possédée par un adversaire', gameState: gs };
  }

  const toId = sq.ownerId;
  const to   = getPlayer(gs, toId);
  if (!to) return { success: false, error: 'Propriétaire introuvable', gameState: gs };

  if (sq.building) return { success: false, error: 'Impossible de forcer un trade avec bâtiment', gameState: gs };

  // Le forceur ne doit pas déjà avoir le monopole sur ce groupe
  const allInGroup    = gs.board.filter(s => s.group === sq.group && isBuyable(s));
  const ownedByFromer = allInGroup.filter(s => isOwnedBy(s, fromId));
  if (ownedByFromer.length >= allInGroup.length) {
    return { success: false, error: 'Vous avez déjà le monopole sur ce groupe', gameState: gs };
  }

  const cost = sq.price * 3;
  if (from.cash < cost) {
    return { success: false, error: `Fonds insuffisants (coût : ${cost}€)`, gameState: gs };
  }

  deductCash(gs, fromId, cost);
  addCash(gs, toId, cost);
  sq.ownerId = fromId;

  // Immunité 2 tours sur cette case pour l'ancien propriétaire
  if (!to.immunities) to.immunities = {};
  to.immunities[propertyId] = 2;

  // Rupture d'alliance si présente
  let allianceBroken = null;
  const alliance = gs.alliances.find(a =>
    a.status === 'active' &&
    ((a.p1 === fromId && a.p2 === toId) || (a.p1 === toId && a.p2 === fromId))
  );
  if (alliance) {
    alliance.status     = 'broken';
    alliance.brokenTurn = gs.turn;
    alliance.initiator  = fromId;
    allianceBroken      = { ...alliance };
    gs.log.push({ type: 'alliance_broken', alliance: allianceBroken, reason: 'force_trade', turn: gs.turn });
  }

  gs.log.push({ type: 'force_trade', fromId, toId, propId: propertyId, cost, turn: gs.turn });
  return { success: true, gameState: gs, toId, allianceBroken };
}

// ── ALLIANCES ─────────────────────────────────────────────────────────────────

function maxAlliances(gs) {
  return gs.players.length <= 3 ? 1 : 2;
}

function activeAllianceOf(gs, playerId) {
  return gs.alliances.find(a =>
    a.status === 'active' && (a.p1 === playerId || a.p2 === playerId)
  ) || null;
}

function proposeAlliance(gs, fromId, toId) {
  const allianceId = uid();
  gs.alliances = gs.alliances || [];
  gs.alliances.push({
    id:         allianceId,
    p1:         fromId,
    p2:         toId,
    formedTurn: null,
    brokenTurn: null,
    initiator:  null,
    status:     'pending',
  });
  return { gameState: gs, allianceId };
}

function acceptAlliance(gs, allianceId) {
  const alliance = (gs.alliances || []).find(a => a.id === allianceId);
  if (!alliance || alliance.status !== 'pending') {
    return { success: false, error: 'Alliance introuvable ou non en attente', gameState: gs };
  }

  const brokenAlliances = [];

  // Briser les alliances existantes si nécessaire
  for (const pid of [alliance.p1, alliance.p2]) {
    const existing = activeAllianceOf(gs, pid);
    if (existing && existing.id !== allianceId) {
      existing.status     = 'broken';
      existing.brokenTurn = gs.turn;
      existing.initiator  = pid;
      brokenAlliances.push({ ...existing });
      gs.log.push({ type: 'alliance_broken', alliance: existing, reason: 'new_alliance', turn: gs.turn });
    }
  }

  alliance.status     = 'active';
  alliance.formedTurn = gs.turn;

  gs.log.push({ type: 'alliance_formed', p1: alliance.p1, p2: alliance.p2, turn: gs.turn });
  return { success: true, gameState: gs, brokenAlliances };
}

function breakAlliance(gs, playerId) {
  const alliance = activeAllianceOf(gs, playerId);
  if (!alliance) return { gameState: gs, revealedAlliance: null };

  alliance.status     = 'broken';
  alliance.brokenTurn = gs.turn;
  alliance.initiator  = playerId;

  const revealed = { ...alliance };
  gs.log.push({ type: 'alliance_broken', alliance: revealed, reason: 'voluntary', turn: gs.turn });
  return { gameState: gs, revealedAlliance: revealed };
}

// ── COLOCATION ────────────────────────────────────────────────────────────────

function buyColoc(gs, player1Id, player2Id, propertyId) {
  const p1 = getPlayer(gs, player1Id);
  const p2 = getPlayer(gs, player2Id);
  const sq = getSquare(gs, propertyId);

  if (!p1 || !p2)              return { success: false, error: 'Joueur introuvable', gameState: gs };
  if (!sq || !isBuyable(sq))   return { success: false, error: 'Propriété introuvable', gameState: gs };
  if (sq.ownerId)              return { success: false, error: 'Propriété déjà achetée', gameState: gs };

  const eachPays = Math.floor(sq.price * 0.60);
  if (p1.cash < eachPays) return { success: false, error: `${p1.name} n'a pas assez de fonds`, gameState: gs };
  if (p2.cash < eachPays) return { success: false, error: `${p2.name} n'a pas assez de fonds`, gameState: gs };

  deductCash(gs, player1Id, eachPays);
  deductCash(gs, player2Id, eachPays);
  sq.ownerId  = player1Id;
  sq.isColoc  = true;
  sq.coOwners = [player1Id, player2Id];

  gs.log.push({ type: 'buy_coloc', player1Id, player2Id, propId: propertyId, turn: gs.turn });
  return { success: true, gameState: gs };
}

function leaveColoc(gs, playerId, propertyId) {
  const sq = getSquare(gs, propertyId);
  if (!sq || !sq.isColoc || !sq.coOwners?.includes(playerId)) {
    return { success: false, error: "Vous n'êtes pas co-propriétaire de cette case", gameState: gs };
  }

  const negotiationId = uid();
  gs.negotiations = gs.negotiations || [];
  gs.negotiations.push({
    id:          negotiationId,
    propertyId,
    p1:          sq.coOwners[0],
    p2:          sq.coOwners[1],
    offerAmount: null,
    offerBy:     null,
    status:      'pending',
    startTurn:   gs.turn,
  });

  gs.log.push({ type: 'coloc_leave', playerId, propId: propertyId, negotiationId, turn: gs.turn });
  return { gameState: gs, negotiationId };
}

function colocOffer(gs, playerId, negotiationId, amount) {
  const neg = (gs.negotiations || []).find(n => n.id === negotiationId);
  if (!neg || neg.status !== 'pending') return { gameState: gs };
  neg.offerAmount = amount;
  neg.offerBy     = playerId;
  return { gameState: gs };
}

function colocAccept(gs, playerId, negotiationId) {
  const neg = (gs.negotiations || []).find(n => n.id === negotiationId);
  if (!neg || neg.status !== 'pending' || neg.offerBy === playerId) {
    return { success: false, error: 'Offre invalide', gameState: gs };
  }
  if (neg.offerAmount === null) return { success: false, error: 'Aucune offre soumise', gameState: gs };

  const buyer  = neg.offerBy;
  const seller = playerId;
  const payer  = getPlayer(gs, buyer);
  if (!payer || payer.cash < neg.offerAmount) {
    return { success: false, error: 'Fonds insuffisants', gameState: gs };
  }

  deductCash(gs, buyer, neg.offerAmount);
  addCash(gs, seller, neg.offerAmount);

  const sq = getSquare(gs, neg.propertyId);
  if (sq) {
    sq.ownerId  = buyer;
    sq.isColoc  = false;
    sq.coOwners = [];
  }

  neg.status = 'accepted';
  return { success: true, gameState: gs };
}

// ── EXPORTS ───────────────────────────────────────────────────────────────────

module.exports = {
  ECONOMY,
  EVENT_DECK,
  BUILD_LEVELS,

  // Tour
  rollDice,
  processLanding,
  drawEventCard,
  processEventCard,
  endTurn,

  // Achat & construction
  buyProperty,
  build,

  // Hypothèque
  mortgageProperty,
  unmortgageProperty,
  sellBuilding,

  // Enchères
  startAuction,
  refusePurchase,
  placeBid,
  closeAuction,

  // Calculs
  calculateRent,
  netWorth,
  getMaxBuildingLevel,
  getGroupSize,
  countOwnedInGroup,

  // Mécaniques spéciales
  checkTransportStrike,
  updateDayNight,
  checkVictory,

  // Trades
  proposeTrade,
  acceptTrade,
  refuseTrade,
  forceTrade,

  // Alliances
  proposeAlliance,
  acceptAlliance,
  breakAlliance,
  isAllied,

  // Colocation
  buyColoc,
  leaveColoc,
  colocOffer,
  colocAccept,

  // Helpers exposés pour les tests
  getPlayer,
  getSquare,
  shuffleDeck,
};
