const { PrismaClient } = require('@prisma/client');

// Singleton pour éviter de recréer le client à chaque hot-reload en dev
const globalForPrisma = global;

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

module.exports = prisma;
