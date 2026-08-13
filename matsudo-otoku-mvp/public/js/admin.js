<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title>実験ダッシュボード | 松戸のお得情報</title>

  <link rel="stylesheet" href="/css/style.css">

  <!-- Chart.js -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
</head>

<body class="admin-body">

  <div class="admin-header">
    <h1>📊 実験ダッシュボード</h1>
  </div>

  <!-- 管理トークン入力 -->
  <div id="tokenForm" class="token-form">
    <input
      type="password"
      id="tokenInput"
      placeholder="管理トークンを入力"
    >
    <button type="button" id="tokenSubmit">表示</button>
  </div>

  <!-- エラー表示 -->
  <div
    id="adminError"
    style="
      display:none;
      background:#fee;
      color:#900;
      padding:15px;
      margin:15px;
      border-radius:8px;
      white-space:pre-wrap;
    "
  ></div>

  <!-- ダッシュボード -->
  <div id="dashboard" style="display:none;">

    <!-- 基本統計 -->
    <div class="stat-grid">

      <div class="stat-box">
        <div class="value" id="statTotal">-</div>
        <div class="label">総アクセス数</div>
      </div>

      <div class="stat-box">
        <div class="value" id="statUnique">-</div>
        <div class="label">ユニーク推定</div>
      </div>

      <div class="stat-box">
        <div class="value" id="statToday">-</div>
        <div class="label">今日のアクセス</div>
      </div>

      <div class="stat-box">
        <div class="value" id="statAvgPerDay">-</div>
        <div class="label">1日平均アクセス</div>
      </div>

      <div class="stat-box">
        <div class="value" id="statTotalKm">-</div>
        <div class="label">走行距離合計(km)</div>
      </div>

      <div class="stat-box">
        <div class="value" id="statPerKm">-</div>
        <div class="label">アクセス/km</div>
      </div>

    </div>


    <!-- CSV -->
    <div class="admin-section">

      <h2>📥 アクセスログをCSVでダウンロード</h2>

      <p style="font-size:12px;color:#999;margin-bottom:10px;">
        日時・car_id・session_id・初回/再訪・User-Agent・リファラー・不正判定を含む全件をダウンロードします。
      </p>

      <a
        id="csvDownloadLink"
        href="#"
        class="token-form-button-link"
      >
        <button type="button" id="csvDownloadBtn">
          CSVダウンロード
        </button>
      </a>

    </div>


    <!-- 走行距離 -->
    <div class="admin-section">

      <h2>🚗 走行距離の記録</h2>

      <p style="font-size:12px;color:#999;margin-bottom:10px;">
        その日の走行距離を入力すると、走行距離あたりのアクセス数を確認できます。
      </p>

      <div class="drive-log-form">

        <input
          type="date"
          id="driveDate"
        >

        <input
          type="number"
          id="driveKm"
          placeholder="走行距離(km)"
          step="0.1"
          min="0"
        >

        <input
          type="text"
          id="driveNote"
          placeholder="メモ(任意)"
        >

        <button
          type="button"
          id="driveSubmit"
        >
          記録する
        </button>

      </div>

      <table
        class="admin-table"
        id="tableDriveLog"
      ></table>

    </div>


    <!-- 車両別 -->
    <div class="admin-section">

      <h2>車両別アクセス数</h2>

      <table
        class="admin-table"
        id="tableByCar"
      ></table>

    </div>


    <!-- 日別 -->
    <div class="admin-section">

      <h2>日別アクセス数</h2>

      <canvas
        id="chartByDate"
        height="160"
      ></canvas>

    </div>


    <!-- 時間帯 -->
    <div class="admin-section">

      <h2>時間帯別アクセス数</h2>

      <canvas
        id="chartByHour"
        height="160"
      ></canvas>

    </div>


    <!-- 曜日 -->
    <div class="admin-section">

      <h2>曜日別アクセス数</h2>

      <canvas
        id="chartByDow"
        height="160"
      ></canvas>

    </div>


    <!-- 不正アクセス -->
    <div
      class="admin-section"
      id="fraudSection"
    >

      <h2>
        ⚠️ 不正アクセスの参考判定（直近1時間）
      </h2>

      <div id="fraudContent"></div>

    </div>


    <!-- リファラー -->
    <div class="admin-section">

      <h2>リファラー</h2>

      <table
        class="admin-table"
        id="tableReferrer"
      ></table>

    </div>


    <!-- User-Agent -->
    <div class="admin-section">

      <h2>User-Agent</h2>

      <table
        class="admin-table"
        id="tableUA"
      ></table>

    </div>


    <!-- アクセスログ -->
    <div class="admin-section">

      <h2>アクセスログ（最新100件）</h2>

      <table
        class="admin-table"
        id="tableLog"
      ></table>

    </div>

  </div>


  <!-- admin.jsは最後に読み込む -->
  <script src="/js/admin.js"></script>

</body>
</html>
