'use strict';

// ── Données statiques ─────────────────────────────────────────────────────────

const GROUP_NAMES = [
  ['Garges-lès-Gonesse','Sarcelles','Gonesse','Écouen','Goussainville','Louvres'],
  ['Cergy','Pontoise','Évry','Mantes-la-Jolie','Les Mureaux','Conflans-Ste-Honorine'],
  ['Bobigny','Aubervilliers','Saint-Denis','Saint-Ouen','Épinay-sur-Seine','Stains'],
  ['Montreuil','Vincennes','Pantin','Bagnolet','Les Lilas','Romainville'],
  ['Montrouge','Malakoff','Vanves','Châtillon','Clamart','Fontenay-aux-Roses'],
  ['Issy-les-Moulineaux','Boulogne-Billancourt','Levallois-Perret','Colombes','Nanterre','Rueil-Malmaison'],
  ['Neuilly-sur-Seine','Courbevoie','Puteaux','Suresnes','Versailles','Saint-Germain-en-Laye'],
  ['Av. Montaigne','Champs-Élysées','Fg. Saint-Honoré','Place Vendôme','Rue de Rivoli','Rue de la Paix'],
];

const GROUP_BASE_PRICES = [60, 100, 140, 180, 220, 260, 300, 380];

const TRANSPORTS = [
  { id:'tr_0', name:'Gare du Nord',            price:200 },
  { id:'tr_1', name:'Gare de Lyon',             price:200 },
  { id:'tr_2', name:'Transports en Commun ZA',  price:150 },
  { id:'tr_3', name:'Transports en Commun ZB',  price:150 },
  { id:'tr_4', name:'Gare Montparnasse',         price:200 },
  { id:'tr_5', name:'Gare Saint-Lazare',         price:200 },
  { id:'tr_6', name:'Bus Express',               price:120 },
  { id:'tr_7', name:'Tramway T1',                price:120 },
];

const TAX_AMOUNTS = [130, 160, 200, 250, 130, 160, 200, 250];

// ── Helpers de construction ───────────────────────────────────────────────────

function prop(group, propIdx) {
  const base = GROUP_BASE_PRICES[group];
  const step = Math.max(10, Math.round(base * 0.08));
  return {
    type:  'prop',
    id:    `g${group}_${propIdx}`,
    name:  GROUP_NAMES[group][propIdx],
    group,
    price: base + propIdx * step,
  };
}

function transport(tIdx) {
  return { type: 'transport', ...TRANSPORTS[tIdx] };
}

function nightclub(ncIdx) {
  return {
    type:  'nightclub_spot',
    id:    `nc_${ncIdx}`,
    name:  `Emplacement Boîte de nuit #${ncIdx + 1}`,
    price: 350,
  };
}

function event(eIdx) {
  return { type: 'event', id: `event_${eIdx}` };
}

function tax(tIdx) {
  return { type: 'tax', id: `tax_${tIdx}`, amount: TAX_AMOUNTS[tIdx] };
}

// Attribue les idx et les champs mutables aux cases achetables
function finalize(squares) {
  return squares.map((sq, i) => {
    const s = { ...sq, idx: i };
    if (['prop', 'transport', 'nightclub_spot'].includes(s.type)) {
      s.ownerId   = null;
      s.building  = null;
      s.mortgaged = false;
      s.isColoc   = false;
      s.coOwners  = [];
    }
    return s;
  });
}

// ── Génération du plateau 40 cases (2-3 joueurs) ──────────────────────────────
// Disposition : 9 cases par côté, 2 groupes × 3 propriétés par côté
// Coins : 0 (départ), 10 (agence/prison), 20 (parking), 30 (parking gratuit)
function board40() {
  return finalize([
    /* 0  */ { type:'start',        id:'start'        },
    /* 1  */ prop(0,0), prop(0,1), prop(0,2),
    /* 4  */ event(0),
    /* 5  */ transport(0),
    /* 6  */ prop(1,0), prop(1,1), prop(1,2),
    /* 9  */ tax(0),
    /* 10 */ { type:'jail',         id:'jail'         },
    /* 11 */ prop(2,0), prop(2,1), prop(2,2),
    /* 14 */ tax(1),
    /* 15 */ event(1),
    /* 16 */ prop(3,0), prop(3,1), prop(3,2),
    /* 19 */ transport(1),
    /* 20 */ { type:'parking',      id:'parking'      },
    /* 21 */ prop(4,0), prop(4,1), prop(4,2),
    /* 24 */ event(2),
    /* 25 */ transport(2),
    /* 26 */ prop(5,0), prop(5,1), prop(5,2),
    /* 29 */ tax(2),
    /* 30 */ { type:'free_parking', id:'free_parking' },
    /* 31 */ prop(6,0), prop(6,1), prop(6,2),
    /* 34 */ tax(3),
    /* 35 */ event(3),
    /* 36 */ prop(7,0), prop(7,1), prop(7,2),
    /* 39 */ transport(3),
  ].flat());
}

