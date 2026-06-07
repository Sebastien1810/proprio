'use strict';
/**
 * Serveur de test minimal pour Phase 4.
 * Lance uniquement Socket.IO sans Next.js (démarrage rapide).
 *
 * Usage : node tests/phase4-server.js
 */

require('dotenv').config();
const { createServer } = require('http');
const { Server }       = require('socket.io');
const { attachHandlers } = require('../server/index');

const TEST_PORT = parseInt(process.env.TEST_PORT || '3099', 10);

// On remplace app.prepare().then(...) en important uniquement attachHandlers
const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

attachHandlers(io);

httpServer.listen(TEST_PORT, () => {
  console.log(`[TEST SERVER] Prêt sur http://localhost:${TEST_PORT}`);
});
