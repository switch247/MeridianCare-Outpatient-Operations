function requiredEnv(name) {
  const value = process.env[name];
  const runningTests = process.env.NODE_ENV === 'test' || process.argv.join(' ').toLowerCase().includes('vitest');
  if (!value && !runningTests) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value || `${name.toLowerCase()}-test-default`;
}

const env = {
  PORT: Number(process.env.PORT || 13000),
  HOST: process.env.HOST || '0.0.0.0',
  DATABASE_URL: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/meridiancare-clinic',
  JWT_SECRET: requiredEnv('JWT_SECRET'),
  PHI_KEY: requiredEnv('PHI_KEY'),
  TOKEN_TTL_MIN: Number(process.env.TOKEN_TTL_MIN || 15),
  KIOSK_TOKEN_TTL_MIN: Number(process.env.KIOSK_TOKEN_TTL_MIN || 5),
  INACTIVITY_MIN: Number(process.env.INACTIVITY_MIN || 20),
  KIOSK_INACTIVITY_MIN: Number(process.env.KIOSK_INACTIVITY_MIN || 5),
};

module.exports = { env };
