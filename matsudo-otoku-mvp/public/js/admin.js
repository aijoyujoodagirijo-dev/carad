document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  console.log('ADMIN JS START');

  const TOKEN_KEY = 'matsudo_admin_token';
  const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

  const tokenForm = document.getElementById('tokenForm');
  const tokenInput = document.getElementById('tokenInput');
  const tokenSubmit = document.getElementById('tokenSubmit');
  const dashboard = document.getElementById('dashboard');
  const adminError = document.getElementById('adminError');

  let currentToken = null;
  let dateChart = null;
  let hourChart = null;
  let dowChart = null;
  let refreshTimer = null;

  function showError(message) {
    console.error(message);

    if (adminError) {
      adminError.style.display = 'block';
      adminError.textContent =
        '⚠️ ダッシュボードエラー\n\n' + message;
    } else {
      alert(message);
    }
  }

  function clearError() {
    if (adminError) {
      adminError.style.display = 'none';
      adminError.textContent = '';
    }
  }

  function esc(value) {
    if (value === null || value === undefined) {
      return '';
    }

    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function renderByCar(rows) {
    const el = document.getElementById('tableByCar');
    if (!el) return;

    rows = Array.isArray(rows) ? rows : [];

    let html =
      '<tr>' +
      '<th>車両ID</th>' +
      '<th>総アクセス</th>' +
      '<th>ユニーク</th>' +
      '</tr>';

    if (rows.length === 0) {
      html += '<tr><td colspan="3">データなし</td></tr>';
    } else {
      rows.forEach(function (r) {
        html +=
          '<tr>' +
          '<td>' + esc(r.car_id) + '</td>' +
          '<td>' + esc(r.total) + '</td>' +
          '<td>' + esc(r.unique_sessions) + '</td>' +
          '</tr>';
      });
    }

    el.innerHTML = html;
  }

  function renderTable(
    el,
    rows,
    keyLabel,
    valueLabel,
    keyField,
    valueField
  ) {
    if (!el) return;

    rows = Array.isArray(rows) ? rows : [];

    let html =
      '<tr>' +
      '<th>' + esc(keyLabel) + '</th>' +
      '<th>' + esc(valueLabel) + '</th>' +
      '</tr>';

    if (rows.length === 0) {
      html += '<tr><td colspan="2">データなし</td></tr>';
    } else {
      rows.forEach(function (r) {
        html +=
          '<tr>' +
          '<td>' + esc(r[keyField]) + '</td>' +
          '<td>' + esc(r[valueField]) + '</td>' +
          '</tr>';
      });
    }

    el.innerHTML = html;
  }

  function renderLog(rows) {
    const el = document.getElementById('tableLog');
    if (!el) return;

    rows = Array.isArray(rows) ? rows : [];

    let html =
      '<tr>' +
      '<th>日時</th>' +
      '<th>車両</th>' +
      '<th>初回</th>' +
      '<th>IP</th>' +
      '<th>User-Agent</th>' +
      '</tr>';

    if (rows.length === 0) {
      html += '<tr><td colspan="5">データなし</td></tr>';
    } else {
      rows.forEach(function (r) {
        const ua = r.user_agent || '';

        html +=
          '<tr>' +
          '<td>' + esc(r.accessed_at) + '</td>' +
          '<td>' + esc(r.car_id) + '</td>' +
          '<td>' +
          (r.is_first_visit ? '初回' : '再訪') +
          '</td>' +
          '<td>' + esc(r.ip_address) + '</td>' +
          '<td title="' + esc(ua) + '">' +
          esc(ua.slice(0, 30)) +
          (ua.length > 30 ? '...' : '') +
          '</td>' +
          '</tr>';
      });
    }

    el.innerHTML = html;
  }

  function renderDriveLog(rows) {
    const el = document.getElementById('tableDriveLog');
    if (!el) return;

    rows = Array.isArray(rows) ? rows : [];

    let html =
      '<tr>' +
      '<th>日付</th>' +
      '<th>走行距離(km)</th>' +
      '<th>アクセス数</th>' +
      '<th>アクセス/km</th>' +
      '<th>メモ</th>' +
      '</tr>';

    if (rows.length === 0) {
      html +=
        '<tr>' +
        '<td colspan="5">まだ記録がありません</td>' +
        '</tr>';
    } else {
      rows.forEach(function (r) {
        html +=
          '<tr>' +
          '<td>' + esc(r.date) + '</td>' +
          '<td>' + esc(r.distance_km) + '</td>' +
          '<td>' + esc(r.accesses) + '</td>' +
          '<td>' +
          (
            r.per_km === null ||
            r.per_km === undefined
              ? '-'
              : esc(r.per_km)
          ) +
          '</td>' +
          '<td>' + esc(r.note || '') + '</td>' +
          '</tr>';
      });
    }

    el.innerHTML = html;
  }

  function renderFraud(sessions, ips) {
    const el = document.getElementById('fraudContent');
    if (!el) return;

    sessions = Array.isArray(sessions) ? sessions : [];
    ips = Array.isArray(ips) ? ips : [];

    if (
      sessions.length === 0 &&
      ips.length === 0
    ) {
      el.innerHTML =
        '<p style="font-size:13px;color:#8bc9a3;">' +
        '直近1時間で疑わしいアクセスは検出されていません。' +
        '</p>';
      return;
    }

    let html = '';

    sessions.forEach(function (s) {
      html +=
        '<div class="warn-box">' +
        'セッション ' +
        esc(s.session_id) +
        ' が車両 ' +
        esc(s.car_id) +
        ' に ' +
        esc(s.cnt) +
        '回アクセス（直近1時間）' +
        '</div>';
    });

    ips.forEach(function (i) {
      html +=
        '<div class="warn-box">' +
        'IP ' +
        esc(i.ip_address) +
        ' から ' +
        esc(i.cnt) +
        '回アクセス / ' +
        esc(i.sessions) +
        'セッション（直近1時間）' +
        '</div>';
    });

    el.innerHTML = html;
  }

  function destroyCharts() {
    if (dateChart) {
      dateChart.destroy();
      dateChart = null;
    }

    if (hourChart) {
      hourChart.destroy();
      hourChart = null;
    }

    if (dowChart) {
      dowChart.destroy();
      dowChart = null;
    }
  }

  function renderCharts(byDate, byHour, byDow) {
    console.log('グラフ描画開始');

    if (typeof Chart === 'undefined') {
      showError(
        'Chart.js が読み込まれていません。' +
        '\nadmin.html のChart.js読み込みを確認してください。'
      );
      return;
    }

    byDate = Array.isArray(byDate) ? byDate : [];
    byHour = Array.isArray(byHour) ? byHour : [];
    byDow = Array.isArray(byDow) ? byDow : [];

    const dateCanvas =
      document.getElementById('chartByDate');

    const hourCanvas =
      document.getElementById('chartByHour');

    const dowCanvas =
      document.getElementById('chartByDow');

    if (
      !dateCanvas ||
      !hourCanvas ||
      !dowCanvas
    ) {
      showError(
        'グラフ用のcanvasが見つかりません。\n' +
        'admin.html のIDを確認してください。'
      );
      return;
    }

    destroyCharts();

    /*
     * 日別
     */

    const dateLabels = byDate.map(function (item) {
      return String(item.date || '');
    });

    const dateValues = byDate.map(function (item) {
      return num(item.cnt);
    });

    dateChart = new Chart(dateCanvas, {
      type: 'bar',

      data: {
        labels: dateLabels,

        datasets: [{
          label: 'アクセス数',
          data: dateValues
        }]
      },

      options: {
        responsive: true,
        maintainAspectRatio: false,

        scales: {
          y: {
            beginAtZero: true,

            ticks: {
              precision: 0
            }
          }
        },

        plugins: {
          legend: {
            display: false
          }
        }
      }
    });

    /*
     * 時間帯別
     */

    const hourMap = {};

    for (let h = 0; h < 24; h++) {
      hourMap[h] = 0;
    }

    byHour.forEach(function (item) {
      const hour = Number(item.hour);

      if (
        Number.isInteger(hour) &&
        hour >= 0 &&
        hour <= 23
      ) {
        hourMap[hour] = num(item.cnt);
      }
    });

    const hourLabels = [];
    const hourValues = [];

    for (let h = 0; h < 24; h++) {
      hourLabels.push(h + '時');
      hourValues.push(hourMap[h]);
    }

    hourChart = new Chart(hourCanvas, {
      type: 'bar',

      data: {
        labels: hourLabels,

        datasets: [{
          label: 'アクセス数',
          data: hourValues
        }]
      },

      options: {
        responsive: true,
        maintainAspectRatio: false,

        scales: {
          y: {
            beginAtZero: true,

            ticks: {
              precision: 0
            }
          }
        },

        plugins: {
          legend: {
            display: false
          }
        }
      }
    });

    /*
     * 曜日別
     */

    const dowMap = {};

    for (let d = 0; d < 7; d++) {
      dowMap[d] = 0;
    }

    byDow.forEach(function (item) {
      const dow = Number(item.dow);

      if (
        Number.isInteger(dow) &&
        dow >= 0 &&
        dow <= 6
      ) {
        dowMap[dow] = num(item.cnt);
      }
    });

    const dowValues = [];

    for (let d = 0; d < 7; d++) {
      dowValues.push(dowMap[d]);
    }

    dowChart = new Chart(dowCanvas, {
      type: 'bar',

      data: {
        labels: DOW_LABELS,

        datasets: [{
          label: 'アクセス数',
          data: dowValues
        }]
      },

      options: {
        responsive: true,
        maintainAspectRatio: false,

        scales: {
          y: {
            beginAtZero: true,

            ticks: {
              precision: 0
            }
          }
        },

        plugins: {
          legend: {
            display: false
          }
        }
      }
    });

    console.log('グラフ描画完了');
  }

  async function loadStats(token) {
    console.log('統計取得開始');

    try {
      const response = await fetch(
        '/api/stats?token=' +
        encodeURIComponent(token),
        {
          cache: 'no-store'
        }
      );

      console.log(
        'API status:',
        response.status
      );

      if (!response.ok) {
        if (response.status === 401 ||
            response.status === 403) {
          localStorage.removeItem(TOKEN_KEY);
          currentToken = null;

          if (tokenForm) {
            tokenForm.style.display = 'flex';
          }

          if (dashboard) {
            dashboard.style.display = 'none';
          }

          throw new Error(
            '管理トークンが正しくありません。'
          );
        }

        throw new Error(
          'APIエラー: HTTP ' +
          response.status
        );
      }

      const data = await response.json();

      console.log('API data:', data);

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

      if (statTotal) {
        statTotal.textContent =
          data.total ?? 0;
      }

      if (statUnique) {
        statUnique.textContent =
          data.unique ?? 0;
      }

      if (statToday) {
        statToday.textContent =
          data.today ?? 0;
      }

      if (statAvgPerDay) {
        statAvgPerDay.textContent =
          data.avgPerDay ?? 0;
      }

      if (statTotalKm) {
        statTotalKm.textContent =
          data.totalKm ?? 0;
      }

      if (statPerKm) {
        statPerKm.textContent =
          data.overallPerKm === null ||
          data.overallPerKm === undefined
            ? '-'
            : data.overallPerKm;
      }

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

      renderTable(
        document.getElementById(
          'tableReferrer'
        ),
        data.byReferrer,
        'リファラー',
        '件数',
        'referrer',
        'cnt'
      );

      renderTable(
        document.getElementById(
          'tableUA'
        ),
        data.byUserAgent,
        'User-Agent',
        '件数',
        'user_agent',
        'cnt'
      );

      renderLog(data.recentLog);

      renderDriveLog(data.driveLogs);

      const csvLink =
        document.getElementById(
          'csvDownloadLink'
        );

      if (csvLink) {
        csvLink.href =
          '/api/export.csv?token=' +
          encodeURIComponent(token);
      }

      if (tokenForm) {
        tokenForm.style.display = 'none';
      }

      if (dashboard) {
        dashboard.style.display = 'block';
      }

      clearError();

      console.log(
        'ダッシュボード表示完了'
      );

    } catch (error) {
      console.error(
        'loadStats error:',
        error
      );

      showError(
        'データ取得に失敗しました。\n\n' +
        error.message
      );
    }
  }

  function start(token) {
    if (!token) {
      showError(
        '管理トークンを入力してください。'
      );
      return;
    }

    currentToken = token;

    localStorage.setItem(
      TOKEN_KEY,
      token
    );

    loadStats(token);

    /*
     * 既存のタイマーを止める
     */
    if (refreshTimer) {
      clearInterval(refreshTimer);
    }

    /*
     * 15秒ごとに更新
     */
    refreshTimer = setInterval(
      function () {
        if (currentToken) {
          loadStats(currentToken);
        }
      },
      15000
    );
  }

  /*
   * 表示ボタン
   */

  if (tokenSubmit && tokenInput) {
    tokenSubmit.addEventListener(
      'click',
      function () {
        console.log(
          '表示ボタンが押されました'
        );

        const token =
          tokenInput.value.trim();

        if (!token) {
          showError(
            '管理トークンを入力してください。'
          );
          return;
        }

        start(token);
      }
    );

    tokenInput.addEventListener(
      'keydown',
      function (event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          tokenSubmit.click();
        }
      }
    );
  } else {
    showError(
      '管理トークン入力欄が見つかりません。\n' +
      'admin.html のtokenInput / tokenSubmitを確認してください。'
    );
  }

  /*
   * 走行距離
   */

  const driveSubmit =
    document.getElementById(
      'driveSubmit'
    );

  if (driveSubmit) {
    driveSubmit.addEventListener(
      'click',
      async function () {
        const dateEl =
          document.getElementById(
            'driveDate'
          );

        const kmEl =
          document.getElementById(
            'driveKm'
          );

        const noteEl =
          document.getElementById(
            'driveNote'
          );

        const date =
          dateEl ? dateEl.value : '';

        const km =
          kmEl ? kmEl.value : '';

        const note =
          noteEl ? noteEl.value : '';

        if (!date) {
          alert(
            '日付を選択してください。'
          );
          return;
        }

        if (
          km === '' ||
          Number(km) < 0
        ) {
          alert(
            '走行距離(km)を入力してください。'
          );
          return;
        }

        if (!currentToken) {
          alert(
            '先に管理トークンを入力してください。'
          );
          return;
        }

        try {
          const response =
            await fetch(
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

          if (!response.ok) {
            throw new Error(
              '走行距離登録エラー: HTTP ' +
              response.status
            );
          }

          if (kmEl) {
            kmEl.value = '';
          }

          if (noteEl) {
            noteEl.value = '';
          }

          await loadStats(
            currentToken
          );

        } catch (error) {
          showError(
            error.message
          );
        }
      }
    );
  }

  /*
   * 今日の日付を初期値にする
   */

  const driveDate =
    document.getElementById(
      'driveDate'
    );

  if (driveDate && !driveDate.value) {
    driveDate.value =
      new Date()
        .toISOString()
        .slice(0, 10);
  }

  /*
   * URLの ?token= または保存済みトークン
   */

  const urlToken =
    new URLSearchParams(
      window.location.search
    ).get('token');

  const savedToken =
    urlToken ||
    localStorage.getItem(
      TOKEN_KEY
    );

  if (
    savedToken &&
    tokenInput
  ) {
    tokenInput.value =
      savedToken;

    start(savedToken);
  }

  console.log(
    'ADMIN JS READY'
  );
});
