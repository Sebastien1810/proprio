const crypto = require('crypto');

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sans I et O pour éviter confusion

function generateRoomCode() {
  let code = '';
  const bytes = crypto.randomBytes(4);
  for (let i = 0; i < 4; i++) {
    code += LETTERS[bytes[i] % LETTERS.length];
  }
  return code;
}

module.exports = { generateRoomCode };
