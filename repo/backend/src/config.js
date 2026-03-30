const env = {
  PORT: Number(process.env.PORT || 3000),
  HOST: process.env.HOST || '0.0.0.0',
  DATABASE_URL: process.env.DATABASE_URL || 'postgres://meridian:meridian@db:5432/meridiancare',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-me',
  PHI_KEY: process.env.PHI_KEY || 'meridian-local-phi-key',
  TOKEN_TTL_MIN: Number(process.env.TOKEN_TTL_MIN || 15),
  KIOSK_TOKEN_TTL_MIN: Number(process.env.KIOSK_TOKEN_TTL_MIN || 5),
  INACTIVITY_MIN: Number(process.env.INACTIVITY_MIN || 20),
  KIOSK_INACTIVITY_MIN: Number(process.env.KIOSK_INACTIVITY_MIN || 5),
};
module.exports = { env };
