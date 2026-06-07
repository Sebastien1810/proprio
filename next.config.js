/** @type {import('next').NextConfig} */
const nextConfig = {
  // Le serveur custom gère les requêtes — on désactive le serveur Next.js standalone
  // pour permettre l'intégration Socket.IO
};

module.exports = nextConfig;
