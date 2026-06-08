'use client';

const GROUP_COLORS = [
  '#7C3AED', '#0891B2', '#92400E', '#EA580C',
  '#DC2626', '#CA8A04', '#16A34A', '#2563EB',
];

export function getTileColor(sq) {
  if (!sq) return '#3D4558';
  switch (sq.type) {
    case 'prop':           return GROUP_COLORS[sq.group] ?? '#888';
    case 'transport':      return '#22C55E';
    case 'nightclub_spot': return '#8B5CF6';
    case 'event':          return '#F59E0B';
    case 'tax':            return '#EF4444';
    case 'start':          return '#2DD4BF';
    case 'jail':           return '#F97316';
    case 'parking':        return '#60A5FA';
    case 'free_parking':   return '#A3E635';
    default:               return '#3D4558';
  }
}

function darken(hex, amount) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, ((n >> 16) & 0xff) - amount);
  const g = Math.max(0, ((n >> 8)  & 0xff) - amount);
  const b = Math.max(0, (n         & 0xff) - amount);
  return `rgb(${r},${g},${b})`;
}

const CORNER_LABEL  = { start: '▶', jail: '⛓', parking: '🅿', free_parking: '🆓' };
const SPECIAL_LABEL = { event: '✉', tax: '🏛', transport: '🚇', nightclub_spot: '🌙' };
const BUILD_SQUARES = { studio: 1, appart: 2, immeuble: 3 };

function pts(arr) {
  return arr.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}

function OwnerPion({ cx, cy, player, r }) {
  return (
    <g style={{ pointerEvents: 'none' }}>
      <circle
        cx={cx} cy={cy} r={r}
        fill={player.color}
        stroke="rgba(255,255,255,0.45)"
        strokeWidth={1.2}
        style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.55))' }}
      />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={r * 1.15}>
        {player.pion?.emoji ?? '●'}
      </text>
    </g>
  );
}

