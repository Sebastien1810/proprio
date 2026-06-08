'use strict';

const { PION_COLORS, PIONS } = require('./constants');
const { getBoardConfig, generateBoard } = require('./board-configs');
const { shuffleDeck }   = require('./game-engine');

// dbPlayers    : tableau de Player Prisma, triés par id asc (ordre d'arrivée)
// pionChoices  : { [playerId]: pionId } — sélections du lobby (optionnel)
function initGameState(dbPlayers, boardSizeOverride, diceMaxOverride, pionChoices = {}, colorChoices = {}) {
  const boardConfig = getBoardConfig(dbPlayers.length);
  const boardSize   = boardSizeOverride || boardConfig.boardSize;
  const diceMax     = diceMaxOverride   || boardConfig.diceMax;

  const board = generateBoard(boardSize);

  return {
    boardSize,
    diceMax,
    phase:               'playing',
    turn:                0,
    currentPlayerIndex:  0,
    isNight:             false,
    dayNightCounter:     0,
    strikeActive:        false,
    parkingCash:         0,
    board,
    players: dbPlayers.map((p, i) => {
      const pionId = pionChoices[p.id] ?? (i % PIONS.length);
      return {
        id:           p.id,
        name:         p.name,
        color:        colorChoices[p.id] !== undefined
                        ? PION_COLORS[colorChoices[p.id] % PION_COLORS.length]
                        : PION_COLORS[i % PION_COLORS.length],
        pion:         PIONS[pionId] ?? PIONS[0],
        cash:         2500,
        position:     0,
        jailTurns:    0,
        skipTurn:     0,
        hasCar:       false,
        alive:        true,
        allianceId:   null,
        immunities:   {},
        doubleStreak: 0,
        disconnected: false,
      };
    }),
    alliances:         [],
    trades:            [],
    negotiations:      [],
    auctions:          [],
    rentModifiers:     [],
    pendingBuildBonus: {},
    eventDeck:         shuffleDeck(),
    deckIndex:         0,
    log:               [],
  };
}

module.exports = { initGameState };
