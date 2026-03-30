const crypto = require('crypto');
function deriveKey(secret) { return crypto.createHash('sha256').update(secret).digest(); }
function encrypt(text, secret) {
  const iv = crypto.randomBytes(16);
  const key = deriveKey(secret);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}
module.exports = { encrypt };
