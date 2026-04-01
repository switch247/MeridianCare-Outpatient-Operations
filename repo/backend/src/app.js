const Fastify = require("fastify");
const cors = require("@fastify/cors");
const cookie = require("@fastify/cookie");
const jwt = require("@fastify/jwt");
const { env } = require("./config");
const { pool, initDb } = require("./db");
const { encrypt } = require("./utils/crypto");
const {
  hashPassword,
  verifyPassword,
  isLocked,
} = require("./services/security");
const { applyDiscounts } = require("./services/discounts");
const { writeAudit } = require("./lib/audit");
const { can } = require("./lib/rbac");

async function buildApp() {
  const { pino, plugin: loggerPlugin } = require("./lib/logger");
  const app = Fastify({ logger: false });
  // attach our pino logger instance so code can use `app.log`
  try {
    app.log = pino;
  } catch (e) {
    /* ignore if immutable */
  }
  await app.register(cors, { origin: true, credentials: true });
  await app.register(cookie);
  await app.register(jwt, { secret: env.JWT_SECRET });

  // register our request/response logger plugin
  await app.register(loggerPlugin);

  app.decorate("auth", async (request, reply) => {
    try {
      const authHeader = request.headers.authorization || "";
      const headerToken = authHeader.replace("Bearer ", "") || "";
      const cookieToken = request.cookies && request.cookies.session;
      const token = headerToken || cookieToken;
      if (!token) {
        try {
          request.log.warn(["auth", "unauthorized"], `no token provided`, {
            ip: request.ip,
            path: request.routerPath || request.raw.url,
            method: request.method,
          });
        } catch (e) {}
        return reply.code(401).send({ code: 401, msg: "Unauthorized" });
      }
      // verify token explicitly (supports tokens provided in body/query)
      let payload;
      try {
        payload = await app.jwt.verify(token);
      } catch (ve) {
        app.log.error(
            {
              meta: {
                error: ve && ve.message,
                tokenPreview: String((token || "").slice(0, 32)),
              },
            },
            `[auth] token verify failed`,
          );
       
        return reply.code(401).send({ code: 401, msg: "Unauthorized" });
      }

      const decoded = app.jwt.decode(token) || {};
      const jti = payload.jti || payload.jwtid || payload.jwd || decoded.jti || decoded.jwtid || decoded.jwd || null;
      const userRes = await pool.query("SELECT * FROM users WHERE id=$1", [
        payload.sub,
      ]);
      const user = userRes.rows[0];
      if (!user) {
          request.log.warn(
            ["auth", "unauthorized"],
            `user not found for token sub=${payload && payload.sub}`,
            {
              ip: request.ip,
              path: request.routerPath || request.raw.url,
              method: request.method,
            },
          );
        return reply.code(401).send({ code: 401, msg: "Unauthorized" });
      }

      // let session = null;
      // if (jti) {
      //   const sessRes = await pool.query("SELECT * FROM sessions WHERE jti=$1", [jti]);
      //   session = sessRes.rows[0] || null;
      // } else {
      //   const fallback = await pool.query(
      //     "SELECT * FROM sessions WHERE user_id=$1 AND revoked=false ORDER BY last_active_at DESC LIMIT 1",
      //     [payload.sub],
      //   );
      //   session = fallback.rows[0] || null;
      // }
      // if (!session || session.revoked) {
      //   return reply
      //     .code(401)
      //     .send({ code: 401, msg: "Session revoked or not found" });
      // }
      // if (session.expires_at && new Date(session.expires_at) < new Date()) {
      //   return reply.code(401).send({ code: 401, msg: "Token expired" });
      // }

      // const inactivityMin = session.kiosk
      //   ? env.KIOSK_INACTIVITY_MIN
      //   : env.INACTIVITY_MIN;
      // const { isSessionExpiredByInactivity } = require("./services/security");
      // if (isSessionExpiredByInactivity(session.last_active_at, inactivityMin))
      //   return reply.code(401).send({ code: 401, msg: "Session expired" });

      // await pool.query("UPDATE sessions SET last_active_at=NOW() WHERE id=$1", [
      //   session.id,
      // ]);
      // await pool.query("UPDATE users SET last_active_at=NOW() WHERE id=$1", [
      //   user.id,
      // ]);
      request.user = user;
      // request.session = session;
    } catch (e) {      
        request.log.warn(
          ["auth", "unauthorized", "error"],
          `auth verify error`,
          {
            error: e && e.message,
            ip: request.ip,
            path: request.routerPath || request.raw.url,
            method: request.method,
          },
        );
      return reply.code(401).send({ code: 401, msg: "Unauthorized" });
    }
  });

  const permit = (permission) => async (request, reply) => {
    await app.auth(request, reply);
    if (!request.user) return;
    if (!can(request.user.role, permission)) {
      try {
        request.log.warn(["auth", "forbidden"], `user lacks permission`, {
          userId: request.user && request.user.id,
          username: request.user && request.user.username,
          role: request.user && request.user.role,
          permission,
          ip: request.ip,
          path: request.routerPath || request.raw.url,
          method: request.method,
        });
      } catch (e) {}
      return reply.code(403).send({ code: 403, msg: "Forbidden" });
    }
  };

  app.get("/health", async () => ({ ok: true }));

  // register clinics routes separately (clean architecture)

  // register modular routes
  const clinicsRoutes = require("./routes/clinics");
  const authRoutes = require("./routes/auth");
  const patientsRoutes = require("./routes/patients");
  const encountersRoutes = require("./routes/encounters");
  const prescriptionsRoutes = require("./routes/prescriptions");
  const billingRoutes = require("./routes/billing");
  const credentialingRoutes = require("./routes/credentialing");
  const adminRoutes = require("./routes/admin");
  const syncAuditRoutes = require("./routes/sync_audit");
  const overviewRoutes = require("./routes/overview");
  const inventoryRoutes = require("./routes/inventory");
  const usersRoutes = require("./routes/users");

  await app.register(authRoutes, { permit });
  await app.register(clinicsRoutes, { permit });
  await app.register(patientsRoutes, { permit });
  await app.register(encountersRoutes, { permit });
  await app.register(prescriptionsRoutes, { permit });
  await app.register(billingRoutes, { permit });
  await app.register(inventoryRoutes, { permit });
  await app.register(usersRoutes, { permit });
  await app.register(credentialingRoutes, { permit });
  await app.register(adminRoutes, { permit });
  await app.register(syncAuditRoutes, { permit });
  await app.register(overviewRoutes, { permit });

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    reply.code(500).send({ code: 500, msg: "Internal server error" });
  });

  if (process.env.NODE_ENV !== 'test') await initDb();
  return app;
}

module.exports = { buildApp };
