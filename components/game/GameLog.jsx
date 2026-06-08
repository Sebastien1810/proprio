'use client';

import { useState, useMemo } from 'react';

const TYPE_META = {
  buy_property:    { label: 'Achat',        color: '#00FFC8', filter: 'buy'    },
  pay_rent:        { label: 'Loyer',         color: '#FF2D78', filter: 'rent'   },
  pay_rent_night:  { label: 'Loyer nuit',    color: '#FF2D78', filter: 'rent'   },
  build:           { label: 'Construction',  color: '#A855F7', filter: 'build'  },
  event:           { label: 'Événement',     color: '#F59E0B', filter: 'event'  },
  event_card:      { label: 'Événement',     color: '#F59E0B', filter: 'event'  },
  tax_paid:        { label: 'Taxe',          color: '#FF3B3B', filter: 'event'  },
  alliance_formed: { label: 'Alliance',      color: '#00B4FF', filter: 'other'  },
  alliance_broken: { label: 'Alliance',      color: '#00B4FF', filter: 'other'  },
  day_night_change:{ label: 'Jour/Nuit',     color: '#FFE600', filter: 'other'  },
  jail_sent:       { label: 'Prison',        color: '#FF6B2B', filter: 'other'  },
  jail_escape_double:{ label: 'Libéré',      color: '#00FFC8', filter: 'other'  },
  sell_building:   { label: 'Vente',         color: '#A855F7', filter: 'build'  },
  mortgage:        { label: 'Hypothèque',    color: '#FF6B2B', filter: 'other'  },
  unmortgage:      { label: 'Levée hypo.',   color: '#00FFC8', filter: 'other'  },
};

const FILTERS = [
  { id: 'all',   label: 'Tout' },
  { id: 'buy',   label: 'Achats' },
  { id: 'rent',  label: 'Loyers' },
  { id: 'event', label: 'Events' },
];

function formatEntry(entry, players) {
  const p = players?.find(pl => pl.id === entry.playerId);
  const name = p?.name ?? entry.playerId ?? '?';
  const color = p?.color ?? '#fff';
  const pion  = p?.pion?.emoji ?? '●';

  switch (entry.type) {
    case 'buy_property':
      return { name, color, pion, desc: `achète ${entry.propertyName ?? ''}`, amount: entry.price ? `-${entry.price}€` : '' };
    case 'pay_rent':
    case 'pay_rent_night':
      return { name, color, pion, desc: `paye loyer à ${entry.ownerName ?? ''}`, amount: entry.amount ? `-${entry.amount}€` : '' };
    case 'build':
      return { name, color, pion, desc: `construit ${entry.buildingType ?? ''} sur ${entry.propertyName ?? ''}`, amount: '' };
    case 'sell_building':
      return { name, color, pion, desc: `vend bâtiment sur ${entry.propertyName ?? ''}`, amount: '' };
    case 'tax_paid':
      return { name, color, pion, desc: `paie taxe`, amount: entry.amount ? `-${entry.amount}€` : '' };
    case 'event':
    case 'event_card':
      return { name, color, pion, desc: entry.description ?? 'carte événement', amount: '' };
    case 'alliance_formed':
      return { name: 'Alliance', color: '#00B4FF', pion: '🤝', desc: `${entry.p1Name ?? ''} & ${entry.p2Name ?? ''}`, amount: '' };
    case 'alliance_broken':
      return { name: 'Alliance', color: '#00B4FF', pion: '💔', desc: `rompue`, amount: '' };
    case 'day_night_change':
      return { name: entry.isNight ? 'Nuit' : 'Jour', color: '#FFE600', pion: entry.isNight ? '🌙' : '☀️', desc: entry.isNight ? 'Les boîtes ouvrent' : 'Le jour se lève', amount: '' };
    case 'jail_sent':
      return { name, color, pion, desc: 'envoyé en prison', amount: '' };
    case 'jail_escape_double':
      return { name, color, pion, desc: 'libéré (double)', amount: '' };
    case 'mortgage':
      return { name, color, pion, desc: `hypothèque ${entry.propertyName ?? ''}`, amount: entry.amount ? `+${entry.amount}€` : '' };
    case 'unmortgage':
      return { name, color, pion, desc: `lève hypothèque ${entry.propertyName ?? ''}`, amount: entry.amount ? `-${entry.amount}€` : '' };
    default:
      return { name, color, pion, desc: entry.type ?? '', amount: '' };
  }
}

export default function GameLog({ gameState, isOpen, onClose }) {
  const [filter, setFilter] = useState('all');

  const logs = useMemo(() => {
    const raw = gameState?.log ?? [];
    const filtered = filter === 'all'
      ? raw
      : raw.filter(e => (TYPE_META[e.type]?.filter ?? 'other') === filter);
    return [...filtered].reverse();
  }, [gameState?.log, filter]);

  const players = gameState?.players ?? [];
  const recent3 = new Set(logs.slice(0, 3).map((_, i) => i));

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className="fixed right-0 top-0 h-full z-50 flex flex-col"
        style={{
          width: 260,
          background: '#0d0e1a',
          borderLeft: '1px solid rgba(255,255,255,0.06)',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
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
              style={{
                background: '#00ffc8',
                boxShadow: '0 0 6px #00ffc8',
                animation: 'pulse-dot 1.4s ease-in-out infinite',
              }}
            />
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-lg transition"
          >
            ✕
          </button>
        </div>

        {/* Log list */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
          {logs.length === 0 && (
            <p className="text-center text-xs py-8" style={{ color: 'rgba(255,255,255,0.2)' }}>
              Aucune action pour l'instant
            </p>
          )}
          {logs.map((entry, i) => {
            const meta = TYPE_META[entry.type];
            const borderColor = meta?.color ?? 'rgba(255,255,255,0.2)';
            const fmt  = formatEntry(entry, players);
            const isRecent = recent3.has(i);
            return (
              <div
                key={i}
                className="rounded-lg px-3 py-2 flex items-start gap-2"
                style={{
                  background:     isRecent ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                  borderLeft:     `2px solid ${borderColor}`,
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
                background:  filter === f.id ? 'rgba(0,255,200,0.15)' : 'rgba(255,255,255,0.04)',
                color:       filter === f.id ? '#00ffc8' : 'rgba(255,255,255,0.4)',
                border:      filter === f.id ? '1px solid rgba(0,255,200,0.3)' : '1px solid transparent',
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
