document.addEventListener('DOMContentLoaded', function () {

  const TOKEN_KEY = 'matsudo_admin_token';

  const tokenForm = document.getElementById('tokenForm');
  const tokenInput = document.getElementById('tokenInput');
  const tokenSubmit = document.getElementById('tokenSubmit');
  const dashboard = document.getElementById('dashboard');

  let currentToken = null;

  function esc(value) {
    if (value === null || value === undefined) return '';

    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showError(message) {
    console.error(message);
    alert('⚠️ ダッシュボードエラー\n\n' + message);
  }

  function renderByCar(rows) {
    const el = document.getElementById('tableByCar');
    if (!el) return;

    rows = Array.isArray(rows) ? rows : [];

    let html =
      '<tr><th>車両ID</th><th>総アクセス</th><th>ユニーク</th></tr>';

    if (!rows.length) {
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
      '<tr><th>' + keyLabel + '</th><th>' + valueLabel + '</th></tr>';

    if (!rows.length) {
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

    if (!rows.length) {
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
          '<td>' + esc(ua.slice(0, 30)) +
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

    if (!rows.length) {
      html += '<tr><td colspan="5">まだ記録がありません</td></tr>';
    } else {
      rows.forEach(function (r) {
        html +=
          '<tr>' +
          '<td>' + esc(r.date) + '</td>' +
          '<td>' + esc(r.distance_km) + '</td>' +
          '<td>' + esc(r.accesses) + '</td>' +
          '<td>' +
          (r.per_km == null ? '-' : esc(r.per_km)) +
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

    if (!sessions.length && !ips.length) {
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
        'セッション ' + esc(s.session_id) +
        ' が車両 ' + esc(s.car_id) +
        ' に ' + esc(s.cnt) +
        '回アクセス（直近1時間）' +
        '</div>';
    });

    ips.forEach(function (i) {
      html +=
        '<div class="warn-box">' +
        'IP ' + esc(i.ip_address) +
        ' から ' + esc(i.cnt) +
        '回アクセス / ' +
        esc(i.sessions) +
        'セッション（直近1時間）' +
        '</div>';
    });

    el.innerHTML = html;
  }

  /*
   * Chart.jsを使わない簡易グラフ
   */
  function renderSimpleChart(canvasId, rows, labelField, valueField, title) {

    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const parent = canvas.parentElement;

    const old = parent.querySelector('.simple-chart');
    if (old) old.remove();

    canvas.style.display = 'none';

    rows = Array.isArray(rows) ? rows : [];

    const box = document.createElement('div');
    box.className = 'simple-chart';

    const titleEl = document.createElement('div');
    titleEl.style.fontWeight = 'bold';
    titleEl.style.marginBottom = '10px';
    titleEl.textContent = title;

    box.appendChild(titleEl);

    if (!rows.length) {
      const empty = document.createElement('div');
      empty.textContent = 'まだデータがありません';
      empty.style.color = '#999';
      box.appendChild(empty);
      parent.appendChild(box);
      return;
    }

    let max = 0;

    rows.forEach(function (r) {
      const n = Number(r[valueField]) || 0;
      if (n > max) max = n;
    });

    rows.forEach(function (r) {

      const value = Number(r[valueField]) || 0;

      const row = document.createElement('div');
      row.style.marginBottom = '8px';

      const label = document.createElement('div');
      label.textContent = String(r[labelField]);
      label.style.fontSize = '12px';
      label.style.marginBottom = '3px';

      const barArea = document.createElement('div');
      barArea.style.display = 'flex';
      barArea.style.alignItems = 'center';
      barArea.style.gap = '8px';

      const bar = document.createElement('div');

      const width =
        max > 0
          ? Math.max(3, (value / max) * 100)
          : 3;

      bar.style.width = width + '%';
      bar.style.height = '18px';
      bar.style.background = '#4cd97b';
      bar.style.borderRadius = '4px';

      const number = document.createElement('span');
      number.textContent = value;
      number.style.fontSize = '12px';

      barArea.appendChild(bar);
      barArea.appendChild(number);

      row.appendChild(label);
      row.appendChild(barArea);

      box.appendChild(row);
    });

    parent.appendChild(box);
  }

  function renderCharts(byDate, byHour, byDow) {

    renderSimpleChart(
      'chartByDate',
      byDate,
      'date',
      'cnt',
      '日別アクセス数'
    );

    const hourRows = [];

    for (let h = 0; h < 24; h++) {
      let found = 0;

      (byHour || []).forEach(function (r) {
        if (Number(r.hour) === h) {
          found = Number(r.cnt) || 0;
        }
      });

      hourRows.push({
        hour: h + '時',
        cnt: found
      });
    }

    renderSimpleChart(
      'chartByHour',
      hourRows,
      'hour',
      'cnt',
      '時間帯別アクセス数'
    );

    const labels = ['日', '月', '火', '水', '木', '金', '土'];

    const dowRows = [];

    for (let d = 0; d < 7; d++) {
      let found = 0;

      (byDow || []).forEach(function (r) {
        if (Number(r.dow) === d) {
          found = Number(r.cnt) || 0;
        }
      });

      dowRows.push({
        dow: labels[d],
        cnt: found
      });
    }

    renderSimpleChart(
      'chartByDow',
      dowRows,
      'dow',
      'cnt',
      '曜日別アクセス数'
    );
  }

  async function loadStats(token) {

    try {

      const response = await fetch(
        '/api/stats?token=' +
        encodeURIComponent(token),
        {
          cache: 'no-store'
        }
      );

      if (!response.ok) {
        throw new Error(
          '統計APIエラー HTTP ' + response.status
        );
      }

      const data = await response.json();

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
        data.overallPerKm == null
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

  if (tokenSubmit) {

    tokenSubmit.addEventListener(
      'click',
      function () {

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
  }

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
          alert('走行距離(km)を入力してください。');
          return;
        }

        if (!currentToken) {
          alert('先に管理トークンを入力してください。');
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
              '走行距離登録エラー HTTP ' +
              response.status
            );
          }

          document.getElementById('driveKm').value = '';
          document.getElementById('driveNote').value = '';

          await loadStats(currentToken);

        } catch (error) {
          showError(error.message);
        }
      }
    );
  }

  const driveDate =
    document.getElementById('driveDate');

  if (driveDate) {
    driveDate.value =
      new Date().toISOString().slice(0, 10);
  }

  const urlToken =
    new URLSearchParams(
      window.location.search
    ).get('token');

  const savedToken =
    urlToken ||
    localStorage.getItem(TOKEN_KEY);

  if (savedToken && tokenInput) {
    tokenInput.value = savedToken;
    start(savedToken);
  }

});
