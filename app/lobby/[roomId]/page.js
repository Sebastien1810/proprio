'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getSocket } from '../../../lib/socket';
import MatrixBackground from '../../../components/MatrixBackground';

const PLAYER_COLORS = [
  '#00FFC8', '#FF2D78', '#A855F7', '#FF6B2B',
  '#00B4FF', '#FFE600', '#FF3B3B', '#7FFF00',
];

const PIONS = [
  { id: 0, emoji: '🏀', label: 'Ballon' },
  { id: 1, emoji: '✊', label: 'Poing' },
  { id: 2, emoji: '🐱', label: 'Chat' },
  { id: 3, emoji: '🐍', label: 'Serpent' },
  { id: 4, emoji: '🎮', label: 'Manette' },
  { id: 5, emoji: '👑', label: 'Couronne' },
  { id: 6, emoji: '⚡', label: 'Éclair' },
  { id: 7, emoji: '🎯', label: 'Cible' },
];

const BOARD_EMOJI  = { 40: '🏘️', 60: '🏙️', 80: '🌆' };
const BOARD_LABEL  = { 40: 'Petit', 60: 'Moyen', 80: 'Grand' };

function LobbyContent({ roomId }) {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const playerId     = searchParams.get('playerId');

  const [roomData,  setRoomData]  = useState(null);
  const [connected, setConnected] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error,     setError]     = useState('');

  const connectedPlayers = roomData?.players?.filter(p => p.connected) ?? [];
  const isHost           = roomData?.hostId === playerId;
  const canStart         = isHost && connectedPlayers.length >= 2;
  const lobbyPions       = roomData?.lobbyPions  ?? {};
  const lobbyColors      = roomData?.lobbyColors ?? {};
  const myPionId         = lobbyPions[playerId]  ?? null;
  const myColorId        = lobbyColors[playerId] ?? null;

  useEffect(() => {
    if (!playerId) return;

    const socket = getSocket();
    socket.connect();

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join_room', { roomId, playerId });
    });

    socket.on('room_updated', (data) => {
      setRoomData(data);
    });

    socket.on('game_started', ({ roomId: rid }) => {
      router.push(`/game/${rid}?playerId=${playerId}`);
    });

    socket.on('error', ({ message }) => {
      setError(message);
      setLaunching(false);
    });

    socket.on('disconnect',    () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));

    return () => {
      socket.off('connect');
      socket.off('room_updated');
      socket.off('game_started');
      socket.off('error');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.disconnect();
    };
  }, [roomId, playerId, router]);

  function handleStart() {
    setLaunching(true);
    setError('');
    getSocket().emit('start_game', { roomId });
  }

  function handlePickPion(pionId) {
    getSocket().emit('pick_pion', { roomId, playerId, pionId });
  }

  function handlePickColor(colorId) {
    getSocket().emit('pick_color', { roomId, playerId, colorId });
  }

  function isPionTakenByOther(pionId) {
    return Object.entries(lobbyPions).some(([pid, pid2]) => pid2 === pionId && pid !== playerId);
  }

  function isColorTakenByOther(colorId) {
    return Object.entries(lobbyColors).some(([pid, cid]) => cid === colorId && pid !== playerId);
  }

  if (!playerId) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center bg-proprio-card rounded-2xl p-8">
          <p className="text-gray-400 mb-4">Session invalide — le lien est incomplet.</p>
          <a href="/" className="text-proprio-gold hover:underline text-sm">← Retour à l'accueil</a>
        </div>
      </main>
    );
  }

  const boardSize = roomData?.boardInfo?.boardSize ?? 40;

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <MatrixBackground opacity={0.4} />
      <div className="w-full max-w-lg">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-proprio-gold mb-3">PROPRIO</h1>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <div className="bg-white/10 rounded-xl px-5 py-2 border border-white/20">
              <span className="text-xs text-gray-400 block mb-0.5">Code de la room</span>
              <span className="text-2xl font-mono font-black tracking-[0.3em] text-white">
                {roomData?.code ?? '----'}
              </span>
            </div>
            <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${
              connected
                ? 'bg-green-900/60 text-green-400'
                : 'bg-yellow-900/60 text-yellow-400'
            }`}>
              {connected ? '● En ligne' : '○ Connexion…'}
            </span>
          </div>
        </div>

        {/* ── Plateau sélectionné ───────────────────────────────────────── */}
        {roomData && (
          <div className="bg-white/5 rounded-xl px-5 py-3 border border-white/10 mb-4 flex items-center gap-4">
            <span className="text-3xl">{BOARD_EMOJI[boardSize]}</span>
            <div className="flex-1">
              <span className="text-xs text-gray-400 uppercase tracking-wider">Plateau sélectionné</span>
              <div className="text-white font-semibold mt-0.5">
                {BOARD_LABEL[boardSize]} — {boardSize} cases
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-gray-500 block">Dés</span>
              <span className="text-white font-mono font-bold">1 – {roomData.boardInfo.diceMax}</span>
            </div>
          </div>
        )}

        {/* ── Choix du pion ─────────────────────────────────────────────── */}
        <div className="bg-proprio-card rounded-2xl p-5 border border-white/10 mb-4">
          <h2 className="text-xs text-gray-400 uppercase tracking-widest mb-3">Ton pion</h2>
          <div className="grid grid-cols-4 gap-3 justify-items-center">
            {PIONS.map(pion => {
              const taken  = isPionTakenByOther(pion.id);
              const mine   = myPionId === pion.id;
              return (
                <button
                  key={pion.id}
                  onClick={() => !taken && handlePickPion(pion.id)}
                  disabled={taken}
                  title={pion.label}
                  className={`
                    w-16 h-16 rounded-xl text-3xl flex items-center justify-center
                    border-2 transition-all duration-150
                    ${mine
                      ? 'border-proprio-gold bg-proprio-gold/20 scale-110 shadow-lg shadow-proprio-gold/30'
                      : taken
                        ? 'border-white/10 opacity-30 cursor-not-allowed'
                        : 'border-white/20 hover:border-white/50 hover:bg-white/5 cursor-pointer'
                    }
                  `}
                  data-testid={`pion-${pion.id}`}
                >
                  {pion.emoji}
                </button>
              );
            })}
          </div>
          {myPionId !== null && (
            <p className="text-center text-xs text-gray-400 mt-2">
              Tu joues avec {PIONS[myPionId]?.emoji} {PIONS[myPionId]?.label}
            </p>
          )}

          {/* Color picker */}
          <h2 className="text-xs text-gray-400 uppercase tracking-widest mt-4 mb-3">Ta couleur</h2>
          <div className="grid grid-cols-8 gap-2">
            {PLAYER_COLORS.map((color, colorId) => {
              const taken = isColorTakenByOther(colorId);
              const mine  = myColorId === colorId;
              return (
                <button
                  key={colorId}
                  onClick={() => !taken && handlePickColor(colorId)}
                  disabled={taken}
                  title={color}
                  className={`w-8 h-8 rounded-full transition-all duration-150 ${
                    taken ? 'opacity-20 cursor-not-allowed' : 'hover:scale-110 cursor-pointer'
                  }`}
                  style={{
                    backgroundColor: color,
                    boxShadow: mine ? `0 0 0 2px #07080f, 0 0 0 4px ${color}` : 'none',
                    transform: mine ? 'scale(1.15)' : undefined,
                  }}
                />
              );
            })}
          </div>
          {myColorId !== null && (
            <p className="text-center text-xs text-gray-400 mt-2">
              Ta couleur : <span style={{ color: PLAYER_COLORS[myColorId] }}>●</span> {PLAYER_COLORS[myColorId]}
            </p>
          )}
        </div>

        {/* ── Liste des joueurs ─────────────────────────────────────────── */}
        <div className="bg-proprio-card rounded-2xl p-6 border border-white/10 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs text-gray-400 uppercase tracking-widest">
              Joueurs ({connectedPlayers.length}/8)
            </h2>
            {roomData && (
              <span className="text-xs text-gray-600">
                Code : <strong className="text-gray-400">{roomData.code}</strong>
              </span>
            )}
          </div>

          {!roomData ? (
            <div className="text-center text-gray-500 py-8">Connexion en cours…</div>
          ) : (
            <ul className="space-y-2">
              {roomData.players.map((player, i) => (
                <li
                  key={player.id}
                  className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-opacity
                    ${player.connected ? 'bg-white/5' : 'bg-white/5 opacity-40'}`}
                >
                  <span
                    className="w-5 h-5 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: player.color,
                      boxShadow: `0 0 8px ${player.color}80`,
                    }}
                  />
                  <span className="text-xl">{player.pionId !== null ? PIONS[player.pionId]?.emoji : '❔'}</span>
                  <span className="font-medium text-white">{player.name}</span>

                  <div className="ml-auto flex items-center gap-2">
                    {i === 0 && (
                      <span className="text-xs bg-proprio-gold/20 text-proprio-gold px-2 py-0.5 rounded-full">
                        Hôte
                      </span>
                    )}
                    {player.id === playerId && (
                      <span className="text-xs text-gray-500">(toi)</span>
                    )}
                    {!player.connected && (
                      <span className="text-xs text-gray-600 italic">hors ligne</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {roomData && connectedPlayers.length < 2 && (
            <p className="text-center text-gray-500 text-sm mt-5 italic">
              En attente d'au moins un autre joueur…
            </p>
          )}
        </div>

        {/* ── Erreur ───────────────────────────────────────────────────── */}
        {error && (
          <p className="text-center text-proprio-accent text-sm mb-4">{error}</p>
        )}

        {/* ── Bouton Démarrer ───────────────────────────────────────────── */}
        {isHost ? (
          <button
            onClick={handleStart}
            disabled={!canStart || launching}
            className="w-full bg-proprio-accent hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition text-lg"
          >
            {launching
              ? 'Redirection vers la partie…'
              : canStart
              ? `Démarrer — ${connectedPlayers.length} joueurs`
              : `Démarrer (${Math.max(0, 2 - connectedPlayers.length)} joueur${connectedPlayers.length < 1 ? 's' : ''} manquant)`
            }
          </button>
        ) : (
          <div className="text-center text-gray-500 text-sm py-4">
            En attente que l'hôte démarre la partie…
          </div>
        )}

        {/* ── Lien règles ───────────────────────────────────────────── */}
        <div className="text-center mt-5">
          <a
            href="/rules"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-gray-300 text-sm transition"
          >
            📖 Lire les règles du jeu
          </a>
        </div>

      </div>
    </main>
  );
}

export default function LobbyPage({ params }) {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Chargement du lobby…</p>
      </main>
    }>
      <LobbyContent roomId={params.roomId} />
    </Suspense>
  );
}