// ── Génération du plateau 60 cases (4-5 joueurs) ──────────────────────────────
// Disposition : 14 cases par côté, 9 propriétés par côté (groupes inégaux)
// Groupes 0,2,6,7 : 5 props ; groupes 1,3,4,5 : 4 props → total 36
// Coins : 0, 15, 30, 45
function board60() {
  return finalize([
    /* 0  */ { type:'start',        id:'start'        },
    /* 1  */ prop(0,0), prop(0,1), prop(0,2), prop(0,3), prop(0,4),
    /* 6  */ event(0),
    /* 7  */ transport(0),
    /* 8  */ prop(1,0), prop(1,1), prop(1,2), prop(1,3),
    /* 12 */ tax(0),
    /* 13 */ event(1),
    /* 14 */ event(2),
    /* 15 */ { type:'jail',         id:'jail'         },
    /* 16 */ prop(2,0), prop(2,1), prop(2,2), prop(2,3), prop(2,4),
    /* 21 */ event(3),
    /* 22 */ transport(1),
    /* 23 */ prop(3,0), prop(3,1), prop(3,2), prop(3,3),
    /* 27 */ tax(1),
    /* 28 */ nightclub(0),
    /* 29 */ event(4),
    /* 30 */ { type:'parking',      id:'parking'      },
    /* 31 */ prop(4,0), prop(4,1), prop(4,2), prop(4,3),
    /* 35 */ event(5),
    /* 36 */ transport(2),
    /* 37 */ prop(5,0), prop(5,1), prop(5,2), prop(5,3),
    /* 41 */ tax(2),
    /* 42 */ nightclub(1),
    /* 43 */ event(6),
    /* 44 */ event(7),
    /* 45 */ { type:'free_parking', id:'free_parking' },
    /* 46 */ prop(6,0), prop(6,1), prop(6,2), prop(6,3), prop(6,4),
    /* 51 */ event(8),
    /* 52 */ transport(3),
    /* 53 */ prop(7,0), prop(7,1), prop(7,2), prop(7,3), prop(7,4),
    /* 58 */ tax(3),
    /* 59 */ event(9),
  ].flat());
}

// ── Génération du plateau 80 cases (6-8 joueurs) ──────────────────────────────
// Disposition : 19 cases par côté, 12 propriétés par côté (2 groupes × 6)
// Tous les groupes : 6 props → total 48
// Coins : 0, 20, 40, 60
function board80() {
  function side(gA, gB, eBase, tBase, trIdx, ncIdx) {
    return [
      prop(gA,0), prop(gA,1), prop(gA,2), prop(gA,3), prop(gA,4), prop(gA,5),
      event(eBase),
      tax(tBase),
      transport(trIdx),
      prop(gB,0), prop(gB,1), prop(gB,2), prop(gB,3), prop(gB,4), prop(gB,5),
      event(eBase+1),
      tax(tBase+1),
      nightclub(ncIdx),
      event(eBase+2),
    ];
  }
  return finalize([
    { type:'start',        id:'start'        },
    ...side(0, 1, 0, 0, 0, 0),
    { type:'jail',         id:'jail'         },
    ...side(2, 3, 3, 2, 1, 1),
    { type:'parking',      id:'parking'      },
    ...side(4, 5, 6, 4, 2, 2),
    { type:'free_parking', id:'free_parking' },
    ...side(6, 7, 9, 6, 3, 3),
  ]);
}

// ── API publique ──────────────────────────────────────────────────────────────

const BOARDS = { 40: board40, 60: board60, 80: board80 };

function generateBoard(size) {
  const gen = BOARDS[size];
  if (!gen) throw new Error(`Taille de plateau invalide : ${size}. Valeurs : 40, 60, 80`);
  return gen();
}

const CONFIGS = {
  small:  { boardSize: 40, diceMax: 6, label: 'Petit — 40 cases',  minPlayers: 2, maxPlayers: 3 },
  medium: { boardSize: 60, diceMax: 7, label: 'Moyen — 60 cases',  minPlayers: 4, maxPlayers: 5 },
  large:  { boardSize: 80, diceMax: 8, label: 'Grand — 80 cases',  minPlayers: 6, maxPlayers: 8 },
};

function getBoardConfig(playerCount) {
  if (playerCount <= 3) return CONFIGS.small;
  if (playerCount <= 5) return CONFIGS.medium;
  return CONFIGS.large;
}

module.exports = { generateBoard, getBoardConfig, CONFIGS, GROUP_BASE_PRICES };
