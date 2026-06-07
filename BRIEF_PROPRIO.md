# 🎲 BRIEF CLAUDE CODE — "Proprio" (Monopoly revisité)

## Vision du projet

Un Monopoly multijoueur en temps réel, ancré dans la **vie française moderne**, avec un ton **satirique et humoristique**. Les propriétés, les événements et les mécaniques reflètent la réalité absurde du quotidien en France — loyers parisiens, galères administratives, grèves des transports.

**Nom du jeu** : _Proprio_
**Joueurs** : 2 à 8 joueurs en ligne
**Stack** : Next.js + Socket.IO + PostgreSQL + Prisma

---

## Noms et marques — règles à respecter (jeu monétisé)

| ❌ À éviter                | ✅ Remplacer par                                                                                            |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| RATP                       | Les Transports en Commun                                                                                    |
| Grève RATP                 | Grève des transports                                                                                        |
| Pass Navigo                | Pass Transports                                                                                             |
| Pôle Emploi                | L'Agence                                                                                                    |
| CAF                        | Les Allocations                                                                                             |
| Leboncoin                  | Site de petites annonces                                                                                    |
| Vinted                     | Appli de revente                                                                                            |
| Noms de boîtes/bars précis | Descriptions génériques — SAUF "Rue du Docteur Babinski" qui est un nom de rue public, utilisable librement |

**Les noms de villes et quartiers sont libres** — Garges, Vincennes, Montreuil, Champs-Élysées, etc.

---

## Stack technique

```
Frontend  : Next.js 14 (App Router)
Realtime  : Socket.IO (serveur custom Node.js)
BDD       : PostgreSQL + Prisma ORM
Style     : Tailwind CSS
```

### Structure du projet

```
/
├── app/
│   ├── page.tsx                  # Landing / rejoindre une partie
│   ├── lobby/[roomId]/           # Salle d'attente
│   └── game/[roomId]/            # Interface de jeu
├── server/
│   └── index.js                  # Serveur Socket.IO custom
├── lib/
│   ├── game-engine.js            # Logique du jeu (pure JS, sans side effects)
│   ├── board-configs.js          # Les 3 plateaux (40 / 60 / 80 cases)
│   └── prisma.js
├── prisma/
│   └── schema.prisma
└── components/
    ├── Board.jsx
    ├── PlayerToken.jsx
    ├── PropertyCard.jsx
    ├── EventCard.jsx
    ├── ColocModal.jsx
    ├── TradeModal.jsx
    └── AllianceModal.jsx
```

---

## Modèles Prisma

```prisma
model Room {
  id        String   @id @default(cuid())
  code      String   @unique
  status    String   @default("waiting") // waiting | playing | finished
  gameState Json
  createdAt DateTime @default(now())
  players   Player[]
}

model Player {
  id       String  @id @default(cuid())
  roomId   String
  room     Room    @relation(fields: [roomId], references: [id])
  name     String
  socketId String?
  color    String
}
```

---

## Scaling plateau par nombre de joueurs

| Joueurs | Plateau | Cases    | Dés | Props/groupe   |
| ------- | ------- | -------- | --- | -------------- |
| 2-3     | Petit   | 40 cases | 1-6 | 3 par groupe   |
| 4-5     | Moyen   | 60 cases | 1-7 | 4-5 par groupe |
| 6-8     | Grand   | 80 cases | 1-8 | 6 par groupe   |

Le plateau est sélectionné automatiquement au `start_game` selon `room.players.length`.
Même univers, mêmes quartiers, même économie — juste condensé ou étendu.

---

## Économie du jeu (paramètres validés par simulation — 90 parties)

```
Argent de départ      : 2 500€
Passage Fin de mois   : +300€ (atterrissage exact : +500€)
Prix propriétés       : 60€ → 560€ (8 groupes × 3-6 cases)
```

### Taxes (par plateau)

| Case              | Montant                     |
| ----------------- | --------------------------- |
| Taxe foncière     | 130€                        |
| Impôts locaux     | 160€                        |
| Taxe d'habitation | 200€                        |
| Super impôts      | max(250€, 10% valeur nette) |

