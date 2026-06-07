'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getSocket } from '../../../lib/socket';

export default function RoomPage({ params }) {
  const { code } = params;
  const searchParams = useSearchParams();
  const router = useRouter();
  const playerId = searchParams.get('playerId');

  const [room, setRoom] = useState(null);
  const [connected, setConnected] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!playerId) return;

    const socket = getSocket();

    socket.connect();

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('room:join', { roomCode: code, playerId });
    });

    socket.on('room:state', (data) => {
      setRoom(data);
    });

    socket.on('room:player_joined', ({ player }) => {
      setRoom((prev) => {
        if (!prev) return prev;
        const exists = prev.players.some((p) => p.id === player.id);
        if (exists) return prev;
        return { ...prev, players: [...prev.players, player] };
      });
    });

    socket.on('room:player_left', ({ playerId: leftId }) => {
      setRoom((prev) => {
        if (!prev) return prev;
        return { ...prev, players: prev.players.filter((p) => p.id !== leftId) };
      });
    });

    socket.on('game:started', ({ roomCode }) => {
      router.push(`/game/${roomCode}?playerId=${playerId}`);
    });

    socket.on('error', ({ message }) => {
      setError(message);
      setLaunching(false);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    return () => {
      socket.off('connect');
      socket.off('room:state');
      socket.off('room:player_joined');
      socket.off('room:player_left');
      socket.off('game:started');
      socket.off('error');
      socket.off('disconnect');
      socket.disconnect();
    };
  }, [code, playerId]);

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="bg-proprio-card rounded-2xl p-8 text-center">
          <p className="text-proprio-accent text-lg mb-4">{error}</p>
          <a href="/" className="text-gray-400 hover:text-white text-sm">← Retour à l'accueil</a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-proprio-gold">PROPRIO</h1>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="text-2xl font-mono font-bold tracking-widest text-white bg-white/10 px-4 py-1 rounded-lg">
              {code}
            </span>
            <span className={`text-xs px-2 py-1 rounded-full ${connected ? 'bg-green-900 text-green-400' : 'bg-yellow-900 text-yellow-400'}`}>
              {connected ? 'Connecté' : 'Connexion…'}
            </span>
          </div>
        </div>

        {/* Card lobby */}
        <div className="bg-proprio-card rounded-2xl p-8 border border-white/10">
          <h2 className="text-xs text-gray-400 uppercase tracking-widest mb-4">
            Joueurs ({room?.players?.length ?? 0}/8)
          </h2>

          {!room ? (
            <div className="text-center text-gray-500 py-8">Chargement…</div>
          ) : (
            <ul className="space-y-3">
              {room.players.map((player, i) => (
                <li key={player.id} className="flex items-center gap-3 bg-white/5 rounded-lg px-4 py-3">
                  <span
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: player.color }}
                  />
                  <span className="font-medium">{player.name}</span>
                  {i === 0 && (
                    <span className="ml-auto text-xs text-proprio-gold">Hôte</span>
                  )}
                  {player.id === playerId && (
                    <span className={`${i === 0 ? '' : 'ml-auto'} text-xs text-gray-500`}>
                      (toi)
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {room && room.players.length < 2 && (
            <p className="text-center text-gray-500 text-sm mt-6">
              En attente d'au moins 2 joueurs pour démarrer…
            </p>
          )}

          {room && room.players.length >= 2 && room.players[0]?.id === playerId && (
            <button
              className="w-full mt-6 bg-proprio-accent hover:bg-red-600 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition"
              disabled={launching}
              onClick={() => {
                setLaunching(true);
                getSocket().emit('game:start', { roomCode: code, playerId });
              }}
            >
              {launching ? 'Lancement…' : `Lancer la partie (${room.players.length} joueurs)`}
            </button>
          )}

          {room && room.players.length >= 2 && room.players[0]?.id !== playerId && (
            <p className="text-center text-gray-500 text-sm mt-6">
              En attente que l'hôte lance la partie…
            </p>
          )}
        </div>

        {/* Partage du code */}
        <p className="text-center text-gray-600 text-xs mt-4">
          Partage le code <strong className="text-gray-400">{code}</strong> à tes amis pour qu'ils rejoignent
        </p>
      </div>
    </main>
  );
}
