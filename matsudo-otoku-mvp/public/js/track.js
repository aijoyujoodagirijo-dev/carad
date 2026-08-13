(function () {
  const SESSION_KEY = 'matsudo_session_id';

  const params = new URLSearchParams(window.location.search);
  const carId = params.get('car') || 'unknown';

  let sessionId = localStorage.getItem(SESSION_KEY);
  let isFirstVisit = false;

  if (!sessionId) {
    sessionId =
      (window.crypto && window.crypto.randomUUID)
        ? window.crypto.randomUUID()
        : 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    localStorage.setItem(SESSION_KEY, sessionId);
    isFirstVisit = true;
  }

  fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      car_id: carId,
      session_id: sessionId,
      is_first_visit: isFirstVisit,
      url: window.location.href,
      referrer: document.referrer,
    }),
    keepalive: true,
  }).catch(function () {
    // 計測失敗してもページ表示は継続する
  });
})();
