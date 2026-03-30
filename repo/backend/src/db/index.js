const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { env } = require("../config");
const pool = new Pool({ connectionString: env.DATABASE_URL });
async function initDb() {
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(sql);
}
module.exports = { pool, initDb };
