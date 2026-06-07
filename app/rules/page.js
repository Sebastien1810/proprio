'use client';

import { useState } from 'react';
import Link from 'next/link';

const SECTIONS = [
  { id: 'overview',    label: "Vue d'ensemble" },
  { id: 'board',       label: 'Le plateau' },
  { id: 'economy',     label: 'Économie' },
  { id: 'build',       label: 'Construire' },
  { id: 'coloc',       label: 'Colocation' },
  { id: 'strike',      label: 'Grève transports' },
  { id: 'daynight',    label: 'Cycle Jour / Nuit' },
  { id: 'trades',      label: 'Trades' },
  { id: 'alliances',   label: 'Alliances secrètes' },
  { id: 'victory',     label: 'Conditions de victoire' },
];

function Section({ id, title, children }) {
  return (
    <section id={id} className="mb-12 scroll-mt-6">
      <h2 className="text-2xl font-bold text-white mb-4 pb-2 border-b border-white/10">{title}</h2>
      <div className="text-gray-300 space-y-3 leading-relaxed">{children}</div>
    </section>
  );
}

function Block({ children }) {
  return (
    <pre className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-gray-200 whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
      {children}
    </pre>
  );
}

export default function RulesPage() {
  const [active, setActive] = useState('overview');

  function scrollTo(id) {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-dark)', color: '#fff' }}>
      {/* Sidebar */}
      <aside className="w-60 shrink-0 sticky top-0 h-screen overflow-y-auto border-r border-white/10 bg-white/3 px-4 py-6">
        <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition text-sm mb-6">
          ← Retour
        </Link>
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-3 px-1">Sections</p>
        <nav className="space-y-1">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                active === s.id
                  ? 'bg-red-600/20 text-red-400 font-medium'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main
        className="flex-1 px-8 py-10 max-w-3xl"
        onScroll={e => {
          const el = e.currentTarget;
          for (const s of SECTIONS) {
            const sec = document.getElementById(s.id);
            if (sec && sec.offsetTop - el.scrollTop < 120) setActive(s.id);
          }
        }}
      >
        <h1 className="text-4xl font-black text-white mb-2">Règles du jeu</h1>
        <p className="text-gray-500 text-sm mb-10">Guide complet — Proprio</p>

        <Section id="overview" title="Vue d'ensemble">
          <p>
            Proprio est un jeu de plateau multijoueur satirique inspiré du Monopoly,
            ancré dans la vie française moderne. 2 à 8 joueurs.
          </p>
          <Block>{`Durée estimée :
  2-3 joueurs → 30-45 min   (plateau 40 cases, dés 1-6)
  4-5 joueurs → 45-60 min   (plateau 60 cases, dés 1-7)
  6-8 joueurs → 1h-1h30     (plateau 80 cases, dés 1-8)`}</Block>
        </Section>

        <Section id="board" title="Le plateau">
          <Block>{`Cases spéciales :
🏁 Fin de mois     +300€ passage / +500€ atterrissage exact
⚖️ L'Agence        Bloqué 2 tours. Sortie : 200€ ou double
🚗 Parking         Voiture 250€ ou encaisse la cagnotte
🏛️ Visiteur        Passage libre, aucun effet
📬 Courrier du jour Carte à effet immédiat
💸 Taxes           130€ / 160€ / 200€ / max(250€, 10% valeur nette)
🚉 Transports      Achetables 150€, péage 100€ par passage

Doubles :
  Double → tu rejoues immédiatement
  3 doubles consécutifs → direction L'Agence`}</Block>
        </Section>

        <Section id="economy" title="Économie">
          <p>Argent de départ : <strong className="text-white">2 500€</strong></p>
          <Block>{`Loyers :
                  Solo    Groupe (≥4/6 du quartier)
Propriété nue     10%     18%
Studio            16%     25%
Appartement       25%     35%
Immeuble          40%     52%
Boîte nuit (nuit) 60%     75%
Boîte nuit (jour)  0€      0€`}</Block>
        </Section>

        <Section id="build" title="Construire">
          <Block>{`Ordre : Studio → Appartement → Immeuble ou Boîte de nuit

Niveau max selon possession du quartier :
  1 prop     → Studio max
  2-3 props  → Appartement max
  4+ props   → Immeuble possible
  Monopole   → Boîte de nuit possible (cases éligibles uniquement)

Coûts : Studio 50% / Appart 75% / Immeuble 100% / Boîte 120%

Hypothèque : recevoir 50% du prix. Lever : payer 60%.
Propriété hypothéquée = loyer 0€.`}</Block>
        </Section>

        <Section id="coloc" title="Colocation">
          <Block>{`Achat conjoint : chacun paie 60% du prix (-20% chacun).
Loyers partagés 50/50.

Séparation : négociation 60 secondes → si pas d'accord → enchères.`}</Block>
        </Section>

        <Section id="strike" title="Grève des transports">
          <Block>{`8% de chance par tour. Bloque les joueurs sans voiture.
Voiture = 250€ sur la case Parking. Protection définitive.`}</Block>
        </Section>

        <Section id="daynight" title="Cycle Jour / Nuit">
          <Block>{`Alterne toutes les 4 tours. ☀️ → 🌙 → ☀️
Boîtes de nuit : loyer élevé la nuit, 0€ le jour.`}</Block>
        </Section>

        <Section id="trades" title="Trades">
          <Block>{`VOLONTAIRE : après atterrissage, avant fin de tour.
Cash obligatoire + propriété optionnelle. 45s pour répondre.

FORCÉ : 3× le prix. Impossible à refuser.
Conditions : pas de monopole sur ce groupe + prop sans bâtiment.
Joueur forcé → immunité 2 tours sur la case.
Rompt l'alliance si vous étiez alliés.

ENCHÈRES : si tu refuses d'acheter une prop libre → enchères
publiques 30s, ouvertes à tous.`}</Block>
        </Section>

        <Section id="alliances" title="Alliances secrètes">
          <Block>{`Formation secrète : personne ne voit la proposition ni l'acceptation.
Avantage : loyer = 0€ entre alliés.
Max : 1 alliance (2-3j) / 2 alliances (4-8j).

Rupture : TOUJOURS révélée publiquement avec durée + initiateur.
Former une nouvelle alliance rompt automatiquement l'ancienne.

Carte Indic : apprends secrètement une alliance active.
  Tout le monde voit que tu as tiré la carte, pas ce qu'elle t'a dit.
Carte Rumeur : un joueur choisi dit publiquement s'il est allié (oui/non).`}</Block>
        </Section>

        <Section id="victory" title="Conditions de victoire">
          <Block>{`1. DOMINANCE : valeur nette ≥ 4× la moyenne (après tour 15)
2. DERNIER SURVIVANT : tous les autres éliminés
3. LIMITE : après 50 tours, meilleure valeur nette gagne

Mode survie : à 0€ tu n'es pas éliminé immédiatement.
Tu perçois toujours tes loyers et +300€ de Fin de mois.
Élimination = impossible de rembourser après tout avoir hypothéqué.`}</Block>
        </Section>
      </main>
    </div>
  );
}
