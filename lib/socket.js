'use client';

import { io } from 'socket.io-client';

let socket;

export function getSocket() {
  if (!socket) {
    socket = io({
      path: '/socket.io',
      autoConnect: false,
    });
  }
  return socket;
}
