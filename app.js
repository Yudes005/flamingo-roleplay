/* =====================================================================
   FLAMINGO ROLEPLAY — zajednička logika (index.html + forum.html)
   ===================================================================== */
(() => {
  const body = document.body;

  /* ---------- NAVBAR: zatamni se kad skroluješ ---------- */
  const navbar = document.getElementById('navbar');
  if (navbar && !navbar.classList.contains('solid')) {
    const onScroll = () => navbar.classList.toggle('scrolled', window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- MOBILNI MENI ---------- */
  const navToggle = document.getElementById('navToggle');
  function setMenu(open) {
    body.classList.toggle('menu-open', open);
    body.classList.toggle('lock', open || !!document.querySelector('.modal.open'));
    if (navToggle) navToggle.setAttribute('aria-expanded', String(open));
  }
  if (navToggle) {
    navToggle.addEventListener('click', () => setMenu(!body.classList.contains('menu-open')));
    document.querySelectorAll('#mobileMenu a, #mobileMenu button').forEach(el =>
      el.addEventListener('click', () => setMenu(false)));
    window.addEventListener('resize', () => { if (window.innerWidth > 820) setMenu(false); });
  }

  /* ---------- MODALI ----------
     [data-open="idModala"] otvara modal, [data-close] ga zatvara.
     Otvaranje novog modala zatvara prethodni (npr. "Nazad" u pravilima). */
  function closeModals() {
    document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open'));
    body.classList.toggle('lock', body.classList.contains('menu-open'));
  }
  function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    closeModals();
    modal.classList.add('open');
    body.classList.add('lock');
    const scroller = modal.querySelector('.modal-panel');
    if (scroller) scroller.scrollTop = 0;
  }
  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-open]');
    if (opener) { e.preventDefault(); openModal(opener.dataset.open); return; }
    if (e.target.closest('[data-close]')) closeModals();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeModals();
    setMenu(false);
  });
  window.Flamingo = { openModal, closeModals };

  /* ---------- KOPIRANJE IP ADRESE ---------- */
  document.querySelectorAll('[data-copy]').forEach(btn => {
    const label = btn.innerHTML;
    btn.addEventListener('click', async () => {
      const text = btn.dataset.copy;
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const tmp = document.createElement('textarea');
        tmp.value = text; tmp.style.position = 'fixed'; tmp.style.opacity = '0';
        document.body.appendChild(tmp); tmp.select();
        try { document.execCommand('copy'); } catch {}
        tmp.remove();
      }
      btn.classList.add('copied');
      btn.innerHTML = '<i class="fa-solid fa-check"></i> KOPIRANO';
      clearTimeout(btn._t);
      btn._t = setTimeout(() => { btn.classList.remove('copied'); btn.innerHTML = label; }, 1800);
    });
  });

  /* ---------- REVEAL ANIMACIJE ---------- */
  function startReveal() {
    const items = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) { items.forEach(el => el.classList.add('in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    items.forEach(el => io.observe(el));
  }

  /* ---------- LOADER ---------- */
  const loader = document.getElementById('loader');
  if (loader) {
    let done = false;
    const hide = () => {
      if (done) return;
      done = true;
      loader.classList.add('hide');
      startReveal();
    };
    window.addEventListener('load', () => setTimeout(hide, 900));
    setTimeout(hide, 4000); // ako se neki resurs predugo učitava
  } else {
    startReveal();
  }

  /* ---------- STATUS SERVERA ----------
     /api/status (Vercel funkcija) vraća { online, players, maxPlayers }.
     Ako API nije dostupan (npr. sajt otvoren lokalno), status se sakrije. */
  const statusEls = document.querySelectorAll('[data-server-status]');
  if (statusEls.length) {
    fetch('/api/status', { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(data => {
        statusEls.forEach(el => {
          el.dataset.status = data.online ? 'online' : 'offline';
          const text = el.querySelector('[data-status-text]');
          if (text) {
            text.innerHTML = data.online
              ? `Online · <strong>${Number(data.players) || 0}${data.maxPlayers ? ' / ' + Number(data.maxPlayers) : ''}</strong> igrača`
              : 'Server je trenutno offline';
          }
          const bar = el.querySelector('[data-status-bar]');
          if (bar && data.online && data.maxPlayers) {
            bar.style.width = Math.min(100, Math.round((data.players / data.maxPlayers) * 100)) + '%';
          }
        });
      })
      .catch(() => statusEls.forEach(el => { el.dataset.status = 'hidden'; }));
  }

  /* ---------- GODINA U FOOTERU ---------- */
  document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
})();
