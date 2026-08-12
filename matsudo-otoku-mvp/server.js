require('dotenv').config();

const express = require('express');
const path = require('path');

console.log('=== SERVER STARTING ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
console.log('ADMIN_TOKEN:', process.env.ADMIN_TOKEN ? 'SET' : 'NOT SET');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', true);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function start() {
  try {
    console.log('1. Loading application modules...');

    const { initDb } = require('./src/db');
    console.log('   ✓ db loaded');

    const trackRoutes = require('./src/trackRoutes');
    console.log('   ✓ trackRoutes loaded');
    console.log('   trackRoutes type:', typeof trackRoutes);
    console.log('   trackRoutes:', trackRoutes);

    const statsRoutes = require('./src/statsRoutes');
    console.log('   ✓ statsRoutes loaded');
    console.log('   statsRoutes type:', typeof statsRoutes);
    console.log('   statsRoutes:', statsRoutes);

    const { ADMIN_TOKEN } = require('./src/adminToken');
    console.log('   ✓ adminToken loaded');

    // Routerになっているか確認
    if (typeof trackRoutes !== 'function') {
      throw new Error('trackRoutes が Express Router ではありません');
    }

    if (typeof statsRoutes !== 'function') {
      throw new Error('statsRoutes が Express Router ではありません');
    }

    app.use('/api', trackRoutes);
    app.use('/api', statsRoutes);

    app.get('/healthz', (req, res) => {
      res.send('ok');
    });

    console.log('2. Initializing database...');

    await initDb();

    console.log('✓ Database initialized successfully');

    app.listen(PORT, '0.0.0.0', () => {
      console.log('=================================');
      console.log('✅ SERVER IS LIVE');
      console.log(`PORT: ${PORT}`);
      console.log('=================================');
    });

  } catch (err) {
    console.error('❌ SERVER START FAILED');
    console.error(err);
    process.exit(1);
  }
}

start();