### Loyers

| Niveau               | Solo     | Groupe (≥4/6 props) |
| -------------------- | -------- | ------------------- |
| Nu                   | 10% prix | 18% prix            |
| Studio               | 16% prix | 25% prix            |
| Appartement          | 25% prix | 35% prix            |
| Immeuble             | 40% prix | 52% prix            |
| Boîte de nuit (nuit) | 60% prix | 75% prix            |
| Boîte de nuit (jour) | 0€       | 0€                  |

### Constructions

| Niveau        | Coût                                        |
| ------------- | ------------------------------------------- |
| Studio        | 50% prix de la case                         |
| Appartement   | 75% prix de la case                         |
| Immeuble      | 100% prix de la case                        |
| Boîte de nuit | 120% prix de la case _(pas 150% — corrigé)_ |

**Construction sans prérequis groupe** — on peut construire dès qu'on possède 1 propriété.

### Voiture

- Prix : **250€** (achetable sur la case Parking)
- Protège des grèves des transports définitivement

---

## Les 3 plateaux — cases spéciales

### Coins (identiques sur tous les plateaux)

| Case           | Position      | Effet                                    |
| -------------- | ------------- | ---------------------------------------- |
| 🏁 Fin de mois | Départ        | +300€ passage / +500€ atterrissage       |
| ⚖️ L'Agence    | Prison        | Bloqué 2 tours / sortie : 200€ ou double |
| 🚗 Parking     | Parking       | Achat voiture 250€ ou encaisse cagnotte  |
| 🏛️ Visiteur    | Passage libre | Aucun effet                              |

### Cases spéciales

- **Courrier du Jour** : deck 30 cartes, effet immédiat, 50% positif / 50% négatif
- **Grève des transports** : event global aléatoire (8% par tour) — bloque joueurs sans voiture
- **Transports** : achetables, génèrent un péage à chaque passage
- **Services publics** : abonnement automatique chaque tour si possédés

---

## Mécaniques custom

### 1. Colocation

- Achat conjoint d'une propriété (chacun paie 60% du prix = -20% chacun)
- Loyers partagés 50/50
- Séparation : négociation 60s en temps réel → enchères publiques si pas d'accord

### 2. Grève des transports

- Déclenchement : 8% de probabilité par tour
- Bloque tous les joueurs sans voiture (skip leur tour)
- Voiture = protection définitive (250€)

### 3. Cycle Jour / Nuit

- 4 tours par phase (jour ou nuit)
- Boîte de nuit : loyer ×0 le jour, loyer élevé la nuit
- Indicateur visuel 🌞 / 🌙 sur le plateau

### 4. Boîte de nuit

- Alternative à l'immeuble sur les cases "boîte de nuit disponible"
- Coût : **1.2× le prix de la case** (corrigé après simulation)
- Choix irréversible : immeuble OU boîte, pas les deux
- Carte Courrier du Jour : _"Subvention nightlife — votre prochaine boîte coûte moitié prix"_

### 5. Trades

**Trade volontaire** (après atterrissage, avant fin de tour)

- Cash obligatoire + propriété optionnelle exigée en échange
- L'autre joueur accepte ou refuse (45 secondes)

**Trade forcé**

- Coût : 3× le prix de base de la propriété ciblée
- Impossible à refuser
- Conditions : le forceur n'a pas de monopole actif sur ce groupe + la propriété ciblée n'a pas de bâtiment
- Le joueur forcé reçoit une **immunité de 2 tours** sur cette case
- Rompt automatiquement toute alliance entre les deux joueurs

### 6. Alliances secrètes

- Formation : libre à tout moment, message privé via l'UI
- Avantage : immunité mutuelle (0 loyer entre alliés)
- Max alliances actives : 1 pour 2-3j / 2 pour 4-8j
- Rupture : publique et révélée à tous avec nombre de tours d'alliance
- Former une nouvelle alliance rompt l'ancienne automatiquement

