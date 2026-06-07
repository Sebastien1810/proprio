'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate() {
    if (!playerName.trim()) return setError('Saisis ton prénom pour jouer');
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: playerName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur serveur');
      router.push(`/lobby/${data.room.id}?playerId=${data.player.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!playerName.trim()) return setError('Saisis ton prénom pour jouer');
    if (!joinCode.trim()) return setError('Saisis le code de la room');
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: playerName.trim(), code: joinCode.toUpperCase().trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur serveur');
      router.push(`/lobby/${data.room.id}?playerId=${data.player.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-6xl font-black text-proprio-gold tracking-tight">PROPRIO</h1>
          <p className="text-gray-400 mt-2 text-sm">Le Monopoly à la française — 2 à 8 joueurs</p>
        </div>

        {/* Card */}
        <div className="bg-proprio-card rounded-2xl p-8 shadow-2xl border border-white/10">
          {/* Nom */}
          <div className="mb-6">
            <label className="block text-xs text-gray-400 uppercase tracking-widest mb-2">Ton prénom</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Ex : Marie"
              maxLength={20}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-proprio-gold transition"
            />
          </div>

          {/* Créer */}
          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full bg-proprio-accent hover:bg-red-600 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition mb-4"
          >
            {loading ? '...' : 'Créer une partie'}
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-gray-500">ou rejoindre</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Rejoindre */}
          <div className="flex gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="CODE"
              maxLength={4}
              className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-500 uppercase tracking-widest text-center focus:outline-none focus:border-proprio-gold transition"
            />
            <button
              onClick={handleJoin}
              disabled={loading}
              className="bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-lg transition"
            >
              Go
            </button>
          </div>

          {error && (
            <p className="mt-4 text-proprio-accent text-sm text-center">{error}</p>
          )}
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          Satirique · Pas de vraies marques · 100% fiction
        </p>
      </div>
    </main>
  );
}
