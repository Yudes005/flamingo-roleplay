// ============================================================
//  FLAMINGO MDT - zajednički pomoćnici (Policija + Vlada)
// ============================================================
window.FMDT = (() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => '$' + Math.floor(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const initials = (n) => String(n || '?').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
  const stars = (n) => `<span class="fm-stars">${[1, 2, 3, 4, 5].map((i) => `<i class="fa-solid fa-star ${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
  const dur = (s) => {
    s = Math.max(0, Math.floor(Number(s) || 0));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h ? `${h}h ${m}min` : `${m} min`;
  };
  const empty = (txt, icon) => `<div class="fm-empty"><i class="fa-solid ${icon || 'fa-inbox'}"></i>${esc(txt)}</div>`;
  const loading = (txt) => `<div class="fm-loading"><i class="fa-solid fa-spinner"></i>${esc(txt || 'Učitavanje...')}</div>`;
  const toast = (msg, type) => { if (msg && typeof showToast === 'function') showToast(esc(msg), type || 'info'); };

  // Modal unutar MDT-a (host = .fm element)
  function modal(host, o) {
    close(host);
    const m = document.createElement('div');
    m.className = 'fm-modal';
    m.innerHTML = `<div class="fm-dialog ${o.wide ? 'wide' : ''}">
      <div class="fm-dialog-h"><i class="fa-solid ${o.icon || 'fa-pen'}" style="color:var(--acc2)"></i><b>${esc(o.title)}</b>
        <button class="fm-back" data-fm-close><i class="fa-solid fa-xmark"></i></button></div>
      <div class="fm-dialog-b">${o.body}</div>
      <div class="fm-dialog-f"><button class="fm-btn" data-fm-close>Otkaži</button>
        <button class="fm-btn ${o.danger ? 'red' : 'acc'}" data-fm-ok>${o.ok || 'Sačuvaj'}</button></div>
    </div>`;
    host.appendChild(m);
    m.addEventListener('click', async (e) => {
      if (e.target === m || e.target.closest('[data-fm-close]')) return close(host);
      const okBtn = e.target.closest('[data-fm-ok]');
      if (okBtn && o.onOk) {
        okBtn.disabled = true;
        const done = await o.onOk(m);
        if (done !== false) close(host); else okBtn.disabled = false;
      }
      if (o.onClick) o.onClick(e, m);
    });
    if (o.onMount) o.onMount(m);
    const first = m.querySelector('input, textarea');
    if (first) setTimeout(() => first.focus(), 30);
    return m;
  }
  function close(host) { const m = host && host.querySelector('.fm-modal'); if (m) m.remove(); }

  // Dugme "potvrdi dvaput" (za opasne akcije)
  function arm(btn, label) {
    if (btn.dataset.armed === '1') return true;
    btn.dataset.armed = '1';
    const old = btn.innerHTML;
    btn.classList.add('armed');
    btn.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${label || 'Potvrdi'}`;
    setTimeout(() => { if (btn.isConnected) { btn.dataset.armed = ''; btn.classList.remove('armed'); btn.innerHTML = old; } }, 3000);
    return false;
  }

  return { esc, money, initials, stars, dur, empty, loading, toast, modal, close, arm };
})();
