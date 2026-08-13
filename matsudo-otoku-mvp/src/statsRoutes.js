const express = require('express');
const { pool } = require('./db');

const router = express.Router();

function checkToken(req, res) {
  const token = req.query.token;

  if (!process.env.ADMIN_TOKEN) {
    res.status(500).json({
      error: 'ADMIN_TOKEN is not configured'
    });
    return false;
  }

  if (!token || token !== process.env.ADMIN_TOKEN) {
    res.status(401).json({
      error: 'invalid token'
    });
    return false;
  }

  return true;
}


// ==============================
// GET /api/stats
// ==============================
router.get('/stats', async (req, res) => {
  if (!checkToken(req, res)) return;

  try {
    // 総アクセス数
    const totalResult = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM accesses
    `);

    // ユニークセッション数
    const uniqueResult = await pool.query(`
      SELECT COUNT(DISTINCT session_id)::int AS unique
      FROM accesses
      WHERE session_id IS NOT NULL
    `);

    // 今日のアクセス数
    const todayResult = await pool.query(`
      SELECT COUNT(*)::int AS today
      FROM accesses
      WHERE access_date = CURRENT_DATE
    `);

    // 日別アクセス
    const byDateResult = await pool.query(`
      SELECT
        access_date AS date,
        COUNT(*)::int AS cnt
      FROM accesses
      GROUP BY access_date
      ORDER BY access_date
    `);

    // 時間帯別アクセス
    const byHourResult = await pool.query(`
      SELECT
        access_hour AS hour,
        COUNT(*)::int AS cnt
      FROM accesses
      GROUP BY access_hour
      ORDER BY access_hour
    `);

    // 曜日別アクセス
    const byDowResult = await pool.query(`
      SELECT
        access_dow AS dow,
        COUNT(*)::int AS cnt
      FROM accesses
      GROUP BY access_dow
      ORDER BY access_dow
    `);

    // 車両別
    const byCarResult = await pool.query(`
      SELECT
        car_id,
        COUNT(*)::int AS total,
        COUNT(DISTINCT session_id)::int AS unique_sessions
      FROM accesses
      GROUP BY car_id
      ORDER BY total DESC
    `);

    // リファラー
    const byReferrerResult = await pool.query(`
      SELECT
        COALESCE(NULLIF(referrer, ''), '(直接アクセス)') AS referrer,
        COUNT(*)::int AS cnt
      FROM accesses
      GROUP BY COALESCE(NULLIF(referrer, ''), '(直接アクセス)')
      ORDER BY cnt DESC
    `);

    // User-Agent
    const byUserAgentResult = await pool.query(`
      SELECT
        COALESCE(NULLIF(user_agent, ''), '(不明)') AS user_agent,
        COUNT(*)::int AS cnt
      FROM accesses
      GROUP BY COALESCE(NULLIF(user_agent, ''), '(不明)')
      ORDER BY cnt DESC
      LIMIT 100
    `);

    // 最新100件
    const recentLogResult = await pool.query(`
      SELECT
        accessed_at,
        car_id,
        is_first_visit,
        ip_address,
        user_agent,
        session_id,
        referrer
      FROM accesses
      ORDER BY accessed_at DESC
      LIMIT 100
    `);

    // 直近1時間：同一セッションの大量アクセス
    const suspiciousSessionsResult = await pool.query(`
      SELECT
        session_id,
        car_id,
        COUNT(*)::int AS cnt
      FROM accesses
      WHERE accessed_at >= NOW() - INTERVAL '1 hour'
        AND session_id IS NOT NULL
      GROUP BY session_id, car_id
      HAVING COUNT(*) >= 20
      ORDER BY cnt DESC
    `);

    // 直近1時間：同一IPの大量アクセス
    const suspiciousIPsResult = await pool.query(`
      SELECT
        ip_address,
        COUNT(*)::int AS cnt,
        COUNT(DISTINCT session_id)::int AS sessions
      FROM accesses
      WHERE accessed_at >= NOW() - INTERVAL '1 hour'
        AND ip_address IS NOT NULL
        AND ip_address <> ''
      GROUP BY ip_address
      HAVING COUNT(*) >= 20
      ORDER BY cnt DESC
    `);

    // 1日平均
    const avgResult = await pool.query(`
      SELECT
        CASE
          WHEN COUNT(DISTINCT access_date) = 0 THEN 0
          ELSE ROUND(
            COUNT(*)::numeric /
            COUNT(DISTINCT access_date),
            2
          )
        END AS avg_per_day
      FROM accesses
    `);

    // 走行距離テーブルが存在する場合に使用
    let totalKm = 0;
    let overallPerKm = null;
    let driveLogs = [];

    try {
      const driveResult = await pool.query(`
        SELECT
          date,
          distance_km,
          note
        FROM drive_logs
        ORDER BY date DESC
      `);

      driveLogs = driveResult.rows;

      const kmResult = await pool.query(`
        SELECT
          COALESCE(SUM(distance_km), 0) AS total_km
        FROM drive_logs
      `);

      totalKm = Number(kmResult.rows[0].total_km || 0);

      if (totalKm > 0) {
        const total = Number(totalResult.rows[0].total || 0);
        overallPerKm = Number((total / totalKm).toFixed(2));
      }

      // 日別アクセス数を走行距離と結合
      driveLogs = driveLogs.map((row) => {
        const matchingDate = byDateResult.rows.find(
          (d) =>
            String(d.date).slice(0, 10) ===
            String(row.date).slice(0, 10)
        );

        const accesses = matchingDate
          ? Number(matchingDate.cnt)
          : 0;

        const distance = Number(row.distance_km || 0);

        return {
          date: String(row.date).slice(0, 10),
          distance_km: distance,
          accesses,
          per_km:
            distance > 0
              ? Number((accesses / distance).toFixed(2))
              : null,
          note: row.note || ''
        };
      });

    } catch (driveError) {
      // 走行距離テーブルがまだない場合でも
      // ダッシュボード本体は表示できるようにする
      console.log(
        'drive_logs unavailable:',
        driveError.message
      );
    }

    res.json({
      total: Number(totalResult.rows[0].total || 0),

      unique: Number(uniqueResult.rows[0].unique || 0),

      today: Number(todayResult.rows[0].today || 0),

      avgPerDay: Number(
        avgResult.rows[0].avg_per_day || 0
      ),

      totalKm,

      overallPerKm,

      byCar: byCarResult.rows,

      byDate: byDateResult.rows.map((r) => ({
        date: String(r.date).slice(0, 10),
        cnt: Number(r.cnt)
      })),

      byHour: byHourResult.rows.map((r) => ({
        hour: Number(r.hour),
        cnt: Number(r.cnt)
      })),

      byDow: byDowResult.rows.map((r) => ({
        dow: Number(r.dow),
        cnt: Number(r.cnt)
      })),

      byReferrer: byReferrerResult.rows,

      byUserAgent: byUserAgentResult.rows,

      recentLog: recentLogResult.rows,

      suspiciousSessions:
        suspiciousSessionsResult.rows,

      suspiciousIPs:
        suspiciousIPsResult.rows,

      driveLogs
    });

  } catch (err) {
    console.error('STATS ERROR:', err);

    res.status(500).json({
      error: 'failed to load statistics',
      detail: err.message
    });
  }
});


// ==============================
// GET /api/export.csv
// ==============================
router.get('/export.csv', async (req, res) => {
  if (!checkToken(req, res)) return;

  try {
    const result = await pool.query(`
      SELECT
        accessed_at,
        car_id,
        session_id,
        is_first_visit,
        ip_address,
        user_agent,
        referrer,
        access_url,
        access_date,
        access_hour,
        access_dow
      FROM accesses
      ORDER BY accessed_at DESC
    `);

    const header = [
      '日時',
      '車両ID',
      'セッションID',
      '初回訪問',
      'IP',
      'User-Agent',
      'リファラー',
      'URL',
      '日付',
      '時間',
      '曜日'
    ];

    const escapeCsv = (value) => {
      if (value === null || value === undefined) {
        return '';
      }

      return '"' +
        String(value)
          .replace(/"/g, '""') +
        '"';
    };

    const lines = [
      header.map(escapeCsv).join(',')
    ];

    for (const row of result.rows) {
      lines.push([
        row.accessed_at,
        row.car_id,
        row.session_id,
        row.is_first_visit ? '初回' : '再訪',
        row.ip_address,
        row.user_agent,
        row.referrer,
        row.access_url,
        row.access_date,
        row.access_hour,
        row.access_dow
      ].map(escapeCsv).join(','));
    }

    const csv = '\uFEFF' + lines.join('\n');

    res.setHeader(
      'Content-Type',
      'text/csv; charset=utf-8'
    );

    res.setHeader(
      'Content-Disposition',
      'attachment; filename="access-log.csv"'
    );

    res.send(csv);

  } catch (err) {
    console.error('CSV ERROR:', err);

    res.status(500).send(
      'CSV export failed'
    );
  }
});


// ==============================
// POST /api/drive-log
// ==============================
router.post('/drive-log', async (req, res) => {
  if (!checkToken(req, res)) return;

  try {
    const {
      date,
      distance_km,
      note
    } = req.body || {};

    if (!date) {
      return res.status(400).json({
        error: 'date is required'
      });
    }

    if (
      distance_km === undefined ||
      distance_km === null ||
      Number.isNaN(Number(distance_km)) ||
      Number(distance_km) < 0
    ) {
      return res.status(400).json({
        error: 'distance_km is invalid'
      });
    }

    // drive_logsテーブルを作成
    await pool.query(`
      CREATE TABLE IF NOT EXISTS drive_logs (
        id SERIAL PRIMARY KEY,
        date DATE UNIQUE NOT NULL,
        distance_km NUMERIC(10,2) NOT NULL DEFAULT 0,
        note TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 同じ日付なら上書き
    const result = await pool.query(
      `
      INSERT INTO drive_logs
        (date, distance_km, note, updated_at)
      VALUES
        ($1, $2, $3, NOW())
      ON CONFLICT (date)
      DO UPDATE SET
        distance_km = EXCLUDED.distance_km,
        note = EXCLUDED.note,
        updated_at = NOW()
      RETURNING *
      `,
      [
        date,
        Number(distance_km),
        note ? String(note).slice(0, 500) : null
      ]
    );

    res.json({
      status: 'ok',
      row: result.rows[0]
    });

  } catch (err) {
    console.error('DRIVE LOG ERROR:', err);

    res.status(500).json({
      error: 'failed to save drive log',
      detail: err.message
    });
  }
});


module.exports = router;