export default function IsoTile({ sq, cx, cy, W, H, D, players, ownerPlayer, colocPlayers, isSelected, isNight, onClick }) {
  const base  = getTileColor(sq);
  const left  = darken(base, 45);
  const right = darken(base, 28);

  const top  = [cx,       cy - H / 2];
  const rt   = [cx + W/2, cy        ];
  const bot  = [cx,       cy + H / 2];
  const lft  = [cx - W/2, cy        ];

  const botD = [cx,       cy + H/2 + D];
  const lftD = [cx - W/2, cy + D      ];
  const rtD  = [cx + W/2, cy + D      ];

  const isCorner  = CORNER_LABEL[sq.type];
  const isSpecial = SPECIAL_LABEL[sq.type];

  // Taille de police et longueur du nom selon la largeur canonique de la tuile
  const nameFontSize  = W >= 70 ? 8 : W >= 50 ? 7 : 6;
  const priceFontSize = nameFontSize - 1;
  const maxChars      = W >= 70 ? 9 : W >= 50 ? 7 : 5;

  let label = '';
  const showNamePrice = ['prop', 'transport', 'nightclub_spot'].includes(sq.type);
  if (showNamePrice) {
    label = sq.name.split(/[\s\-']/)[0].slice(0, maxChars);
  } else if (isSpecial) {
    label = isSpecial;
  }

  // Border indicator
  const isColoc      = colocPlayers && colocPlayers.length >= 2;
  const borderGradId = `colocGrad-${sq.id}`;
  const borderStroke = sq.mortgaged
    ? 'rgb(239,68,68)'
    : isColoc
      ? `url(#${borderGradId})`
      : ownerPlayer
        ? ownerPlayer.color
        : null;

  const patternId  = `stripe-${sq.id}`;

  return (
    <g
      onClick={onClick}
      style={{ cursor: 'pointer', opacity: sq.mortgaged ? 0.55 : 1 }}
      data-sq-id={sq.id}
      data-sq-idx={sq.idx}
    >
      {(sq.mortgaged || isColoc) && (
        <defs>
          {sq.mortgaged && (
            <pattern id={patternId} patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(255,255,255,0.22)" strokeWidth="3" />
            </pattern>
          )}
          {isColoc && (
            <linearGradient id={borderGradId} gradientUnits="userSpaceOnUse"
              x1={cx - W / 2} y1={cy} x2={cx + W / 2} y2={cy}>
              <stop offset="0%"   stopColor={colocPlayers[0].color} />
              <stop offset="50%"  stopColor={colocPlayers[0].color} />
              <stop offset="50%"  stopColor={colocPlayers[1].color} />
              <stop offset="100%" stopColor={colocPlayers[1].color} />
            </linearGradient>
          )}
        </defs>
      )}

      {/* Left face */}
      <polygon points={pts([lft, lftD, botD, bot])} fill={left} />
      {/* Right face */}
      <polygon points={pts([rt, rtD, botD, bot])} fill={right} />
      {/* Top face */}
      <polygon
        points={pts([top, rt, bot, lft])}
        fill={base}
        stroke={isSelected ? '#f5a623' : 'rgba(0,0,0,0.25)'}
        strokeWidth={isSelected ? 1.5 : 0.5}
      />

      {/* Mortgage: stripes + dark overlay */}
      {sq.mortgaged && (
        <>
          <polygon points={pts([top, rt, bot, lft])} fill={`url(#${patternId})`} style={{ pointerEvents: 'none' }} />
          <polygon points={pts([top, rt, bot, lft])} fill="rgba(0,0,0,0.35)"    style={{ pointerEvents: 'none' }} />
        </>
      )}

      {/* Selection highlight */}
      {isSelected && (
        <polygon points={pts([top, rt, bot, lft])} fill="rgba(245,166,35,0.25)" style={{ pointerEvents: 'none' }} />
      )}

      {/* Owner border (liseré coloré) */}
      {borderStroke && (
        <polygon
          points={pts([top, rt, bot, lft])}
          fill="none"
          stroke={borderStroke}
          strokeWidth={3}
          strokeLinejoin="round"
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* Corner emoji */}
      {isCorner && (
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={H < 28 ? 10 : 13} style={{ pointerEvents: 'none' }}>
          {isCorner}
        </text>
      )}

      {/* Name label */}
      {label && (
        <text
          x={cx} y={showNamePrice && sq.price ? cy - priceFontSize * 0.7 : cy}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={nameFontSize + 1}
          fill="rgba(255,255,255,0.95)"
          style={{ pointerEvents: 'none', fontFamily: 'var(--font-bebas), Impact, sans-serif', letterSpacing: '0.06em' }}
        >
          {label}
        </text>
      )}

      {/* Price */}
      {showNamePrice && sq.price && (
        <text
          x={cx} y={label ? cy + nameFontSize * 0.85 : cy}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={priceFontSize}
          fill="rgba(255,255,255,0.65)"
          style={{ pointerEvents: 'none', fontFamily: 'var(--font-bebas), Impact, sans-serif', letterSpacing: '0.04em' }}
        >
          {sq.price}€
        </text>
      )}

      {/* Construction icons */}
      {ownerPlayer && sq.building && (() => {
        const iconY  = cy + H * 0.3;
        const color  = ownerPlayer.color;
        if (sq.building === 'nightclub') {
          return (
            <text x={cx} y={iconY} textAnchor="middle" dominantBaseline="middle"
              fontSize={Math.max(6, W * 0.12)} fill="#F0A500"
              style={{ pointerEvents: 'none' }}>
              🌙
              {isNight && <animate attributeName="opacity" values="1;0.25;1" dur="1.2s" repeatCount="indefinite" />}
            </text>
          );
        }
        const count = BUILD_SQUARES[sq.building] ?? 0;
        const sz    = Math.max(4, Math.min(6, W * 0.1));
        const gap   = 2;
        const total = count * sz + (count - 1) * gap;
        const x0    = cx - total / 2;
        return Array.from({ length: count }, (_, i) => (
          <rect key={i}
            x={x0 + i * (sz + gap)} y={iconY - sz / 2}
            width={sz} height={sz} rx={1}
            fill={color} opacity={0.9}
            style={{ pointerEvents: 'none' }}
          />
        ));
      })()}

      {/* Mortgage HYPO badge */}
      {sq.mortgaged && (
        <>
          <rect
            x={cx - W * 0.22} y={cy + H * 0.08}
            width={W * 0.44}   height={H * 0.32}
            rx={2}
            fill="rgba(239,68,68,0.88)"
            style={{ pointerEvents: 'none' }}
          />
          <text
            x={cx} y={cy + H * 0.24}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={Math.max(5, H * 0.18)}
            fill="#fff" fontWeight="bold"
            style={{ pointerEvents: 'none' }}
          >
            HYPO
          </text>
        </>
      )}

      {/* Player tokens (pions sur la case) — jusqu'à 8 joueurs */}
      {(() => {
        const visible = players.slice(0, 8);
        const n   = visible.length;
        const r   = n <= 3 ? 6 : n <= 5 ? 5 : 4;
        const gap = n > 1 ? Math.min((W * 0.38) / (n - 1), W / 5) : 0;
        const ty  = cy - H / 5;
        return visible.map((p, i) => {
          const tx = cx + (i - (n - 1) / 2) * gap;
          return (
            <g key={p.id} style={{ pointerEvents: 'none' }}>
              <circle cx={tx} cy={ty} r={r} fill={p.color} stroke="white" strokeWidth={0.8} />
              <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle" fontSize={r * 1.3}>
                {p.pion?.emoji ?? '●'}
              </text>
            </g>
          );
        });
      })()}
    </g>
  );
}