**Cartes alliance dans le Courrier du Jour :**

- 🎉 _Indic_ — apprend secrètement une alliance active (révélé publiquement que tu sais, pas ce que tu sais)
- 🎉 _Rumeur_ — un joueur choisi doit dire publiquement s'il est allié (oui/non, sans dire avec qui)

---

## Deck Courrier du Jour (30 cartes)

### Négatif (15 cartes)

| Carte                         | Effet                                                |
| ----------------------------- | ---------------------------------------------------- |
| Redressement fiscal           | -130€                                                |
| PV stationnement              | -135€                                                |
| Panne chaudière               | -250€                                                |
| Arnaque site petites annonces | -150€                                                |
| Loyers en baisse              | -10% loyers pendant 2 tours (global)                 |
| Travaux copropriété           | -100€ × nombre de bâtiments                          |
| Dégât des eaux                | -200€                                                |
| Convocation à l'Agence        | Aller directement en case L'Agence                   |
| Grève surprise                | Skip le prochain tour                                |
| Coloc parti sans prévenir     | Perd 1 niveau de bâtiment sur sa prop la moins chère |
| Litige voisins                | Le joueur le plus riche te prend 200€                |
| Voiture en panne              | Perd sa voiture + paye 200€                          |
| Inspection sanitaire          | -80€ × nombre de bâtiments                           |
| Facture impayée               | -180€                                                |
| Contrôle URSSAF               | -8% du cash actuel                                   |

### Positif (15 cartes)

| Carte                              | Effet                                            |
| ---------------------------------- | ------------------------------------------------ |
| Remboursement sécu                 | +180€                                            |
| Prime allocations                  | +120€                                            |
| Vente appli de revente             | +200€                                            |
| Héritage oncle de province         | +300€                                            |
| Héritage surprise                  | +100€ de chaque joueur                           |
| Airbnb cartonne                    | +50€ × nombre de propriétés                      |
| Procès gagné contre ancien proprio | +400€                                            |
| Coup de pouce familial             | +250€                                            |
| Subvention mairie                  | Prochaine construction à -50%                    |
| Subvention nightlife               | Prochaine boîte de nuit à -50%                   |
| Locataires paient en avance        | Encaisse tous tes loyers du tour                 |
| Boom immobilier                    | +20% loyers pendant 1 tour (global)              |
| Coloc paie ses charges             | +150€                                            |
| Airbnb weekend                     | +80€ × nombre de propriétés                      |
| Indic                              | Apprend secrètement une alliance active          |
| Rumeur                             | Un joueur choisi révèle s'il est allié (oui/non) |

_(16 cartes positives — ajuster en retirant 1 au besoin)_

---

## Architecture Socket.IO

### Client → Serveur

```
join_room           { roomId, playerName }
start_game          { roomId }
roll_dice           { roomId, playerId }
buy_property        { roomId, playerId, propertyId }
buy_coloc           { roomId, player1Id, player2Id, propertyId }
leave_coloc         { roomId, playerId, propertyId }
coloc_offer         { roomId, playerId, amount }
coloc_accept        { roomId, playerId }
build               { roomId, playerId, propertyId, buildingType }
propose_trade       { roomId, fromId, toId, offer: { cash, propertyId? } }
accept_trade        { roomId, tradeId }
refuse_trade        { roomId, tradeId }
force_trade         { roomId, fromId, propertyId }
propose_alliance    { roomId, fromId, toId }
accept_alliance     { roomId, allianceId }
break_alliance      { roomId, playerId }
end_turn            { roomId, playerId }
```

### Serveur → Client

```
room_updated        { room }
game_started        { gameState }
game_updated        { gameState }
dice_rolled         { values, total, playerId }
event_card_drawn    { card, playerId }
transport_strike    { active }
day_night_changed   { isNight }
trade_proposed      { tradeId, from, to, offer }
trade_result        { tradeId, accepted }
force_trade_done    { fromId, toId, propertyId, price }
alliance_proposed   { allianceId, fromId, toId }
alliance_formed     { allianceId, p1, p2 } // privé aux deux joueurs
alliance_broken     { p1, p2, turnsDuration, initiator } // public
coloc_negotiation   { propertyId, initiator, timeLeft }
auction_started     { propertyId, currentBid, bidder }
player_eliminated   { playerId }
game_over           { winner, reason }
```

