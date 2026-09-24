/* =====================================================================
   FLAMINGO TABLET - iPadOS sloj (samo izgled: skaliranje, widgeti, dock,
   pozadina). Logika aplikacija je u script.js / kuce.js / market.js /
   mdt_*.js i ovde se NE dira.
   ===================================================================== */
(() => {
  const $ = (id) => document.getElementById(id);
  const frame = $('tablet-frame');
  const W = 1120, H = 780;

  /* ---------- skaliranje na manje monitore ---------- */
  function fit() {
    const s = Math.min(1, (window.innerWidth * 0.94) / W, (window.innerHeight * 0.94) / H);
    frame.style.transform = `scale(${s.toFixed(3)})`;
  }
  window.addEventListener('resize', fit); fit();

  /* ---------- pozadina ---------- */
  const WALLS = ['img/ipad1.svg', 'img/ipad2.svg', 'img/ipad3.svg', 'img/wallpaper.jpg'];
  let wall = 0;
  try { wall = Math.max(0, WALLS.indexOf(localStorage.getItem('fl_tab_wall'))); } catch (e) {}
  function applyWall() { $('tablet').style.backgroundImage = `url('${WALLS[wall]}')`; }
  applyWall();
  $('ios-dock-wall').addEventListener('click', () => {
    wall = (wall + 1) % WALLS.length;
    try { localStorage.setItem('fl_tab_wall', WALLS[wall]); } catch (e) {}
    applyWall();
  });

  /* ---------- dock: prečice otvaraju iste aplikacije kao ikonice ---------- */
  document.querySelectorAll('[data-ios-open]').forEach((b) => b.addEventListener('click', () => {
    const t = $(b.dataset.iosOpen);
    if (t) t.click();
  }));

  /* ---------- widgeti ---------- */
  const DAYS = ['NEDELJA', 'PONEDELJAK', 'UTORAK', 'SREDA', 'ČETVRTAK', 'PETAK', 'SUBOTA'];
  const MONTHS = ['januar', 'februar', 'mart', 'april', 'maj', 'jun', 'jul', 'avgust', 'septembar', 'oktobar', 'novembar', 'decembar'];
  const face = $('ios-clock-face');
  face.innerHTML = `<svg viewBox="0 0 100 100">${Array.from({ length: 12 }, (_, i) => {
      const a = i * 30 * Math.PI / 180, x = 50 + Math.sin(a) * 38, y = 50 - Math.cos(a) * 38;
      return `<text x="${x}" y="${y + 3.6}" text-anchor="middle">${i || 12}</text>`;
    }).join('')}<line id="ios-h" x1="50" y1="50" x2="50" y2="28"/><line id="ios-m" x1="50" y1="50" x2="50" y2="16"/><line id="ios-s" x1="50" y1="58" x2="50" y2="14"/><circle cx="50" cy="50" r="2.4"/></svg>`;

  function tick() {
    const d = new Date();
    const h = d.getHours(), m = d.getMinutes(), s = d.getSeconds();
    const rot = (id, deg) => { const el = $(id); if (el) el.setAttribute('transform', `rotate(${deg} 50 50)`); };
    rot('ios-h', (h % 12) * 30 + m * 0.5); rot('ios-m', m * 6 + s * 0.1); rot('ios-s', s * 6);
    $('ios-w-time').textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    $('ios-w-day').textContent = DAYS[d.getDay()];
    $('ios-w-num').textContent = d.getDate();
    $('ios-w-month').textContent = MONTHS[d.getMonth()];
  }
  function calendar() {
    const d = new Date(), y = d.getFullYear(), m = d.getMonth();
    const off = (new Date(y, m, 1).getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate();
    let html = ['P', 'U', 'S', 'Č', 'P', 'S', 'N'].map((x) => `<i class="h">${x}</i>`).join('');
    for (let i = 0; i < off; i++) html += '<i></i>';
    for (let n = 1; n <= days; n++) html += `<i class="${n === d.getDate() ? 't' : ''}">${n}</i>`;
    $('ios-w-grid').innerHTML = html;
  }
  tick(); calendar();
  setInterval(tick, 1000);
  setInterval(calendar, 60000);

  /* Widget "Hitna pomoć" prati vidljivost quickstats-a (script.js ga pali samo doktorima) */
  const quick = $('home-quickstats'), orgW = $('ios-w-org');
  const syncOrg = () => orgW.classList.toggle('hidden', quick.classList.contains('hidden'));
  new MutationObserver(syncOrg).observe(quick, { attributes: true, attributeFilter: ['class'] });
  syncOrg();
})();
