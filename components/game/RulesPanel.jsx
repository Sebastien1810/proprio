'use client';

import { useState } from 'react';

const TABS = [
  {
    id: 'general',
    icon: '🏠',
    label: 'Général',
    content: (
      <>
        <p className="text-gray-300 leading-relaxed mb-3">
          Proprio est un jeu de plateau satirique inspiré du Monopoly, ancré dans la vie française moderne.
          2 à 8 joueurs.
        </p>
        <pre className="bg-white/5 rounded-lg p-3 text-xs text-gray-300 whitespace-pre-wrap font-mono">{`Durée estimée :
2-3j → 30-45 min (40 cases, dés 1-6)
4-5j → 45-60 min (60 cases, dés 1-7)
6-8j → 1h-1h30  (80 cases, dés 1-8)

Argent de départ : 2 500€`}</pre>
      </>
    ),
  },
  {
    id: 'board',
    icon: '🗺️',
    label: 'Plateau',
    content: (
      <pre className="bg-white/5 rounded-lg p-3 text-xs text-gray-300 whitespace-pre-wrap font-mono">{`🏁 Fin de mois   +300€ passage / +500€ exact
⚖️ L'Agence      Bloqué 2 tours · 200€ ou double
🚗 Parking       Voiture 250€ ou cagnotte
📬 Courrier      Carte à effet immédiat
💸 Taxes         130-250€ selon l'impôt
🚉 Transports    Achetables 150€, péage 100€

Double → rejoue
3× double → L'Agence`}</pre>
    ),
  },
  {
    id: 'build',
    icon: '🏗️',
    label: 'Construire',
    content: (
      <pre className="bg-white/5 rounded-lg p-3 text-xs text-gray-300 whitespace-pre-wrap font-mono">{`Studio → Appart → Immeuble → Boîte nuit

1 prop     → Studio max
2-3 props  → Appartement max
4+  props  → Immeuble possible
Monopole   → Boîte de nuit

Coûts : Studio 50% · Appart 75%
        Immeuble 100% · Boîte 120%

Hypothèque : 50% du prix
Lever : 60% du prix`}</pre>
    ),
  },
  {
    id: 'trades',
    icon: '🤝',
    label: 'Trades',
    content: (
      <pre className="bg-white/5 rounded-lg p-3 text-xs text-gray-300 whitespace-pre-wrap font-mono">{`VOLONTAIRE
Cash + prop optionnelle · 45s

FORCÉ — 3× le prix · Inévitable
Conditions : pas de monopole,
prop sans bâtiment

ENCHÈRES — si refus d'achat
30s · ouvert à tous`}</pre>
    ),
  },
  {
    id: 'alliances',
    icon: '🤫',
    label: 'Alliances',
    content: (
      <pre className="bg-white/5 rounded-lg p-3 text-xs text-gray-300 whitespace-pre-wrap font-mono">{`Formation secrète
Avantage : loyer = 0€ entre alliés
Max : 1 (2-3j) / 2 (4-8j)

Rupture : toujours publique
(durée + initiateur révélés)

Indic : apprendre une alliance
Rumeur : demander à un joueur`}</pre>
    ),
  },
  {
    id: 'cards',
    icon: '📬',
    label: 'Cartes',
    content: (
      <>
        <p className="text-gray-400 text-xs mb-2">Victoire</p>
        <pre className="bg-white/5 rounded-lg p-3 text-xs text-gray-300 whitespace-pre-wrap font-mono mb-3">{`DOMINANCE    valeur nette ≥ 4× moy. (>tour 15)
DERNIER      tous éliminés
LIMITE       meilleure valeur après 50 tours`}</pre>
        <p className="text-gray-400 text-xs mb-2">Cycle Jour / Nuit</p>
        <pre className="bg-white/5 rounded-lg p-3 text-xs text-gray-300 whitespace-pre-wrap font-mono">{`Alterne toutes les 4 tours ☀️ 🌙
Boîtes de nuit : loyer élevé la nuit,
0€ le jour`}</pre>
      </>
    ),
  },
];

export default function RulesPanel({ activeModals = {} }) {
  const [open,    setOpen]    = useState(false);
  const [tabId,   setTabId]   = useState('general');

  const anyModal = Object.values(activeModals).some(Boolean);

  const tab = TABS.find(t => t.id === tabId) ?? TABS[0];

  return (
    <>
      {/* Bouton ? */}
      {!anyModal && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Règles du jeu"
          className="fixed bottom-6 right-6 z-50 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-lg flex items-center justify-center shadow-lg transition"
          data-testid="rules-btn"
        >
          ?
        </button>
      )}

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Panneau */}
      <div
        className="fixed top-0 right-0 h-full z-[61] w-[380px] flex flex-col bg-[#16213e] border-l border-white/10 shadow-2xl"
        style={{
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <span className="text-white font-bold text-base">Règles du jeu</span>
          <button
            onClick={() => setOpen(false)}
            className="text-gray-400 hover:text-white transition text-xl leading-none"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Onglets */}
        <div className="flex border-b border-white/10 overflow-x-auto shrink-0">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTabId(t.id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-2.5 text-xs font-medium shrink-0 transition border-b-2 ${
                tabId === t.id
                  ? 'border-red-500 text-white'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              <span className="text-base">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto px-5 py-4 text-sm">
          {tab.content}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10">
          <a
            href="/rules"
            target="_blank"
            rel="noopener noreferrer"
            className="text-red-400 hover:text-red-300 text-sm transition flex items-center gap-1"
          >
            Voir le guide complet →
          </a>
        </div>
      </div>
    </>
  );
}
