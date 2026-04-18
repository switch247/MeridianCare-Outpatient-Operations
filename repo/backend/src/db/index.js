const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { env } = require("../config");

const pool = new Pool({ connectionString: env.DATABASE_URL });

async function waitForDb(retries = 10, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(res => setTimeout(res, delay));
      console.log(`Waiting for DB... (${i + 1}/${retries})`);
    }
  }
}

async function initDb() {
  await waitForDb();
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(sql);
}

module.exports = { pool, initDb };
