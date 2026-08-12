
const express = require('express');

const router = express.Router();

router.get('/stats', async (req, res) => {
  res.json({
    status: 'ok',
    message: 'stats route is working'
  });
});

router.get('/export.csv', async (req, res) => {
  res.status(501).send('CSV export temporarily unavailable');
});

router.post('/drive-log', async (req, res) => {
  res.status(501).json({
    error: 'drive-log temporarily unavailable'
  });
});

module.exports = router;
