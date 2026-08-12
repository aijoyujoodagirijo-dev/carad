// server.js
require('dotenv').config();

const express = require('express');
const path = require('path');

const { initDb } = require('./src/db');
const trackRoutes = require('./src/trackRoutes');
const statsRoutes = require('./src/statsRoutes');
const { ADMIN_TOKEN } = require('./src/adminToken');

const app = express();

const PORT = Number(process.env.PORT) || 3000;

// Renderなどのプロキシ経由でも正しいアクセス情報を取得
app.set('trust proxy', true);

app.use(express.json());

// publicフォルダをWeb公開
app.use(express.static(path.join(__dirname, 'public')));

// API
app.use('/api', trackRoutes);
app.use('/api', statsRoutes);

// ヘルスチェック
app.get('/healthz', (req, res) => {
  res.status(200).type('text').send('ok');
});

// トップページ
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path
  });
});

async function start() {
  try {
    console.log('=== SERVER STARTING ===');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('PORT:', PORT);
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
    console.log('ADMIN_TOKEN:', process.env.ADMIN_TOKEN ? 'SET' : 'NOT SET');

    console.log('Initializing database...');
    await initDb();

    console.log('✓ Database initialized successfully');

    // 重要：RenderのPORTで待ち受ける
    app.listen(PORT, '0.0.0.0', () => {
      console.log('=================================');
      console.log('✅ SERVER IS LIVE');
      console.log(`PORT: ${PORT}`);
      console.log('HOST: 0.0.0.0');
      console.log('=================================');
    });

  } catch (err) {
    console.error('❌ SERVER START FAILED');
    console.error(err);
    process.exit(1);
  }
}

start();
