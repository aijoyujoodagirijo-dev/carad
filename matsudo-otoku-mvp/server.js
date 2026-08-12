// server.js
require('dotenv').config();

console.log('=== SERVER STARTING ===');
console.log('NODE_ENV:', process.env.NODE_ENV || '(not set)');
console.log('PORT:', process.env.PORT || '(not set)');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
console.log('ADMIN_TOKEN:', process.env.ADMIN_TOKEN ? 'SET' : 'NOT SET');

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 起動時のエラーを必ずログに出す
process.on('uncaughtException', (err) => {
  console.error('❌ UNCAUGHT EXCEPTION');
  console.error(err);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ UNHANDLED REJECTION');
  console.error(err);
});

app.set('trust proxy', true);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function start() {
  console.log('1. Loading application modules...');

  let initDb;
  let trackRoutes;
  let statsRoutes;
  let ADMIN_TOKEN;

  try {
    console.log('2. Loading ./src/db...');
    ({ initDb } = require('./src/db'));
    console.log('   ✓ db loaded');

    console.log('3. Loading ./src/trackRoutes...');
    trackRoutes = require('./src/trackRoutes');
    console.log('   ✓ trackRoutes loaded');

    console.log('4. Loading ./src/statsRoutes...');
    statsRoutes = require('./src/statsRoutes');
    console.log('   ✓ statsRoutes loaded');

    console.log('5. Loading ./src/adminToken...');
    ({ ADMIN_TOKEN } = require('./src/adminToken'));
    console.log('   ✓ adminToken loaded');
  } catch (err) {
    console.error('❌ MODULE LOADING FAILED');
    console.error(err);
    process.exit(1);
  }

  app.use('/api', trackRoutes);
  app.use('/api', statsRoutes);

  app.get('/healthz', (req, res) => {
    res.send('ok');
  });

  console.log('6. Connecting to database...');

  try {
    await initDb();
    console.log('✅ データベース接続・初期化に成功しました');
  } catch (err) {
    console.error('❌ DATABASE INITIALIZATION FAILED');
    console.error(err);
    process.exit(1);
  }

  console.log('7. Starting HTTP server...');

  app.listen(PORT, '0.0.0.0', () => {
    console.log('========================================');
    console.log('✅ 松戸のお得情報 MVP サーバー起動');
    console.log(`✅ PORT: ${PORT}`);
    console.log('========================================');
  });
}

start();
