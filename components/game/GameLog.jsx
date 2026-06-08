'use client';

import { useState, useMemo } from 'react';

const TYPE_META = {
  // Engine types
  buy:               { label: 'Achat',        color: '#00FFC8', filter: 'buy'   },
  rent:              { label: 'Loyer',         color: '#FF2D78', filter: 'rent'  },
  tax:               { label: 'Taxe',          color: '#FF3B3B', filter: 'event' },
  roll:              { label: 'Dés',           color: 'rgba(255,255,255,0.35)', filter: 'other' },
  build:             { label: 'Construction',  color: '#A855F7', filter: 'build' },
  sell_building:     { label: 'Vente',         color: '#A855F7', filter: 'build' },
  mortgage:          { label: 'Hypothèque',    color: '#FF6B2B', filter: 'other' },
  unmortgage:        { label: 'Levée hypo.',   color: '#00FFC8', filter: 'other' },
  day_night_change:  { label: 'Jour/Nuit',     color: '#FFE600', filter: 'other' },
  strike_change:     { label: 'Grève',         color: '#FF6B2B', filter: 'event' },
  alliance_formed:   { label: 'Alliance',      color: '#00B4FF', filter: 'other' },
  alliance_broken:   { label: 'Alliance',      color: '#9CA3AF', filter: 'other' },
  jail_escape_double:{ label: 'Libéré',        color: '#00FFC8', filter: 'other' },
  jail_triple_double:{ label: 'Prison',        color: '#FF6B2B', filter: 'other' },
  pass_go:           { label: 'Fin de mois',   color: '#00FFC8', filter: 'event' },
  parking_collect:   { label: 'Parking',       color: '#60A5FA', filter: 'event' },
  bankrupt:          { label: 'Faillite',      color: '#FF3B3B', filter: 'event' },
  buy_coloc:         { label: 'Colocation',    color: '#00FFC8', filter: 'buy'   },
  force_trade:       { label: 'Trade forcé',   color: '#FFE600', filter: 'other' },
  event:             { label: 'Événement',     color: '#F59E0B', filter: 'event' },
  event_card:        { label: 'Événement',     color: '#F59E0B', filter: 'event' },
  // Legacy aliases (old server versions)
  buy_property:      { label: 'Achat',         color: '#00FFC8', filter: 'buy'   },
  pay_rent:          { label: 'Loyer',         color: '#FF2D78', filter: 'rent'  },
  pay_rent_night:    { label: 'Loyer nuit',    color: '#FF2D78', filter: 'rent'  },
  tax_paid:          { label: 'Taxe',          color: '#FF3B3B', filter: 'event' },
};

const HIDDEN_TYPES = new Set(['voluntary', 'jail_wait', 'trade_accepted']);

const BUILD_LABELS = {
  studio:    'studio',
  appart:    'appartement',
  immeuble:  'immeuble',
  nightclub: 'boîte de nuit',
};

const FILTERS = [
  { id: 'all',   label: 'Tout'    },
  { id: 'buy',   label: 'Achats'  },
  { id: 'rent',  label: 'Loyers'  },
  { id: 'event', label: 'Events'  },
];

