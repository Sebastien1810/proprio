import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { PION_COLORS } from '../../../../lib/constants';

// POST /api/rooms/join — rejoindre une room par code
export async function POST(request) {
  try {
    const { playerName, code } = await request.json();

    if (!playerName || playerName.trim().length < 1) {
      return NextResponse.json({ error: 'Le nom du joueur est requis' }, { status: 400 });
    }
    if (!code || code.trim().length !== 4) {
      return NextResponse.json({ error: 'Code invalide (4 lettres)' }, { status: 400 });
    }

    const room = await prisma.room.findUnique({
      where: { code: code.toUpperCase().trim() },
      include: { players: true },
    });

    if (!room)                    return NextResponse.json({ error: 'Room introuvable — vérifie le code' }, { status: 404 });
    if (room.status !== 'waiting') return NextResponse.json({ error: 'La partie est déjà en cours' }, { status: 409 });
    if (room.players.length >= 8) return NextResponse.json({ error: 'La room est complète (8 joueurs max)' }, { status: 409 });

    const usedColors = room.players.map(p => p.color);
    const color = PION_COLORS.find(c => !usedColors.includes(c)) ?? PION_COLORS[room.players.length % PION_COLORS.length];

    const player = await prisma.player.create({
      data: {
        name:   playerName.trim(),
        color,
        roomId: room.id,
      },
    });

    return NextResponse.json({ room, player }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/rooms/join]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
