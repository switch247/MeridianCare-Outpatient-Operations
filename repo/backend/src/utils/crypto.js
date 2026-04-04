const crypto = require('crypto');
function deriveKey(secret) { return crypto.createHash('sha256').update(secret).digest(); }
function encryptBuffer(buffer, secret) {
  const iv = crypto.randomBytes(16);
  const key = deriveKey(secret);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(buffer)), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}
function encrypt(text, secret) {
  return encryptBuffer(Buffer.from(String(text), 'utf8'), secret);
}
function decrypt(payload, secret) {
  const [ivHex, encryptedHex] = String(payload || '').split(':');
  if (!ivHex || !encryptedHex) {
    throw new Error('Invalid encrypted payload format');
  }
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const key = deriveKey(secret);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
module.exports = { encrypt, encryptBuffer, decrypt };
