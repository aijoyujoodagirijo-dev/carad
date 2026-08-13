(function () {
window.onerror = function(message, source, lineno, colno, error) {
  document.body.insertAdjacentHTML(
    'afterbegin',
    '<div style="background:#fee;color:#900;padding:20px;font-size:16px;white-space:pre-wrap;">JSエラー: ' +
    message +
    '</div>'
  );
};

console.log('ADMIN JS START');
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

  function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function renderKeyValTable(el, rows, keyLabel, valLabel, keyField, valField) {
    let html = `<tr><th>${keyLabel}</th><th>${valLabel}</th></tr>`;
    rows.forEach((r) => {
      html += `<tr><td>${esc(r[keyField])}</td><td>${esc(r[valField])}</td></tr>`;
    });
    el.innerHTML = html || '<tr><td>データなし</td></tr>';
  }

  function renderByCar(rows) {
    let html = '<tr><th>車両ID</th><th>総アクセス</th><th>ユニーク</th></tr>';
    rows.forEach((r) => {
      html += `<tr><td>${esc(r.car_id)}</td><td>${r.total}</td><td>${r.unique_sessions}</td></tr>`;
    });
    document.getElementById('tableByCar').innerHTML = html || '<tr><td>データなし</td></tr>';
  }

  function renderLog(rows) {
    let html = '<tr><th>日時</th><th>車両</th><th>初回</th><th>IP</th><th>UA</th></tr>';
    rows.forEach((r) => {
      html += `<tr>
        <td>${esc(r.accessed_at)}</td>
        <td>${esc(r.car_id)}</td>
        <td>${r.is_first_visit ? '初回' : '再訪'}</td>
        <td>${esc(r.ip_address)}</td>
        <td title="${esc(r.user_agent)}">${esc((r.user_agent || '').slice(0, 30))}...</td>
      </tr>`;
    });
    document.getElementById('tableLog').innerHTML = html;
  }

  function renderFraud(sessions, ips) {
    const el = document.getElementById('fraudContent');
    if ((!sessions || sessions.length === 0) && (!ips || ips.length === 0)) {
      el.innerHTML = '<p style="font-size:13px;color:#8bc9a3;">直近1時間で疑わしいアクセスは検出されていません。</p>';
      return;
    }
    let html = '';
    sessions.forEach((s) => {
      html += `<div class="warn-box">セッション ${esc(s.session_id)} が車両${esc(s.car_id)}に ${s.cnt}回 アクセス（直近1時間）</div>`;
    });
    ips.forEach((i) => {
      html += `<div class="warn-box">IP ${esc(i.ip_address)} から ${i.cnt}回 アクセス / ${i.sessions}セッション（直近1時間）</div>`;
    });
    el.innerHTML = html;
  }

  function renderDriveLog(rows) {
    let html = '<tr><th>日付</th><th>走行距離(km)</th><th>アクセス数</th><th>アクセス/km</th><th>メモ</th></tr>';
    rows.forEach((r) => {
      html += `<tr>
        <td>${esc(r.date)}</td>
        <td>${esc(r.distance_km)}</td>
        <td>${esc(r.accesses)}</td>
        <td>${r.per_km === null ? '-' : esc(r.per_km)}</td>
        <td>${esc(r.note || '')}</td>
      </tr>`;
    });
    document.getElementById('tableDriveLog').innerHTML = html || '<tr><td>まだ記録がありません</td></tr>';
  }

  function renderCharts(byDate, byHour, byDow) {
    const dateCtx = document.getElementById('chartByDate');
    const hourCtx = document.getElementById('chartByHour');
    const dowCtx = document.getElementById('chartByDow');

    if (dateChart) dateChart.destroy();
    if (hourChart) hourChart.destroy();
    if (dowChart) dowChart.destroy();

    dateChart = new Chart(dateCtx, {
      type: 'bar',
      data: {
        labels: byDate.map((d) => d.date),
        datasets: [{ label: 'アクセス数', data: byDate.map((d) => d.cnt), backgroundColor: '#4cd97b' }],
      },
      options: { plugins: { legend: { display: false } } },
    });

    const hourMap = {};
    for (let h = 0; h < 24; h++) hourMap[h] = 0;
    byHour.forEach((h) => (hourMap[h.hour] = h.cnt));

    hourChart = new Chart(hourCtx, {
      type: 'bar',
      data: {
        labels: Object.keys(hourMap).map((h) => h + '時'),
        datasets: [{ label: 'アクセス数', data: Object.values(hourMap), backgroundColor: '#5b9bd5' }],
      },
      options: { plugins: { legend: { display: false } } },
    });

    const dowMap = {};
    for (let d = 0; d < 7; d++) dowMap[d] = 0;
    byDow.forEach((d) => (dowMap[d.dow] = d.cnt));

    dowChart = new Chart(dowCtx, {
      type: 'bar',
      data: {
        labels: Object.keys(dowMap).map((d) => DOW_LABELS[d]),
        datasets: [{ label: 'アクセス数', data: Object.values(dowMap), backgroundColor: '#e0a458' }],
      },
      options: { plugins: { legend: { display: false } } },
    });
  }

  async function loadStats(token) {
    const res = await fetch('/api/stats?token=' + encodeURIComponent(token));
    if (!res.ok) {
      alert('トークンが正しくないか、取得に失敗しました');
      localStorage.removeItem(TOKEN_KEY);
      tokenForm.style.display = 'flex';
      dashboard.style.display = 'none';
      return;
    }
    const data = await res.json();

    document.getElementById('statTotal').textContent = data.total;
    document.getElementById('statUnique').textContent = data.unique;
    document.getElementById('statToday').textContent = data.today;
    document.getElementById('statAvgPerDay').textContent = data.avgPerDay;
    document.getElementById('statTotalKm').textContent = data.totalKm;
    document.getElementById('statPerKm').textContent = data.overallPerKm === null ? '-' : data.overallPerKm;

    renderByCar(data.byCar);
    renderCharts(data.byDate, data.byHour, data.byDow);
    renderFraud(data.suspiciousSessions, data.suspiciousIPs);
    renderKeyValTable(document.getElementById('tableReferrer'), data.byReferrer, 'リファラー', '件数', 'referrer', 'cnt');
    renderKeyValTable(document.getElementById('tableUA'), data.byUserAgent, 'User-Agent', '件数', 'user_agent', 'cnt');
    renderLog(data.recentLog);
    renderDriveLog(data.driveLogs);

    // CSVダウンロードリンクにトークンを反映
    document.getElementById('csvDownloadLink').href = '/api/export.csv?token=' + encodeURIComponent(token);

    tokenForm.style.display = 'none';
    dashboard.style.display = 'block';
  }

  function start(token) {
    currentToken = token;
    localStorage.setItem(TOKEN_KEY, token);
    loadStats(token);
    setInterval(() => loadStats(token), 15000); // 15秒ごとに自動更新
  }

  tokenSubmit.addEventListener('click', () => {
    const token = tokenInput.value.trim();
    if (token) start(token);
  });

  tokenInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') tokenSubmit.click();
  });

  // 走行距離の登録
  document.getElementById('driveSubmit').addEventListener('click', async () => {
    const date = document.getElementById('driveDate').value;
    const km = document.getElementById('driveKm').value;
    const note = document.getElementById('driveNote').value;

    if (!date) {
      alert('日付を選択してください');
      return;
    }
    if (km === '' || Number(km) < 0) {
      alert('走行距離(km)を入力してください');
      return;
    }
    if (!currentToken) return;

    const res = await fetch('/api/drive-log?token=' + encodeURIComponent(currentToken), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, distance_km: Number(km), note }),
    });

    if (!res.ok) {
      alert('走行距離の記録に失敗しました');
      return;
    }

    document.getElementById('driveKm').value = '';
    document.getElementById('driveNote').value = '';
    loadStats(currentToken);
  });

  // 今日の日付を初期値にしておく(入力の手間を減らす)
  document.getElementById('driveDate').value = new Date().toISOString().slice(0, 10);

  // URLの ?token=... からも読み取れるようにする
  const urlToken = new URLSearchParams(window.location.search).get('token');
  const savedToken = urlToken || localStorage.getItem(TOKEN_KEY);
  if (savedToken) {
    tokenInput.value = savedToken;
    start(savedToken);
  }
})();
