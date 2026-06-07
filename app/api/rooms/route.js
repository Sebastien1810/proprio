import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { generateRoomCode } from '../../../lib/roomCode';
import { PION_COLORS } from '../../../lib/constants';

// POST /api/rooms — créer une room et y ajouter le premier joueur (l'hôte)
export async function POST(request) {
  try {
    const { playerName } = await request.json();

    if (!playerName || playerName.trim().length < 1) {
      return NextResponse.json({ error: 'Le nom du joueur est requis' }, { status: 400 });
    }

    // Générer un code unique (retry en cas de collision improbable)
    let code;
    let attempts = 0;
    do {
      code = generateRoomCode();
      attempts++;
      if (attempts > 10) throw new Error('Impossible de générer un code unique');
    } while (await prisma.room.findUnique({ where: { code } }));

    const room = await prisma.room.create({
      data: {
        code,
        status: 'waiting',
        gameState: {},
        players: {
          create: {
            name:  playerName.trim(),
            color: PION_COLORS[0],
          },
        },
      },
      include: { players: true },
    });

    return NextResponse.json({ room, player: room.players[0] }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/rooms]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
