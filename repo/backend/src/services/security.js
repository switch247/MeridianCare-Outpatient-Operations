const bcrypt = require('bcryptjs');
async function hashPassword(password) { if (!password || password.length < 12) throw new Error('Password must be at least 12 characters'); return bcrypt.hash(password, 12); }
async function verifyPassword(password, hash) { return bcrypt.compare(password, hash); }
function isLocked(lockoutUntil) { return lockoutUntil && new Date(lockoutUntil) > new Date(); }
function isSessionExpiredByInactivity(lastActiveAt, inactivityMin) {
	if (!lastActiveAt) return true;
	return Date.now() - new Date(lastActiveAt).getTime() > inactivityMin * 60 * 1000;
}
module.exports = { hashPassword, verifyPassword, isLocked, isSessionExpiredByInactivity };
