document.addEventListener('DOMContentLoaded', function () {

  console.log('ADMIN JS START');

  const TOKEN_KEY = 'matsudo_admin_token';

  const tokenForm = document.getElementById('tokenForm');
  const tokenInput = document.getElementById('tokenInput');
  const tokenSubmit = document.getElementById('tokenSubmit');
  const dashboard = document.getElementById('dashboard');
  const adminError = document.getElementById('adminError');

  let currentToken = null;
  let dateChart = null;
  let hourChart = null;
  let dowChart = null;

  function showError(message) {
    console.error(message);

    if (adminError) {
      adminError.style.display = 'block';
      adminError.textContent = '⚠️ ダッシュボードエラー\n\n' + message;
    } else {
      alert(message);
    }
  }

  function esc(value) {
    if (value === null || value === undefined) return '';

    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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

  function renderTable(el, rows, keyLabel, valueLabel, keyField, valueField) {

    if (!el) return;

    rows = Array.isArray(rows) ? rows : [];

    let html =
      '<tr>' +
      '<th>' + keyLabel + '</th>' +
      '<th>' + valueLabel + '</th>' +
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
          '<td>' + (r.is_first_visit ? '初回' : '再訪') + '</td>' +
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
          (r.per_km === null || r.per_km === undefined
            ? '-'
            : esc(r.per_km)) +
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

    if (sessions.length === 0 && ips.length === 0) {

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
        ' が車両' +
        esc(s.car_id) +
        'に ' +
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

  function renderCharts(byDate, byHour, byDow) {

    /*
     * Chart.jsが読み込めなくても、
     * ダッシュボード自体は表示できるようにする。
     */

    if (typeof Chart === 'undefined') {

      console.warn('Chart.js が読み込まれていません。');

      return;
    }

    byDate = Array.isArray(byDate) ? byDate : [];
    byHour = Array.isArray(byHour) ? byHour : [];
    byDow = Array.isArray(byDow) ? byDow : [];

    const dateCanvas = document.getElementById('chartByDate');
    const hourCanvas = document.getElementById('chartByHour');
    const dowCanvas = document.getElementById('chartByDow');

    if (!dateCanvas || !hourCanvas || !dowCanvas) return;

    if (dateChart) dateChart.destroy();
    if (hourChart) hourChart.destroy();
    if (dowChart) dowChart.destroy();

    dateChart = new Chart(dateCanvas, {
      type: 'bar',
      data: {
        labels: byDate.map(function (d) {
          return d.date;
        }),
        datasets: [{
          label: 'アクセス数',
          data: byDate.map(function (d) {
            return d.cnt;
          })
        }]
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

    const hourMap = {};

    for (let h = 0; h < 24; h++) {
      hourMap[h] = 0;
    }

    byHour.forEach(function (h) {
      hourMap[h.hour] = h.cnt;
    });

    hourChart = new Chart(hourCanvas, {
      type: 'bar',
      data: {
        labels: Object.keys(hourMap).map(function (h) {
          return h + '時';
        }),
        datasets: [{
          label: 'アクセス数',
          data: Object.values(hourMap)
        }]
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

    const dowLabels = [
      '日',
      '月',
      '火',
      '水',
      '木',
      '金',
      '土'
    ];

    const dowMap = {};

    for (let d = 0; d < 7; d++) {
      dowMap[d] = 0;
    }

    byDow.forEach(function (d) {
      dowMap[d.dow] = d.cnt;
    });

    dowChart = new Chart(dowCanvas, {
      type: 'bar',
      data: {
        labels: Object.keys(dowMap).map(function (d) {
          return dowLabels[d];
        }),
        datasets: [{
          label: 'アクセス数',
          data: Object.values(dowMap)
        }]
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

  async function loadStats(token) {

    console.log('統計取得開始');

    try {

      const response = await fetch(
        '/api/stats?token=' +
        encodeURIComponent(token)
      );

      console.log('API status:', response.status);

      if (!response.ok) {

        throw new Error(
          'APIエラー: HTTP ' + response.status
        );
      }

      const data = await response.json();

      console.log('API data:', data);

      document.getElementById('statTotal').textContent =
        data.total ?? 0;

      document.getElementById('statUnique').textContent =
        data.unique ?? 0;

      document.getElementById('statToday').textContent =
        data.today ?? 0;

      document.getElementById('statAvgPerDay').textContent =
        data.avgPerDay ?? 0;

      document.getElementById('statTotalKm').textContent =
        data.totalKm ?? 0;

      document.getElementById('statPerKm').textContent =
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

      renderTable(
        document.getElementById('tableReferrer'),
        data.byReferrer,
        'リファラー',
        '件数',
        'referrer',
        'cnt'
      );

      renderTable(
        document.getElementById('tableUA'),
        data.byUserAgent,
        'User-Agent',
        '件数',
        'user_agent',
        'cnt'
      );

      renderLog(data.recentLog);

      renderDriveLog(data.driveLogs);

      const csvLink =
        document.getElementById('csvDownloadLink');

      if (csvLink) {

        csvLink.href =
          '/api/export.csv?token=' +
          encodeURIComponent(token);
      }

      tokenForm.style.display = 'none';
      dashboard.style.display = 'block';

      if (adminError) {
        adminError.style.display = 'none';
      }

      console.log('ダッシュボード表示完了');

    } catch (error) {

      console.error(error);

      showError(
        'データ取得に失敗しました。\n\n' +
        error.message
      );
    }
  }

  function start(token) {

    if (!token) {
      showError('管理トークンを入力してください。');
      return;
    }

    currentToken = token;

    localStorage.setItem(
      TOKEN_KEY,
      token
    );

    loadStats(token);
  }

  /*
   * 「表示」ボタン
   */
  if (tokenSubmit) {

    tokenSubmit.addEventListener(
      'click',
      function () {

        console.log('表示ボタンが押されました');

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

  } else {

    showError(
      'tokenSubmit が見つかりません。\n' +
      'admin.html のIDを確認してください。'
    );
  }

  /*
   * Enterキー
   */
  if (tokenInput) {

    tokenInput.addEventListener(
      'keydown',
      function (event) {

        if (event.key === 'Enter') {

          event.preventDefault();

          tokenSubmit.click();
        }
      }
    );
  }

  /*
   * 走行距離
   */
  const driveSubmit =
    document.getElementById('driveSubmit');

  if (driveSubmit) {

    driveSubmit.addEventListener(
      'click',
      async function () {

        const date =
          document.getElementById('driveDate').value;

        const km =
          document.getElementById('driveKm').value;

        const note =
          document.getElementById('driveNote').value;

        if (!date) {

          alert('日付を選択してください。');

          return;
        }

        if (km === '' || Number(km) < 0) {

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

          const response = await fetch(
            '/api/drive-log?token=' +
            encodeURIComponent(currentToken),
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                date: date,
                distance_km: Number(km),
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

          document.getElementById(
            'driveKm'
          ).value = '';

          document.getElementById(
            'driveNote'
          ).value = '';

          loadStats(currentToken);

        } catch (error) {

          showError(error.message);
        }
      }
    );
  }

  /*
   * 今日の日付
   */
  const driveDate =
    document.getElementById('driveDate');

  if (driveDate) {

    driveDate.value =
      new Date().toISOString().slice(0, 10);
  }

  /*
   * URLまたは保存済みトークン
   */
  const urlToken =
    new URLSearchParams(
      window.location.search
    ).get('token');

  const savedToken =
    urlToken ||
    localStorage.getItem(TOKEN_KEY);

  if (savedToken) {

    tokenInput.value = savedToken;

    start(savedToken);
  }

});