function formatEntry(entry, players, board) {
  const p     = players?.find(pl => pl.id === entry.playerId);
  const name  = p?.name  ?? (entry.playerId ? entry.playerId.slice(0, 8) : '?');
  const color = p?.color ?? '#fff';
  const pion  = p?.pion?.emoji ?? '●';

  const propName = () => {
    const sq = board?.find(s => s.id === (entry.propId ?? entry.propertyId));
    return sq?.name ?? entry.propertyName ?? '';
  };
  const ownerName = () => {
    const owner = players?.find(pl => pl.id === (entry.ownerId ?? entry.owner));
    return owner?.name ?? entry.ownerName ?? '?';
  };

  switch (entry.type) {
    case 'buy':
    case 'buy_property':
      return { name, color, pion,
        desc:   `achète ${propName()}`,
        amount: entry.price ? `-${entry.price}€` : '' };

    case 'rent':
    case 'pay_rent':
    case 'pay_rent_night': {
      const amt = entry.amount;
      return { name, color, pion,
        desc:   `paie ${amt ?? '?'}€ de loyer à ${ownerName()}`,
        amount: amt ? `-${amt}€` : '' };
    }

    case 'tax':
    case 'tax_paid':
      return { name, color, pion,
        desc:   'paie une taxe',
        amount: entry.amount ? `-${entry.amount}€` : '' };

    case 'roll': {
      const [d1 = 0, d2 = 0] = entry.diceValues ?? [];
      return { name, color, pion,
        desc:   `lance les dés — ${d1} + ${d2} = ${d1 + d2}`,
        amount: '' };
    }

    case 'build':
      return { name, color, pion,
        desc:   `construit ${BUILD_LABELS[entry.buildingType] ?? entry.buildingType ?? ''} sur ${propName()}`,
        amount: entry.cost ? `-${entry.cost}€` : '' };

    case 'sell_building':
      return { name, color, pion,
        desc:   `vend bâtiment sur ${propName()}`,
        amount: entry.cashReceived ? `+${entry.cashReceived}€` : '' };

    case 'mortgage':
      return { name, color, pion,
        desc:   `hypothèque ${propName()}`,
        amount: entry.cashReceived ? `+${entry.cashReceived}€` : '' };

    case 'unmortgage':
      return { name, color, pion,
        desc:   `lève l'hypothèque de ${propName()}`,
        amount: entry.cashPaid ? `-${entry.cashPaid}€` : '' };

    case 'strike_change':
      return { name: 'Transports', color: '#FF6B2B', pion: '🚇',
        desc:   entry.active ? 'Grève des transports active' : 'Grève terminée',
        amount: '' };

    case 'pass_go':
      return { name, color, pion,
        desc:   'passe la case Fin de mois',
        amount: entry.amount ? `+${entry.amount}€` : '+300€' };

    case 'parking_collect':
      return { name, color, pion,
        desc:   'récupère la cagnotte du parking',
        amount: entry.amount ? `+${entry.amount}€` : '' };

    case 'bankrupt':
      return { name, color, pion, desc: 'est éliminé', amount: '' };

    case 'day_night_change':
      return {
        name:   entry.isNight ? 'Nuit' : 'Jour',
        color:  '#FFE600',
        pion:   entry.isNight ? '🌙' : '☀️',
        desc:   entry.isNight ? 'Les boîtes de nuit ouvrent' : 'Le jour se lève',
        amount: '',
      };

    case 'alliance_formed': {
      const p1 = players?.find(pl => pl.id === entry.p1);
      const p2 = players?.find(pl => pl.id === entry.p2);
      return { name: 'Alliance', color: '#00B4FF', pion: '🤝',
        desc: `${p1?.name ?? '?'} & ${p2?.name ?? '?'}`, amount: '' };
    }

    case 'alliance_broken': {
      const al = entry.alliance ?? entry;
      const p1 = players?.find(pl => pl.id === al.p1);
      const p2 = players?.find(pl => pl.id === al.p2);
      return { name: 'Alliance', color: '#9CA3AF', pion: '💔',
        desc: `${p1?.name ?? '?'} & ${p2?.name ?? '?'} — rompue`, amount: '' };
    }

    case 'jail_escape_double':
      return { name, color, pion, desc: 'libéré de prison (double)', amount: '' };

    case 'jail_triple_double':
      return { name, color, pion, desc: 'envoyé en prison (triple double)', amount: '' };

    case 'buy_coloc': {
      const partner = players?.find(pl => pl.id === entry.player2Id);
      return { name, color, pion,
        desc: `colocation avec ${partner?.name ?? '?'} sur ${propName()}`,
        amount: '' };
    }

    case 'force_trade': {
      const from = players?.find(pl => pl.id === entry.fromId);
      const to   = players?.find(pl => pl.id === entry.toId);
      const sq   = board?.find(s => s.id === entry.propId);
      return {
        name:   from?.name ?? name,
        color:  from?.color ?? color,
        pion:   from?.pion?.emoji ?? pion,
        desc:   `trade forcé : ${sq?.name ?? ''} à ${to?.name ?? '?'}`,
        amount: entry.cost ? `-${entry.cost}€` : '',
      };
    }

    case 'event':
    case 'event_card':
      return { name, color, pion,
        desc: entry.description ?? 'carte événement', amount: '' };

    default:
      return { name, color, pion, desc: entry.type ?? '', amount: '' };
  }
}

export default function GameLog({ gameState, isOpen, onClose }) {
  const [filter, setFilter] = useState('all');

  const players = gameState?.players ?? [];
  const board   = gameState?.board   ?? [];

  const logs = useMemo(() => {
    const raw = (gameState?.log ?? []).filter(e => !HIDDEN_TYPES.has(e.type));
    const filtered = filter === 'all'
      ? raw
      : raw.filter(e => (TYPE_META[e.type]?.filter ?? 'other') === filter);
    return [...filtered].reverse();
  }, [gameState?.log, filter]);

  const recent3 = new Set([0, 1, 2]);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={onClose}
        />
      )}

      <div
        className="fixed right-0 top-0 h-full z-50 flex flex-col"
        style={{
          width:      260,
          background: '#0d0e1a',
          borderLeft: '1px solid rgba(255,255,255,0.06)',
          transform:  isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2">
            <span className="font-bebas tracking-wider text-white text-lg">FIL DU JEU</span>
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: '#00ffc8', boxShadow: '0 0 6px #00ffc8', animation: 'pulse-dot 1.4s ease-in-out infinite' }}
            />
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg transition">✕</button>
        </div>

        {/* Log list */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
          {logs.length === 0 && (
            <p className="text-center text-xs py-8" style={{ color: 'rgba(255,255,255,0.2)' }}>
              Aucune action pour l'instant
            </p>
          )}
          {logs.map((entry, i) => {
            const meta        = TYPE_META[entry.type];
            const borderColor = meta?.color ?? 'rgba(255,255,255,0.2)';
            const fmt         = formatEntry(entry, players, board);
            const isRecent    = recent3.has(i);
            return (
              <div
                key={i}
                className="rounded-lg px-3 py-2 flex items-start gap-2"
                style={{
                  background:  isRecent ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                  borderLeft:  `2px solid ${borderColor}`,
                }}
              >
                <span className="text-sm flex-shrink-0" style={{ lineHeight: '1.2' }}>{fmt.pion}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="text-xs font-semibold truncate" style={{ color: fmt.color }}>
                      {fmt.name}
                    </span>
                    {entry.turn !== undefined && (
                      <span className="text-xs flex-shrink-0" style={{ color: 'rgba(255,255,255,0.2)' }}>
                        T{entry.turn + 1}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.45)' }}>
                      {fmt.desc}
                    </span>
                    {fmt.amount && (
                      <span className="text-xs font-bebas flex-shrink-0" style={{ color: borderColor }}>
                        {fmt.amount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Filters */}
        <div className="px-3 py-2 flex gap-1"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className="flex-1 text-xs py-1.5 rounded-lg transition"
              style={{
                background: filter === f.id ? 'rgba(0,255,200,0.15)' : 'rgba(255,255,255,0.04)',
                color:      filter === f.id ? '#00ffc8' : 'rgba(255,255,255,0.4)',
                border:     filter === f.id ? '1px solid rgba(0,255,200,0.3)' : '1px solid transparent',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
