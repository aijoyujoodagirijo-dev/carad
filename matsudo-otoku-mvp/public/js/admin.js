(function () {
  const TOKEN_KEY = 'matsudo_admin_token';
  const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

  const tokenForm = document.getElementById('tokenForm');
  const tokenInput = document.getElementById('tokenInput');
  const tokenSubmit = document.getElementById('tokenSubmit');
  const dashboard = document.getElementById('dashboard');

  let dateChart = null;
  let hourChart = null;
  let dowChart = null;
  let currentToken = null;
  let refreshTimer = null;

  // --------------------------------
  // エラーを画面に表示
  // --------------------------------
  function showError(message) {
    console.error(message);

    let box = document.getElementById('adminErrorBox');

    if (!box) {
      box = document.createElement('div');
      box.id = 'adminErrorBox';

      box.style.cssText =
        'margin:15px;padding:15px;background:#fff0f0;' +
        'border:2px solid #d33;color:#900;border-radius:8px;' +
        'font-size:14px;line-height:1.6;white-space:pre-wrap;';

      document.body.insertBefore(box, document.body.firstChild);
    }

    box.textContent = '⚠️ ダッシュボードエラー\n\n' + message;
  }

  // JavaScriptそのもののエラー
  window.onerror = function (message, source, lineno, colno) {
    showError(
      'JavaScriptエラー\n' +
      message +
      '\n\n行番号: ' +
      lineno
    );
  };

  console.log('ADMIN JS START');

  // --------------------------------
  // HTML要素チェック
  // --------------------------------
  if (!tokenForm) {
    showError('tokenForm が見つかりません。admin.htmlを確認してください。');
    return;
  }

  if (!tokenInput) {
    showError('tokenInput が見つかりません。admin.htmlを確認してください。');
    return;
  }

  if (!tokenSubmit) {
    showError('tokenSubmit が見つかりません。admin.htmlを確認してください。');
    return;
  }

  if (!dashboard) {
    showError('dashboard が見つかりません。admin.htmlを確認してください。');
    return;
  }

  // --------------------------------
  // HTMLエスケープ
  // --------------------------------
  function esc(str) {
    if (str === null || str === undefined) return '';

    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --------------------------------
  // キー・バリューテーブル
  // --------------------------------
  function renderKeyValTable(
    el,
    rows,
    keyLabel,
    valLabel,
    keyField,
    valField
  ) {
    if (!el) return;

    if (!Array.isArray(rows) || rows.length === 0) {
      el.innerHTML =
        '<tr><td>データなし</td></tr>';
      return;
    }

    let html =
      `<tr><th>${keyLabel}</th><th>${valLabel}</th></tr>`;

    rows.forEach((r) => {
      html +=
        `<tr>` +
        `<td>${esc(r[keyField])}</td>` +
        `<td>${esc(r[valField])}</td>` +
        `</tr>`;
    });

    el.innerHTML = html;
  }

  // --------------------------------
  // 車両別
  // --------------------------------
  function renderByCar(rows) {
    const el = document.getElementById('tableByCar');
    if (!el) return;

    if (!Array.isArray(rows) || rows.length === 0) {
      el.innerHTML =
        '<tr><td>データなし</td></tr>';
      return;
    }

    let html =
      '<tr><th>車両ID</th><th>総アクセス</th><th>ユニーク</th></tr>';

    rows.forEach((r) => {
      html +=
        `<tr>` +
        `<td>${esc(r.car_id)}</td>` +
        `<td>${esc(r.total)}</td>` +
        `<td>${esc(r.unique_sessions)}</td>` +
        `</tr>`;
    });

    el.innerHTML = html;
  }

  // --------------------------------
  // アクセスログ
  // --------------------------------
  function renderLog(rows) {
    const el = document.getElementById('tableLog');
    if (!el) return;

    if (!Array.isArray(rows) || rows.length === 0) {
      el.innerHTML =
        '<tr><td>アクセスログはまだありません</td></tr>';
      return;
    }

    let html =
      '<tr>' +
      '<th>日時</th>' +
      '<th>車両</th>' +
      '<th>初回</th>' +
      '<th>IP</th>' +
      '<th>UA</th>' +
      '</tr>';

    rows.forEach((r) => {
      const ua = r.user_agent || '';

      html +=
        `<tr>` +
        `<td>${esc(r.accessed_at)}</td>` +
        `<td>${esc(r.car_id)}</td>` +
        `<td>${r.is_first_visit ? '初回' : '再訪'}</td>` +
        `<td>${esc(r.ip_address)}</td>` +
        `<td title="${esc(ua)}">${esc(ua.slice(0, 30))}</td>` +
        `</tr>`;
    });

    el.innerHTML = html;
  }

  // --------------------------------
  // 不正アクセス
  // --------------------------------
  function renderFraud(sessions, ips) {
    const el = document.getElementById('fraudContent');
    if (!el) return;

    const sessionList =
      Array.isArray(sessions) ? sessions : [];

    const ipList =
      Array.isArray(ips) ? ips : [];

    if (
      sessionList.length === 0 &&
      ipList.length === 0
    ) {
      el.innerHTML =
        '<p style="font-size:13px;color:#8bc9a3;">' +
        '直近1時間で疑わしいアクセスは検出されていません。' +
        '</p>';

      return;
    }

    let html = '';

    sessionList.forEach((s) => {
      html +=
        `<div class="warn-box">` +
        `セッション ${esc(s.session_id)} が ` +
        `車両${esc(s.car_id)}に ${esc(s.cnt)}回アクセス ` +
        `（直近1時間）` +
        `</div>`;
    });

    ipList.forEach((i) => {
      html +=
        `<div class="warn-box">` +
        `IP ${esc(i.ip_address)} から ` +
        `${esc(i.cnt)}回アクセス / ` +
        `${esc(i.sessions)}セッション ` +
        `（直近1時間）` +
        `</div>`;
    });

    el.innerHTML = html;
  }

  // --------------------------------
  // 走行距離
  // --------------------------------
  function renderDriveLog(rows) {
    const el = document.getElementById('tableDriveLog');
    if (!el) return;

    if (!Array.isArray(rows) || rows.length === 0) {
      el.innerHTML =
        '<tr><td>まだ記録がありません</td></tr>';
      return;
    }

    let html =
      '<tr>' +
      '<th>日付</th>' +
      '<th>走行距離(km)</th>' +
      '<th>アクセス数</th>' +
      '<th>アクセス/km</th>' +
      '<th>メモ</th>' +
      '</tr>';

    rows.forEach((r) => {
      html +=
        `<tr>` +
        `<td>${esc(r.date)}</td>` +
        `<td>${esc(r.distance_km)}</td>` +
        `<td>${esc(r.accesses)}</td>` +
        `<td>${r.per_km === null ? '-' : esc(r.per_km)}</td>` +
        `<td>${esc(r.note || '')}</td>` +
        `</tr>`;
    });

    el.innerHTML = html;
  }

  // --------------------------------
  // グラフ
  // --------------------------------
  function renderCharts(byDate, byHour, byDow) {
    if (typeof Chart === 'undefined') {
      showError(
        'Chart.js が読み込まれていません。\n' +
        'admin.html のChart.js読み込みを確認してください。'
      );
      return;
    }

    const dateCtx =
      document.getElementById('chartByDate');

    const hourCtx =
      document.getElementById('chartByHour');

    const dowCtx =
      document.getElementById('chartByDow');

    if (!dateCtx || !hourCtx || !dowCtx) {
      showError(
        'グラフ用のcanvasが見つかりません。'
      );
      return;
    }

    if (dateChart) dateChart.destroy();
    if (hourChart) hourChart.destroy();
    if (dowChart) dowChart.destroy();

    const dates =
      Array.isArray(byDate) ? byDate : [];

    const hours =
      Array.isArray(byHour) ? byHour : [];

    const dows =
      Array.isArray(byDow) ? byDow : [];

    // 日別
    dateChart = new Chart(dateCtx, {
      type: 'bar',

      data: {
        labels: dates.map((d) => d.date),

        datasets: [
          {
            label: 'アクセス数',
            data: dates.map((d) => d.cnt),
            backgroundColor: '#4cd97b'
          }
        ]
      },

      options: {
        responsive: true,

        plugins: {
          legend: {
            display: false
          }
        }
      }
    });

    // 時間帯別
    const hourMap = {};

    for (let h = 0; h < 24; h++) {
      hourMap[h] = 0;
    }

    hours.forEach((h) => {
      hourMap[h.hour] = h.cnt;
    });

    hourChart = new Chart(hourCtx, {
      type: 'bar',

      data: {
        labels: Object.keys(hourMap).map(
          (h) => h + '時'
        ),

        datasets: [
          {
            label: 'アクセス数',
            data: Object.values(hourMap),
            backgroundColor: '#5b9bd5'
          }
        ]
      },

      options: {
        responsive: true,

        plugins: {
          legend: {
            display: false
          }
        }
      }
    });

    // 曜日別
    const dowMap = {};

    for (let d = 0; d < 7; d++) {
      dowMap[d] = 0;
    }

    dows.forEach((d) => {
      dowMap[d.dow] = d.cnt;
    });

    dowChart = new Chart(dowCtx, {
      type: 'bar',

      data: {
        labels: Object.keys(dowMap).map(
          (d) => DOW_LABELS[d]
        ),

        datasets: [
          {
            label: 'アクセス数',
            data: Object.values(dowMap),
            backgroundColor: '#e0a458'
          }
        ]
      },

      options: {
        responsive: true,

        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  }

  // --------------------------------
  // 統計取得
  // --------------------------------
  async function loadStats(token) {
    console.log('loadStats START');

    try {
      const url =
        '/api/stats?token=' +
        encodeURIComponent(token);

      console.log('API:', url);

      const res = await fetch(url);

      console.log(
        'API response:',
        res.status,
        res.statusText
      );

      if (!res.ok) {
        let body = '';

        try {
          body = await res.text();
        } catch (e) {
          body = '';
        }

        throw new Error(
          `/api/stats がエラーを返しました。\n` +
          `HTTP ${res.status} ${res.statusText}\n\n` +
          body
        );
      }

      const data = await res.json();

      console.log('API data:', data);

      if (!data || typeof data !== 'object') {
        throw new Error(
          'APIから正しいJSONデータが返ってきませんでした。'
        );
      }

      // 基本統計
      const statTotal =
        document.getElementById('statTotal');

      const statUnique =
        document.getElementById('statUnique');

      const statToday =
        document.getElementById('statToday');

      const statAvgPerDay =
        document.getElementById('statAvgPerDay');

      const statTotalKm =
        document.getElementById('statTotalKm');

      const statPerKm =
        document.getElementById('statPerKm');

      if (statTotal)
        statTotal.textContent =
          data.total ?? 0;

      if (statUnique)
        statUnique.textContent =
          data.unique ?? 0;

      if (statToday)
        statToday.textContent =
          data.today ?? 0;

      if (statAvgPerDay)
        statAvgPerDay.textContent =
          data.avgPerDay ?? 0;

      if (statTotalKm)
        statTotalKm.textContent =
          data.totalKm ?? 0;

      if (statPerKm)
        statPerKm.textContent =
          data.overallPerKm === null ||
          data.overallPerKm === undefined
            ? '-'
            : data.overallPerKm;

      renderByCar(data.byCar);
      renderCharts(
        data.byDate,
        data.byHour,
        data.byDow
      );

      renderFraud(
        data.suspiciousSessions,
        data.suspiciousIPs
      );

      renderKeyValTable(
        document.getElementById('tableReferrer'),
        data.byReferrer,
        'リファラー',
        '件数',
        'referrer',
        'cnt'
      );

      renderKeyValTable(
        document.getElementById('tableUA'),
        data.byUserAgent,
        'User-Agent',
        '件数',
        'user_agent',
        'cnt'
      );

      renderLog(data.recentLog);
      renderDriveLog(data.driveLogs);

      // CSV
      const csv =
        document.getElementById(
          'csvDownloadLink'
        );

      if (csv) {
        csv.href =
          '/api/export.csv?token=' +
          encodeURIComponent(token);
      }

      tokenForm.style.display = 'none';
      dashboard.style.display = 'block';

      console.log('Dashboard displayed');

    } catch (error) {
      console.error(error);

      showError(
        error.message ||
        '統計データの取得中にエラーが発生しました。'
      );

      tokenForm.style.display = 'flex';
      dashboard.style.display = 'none';
    }
  }

  // --------------------------------
  // 開始
  // --------------------------------
  async function start(token) {
    console.log('START:', token ? 'tokenあり' : 'tokenなし');

    currentToken = token;

    localStorage.setItem(
      TOKEN_KEY,
      token
    );

    await loadStats(token);

    if (refreshTimer) {
      clearInterval(refreshTimer);
    }

    refreshTimer = setInterval(
      function () {
        loadStats(token);
      },
      15000
    );
  }

  // --------------------------------
  // 表示ボタン
  // --------------------------------
  tokenSubmit.addEventListener(
    'click',
    async function () {
      console.log('表示ボタン CLICK');

      const token =
        tokenInput.value.trim();

      if (!token) {
        alert(
          '管理トークンを入力してください'
        );
        return;
      }

      try {
        await start(token);
      } catch (error) {
        showError(
          'start処理でエラーが発生しました。\n\n' +
          error.message
        );
      }
    }
  );

  // --------------------------------
  // Enterでも実行
  // --------------------------------
  tokenInput.addEventListener(
    'keydown',
    function (e) {
      if (e.key === 'Enter') {
        tokenSubmit.click();
      }
    }
  );

  // --------------------------------
  // 走行距離登録
  // --------------------------------
  const driveSubmit =
    document.getElementById(
      'driveSubmit'
    );

  if (driveSubmit) {
    driveSubmit.addEventListener(
      'click',
      async function () {
        try {
          const date =
            document.getElementById(
              'driveDate'
            ).value;

          const km =
            document.getElementById(
              'driveKm'
            ).value;

          const note =
            document.getElementById(
              'driveNote'
            ).value;

          if (!date) {
            alert(
              '日付を選択してください'
            );
            return;
          }

          if (
            km === '' ||
            Number(km) < 0
          ) {
            alert(
              '走行距離(km)を入力してください'
            );
            return;
          }

          if (!currentToken) {
            alert(
              '先に管理トークンを入力して「表示」を押してください'
            );
            return;
          }

          const res = await fetch(
            '/api/drive-log?token=' +
            encodeURIComponent(
              currentToken
            ),
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json'
              },

              body: JSON.stringify({
                date: date,
                distance_km:
                  Number(km),
                note: note
              })
            }
          );

          if (!res.ok) {
            const text =
              await res.text();

            throw new Error(
              '走行距離の記録に失敗しました。\n' +
              `HTTP ${res.status}\n\n` +
              text
            );
          }

          document.getElementById(
            'driveKm'
          ).value = '';

          document.getElementById(
            'driveNote'
          ).value = '';

          await loadStats(
            currentToken
          );

          alert(
            '走行距離を記録しました'
          );

        } catch (error) {
          showError(
            error.message
          );
        }
      }
    );
  }

  // --------------------------------
  // 今日の日付
  // --------------------------------
  const driveDate =
    document.getElementById(
      'driveDate'
    );

  if (driveDate) {
    driveDate.value =
      new Date()
        .toISOString()
        .slice(0, 10);
  }

  // --------------------------------
  // URLまたは保存済みトークン
  // --------------------------------
  const urlToken =
    new URLSearchParams(
      window.location.search
    ).get('token');

  const savedToken =
    urlToken ||
    localStorage.getItem(
      TOKEN_KEY
    );

  if (savedToken) {
    tokenInput.value =
      savedToken;

    start(savedToken);
  }

  console.log('ADMIN JS READY');
})();
