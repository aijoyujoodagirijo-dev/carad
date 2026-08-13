const express = require('express');
const { pool } = require('./db');

const router = express.Router();

/*
 * 管理トークン確認
 */
function checkToken(req, res) {
  const token = req.query.token;

  if (!token || token !== process.env.ADMIN_TOKEN) {
    res.status(401).json({
      error: 'Unauthorized',
    });
    return false;
  }

  return true;
}

/*
 * GET /api/stats
 */
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
  WHERE access_date = (
    CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo'
  )::date
`);

    // 日数
    const daysResult = await pool.query(`
      SELECT COUNT(DISTINCT access_date)::int AS days
      FROM accesses
    `);

    const total = totalResult.rows[0].total;
    const unique = uniqueResult.rows[0].unique;
    const today = todayResult.rows[0].today;
    const days = daysResult.rows[0].days;

    const avgPerDay =
      days > 0
        ? Math.round((total / days) * 100) / 100
        : 0;

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

    // 日別
    const byDateResult = await pool.query(`
      SELECT
        access_date::text AS date,
        COUNT(*)::int AS cnt
      FROM accesses
      GROUP BY access_date
      ORDER BY access_date
    `);

    // 時間帯別
    const byHourResult = await pool.query(`
      SELECT
        access_hour AS hour,
        COUNT(*)::int AS cnt
      FROM accesses
      GROUP BY access_hour
      ORDER BY access_hour
    `);

    // 曜日別
    const byDowResult = await pool.query(`
      SELECT
        access_dow AS dow,
        COUNT(*)::int AS cnt
      FROM accesses
      GROUP BY access_dow
      ORDER BY access_dow
    `);

    // リファラー
    const byReferrerResult = await pool.query(`
      SELECT
        COALESCE(NULLIF(referrer, ''), '(直接アクセス)') AS referrer,
        COUNT(*)::int AS cnt
      FROM accesses
      GROUP BY COALESCE(NULLIF(referrer, ''), '(直接アクセス)')
      ORDER BY cnt DESC
      LIMIT 100
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
        session_id,
        is_first_visit,
        ip_address,
        user_agent,
        referrer,
        access_url
      FROM accesses
      ORDER BY accessed_at DESC
      LIMIT 100
    `);

    // 走行距離
    const driveResult = await pool.query(`
      SELECT
        dl.log_date::text AS date,
        dl.distance_km,
        dl.note,
        COALESCE(a.accesses, 0)::int AS accesses,
        CASE
          WHEN dl.distance_km > 0
          THEN ROUND(
            COALESCE(a.accesses, 0)::numeric / dl.distance_km,
            2
          )
          ELSE NULL
        END AS per_km
      FROM drive_logs dl
      LEFT JOIN (
        SELECT
          access_date,
          COUNT(*) AS accesses
        FROM accesses
        GROUP BY access_date
      ) a
      ON a.access_date = dl.log_date
      ORDER BY dl.log_date DESC
    `);

    // 総走行距離
    const totalKmResult = await pool.query(`
      SELECT
        COALESCE(SUM(distance_km), 0)::numeric AS total_km
      FROM drive_logs
    `);

    const totalKm = Number(totalKmResult.rows[0].total_km || 0);

    const overallPerKm =
      totalKm > 0
        ? Math.round((total / totalKm) * 100) / 100
        : null;

    // 直近1時間の怪しいセッション
    const suspiciousSessionsResult = await pool.query(`
      SELECT
        session_id,
        car_id,
        COUNT(*)::int AS cnt
      FROM accesses
      WHERE accessed_at >= NOW() - INTERVAL '1 hour'
        AND session_id IS NOT NULL
      GROUP BY session_id, car_id
      HAVING COUNT(*) >= 10
      ORDER BY cnt DESC
      LIMIT 50
    `);

    // 直近1時間の怪しいIP
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
      LIMIT 50
    `);

    res.json({
      total,
      unique,
      today,
      avgPerDay,

      totalKm,
      overallPerKm,

      byCar: byCarResult.rows,
      byDate: byDateResult.rows,
      byHour: byHourResult.rows,
      byDow: byDowResult.rows,

      byReferrer: byReferrerResult.rows,
      byUserAgent: byUserAgentResult.rows,

      recentLog: recentLogResult.rows,

      driveLogs: driveResult.rows,

      suspiciousSessions:
        suspiciousSessionsResult.rows,

      suspiciousIPs:
        suspiciousIPsResult.rows,
    });

  } catch (err) {
    console.error('stats error:', err);

    res.status(500).json({
      error: 'stats error',
      message: err.message,
    });
  }
});


/*
 * GET /api/export.csv
 */
router.get('/export.csv', async (req, res) => {
  if (!checkToken(req, res)) return;

  try {
    const result = await pool.query(`
      SELECT
        id,
        accessed_at,
        car_id,
        session_id,
        is_first_visit,
        access_url,
        referrer,
        user_agent,
        ip_address,
        access_date,
        access_hour,
        access_dow
      FROM accesses
      ORDER BY accessed_at DESC
    `);

    const header = [
      'id',
      'accessed_at',
      'car_id',
      'session_id',
      'is_first_visit',
      'access_url',
      'referrer',
      'user_agent',
      'ip_address',
      'access_date',
      'access_hour',
      'access_dow',
    ];

    function csvEscape(value) {
      if (value === null || value === undefined) {
        return '';
      }

      const str = String(value);

      if (
        str.includes(',') ||
        str.includes('"') ||
        str.includes('\n') ||
        str.includes('\r')
      ) {
        return '"' + str.replace(/"/g, '""') + '"';
      }

      return str;
    }

    const lines = [
      header.join(','),
      ...result.rows.map(row =>
        header
          .map(key => csvEscape(row[key]))
          .join(',')
      ),
    ];

    const csv = '\uFEFF' + lines.join('\r\n');

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
    console.error('CSV error:', err);

    res.status(500).json({
      error: 'CSV export error',
    });
  }
});


/*
 * POST /api/drive-log
 */
router.post('/drive-log', async (req, res) => {
  if (!checkToken(req, res)) return;

  try {
    const {
      date,
      distance_km,
      note,
    } = req.body || {};

    if (!date) {
      return res.status(400).json({
        error: 'date is required',
      });
    }

    const km = Number(distance_km);

    if (!Number.isFinite(km) || km < 0) {
      return res.status(400).json({
        error: 'distance_km is invalid',
      });
    }

    await pool.query(
      `
      INSERT INTO drive_logs
        (
          log_date,
          distance_km,
          note,
          updated_at
        )
      VALUES
        ($1, $2, $3, NOW())
      ON CONFLICT (log_date)
      DO UPDATE SET
        distance_km = EXCLUDED.distance_km,
        note = EXCLUDED.note,
        updated_at = NOW()
      `,
      [
        date,
        km,
        note
          ? String(note).slice(0, 500)
          : null,
      ]
    );

    res.json({
      status: 'ok',
    });

  } catch (err) {
    console.error('drive-log error:', err);

    res.status(500).json({
      error: 'drive-log error',
      message: err.message,
    });
  }
});


module.exports = router;
