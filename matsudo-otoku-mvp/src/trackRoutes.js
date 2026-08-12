
const express = require('express');
const { pool, getJstParts } = require('./db');

const router = express.Router();

router.post('/track', async (req, res) => {
  try {
    const {
      car_id,
      session_id,
      is_first_visit,
      url,
      referrer
    } = req.body || {};

    if (!car_id || typeof car_id !== 'string') {
      return res.status(400).json({
        error: 'car_id is required'
      });
    }

    const now = new Date();

    const ip =
      req.headers['x-forwarded-for']?.split(',')[0].trim() ||
      req.ip ||
      '';

    const userAgent = req.get('user-agent') || '';

    const {
      accessDate,
      accessHour,
      accessDow
    } = getJstParts(now);

    await pool.query(
      `INSERT INTO accesses
        (
          car_id,
          session_id,
          is_first_visit,
          access_url,
          referrer,
          user_agent,
          ip_address,
          accessed_at,
          access_date,
          access_hour,
          access_dow
        )
       VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        String(car_id).slice(0, 50),
        session_id
          ? String(session_id).slice(0, 100)
          : null,
        !!is_first_visit,
        url
          ? String(url).slice(0, 500)
          : null,
        referrer
          ? String(referrer).slice(0, 500)
          : null,
        userAgent.slice(0, 500),
        ip,
        now.toISOString(),
        accessDate,
        accessHour,
        accessDow
      ]
    );

    res.json({
      status: 'ok'
    });

  } catch (err) {
    console.error('track error:', err);

    res.status(500).json({
      error: 'internal error'
    });
  }
});

module.exports = router;
