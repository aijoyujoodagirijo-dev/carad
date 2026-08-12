
// src/db.js

const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL が設定されていません。');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS accesses (
      id BIGSERIAL PRIMARY KEY,
      car_id TEXT NOT NULL,
      session_id TEXT,
      is_first_visit BOOLEAN DEFAULT FALSE,
      access_url TEXT,
      referrer TEXT,
      user_agent TEXT,
      ip_address TEXT,
      accessed_at TIMESTAMPTZ NOT NULL,
      access_date DATE NOT NULL,
      access_hour SMALLINT NOT NULL,
      access_dow SMALLINT NOT NULL
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_accesses_car_id
    ON accesses(car_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_accesses_session_id
    ON accesses(session_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_accesses_access_date
    ON accesses(access_date);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_accesses_ip_address
    ON accesses(ip_address);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS drive_logs (
      id BIGSERIAL PRIMARY KEY,
      log_date DATE UNIQUE NOT NULL,
      distance_km NUMERIC(6,1) NOT NULL,
      note TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

function getJstParts(date) {
  const dateFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const hourFmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    hour12: false,
  });

  const dowFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    weekday: 'short',
  });

  const accessDate = dateFmt.format(date);

  const hourStr = hourFmt
    .format(date)
    .replace(/[^\d]/g, '');

  const accessHour = parseInt(hourStr, 10) % 24;

  const dowMap = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  const accessDow = dowMap[dowFmt.format(date)];

  return {
    accessDate,
    accessHour,
    accessDow,
  };
}

module.exports = {
  pool,
  initDb,
  getJstParts,
};