---

## Condition de victoire

- **Dominance** : valeur nette ≥ 4× la moyenne des autres joueurs (activée après le tour 15)
- **Dernier survivant** : tous les autres joueurs éliminés
- **Limite de temps** : après 50 tours, le joueur avec la plus haute valeur nette gagne

**Mode survie** : un joueur à 0€ ne sort pas immédiatement — il reçoit toujours les loyers de ses propriétés et les +300€ de Fin de mois. Éliminé définitivement seulement s'il ne peut plus rembourser une dette après hypothèque de tout.

---

## Design & UI

**Ton visuel** : Satirique, coloré, légèrement absurde. Affiches administratives françaises années 80.

- Police : bold et bureaucratique (ex: **Bebas Neue**, **Anton**)
- Palette : Bleu-blanc-rouge détourné, pas patriotique — administratif/absurde
- Plateau : Vue de dessus, cases rectangulaires sur le périmètre, centre vide avec logo
- Indicateur jour/nuit visible en permanence 🌞 / 🌙
- Pions : Avatars colorés simples

---

## Todo List v1 (ordre recommandé)

### Phase 1 — Setup

- [ ] Init Next.js 14 + Prisma + PostgreSQL
- [ ] Serveur Socket.IO custom (`server/index.js`)
- [ ] Modèles Prisma : Room, Player
- [ ] API : créer une room, rejoindre avec un code

### Phase 2 — Lobby

- [ ] Page d'accueil : créer / rejoindre
- [ ] Page lobby : liste joueurs, bouton démarrer
- [ ] Sélection automatique du plateau selon nb joueurs

### Phase 3 — Moteur de jeu (`game-engine.js`)

- [ ] Initialiser gameState (3 configs plateau)
- [ ] `rollDice()` → déplacer joueur
- [ ] `processLanding(playerId, caseIndex)` → action selon case
- [ ] `buyProperty()`, `build()`, `calculateRent()`
- [ ] `drawEventCard()` → deck 30 cartes
- [ ] `checkTransportStrike()` → 8% probabilité
- [ ] `updateDayNight()` → cycle 4 tours
- [ ] `endTurn()` → joueur suivant
- [ ] `checkVictory()` → 3 conditions

### Phase 4 — Mécaniques custom

- [ ] **Colocation** : achat conjoint, modal négociation, enchères
- [ ] **Trades** : volontaire (modal 45s) + forcé (automatique avec immunité)
- [ ] **Alliances secrètes** : formation privée, rupture publique, immunité mutuelle
- [ ] **Boîte de nuit** : choix au moment de construire, cycle jour/nuit
- [ ] **Grève des transports** : event global, blocage sans voiture

### Phase 5 — UI plateau

- [ ] `Board.jsx` : périmètre 40/60/80 cases selon config
- [ ] `PlayerToken.jsx` : déplacement animé
- [ ] `PropertyCard.jsx` : infos au survol
- [ ] `EventCard.jsx` : animation retournement
- [ ] `TradeModal.jsx` : proposition + timer 45s
- [ ] `ColocModal.jsx` : négociation + timer 60s
- [ ] `AllianceModal.jsx` : formation secrète, révélation publique

### Phase 6 — Polish

- [ ] Gestion déconnexion joueur
- [ ] Écran fin de partie + historique alliances/trahisons
- [ ] Responsive mobile

---

## Contraintes importantes

- **Logique 100% côté serveur** — le client reçoit uniquement le gameState mis à jour
- **gameState sérialisé en JSON** dans PostgreSQL à chaque action (reconnexion possible)
- **Code en JavaScript** (pas TypeScript)
- Commencer par faire tourner 1 joueur seul avant d'attaquer le multijoueur
