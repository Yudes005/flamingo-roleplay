// ============================================================
//  MDT POLICIJA - aplikacija u tabletu
//  Podaci + sve provere: flamingo_policija (server/mdt.lua)
//  Tablet klijent prosleđuje: NUI 'pd' -> ESX callback 'flamingo_policija:mdt'
// ============================================================
(() => {
  const { esc, money, initials, stars, dur, empty, loading, toast, modal, arm } = window.FMDT;
  const icon = document.getElementById('app-pdmdt');
  const screen = document.getElementById('app-screen-pdmdt');
  const shell = document.getElementById('pdm');
  const content = document.getElementById('pdm-content');
  const headT = document.getElementById('pdm-head-title');
  const headS = document.getElementById('pdm-head-sub');
  const backBtn = document.getElementById('pdm-back');
  const navEl = document.getElementById('pdm-nav');

  let A = null;            // access (officer, perms, penalCode, wantedLevels)
  let view = 'dashboard';
  let hist = [];           // stek za "nazad"
  let cur = null;          // { view, arg }
  let pendingOpen = null;
  let callCount = 0;

  const can = (p) => !!(A && A.officer && (A.officer.perms.includes('*') || A.officer.perms.includes(p)));
  const api = async (route, payload) => {
    const r = await postAsync('pd', { route, payload: payload || {} });
    return r || { ok: false, error: 'Nema odgovora.' };
  };
  // FIB sekcija -> flamingo_fib
  const apiF = async (route, payload) => {
    const r = await postAsync('fib', { route, payload: payload || {} });
    return r || { ok: false, error: 'Nema odgovora.' };
  };
  let F = null; // FIB pregled (dozvole, klasifikacije) - puni se u Views.fib
  const isFib = () => !!(A && A.agency === 'fib');

  const NAV = [
    ['Pregled', [['dashboard', 'fa-gauge-high', 'Dashboard'], ['dispatch', 'fa-tower-broadcast', 'Dispatch', null, 'calls']]],
    ['Evidencije', [['citizens', 'fa-users', 'Građani'], ['vehicles', 'fa-car', 'Vozila', 'vehicle.check'], ['wanted', 'fa-star', 'Wanted', 'wanted.view'],
      ['cases', 'fa-folder-open', 'Predmeti'], ['warrants', 'fa-file-signature', 'Poternice'], ['tickets', 'fa-file-invoice-dollar', 'Kazne'],
      ['evidence', 'fa-box-archive', 'Dokazi', 'evidence.view'], ['arrests', 'fa-building-shield', 'Hapšenja']]],
    ['Stanica', [['officers', 'fa-user-shield', 'Policajci'], ['logs', 'fa-list-check', 'Logovi', 'logs.view'], ['boss', 'fa-user-tie', 'Uprava', 'boss.hire']]]
  ];
  const NAV_FIB = ['FIB', [['fib', 'fa-user-secret', 'FIB pregled', 'fib.ops'], ['ops', 'fa-folder-tree', 'Operacije', 'fib.ops'], ['lab', 'fa-flask', 'Laboratorija', 'fib.lab'],
    ['nadzor', 'fa-satellite-dish', 'Nadzor i nalozi', 'fib.surveillance.request'], ['informants', 'fa-user-ninja', 'Informanti', 'fib.informants'], ['ia', 'fa-scale-balanced', 'Unutrašnja kontrola', 'fib.ia']]];

  function renderNav() {
    const nav = isFib() && A.fibModule ? [NAV_FIB, ...NAV] : NAV;
    navEl.innerHTML = nav.map(([sec, items]) => {
      const vis = items.filter((i) => !i[3] || can(i[3]) || (i[0] === 'boss' && can('boss.menu')));
      if (!vis.length) return '';
      return `<div class="fm-nav-sec">${sec}</div>` + vis.map((i) => `
        <button class="fm-nav-btn ${view === i[0] ? 'active' : ''}" data-nav="${i[0]}"><i class="fa-solid ${i[1]}"></i>${i[2]}
          ${i[4] === 'calls' && callCount ? `<span class="fm-badge">${callCount}</span>` : ''}</button>`).join('');
    }).join('');
    const o = A.officer;
    document.getElementById('pdm-me').innerHTML = `<div class="fm-me-av">${esc(initials(o.name))}</div>
      <div class="fm-me-t"><b>${o.callsign ? '[' + esc(o.callsign) + '] ' : ''}${esc(o.name)}</b><span>${esc(o.rank)}</span></div>`;
  }

  function setHead(t, s) { headT.textContent = t; headS.textContent = s || ''; backBtn.classList.toggle('hidden', hist.length === 0); }

  // mode: 'push' (novi ekran, pamti prethodni) | 'root' (meni - briše istoriju) | 'back'
  function go(v, arg, mode = 'push') {
    if (mode === 'push' && cur) hist.push(cur);
    if (mode === 'root') hist = [];
    if (v === 'person' && (!cur || cur.view !== 'person' || cur.arg !== arg)) personTab = 'pregled';
    cur = { view: v, arg };
    if (['dashboard', 'dispatch', 'citizens', 'vehicles', 'wanted', 'cases', 'warrants', 'tickets', 'evidence', 'arrests', 'officers', 'logs', 'boss',
      'fib', 'ops', 'lab', 'nadzor', 'informants', 'ia'].includes(v)) view = v;
    renderNav();
    FMDT.close(shell);
    content.innerHTML = loading();
    content.scrollTop = 0;
    Views[v](arg);
  }
  function back() { const p = hist.pop(); if (p) go(p.view, p.arg, 'back'); }
  function reload() { if (cur) Views[cur.view](cur.arg); }

  const item = (o) => `<div class="fm-item ${o.click ? 'click' : ''}" ${o.click || ''}>
    <div class="fm-item-ico ${o.tone || ''}"><i class="fa-solid ${o.icon}"></i></div>
    <div class="fm-item-t"><b>${o.title}</b>${o.sub ? `<span>${o.sub}</span>` : ''}${o.text ? `<p>${o.text}</p>` : ''}</div>
    ${o.right ? `<div class="fm-item-r">${o.right}</div>` : ''}</div>`;
  const tabs = (list, active, attr) => `<div class="fm-tabs">${list.map(([k, l]) => `<button class="fm-tab ${k === active ? 'active' : ''}" data-${attr}="${k}">${l}</button>`).join('')}</div>`;
  const personLink = (ref, name) => ref ? `data-person="${ref}"` : '';

  // ============================================================
  //  VIEWS
  // ============================================================
  const Views = {};

  // ---------- DASHBOARD ----------
  Views.dashboard = async () => {
    setHead('Dashboard', `${A.officer.rank} · ${A.officer.name}`);
    const r = await api('dashboard');
    if (!r.ok) { content.innerHTML = empty(r.error, 'fa-plug-circle-xmark'); return; }
    const s = r.stats;
    callCount = s.calls; renderNav();
    content.innerHTML = `
      <div class="fm-stats">
        <div class="fm-stat"><i class="g fa-solid fa-user-shield"></i><span>Na dužnosti</span><b>${s.onDuty}</b></div>
        <div class="fm-stat"><i class="r fa-solid fa-star"></i><span>Traženi</span><b>${s.wanted}</b></div>
        <div class="fm-stat"><i class="w fa-solid fa-tower-broadcast"></i><span>Aktivni pozivi</span><b>${s.calls}</b></div>
        <div class="fm-stat"><i class="fa-solid fa-folder-open"></i><span>Otvoreni predmeti</span><b>${s.cases}</b></div>
        <div class="fm-stat"><i class="r fa-solid fa-file-signature"></i><span>Aktivne poternice</span><b>${s.warrants}</b></div>
        <div class="fm-stat"><i class="w fa-solid fa-building-shield"></i><span>U zatvoru</span><b>${s.prisoners}</b></div>
      </div>
      <div class="fm-2col">
        <div>
          <div class="fm-card"><div class="fm-card-h"><i class="h-ico fa-solid fa-clock"></i><b>Moja smena</b>
            ${A.officer.callsign ? `<span class="fm-pill acc">${esc(A.officer.callsign)}</span>` : '<button class="fm-btn sm acc" data-act="callsign">Postavi pozivni znak</button>'}</div>
            <div class="fm-kv" style="grid-template-columns:1fr 1fr"><div><span>Ova smena</span><b>${dur(r.me.session)}</b></div><div><span>Poslednjih 7 dana</span><b>${dur(r.me.week)}</b></div></div></div>
          <div class="fm-card"><div class="fm-card-h"><i class="h-ico fa-solid fa-tower-broadcast"></i><b>Poslednji pozivi</b><button class="fm-btn sm" data-nav="dispatch">Svi</button></div>
            <div class="fm-list">${r.calls.slice(0, 4).map((c) => item({ icon: c.icon || 'fa-bell', tone: c.priority === 'CRITICAL' ? 'r' : (c.priority === 'HIGH' ? 'w' : ''),
              title: `#${c.id} ${esc(c.title)}`, sub: `${esc(c.street || '')} · ${statusLabel(c.status)}` })).join('') || empty('Nema aktivnih poziva.', 'fa-bell-slash')}</div></div>
        </div>
        <div>
          <div class="fm-card"><div class="fm-card-h"><i class="h-ico fa-solid fa-star"></i><b>Traženi</b><button class="fm-btn sm" data-nav="wanted">Svi</button></div>
            <div class="fm-list">${r.wanted.slice(0, 5).map((w) => item({ icon: 'fa-user', tone: 'r', title: esc(w.name), sub: esc(w.reason), right: stars(w.stars), click: personLink(w.ref) })).join('') || empty('Niko nije na potrazi.', 'fa-face-smile')}</div></div>
          <div class="fm-card"><div class="fm-card-h"><i class="h-ico fa-solid fa-user-shield"></i><b>Jedinice na terenu</b></div>
            <div class="fm-list">${r.units.map((u) => `<div class="fm-item"><span class="fm-dot ${u.status === 'dostupan' ? 'on' : 'busy'}"></span>
              <div class="fm-item-t"><b>${u.callsign ? '[' + esc(u.callsign) + '] ' : ''}${esc(u.name)}</b><span>${esc(u.agency || '')} · ${esc(u.rank)} · ${esc(u.status)}${u.undercover ? ' · undercover' : ''}</span></div></div>`).join('')}</div></div>
        </div>
      </div>
      <div class="fm-card"><div class="fm-card-h"><i class="h-ico fa-solid fa-clock-rotate-left"></i><b>Poslednje akcije</b></div>
        <div class="fm-list">${r.recent.map((l) => item({ icon: 'fa-circle-dot', title: `${esc(logLabel(l.action))} · ${esc(l.target_name || '')}`, sub: `${esc(l.actor_name)} · ${esc(l.detail)}`, right: `<span class="fm-time">${esc(l.t)}</span>` })).join('') || empty('Još nema akcija.')}</div></div>`;
  };

  // ---------- GRAĐANI ----------
  let lastQuery = '';
  Views.citizens = async (q) => {
    setHead('Građani', 'Pretraga po imenu, prezimenu ili ID-u (online igrač)');
    content.innerHTML = `<div class="fm-search"><i class="fa-solid fa-magnifying-glass"></i><input class="fm-inp" id="pdm-q" placeholder="npr. Marko Petrović ili 12" value="${esc(q || lastQuery)}">
      <button class="fm-btn acc" data-act="search">Traži</button></div><div id="pdm-res">${empty('Unesi ime ili ID.', 'fa-users')}</div>`;
    const inp = document.getElementById('pdm-q');
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') searchPeople(); });
    if (q || lastQuery) searchPeople();
    else inp.focus();
  };
  async function searchPeople() {
    const q = document.getElementById('pdm-q').value.trim();
    if (!q) return;
    lastQuery = q;
    const res = document.getElementById('pdm-res');
    res.innerHTML = loading('Pretraga...');
    const r = await api('searchPerson', { query: q });
    if (!r.ok) { res.innerHTML = empty(r.error, 'fa-circle-exclamation'); return; }
    res.innerHTML = `<div class="fm-list">${r.results.map((p) => item({ icon: 'fa-user', tone: p.stars ? 'r' : '', title: esc(p.name),
      sub: `${esc(p.dob || 'nepoznat datum')}${p.online ? ' · <b style="color:var(--ok)">online · ID ' + p.serverId + '</b>' : ''}`,
      right: `${p.warrants ? `<span class="fm-pill red">${p.warrants} poternica</span>` : ''}${p.stars ? stars(p.stars) : ''}<i class="fa-solid fa-chevron-right" style="color:var(--faint)"></i>`,
      click: personLink(p.ref) })).join('') || empty('Nema rezultata.', 'fa-user-slash')}</div>`;
    return r.results;
  }

  // ---------- PROFIL / DOSIJE ----------
  let personTab = 'pregled';
  Views.person = async (ref) => {
    const r = await api('person', { ref });
    if (!r.ok) { setHead('Dosije', ''); content.innerHTML = empty(r.error, 'fa-user-slash'); return; }
    const p = r.person;
    setHead(p.name, 'Policijski dosije');
    const LIC = { valid: ['ok', 'Važi'], suspended: ['warn', 'Suspendovana'], revoked: ['red', 'Oduzeta'], expired: ['red', 'Istekla'] };
    const T = [['pregled', 'Pregled'], ['wanted', `Wanted (${r.wantedHistory.length})`], ['hapsenja', `Hapšenja (${r.arrests.length})`], ['kazne', `Kazne (${r.tickets.length})`],
      ['dokazi', `Zaplene (${r.evidence.length})`], ['dosije', `Beleške (${r.notes.length})`], ['predmeti', `Predmeti (${r.cases.length})`]];
    let body = '';
    if (personTab === 'pregled') {
      body = `<div class="fm-2col"><div>
          <div class="fm-card"><div class="fm-card-h"><i class="h-ico fa-solid fa-id-card"></i><b>Lični podaci</b></div>
            <div class="fm-kv">
              <div><span>Rođen</span><b>${esc(p.dob || '-')}</b></div><div><span>Pol</span><b>${p.sex === 'f' ? 'Ž' : (p.sex === 'm' ? 'M' : '-')}</b></div>
              <div><span>Visina</span><b>${esc(p.height || '-')}</b></div><div><span>Telefon</span><b>${esc(p.phone || '-')}</b></div>
              <div style="grid-column:span 2"><span>Posao</span><b>${esc(p.job || '-')}</b></div>
              <div style="grid-column:span 3"><span>Lična karta</span><b>${r.idcard ? esc(r.idcard.number) + ' · ' + (r.idcard.status === 'valid' ? 'važeća' : esc(r.idcard.status)) : '<span style="color:var(--red)">Nema ličnu kartu</span>'}</b></div>
            </div></div>
          <div class="fm-card"><div class="fm-card-h"><i class="h-ico fa-solid fa-location-dot"></i><b>Poslednja poznata lokacija</b></div>
            ${p.location ? `<div class="fm-item"><div class="fm-item-t"><b>${esc(p.location.when || '')}</b><span>Izvor: ${esc(p.location.source || 'sistem')}</span></div>
              <button class="fm-btn sm acc" data-gps="${p.location.x},${p.location.y}"><i class="fa-solid fa-location-arrow"></i> GPS</button></div>`
              : `<p class="fm-time">${p.online ? 'Lokacija online osobe se ne prati (samo tokom aktivne potrage 3★+).' : 'Nema legitimno sačuvane lokacije.'}</p>`}</div>
        </div><div>
          <div class="fm-card"><div class="fm-card-h"><i class="h-ico fa-solid fa-id-card-clip"></i><b>Dozvole</b></div>
            ${r.licenses.filter((l) => l.owned).map((l) => { const s = LIC[l.status] || ['', l.status]; return `<div class="fm-lic"><b>${esc(l.label)}</b><span class="fm-pill ${s[0]}">${s[1]}</span>
              ${can('license.manage') ? `<button class="fm-btn sm" data-lic="${esc(l.key)}" data-lic-status="${esc(l.status)}"><i class="fa-solid fa-gear"></i></button>` : ''}</div>`; }).join('') || '<p class="fm-time">Nema dozvola.</p>'}</div>
          <div class="fm-card"><div class="fm-card-h"><i class="h-ico fa-solid fa-file-signature"></i><b>Poternice</b></div>
            <div class="fm-list">${r.warrants.filter((w) => w.status === 'aktivna').map((w) => item({ icon: 'fa-file-signature', tone: 'r', title: `#${w.id} ${esc(w.crime || 'Poternica')}`, sub: esc(w.reason) })).join('') || '<p class="fm-time">Nema aktivnih poternica.</p>'}</div></div>
          <div class="fm-card"><div class="fm-card-h"><i class="h-ico fa-solid fa-car"></i><b>Vozila</b></div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">${r.vehicles.map((v) => `<button class="fm-pill acc" data-plate="${esc(v.plate)}">${esc(v.plate)}</button>`).join('') || '<p class="fm-time">Nema registrovanih vozila.</p>'}</div></div>
        </div></div>`;
    } else if (personTab === 'wanted') {
      body = `<div class="fm-card"><div class="fm-timeline">${r.wantedHistory.map((h) => `<div class="fm-tl"><b>${esc(wAct(h.action))} ${h.stars_from} → ${h.stars_to}★</b><span>${esc(h.t)} · ${esc(h.actor_name)}</span><p>${esc(h.reason)}</p></div>`).join('') || empty('Nema istorije potrage.')}</div></div>`;
    } else if (personTab === 'hapsenja') {
      body = `<div class="fm-list">${r.arrests.map((a) => item({ icon: a.kind === 'hapsenje' ? 'fa-building-shield' : (a.kind === 'pustanje' ? 'fa-person-walking' : 'fa-user-lock'), tone: a.kind === 'hapsenje' ? 'r' : 'w',
        title: `#${a.id} ${kindLabel(a.kind)}${a.jail_minutes ? ' · ' + a.jail_minutes + ' min' : ''}${a.fine ? ' · ' + money(a.fine) : ''}`, sub: `${esc(a.officer_name)} · ${esc(a.t)}${a.case_id ? ' · predmet #' + a.case_id : ''}`,
        text: esc(chargeNames(a.charges) || a.report || '') })).join('') || empty('Nema zapisa.')}</div>`;
    } else if (personTab === 'kazne') {
      body = `<div class="fm-list">${r.tickets.map((t) => item({ icon: 'fa-file-invoice-dollar', tone: t.status === 'neplacena' ? 'w' : (t.status === 'placena' ? 'g' : ''),
        title: `#${t.id} · ${money(t.amount)}`, sub: `${esc(t.officer_name)} · ${esc(t.t)}`, text: esc(t.reason), right: ticketPill(t.status) })).join('') || empty('Nema kazni.')}</div>`;
    } else if (personTab === 'dokazi') {
      body = `<div class="fm-list">${r.evidence.map((e) => item({ icon: 'fa-box-archive', title: `#${e.id} ${esc(e.count)}x ${esc(e.label)}`, sub: `${esc(e.officer_name)} · ${esc(e.t)}${e.case_id ? ' · predmet #' + e.case_id : ''}`, text: esc(e.reason), right: evPill(e.status) })).join('') || empty('Nema zaplena.')}</div>`;
    } else if (personTab === 'dosije') {
      body = `${can('dosije.note') ? '<button class="fm-btn acc" data-act="note" style="margin-bottom:10px"><i class="fa-solid fa-plus"></i> Novi zapis</button>' : ''}
        <div class="fm-list">${r.notes.map((n) => item({ icon: noteIcon(n.kind), title: `${esc(noteKind(n.kind))}${n.case_id ? ' · predmet #' + n.case_id : ''}`, sub: `${esc(n.author_name)} · ${esc(n.t)}`, text: esc(n.content) })).join('') || empty('Dosije je prazan.', 'fa-folder')}</div>`;
    } else if (personTab === 'predmeti') {
      body = `<div class="fm-list">${r.cases.map((c) => item({ icon: 'fa-folder', title: `#${c.id} ${esc(c.title)}`, sub: `${esc(roleLabel(c.role))}`, right: casePill(c.status), click: `data-case="${c.id}"` })).join('') || empty('Nije deo nijednog predmeta.')}</div>`;
    }

    content.innerHTML = `
      <div class="fm-prof ${p.danger ? 'danger' : ''}">
        <div class="fm-photo" ${p.photo ? `style="background-image:url('${esc(p.photo)}')"` : ''}>${p.photo ? '' : esc(initials(p.name))}</div>
        <div class="fm-prof-t"><h2>${esc(p.name)}</h2>
          <div class="fm-prof-tags">
            ${p.online ? `<span class="fm-pill ok">Online · ID ${p.serverId}</span>` : '<span class="fm-pill">Offline</span>'}
            ${r.wanted ? `<span class="fm-pill gold">${stars(r.wanted.stars)}</span>` : '<span class="fm-pill ok">Nije na potrazi</span>'}
            ${p.danger ? '<span class="fm-pill red"><i class="fa-solid fa-skull"></i> OPASAN</span>' : ''}
            ${p.inPrison ? '<span class="fm-pill red">U zatvoru</span>' : ''}
            ${p.restrained ? '<span class="fm-pill warn">Vezan</span>' : ''}
            ${r.fib && r.fib.flagged ? (r.fib.ops ? r.fib.ops.map((o) => `<button class="fm-pill red" data-op="${o.id}"><i class="fa-solid fa-user-secret"></i> ${esc(o.codename)}</button>`).join('') || '<span class="fm-pill red"><i class="fa-solid fa-user-secret"></i> FIB meta</span>' : '<span class="fm-pill red"><i class="fa-solid fa-user-secret"></i> FIB interes - obavesti FIB</span>') : ''}
          </div>
          ${r.wanted ? `<p class="fm-time" style="margin-top:6px;color:var(--gold)">Potraga: ${esc(r.wanted.reason)}</p>` : ''}
        </div>
        <div class="fm-prof-act">
          ${can('wanted.set') ? '<button class="fm-btn sm acc" data-act="wanted"><i class="fa-solid fa-star"></i> Wanted</button>' : ''}
          ${can('ticket') ? '<button class="fm-btn sm" data-act="ticket"><i class="fa-solid fa-file-invoice-dollar"></i> Kazna</button>' : ''}
          ${can('warrant.create') ? '<button class="fm-btn sm" data-act="warrant"><i class="fa-solid fa-file-signature"></i> Poternica</button>' : ''}
          ${can('dosije.note') ? `<div style="display:flex;gap:6px"><button class="fm-btn sm" data-act="photo" title="Fotografija"><i class="fa-solid fa-camera"></i></button>
            <button class="fm-btn sm ${p.danger ? 'red' : ''}" data-act="danger" title="Oznaka opasan"><i class="fa-solid fa-skull"></i></button></div>` : ''}
        </div>
      </div>
      ${tabs(T, personTab, 'ptab')}
      ${body}`;
    content.dataset.ref = ref;
    content._person = r;
  };

  // ---------- VOZILA ----------
  Views.vehicles = async (q) => {
    setHead('Vozila', 'Provera tablica i vlasnika');
    content.innerHTML = `<div class="fm-search"><i class="fa-solid fa-magnifying-glass"></i><input class="fm-inp" id="pdm-vq" placeholder="Tablica (min 2 karaktera)" value="${esc(q || '')}">
      <button class="fm-btn acc" data-act="vsearch">Traži</button></div><div id="pdm-vres">${empty('Unesi tablicu.', 'fa-car')}</div>`;
    const inp = document.getElementById('pdm-vq');
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') searchVehicles(); });
    if (q) searchVehicles(); else inp.focus();
  };
  async function searchVehicles() {
    const q = document.getElementById('pdm-vq').value.trim();
    const res = document.getElementById('pdm-vres');
    res.innerHTML = loading();
    const r = await api('searchVehicle', { query: q });
    if (!r.ok) { res.innerHTML = empty(r.error, 'fa-circle-exclamation'); return; }
    res.innerHTML = `<div class="fm-list">${r.results.map((v) => item({ icon: 'fa-car', tone: v.stolen ? 'r' : '', title: esc(v.plate), sub: `${esc(v.modelLabel || v.model || '')} · ${esc(v.owner || 'nepoznat vlasnik')}`,
      right: `${v.stolen ? '<span class="fm-pill red">UKRADENO</span>' : ''}${v.wanted ? '<span class="fm-pill red">TRAŽENO</span>' : ''}${v.impound ? '<span class="fm-pill warn">Impound</span>' : ''}`,
      click: `data-plate="${esc(v.plate)}"` })).join('') || empty('Nema rezultata.')}</div>`;
  }

  Views.vehicle = async (plate) => {
    const r = await api('vehicle', { plate });
    if (!r.ok) { content.innerHTML = empty(r.error); return; }
    const v = r.vehicle;
    setHead(v.plate, v.modelLabel || 'Vozilo');
    content.innerHTML = `
      <div class="fm-prof ${v.stolen || v.wanted ? 'danger' : ''}">
        <div class="fm-photo"><i class="fa-solid fa-car"></i></div>
        <div class="fm-prof-t"><h2>${esc(v.plate)}</h2><div class="fm-prof-tags">
          ${v.registered ? '<span class="fm-pill ok">Registrovano</span>' : '<span class="fm-pill warn">Nije u registru</span>'}
          ${v.stolen ? '<span class="fm-pill red">UKRADENO</span>' : ''}${v.wanted ? '<span class="fm-pill red">TRAŽENO</span>' : ''}
          ${v.impound ? '<span class="fm-pill warn">Na impoundu</span>' : ''}</div></div>
        <div class="fm-prof-act">
          ${!v.stolen && can('vehicle.stolen') ? '<button class="fm-btn sm red" data-vflag="stolen" data-s="1">Prijavi ukradeno</button>' : ''}
          ${v.stolen && can('vehicle.clearstolen') ? '<button class="fm-btn sm ok" data-vflag="stolen" data-s="0">Skini "ukradeno"</button>' : ''}
          ${can('vehicle.stolen') ? `<button class="fm-btn sm" data-vflag="wanted" data-s="${v.wanted ? 0 : 1}">${v.wanted ? 'Skini "traženo"' : 'Označi traženo'}</button>` : ''}
        </div>
      </div>
      <div class="fm-card"><div class="fm-kv">
        <div><span>Model</span><b>${esc(v.modelLabel || v.model || '-')}</b></div>
        <div ${personLink(v.ownerRef)} style="${v.ownerRef ? 'cursor:pointer' : ''}"><span>Vlasnik</span><b>${esc(v.owner || '-')} ${v.ownerRef ? '<i class="fa-solid fa-arrow-up-right-from-square" style="font-size:10px;color:var(--acc2)"></i>' : ''}</b></div>
        <div><span>Potraga vlasnika</span><b>${v.ownerStars ? stars(v.ownerStars) : 'Nema'}</b></div>
      </div>${v.note ? `<p class="fm-time" style="margin-top:10px">Napomena (${esc(v.flaggedBy || '')}): ${esc(v.note)}</p>` : ''}</div>
      <div class="fm-card"><div class="fm-card-h"><i class="h-ico fa-solid fa-truck-pickup"></i><b>Istorija impounda</b></div>
        <div class="fm-list">${v.history.map((h) => item({ icon: 'fa-truck-pickup', title: `${esc(h.reason)} · ${money(h.fee)}`, sub: `${esc(h.officer_name)} · ${esc(h.t)}`, right: `<span class="fm-pill">${esc(h.status)}</span>` })).join('') || empty('Nikad nije zaplenjeno.')}</div></div>`;
    content.dataset.plate = v.plate;
  };

  // ---------- WANTED ----------
  Views.wanted = async () => {
    setHead('Wanted', 'Aktivne potrage');
    const r = await api('wantedList');
    if (!r.ok) { content.innerHTML = empty(r.error); return; }
    content.innerHTML = `<div class="fm-list">${r.list.map((w) => item({ icon: 'fa-user-ninja', tone: 'r', title: esc(w.name), sub: `${w.online ? '<b style="color:var(--ok)">online</b> · ' : ''}${esc(w.reason)}${w.caseId ? ' · predmet #' + w.caseId : ''}`,
      right: stars(w.stars), click: personLink(w.ref) })).join('') || empty('Niko nije na potrazi.', 'fa-face-smile')}</div>`;
  };

  // ---------- PREDMETI ----------
  let caseFilter = '';
  Views.cases = async () => {
    setHead('Predmeti', 'Policijski predmeti i istrage');
    const r = await api('cases', { status: caseFilter, query: (document.getElementById('pdm-cq') || {}).value || '' });
    const T = [['', 'Svi'], ['otvoren', 'Otvoreni'], ['u_istrazi', 'U istrazi'], ['zatvoren', 'Zatvoreni'], ['preuzet_fib', 'FIB']];
    content.innerHTML = `<div class="fm-search"><i class="fa-solid fa-magnifying-glass"></i><input class="fm-inp" id="pdm-cq" placeholder="Broj ili naslov predmeta">
        ${can('case.create') ? '<button class="fm-btn acc" data-act="caseNew"><i class="fa-solid fa-plus"></i> Novi predmet</button>' : ''}</div>
      ${tabs(T, caseFilter, 'cfilter')}
      <div class="fm-list">${(r.list || []).map((c) => item({ icon: 'fa-folder', title: `#${c.id} ${esc(c.title)}`, sub: `${esc(c.event_type || 'Događaj')} · ${esc(c.created_by_name)} · izmena ${esc(c.u)}`,
        right: casePill(c.status), click: `data-case="${c.id}"` })).join('') || empty('Nema predmeta.', 'fa-folder-open')}</div>`;
    document.getElementById('pdm-cq').addEventListener('keydown', (e) => { if (e.key === 'Enter') Views.cases(); });
  };

  Views.case = async (id) => {
    const r = await api('case', { id });
    if (!r.ok) { content.innerHTML = empty(r.error); return; }
    const c = r.case;
    const locked = (c.status === 'preuzet_fib' && !isFib()) || c.status === 'zatvoren';
    setHead(`Predmet #${c.id}`, c.title);
    content.innerHTML = `
      <div class="fm-prof"><div class="fm-photo"><i class="fa-solid fa-folder-open"></i></div>
        <div class="fm-prof-t"><h2>${esc(c.title)}</h2><div class="fm-prof-tags">${casePill(c.status)}<span class="fm-pill">${esc(c.event_type || 'Događaj')}</span>
          <span class="fm-pill">${esc(c.created_by_name)} · ${esc(c.t)}</span>${c.ft ? `<span class="fm-pill acc">DOJ · ${esc(c.ft)}</span>` : ''}</div>
          ${c.location ? `<p class="fm-time" style="margin-top:6px"><i class="fa-solid fa-location-dot"></i> ${esc(c.location)}</p>` : ''}</div>
        ${can('case.manage') && (c.status !== 'preuzet_fib' || isFib()) ? `<div class="fm-prof-act"><select class="fm-inp" id="pdm-cstatus" style="height:30px;font-size:12px">
          ${Object.entries(r.statuses).filter(([k]) => k !== 'preuzet_fib' || c.status === 'preuzet_fib').map(([k, l]) => `<option value="${k}" ${k === c.status ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <button class="fm-btn sm acc" data-act="caseStatus">Promeni status</button></div>` : ''}
        ${isFib() && F && F.perms.takeover && c.status !== 'preuzet_fib' ? `<div class="fm-prof-act"><button class="fm-btn sm red" data-fibtake="${c.id}"><i class="fa-solid fa-user-secret"></i> FIB preuzima</button></div>` : ''}
      </div>
      ${c.description ? `<div class="fm-card"><div class="fm-card-h"><i class="h-ico fa-solid fa-align-left"></i><b>Opis</b></div><p style="font-size:12.5px;line-height:1.5;white-space:pre-wrap">${esc(c.description)}</p></div>` : ''}
      <div class="fm-2col">
        <div>
          <div class="fm-card"><div class="fm-card-h"><i class="h-ico fa-solid fa-users"></i><b>Učesnici</b>${!locked ? '<button class="fm-btn sm acc" data-act="caseMember"><i class="fa-solid fa-plus"></i></button>' : ''}</div>
            <div class="fm-list">${r.members.map((m) => item({ icon: m.role === 'osumnjiceni' ? 'fa-user-ninja' : (m.role === 'policajac' ? 'fa-user-shield' : 'fa-user'), tone: m.role === 'osumnjiceni' ? 'r' : '',
              title: esc(m.name), sub: `${esc(r.roles[m.role] || m.role)}${m.note ? ' · ' + esc(m.note) : ''}`,
              right: `${m.ref ? `<button class="fm-btn sm" ${personLink(m.ref)}><i class="fa-solid fa-folder-open"></i></button>` : ''}${!locked && can('case.edit') ? `<button class="fm-btn sm red" data-rmember="${m.id}"><i class="fa-solid fa-xmark"></i></button>` : ''}` })).join('') || empty('Nema učesnika.')}</div></div>
          <div class="fm-card"><div class="fm-card-h"><i class="h-ico fa-solid fa-box-archive"></i><b>Dokazi</b>${!locked ? '<button class="fm-btn sm acc" data-act="evAdd"><i class="fa-solid fa-plus"></i></button>' : ''}</div>
            <div class="fm-list">${r.evidence.map((e) => item({ icon: 'fa-box', title: `#${e.id} ${e.count}x ${esc(e.label)}`, sub: `${esc(e.name || 'bez vlasnika')} · ${esc(e.officer_name)}`, text: esc(e.reason), right: evPill(e.status) })).join('') || empty('Nema dokaza.')}</div></div>
          <div class="fm-card"><div class="fm-card-h"><i class="h-ico fa-solid fa-link"></i><b>Povezano</b></div>
            <div class="fm-list">
              ${r.arrests.map((a) => item({ icon: 'fa-building-shield', title: `Hapšenje #${a.id} · ${esc(a.name)}`, sub: `${a.jail_minutes} min · ${money(a.fine)} · ${esc(a.t)}` })).join('')}
              ${r.tickets.map((t) => item({ icon: 'fa-file-invoice-dollar', title: `Kazna #${t.id} · ${esc(t.name)}`, sub: money(t.amount), right: ticketPill(t.status) })).join('')}
              ${r.warrants.map((w) => item({ icon: 'fa-file-signature', title: `Poternica #${w.id} · ${esc(w.name)}`, sub: esc(w.crime), right: `<span class="fm-pill">${esc(w.status)}</span>` })).join('')}
              ${!r.arrests.length && !r.tickets.length && !r.warrants.length ? empty('Ništa nije povezano.') : ''}
            </div></div>
        </div>
        <div class="fm-card"><div class="fm-card-h"><i class="h-ico fa-solid fa-timeline"></i><b>Tok predmeta</b>${!locked ? '<button class="fm-btn sm acc" data-act="caseEntry"><i class="fa-solid fa-plus"></i> Zapis</button>' : ''}</div>
          <div class="fm-timeline">${r.entries.map((e) => `<div class="fm-tl"><b>${esc(entryKind(e.kind))}</b><span>${esc(e.author_name)} · ${esc(e.t)}</span><p>${esc(e.content)}</p></div>`).join('') || empty('Još nema zapisa.')}</div></div>
      </div>`;
    content.dataset.caseId = c.id;
  };

  // ---------- POTERNICE / KAZNE / DOKAZI ----------
  let wFilter = 'aktivna', tFilter = 'neplacena', eFilter = 'u_dokazima';
  Views.warrants = async () => {
    setHead('Poternice', 'Nalozi za hapšenje');
    const r = await api('warrants', { status: wFilter });
    content.innerHTML = `${tabs([['aktivna', 'Aktivne'], ['izvrsena', 'Izvršene'], ['otkazana', 'Otkazane']], wFilter, 'wfilter')}
      <p class="fm-time" style="margin:-6px 0 10px">Nova poternica se izdaje iz dosijea osobe.</p>
      <div class="fm-list">${(r.list || []).map((w) => item({ icon: 'fa-file-signature', tone: w.status === 'aktivna' ? 'r' : '', title: `#${w.id} ${esc(w.name)}`, sub: `${esc(w.crime || '')} · ${esc(w.created_by_name)} · ${esc(w.t)}`, text: esc(w.reason),
        right: `<button class="fm-btn sm" ${personLink(w.ref)}><i class="fa-solid fa-folder-open"></i></button>${w.status === 'aktivna' ? `${can('detain') ? `<button class="fm-btn sm ok" data-wstatus="izvrsena" data-id="${w.id}">Izvršena</button>` : ''}${can('warrant.cancel') ? `<button class="fm-btn sm red" data-wstatus="otkazana" data-id="${w.id}">Otkaži</button>` : ''}` : `<span class="fm-time">${esc(w.closed_by_name || '')}</span>`}` })).join('') || empty('Nema poternica.')}</div>`;
  };
  Views.tickets = async () => {
    setHead('Kazne', 'Izdate novčane kazne');
    const r = await api('tickets', { status: tFilter });
    content.innerHTML = `${tabs([['neplacena', 'Neplaćene'], ['placena', 'Plaćene'], ['ponistena', 'Poništene']], tFilter, 'tfilter')}
      <div class="fm-list">${(r.list || []).map((t) => item({ icon: 'fa-file-invoice-dollar', tone: t.status === 'neplacena' ? 'w' : (t.status === 'placena' ? 'g' : ''), title: `#${t.id} ${esc(t.name)} · ${money(t.amount)}`,
        sub: `${esc(t.officer_name)} · ${esc(t.t)}`, text: esc(t.reason) + (t.void_reason ? ' — poništeno: ' + esc(t.void_reason) : ''),
        right: `<button class="fm-btn sm" ${personLink(t.ref)}><i class="fa-solid fa-folder-open"></i></button>${t.status === 'neplacena' && can('ticket.void') ? `<button class="fm-btn sm red" data-void="${t.id}">Poništi</button>` : ''}` })).join('') || empty('Nema kazni.')}</div>`;
  };
  Views.evidence = async () => {
    setHead('Dokazi', 'Magacin zaplenjenih predmeta');
    const r = await api('evidence', { status: eFilter });
    content.innerHTML = `${tabs([['u_dokazima', 'U magacinu'], ['vracen', 'Vraćeno'], ['unisten', 'Uništeno']], eFilter, 'efilter')}
      <div class="fm-list">${(r.list || []).map((e) => item({ icon: e.item && e.item.startsWith('WEAPON_') ? 'fa-gun' : 'fa-box', title: `#${e.id} ${e.count}x ${esc(e.label)}`,
        sub: `Od: ${esc(e.name || '-')} · ${esc(e.officer_name)} · ${esc(e.t)}${e.case_id ? ' · predmet #' + e.case_id : ''}`, text: esc(e.reason),
        right: e.status === 'u_dokazima' ? `${can('evidence.return') && e.ref ? `<button class="fm-btn sm ok" data-evret="${e.id}">Vrati</button>` : ''}${can('evidence.destroy') ? `<button class="fm-btn sm red" data-evdes="${e.id}">Uništi</button>` : ''}` : `<span class="fm-time">${esc(e.closed_by || '')}</span>` })).join('') || empty('Prazno.', 'fa-box-open')}</div>`;
  };

  // ---------- HAPŠENJA + ZATVOR ----------
  Views.arrests = async () => {
    setHead('Hapšenja', 'Privođenja, hapšenja i zatvorenici');
    const r = await api('arrests');
    if (!r.ok) { content.innerHTML = empty(r.error); return; }
    const tr = r.transfers || [];
    content.innerHTML = `
      ${tr.length ? `<div class="fm-card" style="border-color:rgba(255,181,71,.35)"><div class="fm-card-h"><i class="h-ico fa-solid fa-van-shuttle"></i><b>Čeka transport do Bolingbroke-a (${tr.length})</b></div>
        <div class="fm-list">${tr.map((t) => item({ icon: 'fa-van-shuttle', tone: 'w', title: `${esc(t.name)} · ${t.minutes} min`, sub: `${esc(t.officer || '')} · čeka ${dur(t.waiting)} · ${t.online ? 'online' : 'offline'}`, text: esc(t.reason),
          right: `${t.x ? `<button class="fm-btn sm" data-gps="${t.x},${t.y}"><i class="fa-solid fa-location-arrow"></i></button>` : ''}<button class="fm-btn sm" ${personLink(t.ref)}><i class="fa-solid fa-folder-open"></i></button>${can('prison.release') ? `<button class="fm-btn sm red" data-trcancel="${t.ref}">Otkaži</button>` : ''}` })).join('')}</div></div>` : ''}
      <div class="fm-card"><div class="fm-card-h"><i class="h-ico fa-solid fa-building-shield"></i><b>Trenutno u zatvoru (${r.prisoners.length})</b></div>
        <div class="fm-list">${r.prisoners.map((p) => item({ icon: 'fa-user-lock', tone: 'w', title: esc(p.name), sub: `${dur(p.remaining)} preostalo od ${dur(p.total)} · ${p.online ? 'online' : 'offline (vreme stoji)'}`, text: esc(p.reason),
          right: `<button class="fm-btn sm" ${personLink(p.ref)}><i class="fa-solid fa-folder-open"></i></button>${can('prison.release') ? `<button class="fm-btn sm red" data-prel="${p.ref}">Pusti</button>` : ''}` })).join('') || empty('Zatvor je prazan.')}</div></div>
      <div class="fm-card"><div class="fm-card-h"><i class="h-ico fa-solid fa-clock-rotate-left"></i><b>Poslednji zapisi</b></div>
        <div class="fm-list">${r.list.map((a) => item({ icon: a.kind === 'hapsenje' ? 'fa-building-shield' : (a.kind === 'pustanje' ? 'fa-person-walking' : 'fa-user-lock'), tone: a.kind === 'hapsenje' ? 'r' : '',
          title: `${esc(a.name)} · ${kindLabel(a.kind)}`, sub: `${esc(a.officer_name)} · ${esc(a.t)}${a.jail_minutes ? ' · ' + a.jail_minutes + ' min' : ''}${a.fine ? ' · ' + money(a.fine) : ''}`, click: personLink(a.ref) })).join('') || empty('Nema zapisa.')}</div></div>`;
  };

  // ---------- DISPATCH ----------
  Views.dispatch = async () => {
    setHead('Dispatch', 'Aktivni pozivi · F7 prihvata poslednji poziv');
    const r = await api('dispatch');
    if (!r.ok) { content.innerHTML = empty(r.error); return; }
    callCount = r.list.length; renderNav();
    const me = A.officer.name;
    content.innerHTML = `<div style="display:flex;gap:8px;margin-bottom:12px">${can('dispatch.manage') ? '<button class="fm-btn acc" data-act="callNew"><i class="fa-solid fa-plus"></i> Novi poziv (moja lokacija)</button>' : ''}
      ${!isFib() ? '<button class="fm-btn" data-act="reqFib"><i class="fa-solid fa-user-secret"></i> Zatraži podršku FIB-a</button>' : ''}</div>
      ${r.list.map((c) => {
        const units = Object.values(c.units || {});
        const mine = units.find((u) => u.name === me);
        return `<div class="fm-call p-${c.priority}"><div class="fm-call-top"><i class="fa-solid ${c.icon || 'fa-bell'}" style="color:var(--pc)"></i><b>#${c.id} ${esc(c.title)}</b>
            <span class="fm-pill">${prioLabel(c.priority)}</span><span class="fm-pill acc">${statusLabel(c.status)}</span></div>
          <p>${esc(c.description || '')}</p>
          <div class="fm-time" style="margin-top:6px"><i class="fa-solid fa-location-dot"></i> ${esc(c.street || 'nepoznato')} ${c.caller ? ' · ' + esc(c.caller) : ''} · ${ago(c.created)}</div>
          <div class="fm-call-units">${units.map((u) => `<span class="fm-pill ${u.state === 'na_lokaciji' ? 'ok' : 'acc'}">${u.callsign ? esc(u.callsign) + ' ' : ''}${esc(u.name)}</span>`).join('')}</div>
          <div class="fm-call-act">
            ${!mine ? `<button class="fm-btn sm acc" data-call="accept" data-id="${c.id}">Prihvati</button>` : `<button class="fm-btn sm ok" data-call="arrived" data-id="${c.id}" ${mine.state === 'na_lokaciji' ? 'disabled' : ''}>Na lokaciji</button><button class="fm-btn sm" data-call="decline" data-id="${c.id}">Odustani</button>`}
            ${c.coords ? `<button class="fm-btn sm" data-callgps="${c.id}" data-x="${c.coords.x}" data-y="${c.coords.y}"><i class="fa-solid fa-location-arrow"></i> GPS</button>` : ''}
            ${mine || can('dispatch.manage') ? `<button class="fm-btn sm red" data-call="finish" data-id="${c.id}" style="margin-left:auto">Završi</button>` : ''}
          </div></div>`;
      }).join('') || empty('Nema aktivnih poziva.', 'fa-bell-slash')}`;
  };

  // ---------- POLICAJCI ----------
  Views.officers = async () => {
    setHead('Policajci', 'Jedinice i sastav');
    const r = await api('officers');
    if (!r.ok) { content.innerHTML = empty(r.error); return; }
    content.innerHTML = `
      <div class="fm-card"><div class="fm-card-h"><i class="h-ico fa-solid fa-signal"></i><b>Na dužnosti (${r.units.length})</b><button class="fm-btn sm" data-act="callsign">Moj pozivni znak</button></div>
        <div class="fm-list">${r.units.map((u) => `<div class="fm-item"><span class="fm-dot ${u.status === 'dostupan' ? 'on' : 'busy'}"></span>
          <div class="fm-item-t"><b>${u.callsign ? '[' + esc(u.callsign) + '] ' : ''}${esc(u.name)}</b><span>${esc(u.rank)}</span></div><span class="fm-pill">${esc(u.status)}</span></div>`).join('')}</div></div>
      ${r.roster ? `<div class="fm-card"><div class="fm-card-h"><i class="h-ico fa-solid fa-users"></i><b>Svi zaposleni (${r.roster.length})</b></div>
        <div class="fm-list">${r.roster.map((o) => `<div class="fm-item"><span class="fm-dot ${o.onDuty ? 'on' : (o.online ? '' : 'off')}"></span>
          <div class="fm-item-t"><b>${o.callsign ? '[' + esc(o.callsign) + '] ' : ''}${esc(o.name)}</b><span>${esc(o.rank)} · 7 dana: ${dur(o.week)} · ukupno: ${dur(o.total)}</span></div>
          <span class="fm-time">${o.onDuty ? 'na dužnosti' : (o.lastDuty ? 'posl. ' + esc(o.lastDuty) : '')}</span></div>`).join('')}</div></div>` : ''}`;
  };

  // ---------- LOGOVI ----------
  Views.logs = async (q) => {
    setHead('Logovi', 'Sve bitne akcije (server)');
    const r = await api('logs', { query: q || '' });
    if (!r.ok) { content.innerHTML = empty(r.error); return; }
    content.innerHTML = `<div class="fm-search"><i class="fa-solid fa-magnifying-glass"></i><input class="fm-inp" id="pdm-lq" placeholder="Ime, akcija ili detalj" value="${esc(q || '')}"></div>
      <div class="fm-list">${r.list.map((l) => item({ icon: 'fa-circle-dot', title: `${esc(logLabel(l.action))}${l.target_name ? ' · ' + esc(l.target_name) : ''}`, sub: `${esc(l.actor_name)} · ${esc(l.t)}`, text: esc(l.detail) })).join('') || empty('Nema zapisa.')}</div>`;
    document.getElementById('pdm-lq').addEventListener('keydown', (e) => { if (e.key === 'Enter') { cur.arg = e.target.value; Views.logs(e.target.value); } });
  };

  // ---------- UPRAVA ----------
  Views.boss = async () => {
    setHead('Uprava', 'Zaposleni, činovi i plate');
    const r = await api('boss');
    if (!r.ok) { content.innerHTML = empty(r.error, 'fa-lock'); return; }
    content._boss = r;
    content.innerHTML = `
      ${r.can.hire ? `<div class="fm-card"><div class="fm-card-h"><i class="h-ico fa-solid fa-user-plus"></i><b>Zaposli</b></div>
        <div class="fm-row"><input class="fm-inp" id="pdm-hire" type="number" placeholder="Server ID igrača"><button class="fm-btn acc" data-act="hire" style="flex:0 0 auto">Zaposli kao Cadet</button></div></div>` : ''}
      <div class="fm-card"><div class="fm-card-h"><i class="h-ico fa-solid fa-users"></i><b>Zaposleni (${r.roster.length})</b></div>
        <div class="fm-list">${r.roster.map((o) => `<div class="fm-item"><span class="fm-dot ${o.onDuty ? 'on' : (o.online ? '' : 'off')}"></span>
          <div class="fm-item-t"><b>${o.callsign ? '[' + esc(o.callsign) + '] ' : ''}${esc(o.name)}</b><span>${esc(o.rank)} · 7 dana: ${dur(o.week)}</span></div>
          ${o.self || (o.grade >= r.myGrade && r.myGrade < 9) ? '' : `<div class="fm-item-r">
            ${r.can.promote ? `<select class="fm-inp" data-setgrade="${o.ref}" style="height:28px;width:140px;font-size:11.5px">${r.ranks.filter((k) => k.grade < r.myGrade || r.myGrade >= 9).map((k) => `<option value="${k.grade}" ${k.grade === o.grade ? 'selected' : ''}>${esc(k.label)}</option>`).join('')}</select>
              <button class="fm-btn sm" data-cs="${o.ref}" title="Pozivni znak"><i class="fa-solid fa-hashtag"></i></button>` : ''}
            ${r.can.fire ? `<button class="fm-btn sm red" data-fire="${o.ref}"><i class="fa-solid fa-user-xmark"></i></button>` : ''}</div>`}
        </div>`).join('')}</div></div>
      <div class="fm-card"><div class="fm-card-h"><i class="h-ico fa-solid fa-sack-dollar"></i><b>Činovi i plate</b><span class="fm-time">plata po satu na dužnosti</span></div>
        <div class="fm-list">${r.ranks.map((k) => `<div class="fm-item"><div class="fm-item-ico">${k.grade}</div>
          <div class="fm-item-t"><b>${esc(k.label)}</b><span>max ${k.maxStars}★ · kazna ${money(k.maxFine)} · zatvor ${k.maxJail} min</span></div>
          ${r.can.salary && (k.grade < r.myGrade || r.myGrade >= 9) ? `<input class="fm-inp" type="number" value="${k.salary}" data-salary="${k.grade}" style="width:100px;height:28px;font-size:12px"><button class="fm-btn sm acc" data-savesal="${k.grade}">Sačuvaj</button>` : `<span class="fm-pill acc">${money(k.salary)}</span>`}
        </div>`).join('')}</div></div>`;
  };

  // ============================================================
  //  FIB SEKCIJA (samo agencija 'fib' + resurs flamingo_fib)
  // ============================================================
  const clsPill = (n) => {
    const c = F && F.classification && F.classification[n];
    const tone = n >= 3 ? 'red' : (n === 2 ? 'warn' : 'acc');
    return `<span class="fm-pill ${tone}"><i class="fa-solid fa-lock"></i> ${esc(c ? c.label : ('Nivo ' + n))}</span>`;
  };
  const opPill = (s) => { const m = { aktivna: ['ok', 'Aktivna'], nadzor: ['warn', 'Pod nadzorom'], zavrsena: ['', 'Završena'], obustavljena: ['red', 'Obustavljena'] }[s] || ['', s]; return `<span class="fm-pill ${m[0]}">${m[1]}</span>`; };
  const authPill = (s) => { const m = { zatrazen: ['warn', 'Čeka odobrenje'], odobren: ['ok', 'Odobren'], aktivan: ['acc', 'Aktivan'], odbijen: ['red', 'Odbijen'], istekao: ['', 'Istekao'], zavrsen: ['', 'Završen'] }[s] || ['', s]; return `<span class="fm-pill ${m[0]}">${m[1]}</span>`; };

  async function loadF() {
    const r = await apiF('overview');
    if (r.ok) F = r;
    return r;
  }

  Views.fib = async () => {
    setHead('FIB pregled', 'Federal Investigation Bureau');
    const r = await loadF();
    if (!r.ok) { content.innerHTML = empty(r.error, 'fa-user-secret'); return; }
    const s = r.stats;
    content.innerHTML = `
      <div class="fm-prof"><div class="fm-photo"><i class="fa-solid fa-user-secret"></i></div>
        <div class="fm-prof-t"><h2>${esc(A.officer.name)}</h2><div class="fm-prof-tags"><span class="fm-pill acc">${esc(A.officer.rank)}</span>
          ${r.clearance ? clsPill(r.clearance) : '<span class="fm-pill">Bez pristupa tajnim podacima</span>'}</div>
          <p class="fm-time" style="margin-top:6px">Nivo pristupa određuje koje operacije vidiš.</p></div></div>
      <div class="fm-stats">
        <div class="fm-stat"><i class="fa-solid fa-folder-tree"></i><span>Aktivne operacije</span><b>${s.ops}</b></div>
        <div class="fm-stat"><i class="w fa-solid fa-flask"></i><span>Lab u obradi</span><b>${s.lab}</b></div>
        <div class="fm-stat"><i class="r fa-solid fa-file-signature"></i><span>Nalozi na čekanju</span><b>${s.auths}</b></div>
        <div class="fm-stat"><i class="g fa-solid fa-satellite-dish"></i><span>Aktivni trackeri</span><b>${s.trackers}</b></div>
        <div class="fm-stat"><i class="fa-solid fa-user-ninja"></i><span>Aktivni informanti</span><b>${s.informants}</b></div>
        <div class="fm-stat"><i class="r fa-solid fa-user-slash"></i><span>Suspendovani službenici</span><b>${s.suspended}</b></div>
      </div>
      <div class="fm-card"><div class="fm-card-h"><i class="h-ico fa-solid fa-circle-info"></i><b>Nadležnost</b></div>
        <p style="font-size:12.5px;line-height:1.55;color:#c7cbd8">FIB vodi organizovani kriminal, pljačke banaka, otmice i korupciju. Ozbiljne policijske predmete FIB <b>preuzima</b> (Predmeti → otvori predmet → "FIB preuzima").
        Naloge za nadzor odobrava FIB komanda. FIB vidi sve policijske podatke, a policija vidi samo oznaku "FIB interes".</p></div>`;
  };

  let opFilter = '';
  Views.ops = async () => {
    setHead('Operacije', 'Klasifikovane FIB istrage');
    if (!F) await loadF();
    const r = await apiF('ops', { status: opFilter });
    if (!r.ok) { content.innerHTML = empty(r.error); return; }
    content.innerHTML = `<div style="display:flex;gap:8px;margin-bottom:12px">
        <button class="fm-btn acc" data-fact="opNew"><i class="fa-solid fa-plus"></i> Nova operacija</button>
        ${F && F.perms.takeover ? '<button class="fm-btn" data-fact="takeover"><i class="fa-solid fa-hand"></i> Preuzmi PD predmet</button>' : ''}</div>
      ${tabs([['', 'Sve'], ['aktivna', 'Aktivne'], ['nadzor', 'Nadzor'], ['zavrsena', 'Završene'], ['obustavljena', 'Obustavljene']], opFilter, 'opfilter')}
      <div class="fm-list">${r.list.map((o) => item({ icon: 'fa-folder-closed', tone: o.classification >= 3 ? 'r' : (o.classification === 2 ? 'w' : ''),
        title: `${esc(o.codename)} · ${esc(o.title)}`, sub: `Vodi: ${esc(o.lead_name)} · izmena ${esc(o.u)}${o.pd_case_id ? ' · PD #' + o.pd_case_id : ''}`,
        right: `${clsPill(o.classification)}${opPill(o.status)}`, click: `data-op="${o.id}"` })).join('') || empty('Nema operacija za tvoj nivo pristupa.', 'fa-folder-open')}</div>`;
  };

  Views.op = async (id) => {
    if (!F) await loadF();
    const r = await apiF('op', { id });
    if (!r.ok) { setHead('Operacija', ''); content.innerHTML = empty(r.error, 'fa-lock'); return; }
    const o = r.op;
    setHead(o.codename, o.title);
    content.dataset.opId = o.id;
    const clsOpts = Object.entries(F.classification).filter(([n]) => Number(n) <= F.clearance).map(([n, c]) => `<option value="${n}" ${Number(n) === o.classification ? 'selected' : ''}>${esc(c.label)}</option>`).join('');
    content.innerHTML = `
      <div class="fm-prof ${o.classification >= 3 ? 'danger' : ''}"><div class="fm-photo"><i class="fa-solid fa-folder-tree"></i></div>
        <div class="fm-prof-t"><h2>${esc(o.codename)}</h2><div class="fm-prof-tags">${clsPill(o.classification)}${opPill(o.status)}
          <span class="fm-pill">Vodi: ${esc(o.lead_name)}</span>${o.pd_case_id ? `<button class="fm-pill acc" data-case="${o.pd_case_id}">PD predmet #${o.pd_case_id}</button>` : ''}</div>
          <p class="fm-time" style="margin-top:6px">${esc(o.title)} · otvorena ${esc(o.t)}</p></div>
        <div class="fm-prof-act">
          <select class="fm-inp" id="fib-status" style="height:30px;font-size:12px">${Object.entries(F.statuses).map(([k, l]) => `<option value="${k}" ${k === o.status ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
          <select class="fm-inp" id="fib-cls" style="height:30px;font-size:12px">${clsOpts}</select>
          <button class="fm-btn sm acc" data-fact="opSave">Sačuvaj</button></div></div>
      ${o.description ? `<div class="fm-card"><div class="fm-card-h"><i class="h-ico fa-solid fa-align-left"></i><b>Opis</b></div><p style="font-size:12.5px;line-height:1.5;white-space:pre-wrap">${esc(o.description)}</p></div>` : ''}
      <div class="fm-2col"><div>
        <div class="fm-card"><div class="fm-card-h"><i class="h-ico fa-solid fa-users"></i><b>Učesnici</b><button class="fm-btn sm acc" data-fact="opMember"><i class="fa-solid fa-plus"></i></button></div>
          <div class="fm-list">${r.members.map((m) => item({ icon: m.role === 'meta' ? 'fa-crosshairs' : (m.role === 'agent' ? 'fa-user-secret' : 'fa-user'), tone: m.role === 'meta' ? 'r' : '',
            title: esc(m.name), sub: `${esc((F.roles || {})[m.role] || m.role)}${m.note ? ' · ' + esc(m.note) : ''}`,
            right: `${m.ref ? `<button class="fm-btn sm" data-person="${m.ref}"><i class="fa-solid fa-folder-open"></i></button>` : ''}<button class="fm-btn sm red" data-fopm="${m.id}"><i class="fa-solid fa-xmark"></i></button>` })).join('') || empty('Nema učesnika.')}</div></div>
        <div class="fm-card"><div class="fm-card-h"><i class="h-ico fa-solid fa-satellite-dish"></i><b>Nalozi</b><button class="fm-btn sm acc" data-fact="authNew"><i class="fa-solid fa-plus"></i></button></div>
          <div class="fm-list">${r.auths.map((a) => item({ icon: 'fa-file-signature', title: `#${a.id} ${esc((F.kinds || {})[a.kind] || a.kind)}`, sub: `${esc(a.target)} · ${esc(a.requested_by)}${a.exp ? ' · do ' + esc(a.exp) : ''}`, right: authPill(a.status) })).join('') || empty('Nema naloga.')}</div></div>
        <div class="fm-card"><div class="fm-card-h"><i class="h-ico fa-solid fa-flask"></i><b>Laboratorija</b></div>
          <div class="fm-list">${r.lab.map((l) => item({ icon: 'fa-flask', tone: l.status === 'gotovo' ? 'g' : 'w', title: esc(l.label), text: l.result ? esc(l.result) : 'U obradi...' })).join('') || empty('Nema analiza.')}</div></div>
      </div>
      <div class="fm-card"><div class="fm-card-h"><i class="h-ico fa-solid fa-timeline"></i><b>Tok operacije</b><button class="fm-btn sm acc" data-fact="opEntry"><i class="fa-solid fa-plus"></i> Zapis</button></div>
        <div class="fm-timeline">${r.entries.map((e) => `<div class="fm-tl"><b>${esc(({ izvestaj: 'Izveštaj', dokaz: 'Dokaz', nadzor: 'Nadzor', napomena: 'Napomena', status: 'Promena' })[e.kind] || e.kind)}</b><span>${esc(e.author_name)} · ${esc(e.t)}</span><p>${esc(e.content)}</p></div>`).join('') || empty('Još nema zapisa.')}</div></div>
      </div>`;
  };

  Views.lab = async () => {
    setHead('Laboratorija', 'Forenzička i balistička analiza dokaza');
    const r = await apiF('lab');
    if (!r.ok) { content.innerHTML = empty(r.error); return; }
    content._lab = r;
    content.innerHTML = `<button class="fm-btn acc" data-fact="labNew" style="margin-bottom:12px"><i class="fa-solid fa-plus"></i> Pošalji dokaz na analizu</button>
      <div class="fm-list">${r.list.map((l) => item({ icon: 'fa-flask', tone: l.status === 'gotovo' ? 'g' : 'w', title: `#${l.id} ${esc(l.label)} (dokaz #${l.evidence_id})`,
        sub: `${esc(l.requested_by)} · ${esc(l.t)}${l.status !== 'gotovo' ? ' · gotovo za ~' + Math.ceil(l.eta / 60) + ' min' : ''}`, text: l.result ? esc(l.result) : '',
        right: l.status === 'gotovo' ? '<span class="fm-pill ok">Gotovo</span>' : '<span class="fm-pill warn">U obradi</span>' })).join('') || empty('Nema analiza.', 'fa-flask')}</div>`;
  };

  Views.nadzor = async () => {
    setHead('Nadzor i nalozi', 'Odobrava FIB komanda (DOJ ne postoji)');
    if (!F) await loadF();
    const [r, t] = await Promise.all([apiF('auths'), apiF('trackers')]);
    if (!r.ok) { content.innerHTML = empty(r.error); return; }
    content.innerHTML = `<button class="fm-btn acc" data-fact="authNew" style="margin-bottom:12px"><i class="fa-solid fa-plus"></i> Zahtev za nalog</button>
      <div class="fm-card"><div class="fm-card-h"><i class="h-ico fa-solid fa-satellite-dish"></i><b>Aktivni GPS trackeri</b><span class="fm-time">postavlja se iz G menija → FIB alati</span></div>
        <div class="fm-list">${(t.list || []).map((x) => item({ icon: 'fa-location-crosshairs', tone: x.signal ? 'g' : 'r', title: `${esc(x.plate)} · ${esc(x.codename)}`,
          sub: `${esc(x.by)} · još ${dur(x.left)}${x.signal ? '' : ' · NEMA SIGNALA (vozilo nije u svetu)'}`, right: `<button class="fm-btn sm red" data-ftrk="${esc(x.plate)}">Ukloni</button>` })).join('') || empty('Nema aktivnih trackera.')}</div></div>
      <div class="fm-card"><div class="fm-card-h"><i class="h-ico fa-solid fa-file-signature"></i><b>Nalozi</b></div>
        <div class="fm-list">${r.list.map((a) => item({ icon: 'fa-file-signature', tone: a.status === 'zatrazen' ? 'w' : '', title: `#${a.id} ${esc(r.kinds[a.kind] || a.kind)} · ${esc(a.target)}`,
          sub: `${esc(a.requested_by)} · ${esc(a.t)}${a.codename ? ' · ' + esc(a.codename) : ''} · ${a.minutes} min${a.decided_by ? ' · odlučio ' + esc(a.decided_by) : ''}`, text: esc(a.reason) + (a.decision_note ? ' — ' + esc(a.decision_note) : ''),
          right: a.status === 'zatrazen' && F && F.perms.approve ? `<button class="fm-btn sm ok" data-fauth="${a.id}" data-ok="1">Odobri</button><button class="fm-btn sm red" data-fauth="${a.id}" data-ok="0">Odbij</button>` : authPill(a.status) })).join('') || empty('Nema naloga.')}</div></div>`;
  };

  Views.informants = async () => {
    setHead('Informanti', 'Registar doušnika - isplate iz FIB sefa');
    const r = await apiF('informants');
    if (!r.ok) { content.innerHTML = empty(r.error); return; }
    content.innerHTML = `<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px"><button class="fm-btn acc" data-fact="infNew"><i class="fa-solid fa-plus"></i> Novi informant</button>
        <span class="fm-pill acc">FIB sef: ${money(r.safe)}</span>${r.identity ? '' : '<span class="fm-time">Prava imena vidiš samo za svoje informante.</span>'}</div>
      <div class="fm-list">${r.list.map((i) => item({ icon: 'fa-user-ninja', tone: i.status === 'spaljen' ? 'r' : (i.status === 'aktivan' ? 'g' : ''), title: `${esc(i.codename)}${i.real_name ? ' · ' + esc(i.real_name) : ''}`,
        sub: `Kontakt: ${esc(i.handler_name)} · isplaćeno ${money(i.total_paid)}${i.online ? ' · <b style="color:var(--ok)">online</b>' : ''}`, text: esc(i.notes || ''),
        right: `<select class="fm-inp" data-finfst="${i.id}" style="height:28px;width:110px;font-size:11.5px">${['aktivan', 'neaktivan', 'spaljen'].map((s2) => `<option ${s2 === i.status ? 'selected' : ''}>${s2}</option>`).join('')}</select>
          ${r.canPay && i.status === 'aktivan' ? `<button class="fm-btn sm acc" data-finfpay="${i.id}">Isplati</button>` : ''}` })).join('') || empty('Nema informanata.', 'fa-user-ninja')}</div>`;
  };

  Views.ia = async (q) => {
    setHead('Unutrašnja kontrola', 'Istrage službenika policije, FIB-a i vlade');
    content.innerHTML = `<div class="fm-search"><i class="fa-solid fa-magnifying-glass"></i><input class="fm-inp" id="fib-iaq" placeholder="Ime službenika (prazno = svi)" value="${esc(q || '')}">
      <button class="fm-btn acc" data-fact="iaSearch">Traži</button></div><div id="fib-iares">${loading()}</div>`;
    document.getElementById('fib-iaq').addEventListener('keydown', (e) => { if (e.key === 'Enter') iaSearch(); });
    iaSearch();
  };
  async function iaSearch() {
    const q = document.getElementById('fib-iaq').value.trim();
    if (cur) cur.arg = q;
    const r = await apiF('iaSearch', { query: q });
    const el = document.getElementById('fib-iares');
    if (!el) return;
    if (!r.ok) { el.innerHTML = empty(r.error); return; }
    el.innerHTML = `<div class="fm-list">${r.list.map((o) => item({ icon: 'fa-user-shield', tone: o.suspended ? 'r' : '', title: esc(o.name), sub: `${esc(o.job)} · čin ${o.grade}`,
      right: `${o.suspended ? '<span class="fm-pill red">Suspendovan</span>' : ''}<i class="fa-solid fa-chevron-right" style="color:var(--faint)"></i>`, click: `data-fia="${o.ref}"` })).join('') || empty('Nema rezultata.')}</div>`;
  }

  Views.iaOfficer = async (ref) => {
    if (!F) await loadF();
    const r = await apiF('iaOfficer', { ref });
    if (!r.ok) { setHead('Službenik', ''); content.innerHTML = empty(r.error); return; }
    setHead(r.name, `Unutrašnja kontrola · ${r.job} · čin ${r.grade}`);
    const s = r.stats;
    const active = r.suspensions.find((x) => x.active && x.running);
    content.dataset.iaRef = ref;
    content.innerHTML = `
      <div class="fm-prof ${active ? 'danger' : ''}"><div class="fm-photo">${esc(initials(r.name))}</div>
        <div class="fm-prof-t"><h2>${esc(r.name)}</h2><div class="fm-prof-tags"><span class="fm-pill acc">${esc(r.job)}</span>${active ? `<span class="fm-pill red">Suspendovan do ${esc(active.until_t)}</span>` : '<span class="fm-pill ok">Aktivan</span>'}</div></div>
        ${F && F.perms.suspend ? `<div class="fm-prof-act">${active ? `<button class="fm-btn sm ok" data-flift="${active.id}">Ukini suspenziju</button>` : '<button class="fm-btn sm red" data-fact="iaSuspend">Suspenduj</button>'}</div>` : ''}</div>
      <div class="fm-stats">
        <div class="fm-stat"><i class="fa-solid fa-clock"></i><span>Dužnost (14 dana)</span><b>${dur(s.duty14)}</b></div>
        <div class="fm-stat"><i class="w fa-solid fa-gun"></i><span>Preuzimanja iz oružarnice</span><b>${s.armory}</b></div>
        <div class="fm-stat"><i class="fa-solid fa-box-archive"></i><span>Zaplene</span><b>${s.seizures}</b></div>
        <div class="fm-stat"><i class="r fa-solid fa-fire"></i><span>Uništeni dokazi</span><b>${s.destroyed}</b></div>
        <div class="fm-stat"><i class="w fa-solid fa-rotate-left"></i><span>Vraćeni dokazi</span><b>${s.returned}</b></div>
        <div class="fm-stat"><i class="r fa-solid fa-ban"></i><span>Poništene kazne</span><b>${s.voided}</b></div>
      </div>
      <div class="fm-2col">
        <div class="fm-card"><div class="fm-card-h"><i class="h-ico fa-solid fa-user-slash"></i><b>Suspenzije</b></div>
          <div class="fm-list">${r.suspensions.map((x) => item({ icon: 'fa-user-slash', tone: x.active && x.running ? 'r' : '', title: `Do ${esc(x.until_t)}`, sub: `${esc(x.by_name)}${x.active && x.running ? '' : ' · neaktivna'}`, text: esc(x.reason) })).join('') || empty('Nikad suspendovan.')}</div></div>
        <div class="fm-card"><div class="fm-card-h"><i class="h-ico fa-solid fa-list-check"></i><b>Aktivnost</b><span class="fm-time">hapšenja ${s.arrests} · puštanja iz zatvora ${s.releases}</span></div>
          <div class="fm-list" style="max-height:320px;overflow-y:auto">${r.logs.map((l) => item({ icon: 'fa-circle-dot', title: `${esc(logLabel(l.action))}${l.target_name ? ' · ' + esc(l.target_name) : ''}`, sub: `${esc(l.agency)} · ${esc(l.t)}`, text: esc(l.detail || '') })).join('') || empty('Nema zapisa.')}</div></div>
      </div>`;
  };

  function personPickModal(title, iconName, extraFields, onPick) {
    let chosen = null;
    FMDT.modal(shell, {
      title, icon: iconName, ok: 'Sačuvaj',
      body: `<div class="fm-field"><label class="fm-lbl">Pretraži građanina</label><div class="fm-row"><input class="fm-inp" id="m-q" placeholder="Ime ili ID"><button class="fm-btn" id="m-search" style="flex:0 0 auto">Traži</button></div></div>
        <div class="fm-list" id="m-res" style="max-height:150px;overflow-y:auto;margin-bottom:12px"></div>` + extraFields,
      onClick: async (e, mm) => {
        if (e.target.closest('#m-search')) {
          const r = await api('searchPerson', { query: mm.querySelector('#m-q').value });
          mm.querySelector('#m-res').innerHTML = r.ok ? r.results.map((p) => `<div class="fm-item click" data-pick="${p.ref}"><div class="fm-item-t"><b>${esc(p.name)}</b><span>${esc(p.dob || '')}</span></div></div>`).join('') || empty('Nema rezultata.') : empty(r.error);
        }
        const pk = e.target.closest('[data-pick]');
        if (pk) { chosen = Number(pk.dataset.pick); mm.querySelectorAll('[data-pick]').forEach((x) => { x.style.borderColor = ''; }); pk.style.borderColor = 'var(--acc)'; }
      },
      onOk: async (mm) => onPick(chosen, mm)
    });
  }

  async function fibClick(e) {
    const t = (sel) => e.target.closest(sel);
    let el;
    if ((el = t('[data-op]'))) { go('op', Number(el.dataset.op)); return true; }
    if ((el = t('[data-opfilter]'))) { opFilter = el.dataset.opfilter; Views.ops(); return true; }
    if ((el = t('[data-fia]'))) { go('iaOfficer', Number(el.dataset.fia)); return true; }
    if ((el = t('[data-fibtake]'))) {
      if (!arm(el, 'Preuzmi?')) return true;
      const r = await apiF('takeover', { caseId: Number(el.dataset.fibtake) });
      toast(r.ok ? 'FIB je preuzeo predmet - otvorena je operacija.' : r.error, r.ok ? 'success' : 'error');
      if (r.ok) go('op', r.id);
      return true;
    }
    if ((el = t('[data-fopm]'))) {
      if (!arm(el, '')) return true;
      await apiF('opMemberRemove', { id: Number(content.dataset.opId), memberId: Number(el.dataset.fopm) });
      reload(); return true;
    }
    if ((el = t('[data-fauth]'))) {
      const approve = el.dataset.ok === '1';
      simpleModal(approve ? 'Odobri nalog' : 'Odbij nalog', 'fa-file-signature', [{ key: 'note', label: 'Napomena (opciono)', max: 255 }], 'authDecide', { id: Number(el.dataset.fauth), approve }, approve ? 'Odobri' : 'Odbij', null, apiF);
      return true;
    }
    if ((el = t('[data-ftrk]'))) {
      if (!arm(el, 'Ukloni?')) return true;
      const r = await apiF('trackerRemove', { plate: el.dataset.ftrk });
      toast(r.ok ? 'Tracker je uklonjen.' : r.error, r.ok ? 'success' : 'error');
      reload(); return true;
    }
    if ((el = t('[data-finfpay]'))) {
      simpleModal('Isplata informantu', 'fa-money-bill-wave', [{ key: 'amount', label: 'Iznos ($)', type: 'number' }, { key: 'note', label: 'Za šta (napomena)', max: 255 }], 'informantPay', { id: Number(el.dataset.finfpay) }, 'Isplati', null, apiF);
      return true;
    }
    if ((el = t('[data-flift]'))) {
      if (!arm(el, 'Ukini?')) return true;
      const r = await apiF('iaLift', { id: Number(el.dataset.flift) });
      toast(r.ok ? 'Suspenzija je ukinuta.' : r.error, r.ok ? 'success' : 'error');
      reload(); return true;
    }
    const act = t('[data-fact]');
    if (!act) return false;
    const kindsOpts = F ? Object.entries(F.kinds).map(([k, l]) => [k, l]) : [['tracker', 'GPS tracker']];
    switch (act.dataset.fact) {
      case 'opNew': {
        const cls = F ? Object.entries(F.classification).filter(([n]) => Number(n) <= F.clearance).map(([n, c]) => [n, c.label]) : [['1', 'Poverljivo']];
        simpleModal('Nova operacija', 'fa-folder-plus', [{ key: 'codename', label: 'Kodno ime', ph: 'npr. CRNI LABUD', max: 40 }, { key: 'title', label: 'Naslov', max: 120 },
          { key: 'classification', label: 'Nivo tajnosti', type: 'select', options: cls }, { key: 'description', label: 'Opis', type: 'area', tall: true, max: 4000 }], 'opCreate', {}, 'Otvori', (r) => go('op', r.id), apiF);
        return true;
      }
      case 'takeover':
        simpleModal('Preuzmi policijski predmet', 'fa-hand', [{ key: 'caseId', label: 'Broj PD predmeta', type: 'number' }], 'takeover', {}, 'Preuzmi', (r) => go('op', r.id), apiF);
        return true;
      case 'opSave': {
        const r = await apiF('opUpdate', { id: Number(content.dataset.opId), status: document.getElementById('fib-status').value, classification: Number(document.getElementById('fib-cls').value) });
        toast(r.ok ? 'Sačuvano.' : r.error, r.ok ? 'success' : 'error');
        reload(); return true;
      }
      case 'opEntry':
        simpleModal('Novi zapis', 'fa-pen', [{ key: 'kind', label: 'Vrsta', type: 'select', options: [['izvestaj', 'Izveštaj'], ['dokaz', 'Dokaz'], ['nadzor', 'Nadzor'], ['napomena', 'Napomena']] }, { key: 'content', label: 'Sadržaj', type: 'area', tall: true, max: 4000 }], 'opEntry', { id: Number(content.dataset.opId) }, 'Sačuvaj', null, apiF);
        return true;
      case 'opMember':
        personPickModal('Dodaj učesnika', 'fa-user-plus', `<div class="fm-field"><label class="fm-lbl">...ili ime (van baze)</label><input class="fm-inp" id="m-name" maxlength="100"></div>
          <div class="fm-row"><div class="fm-field"><label class="fm-lbl">Uloga</label><select class="fm-inp" id="m-role">${Object.entries(F.roles).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select></div>
          <div class="fm-field"><label class="fm-lbl">Napomena</label><input class="fm-inp" id="m-note" maxlength="200"></div></div>`, async (ref, mm) => {
          const r = await apiF('opMember', { id: Number(content.dataset.opId), ref, name: mm.querySelector('#m-name').value, role: mm.querySelector('#m-role').value, note: mm.querySelector('#m-note').value });
          toast(r.ok ? 'Učesnik je dodat.' : r.error, r.ok ? 'success' : 'error');
          if (r.ok) reload();
          return r.ok;
        });
        return true;
      case 'authNew':
        simpleModal('Zahtev za nalog', 'fa-file-signature', [{ key: 'kind', label: 'Vrsta', type: 'select', options: kindsOpts }, { key: 'target', label: 'Meta (tablica za tracker / adresa / osoba)', max: 100 },
          { key: 'minutes', label: `Trajanje (min, max ${F ? 60 : 60})`, type: 'number', value: 30 }, { key: 'reason', label: 'Obrazloženje', type: 'area', max: 500 }],
          'authRequest', { opId: cur && cur.view === 'op' ? Number(content.dataset.opId) : null }, 'Pošalji na odobrenje', null, apiF);
        return true;
      case 'labNew': {
        const ev = (content._lab && content._lab.evidence) || [];
        simpleModal('Analiza dokaza', 'fa-flask', [{ key: 'evidenceId', label: 'Dokaz iz magacina', type: 'select', options: ev.map((d) => [d.id, `#${d.id} ${d.count}x ${d.label}${d.name ? ' (' + d.name + ')' : ''}`]) },
          { key: 'opId', label: 'Operacija # (opciono)', type: 'number' }], 'labRequest', {}, 'Pošalji u laboratoriju', null, apiF);
        return true;
      }
      case 'infNew':
        personPickModal('Novi informant', 'fa-user-ninja', `<div class="fm-field"><label class="fm-lbl">Kodno ime</label><input class="fm-inp" id="m-code" maxlength="40" placeholder="npr. VRABAC"></div>
          <div class="fm-field"><label class="fm-lbl">Napomene</label><textarea class="fm-inp" id="m-notes" maxlength="1000"></textarea></div>`, async (ref, mm) => {
          const r = await apiF('informantCreate', { ref, codename: mm.querySelector('#m-code').value, notes: mm.querySelector('#m-notes').value });
          toast(r.ok ? 'Informant je upisan.' : r.error, r.ok ? 'success' : 'error');
          if (r.ok) reload();
          return r.ok;
        });
        return true;
      case 'iaSearch': iaSearch(); return true;
      case 'iaSuspend':
        simpleModal('Suspenzija službenika', 'fa-user-slash', [{ key: 'hours', label: 'Trajanje (sati)', type: 'number', value: 24 }, { key: 'reason', label: 'Razlog', type: 'area', max: 500 }],
          'iaSuspend', { ref: Number(content.dataset.iaRef) }, 'Suspenduj', null, apiF);
        return true;
    }
    return false;
  }

  shell.addEventListener('change', async (e) => {
    const s2 = e.target.closest('[data-finfst]');
    if (!s2) return;
    const r = await apiF('informantStatus', { id: Number(s2.dataset.finfst), status: s2.value });
    toast(r.ok ? 'Status je sačuvan.' : r.error, r.ok ? 'success' : 'error');
  });

  // ============================================================
  //  MODALI
  // ============================================================
  function chargesPicker(sel) {
    return (A.penalCode || []).map((cat) => `<div class="fm-nav-sec" style="margin:8px 2px 4px">${esc(cat.label)}</div>` + cat.items.map((c) =>
      `<div class="fm-ch ${sel.has(c.id) ? 'on' : ''}" data-ch="${c.id}"><span>${esc(c.label)}</span><span class="fm-pill acc" style="flex:0 0 auto">${money(c.fine)}</span></div>`).join('')).join('');
  }

  function ticketModal(ref) {
    const sel = new Set();
    const m = modal(shell, {
      title: 'Nova kazna', icon: 'fa-file-invoice-dollar', wide: true, ok: 'Izdaj kaznu',
      body: `<div class="fm-charges" id="m-ch">${chargesPicker(sel)}</div>
        <div class="fm-row"><div class="fm-field"><label class="fm-lbl">Iznos (bez prekršaja)</label><input class="fm-inp" id="m-amount" type="number" min="0"></div>
          <div class="fm-field"><label class="fm-lbl">Predmet #</label><input class="fm-inp" id="m-case" type="number" min="1"></div></div>
        <div class="fm-field"><label class="fm-lbl">Razlog</label><input class="fm-inp" id="m-reason" maxlength="250"></div>
        <p class="fm-time">Limit tvog čina: ${money(A.officer.maxFine)}. Ako je osoba online, dobija ponudu da plati odmah.</p>`,
      onClick: (e) => {
        const ch = e.target.closest('[data-ch]');
        if (ch) { const id = ch.dataset.ch; sel.has(id) ? sel.delete(id) : sel.add(id); ch.classList.toggle('on'); }
      },
      onOk: async (mm) => {
        const r = await api('personTicket', { ref, charges: [...sel], amount: Number(mm.querySelector('#m-amount').value) || 0, reason: mm.querySelector('#m-reason').value, caseId: Number(mm.querySelector('#m-case').value) || null });
        toast(r.ok ? `Kazna #${r.id} je izdata.` : r.error, r.ok ? 'success' : 'error');
        if (r.ok) reload();
        return r.ok;
      }
    });
    return m;
  }

  function wantedModal(ref, curStars) {
    let pick = curStars ? curStars : 1;
    const draw = (mm) => {
      mm.querySelector('#m-stars').innerHTML = [0, 1, 2, 3, 4, 5].map((n) => {
        const dis = n === 0 ? (!can('wanted.clear') || !curStars) : n > A.officer.maxStars;
        return `<button class="${n === pick ? 'on' : ''}" data-star="${n}" ${dis ? 'disabled' : ''}><i class="fa-solid ${n ? 'fa-star' : 'fa-ban'}"></i>${n ? n + '★' : 'Skini'}</button>`;
      }).join('');
      const lvl = A.wantedLevels && A.wantedLevels[pick];
      mm.querySelector('#m-lvl').textContent = pick === 0 ? 'Uklanjanje potrage (razlog ostaje u istoriji).' : (lvl ? `${lvl.label} · dispatch prioritet ${lvl.priority}` : '');
    };
    modal(shell, {
      title: 'Wanted status', icon: 'fa-star', ok: 'Sačuvaj',
      body: `<div class="fm-starpick" id="m-stars"></div><p class="fm-time" id="m-lvl" style="margin-bottom:12px"></p>
        <div class="fm-field"><label class="fm-lbl">Razlog (obavezno)</label><textarea class="fm-inp" id="m-reason" maxlength="500"></textarea></div>
        <div class="fm-field"><label class="fm-lbl">Predmet #</label><input class="fm-inp" id="m-case" type="number" min="1"></div>`,
      onMount: draw,
      onClick: (e, mm) => { const b = e.target.closest('[data-star]'); if (b && !b.disabled) { pick = Number(b.dataset.star); draw(mm); } },
      onOk: async (mm) => {
        const r = await api('personWanted', { ref, stars: pick, reason: mm.querySelector('#m-reason').value, caseId: Number(mm.querySelector('#m-case').value) || null });
        toast(r.ok ? 'Wanted status je sačuvan.' : r.error, r.ok ? 'success' : 'error');
        if (r.ok) reload();
        return r.ok;
      }
    });
  }

  function simpleModal(title, iconName, fields, route, extra, okLabel, onDone, callFn) {
    modal(shell, {
      title, icon: iconName, ok: okLabel || 'Sačuvaj',
      body: fields.map((f) => `<div class="fm-field"><label class="fm-lbl">${f.label}</label>${f.type === 'area' ? `<textarea class="fm-inp" data-f="${f.key}" maxlength="${f.max || 1500}" ${f.tall ? 'style="height:150px"' : ''}></textarea>`
        : f.type === 'select' ? `<select class="fm-inp" data-f="${f.key}">${f.options.map((o) => `<option value="${o[0]}">${esc(o[1])}</option>`).join('')}</select>`
        : `<input class="fm-inp" data-f="${f.key}" type="${f.type || 'text'}" value="${esc(f.value ?? '')}" maxlength="${f.max || 150}" placeholder="${esc(f.ph || '')}">`}</div>`).join(''),
      onOk: async (mm) => {
        const p = Object.assign({}, extra);
        mm.querySelectorAll('[data-f]').forEach((el) => { p[el.dataset.f] = el.type === 'number' ? (Number(el.value) || null) : el.value; });
        const r = await (callFn || api)(route, p);
        toast(r.ok ? (r.message || 'Sačuvano.') : r.error, r.ok ? 'success' : 'error');
        if (r.ok) { if (onDone) onDone(r); else reload(); }
        return r.ok;
      }
    });
  }

  function memberModal(caseId) {
    let chosen = null;
    modal(shell, {
      title: 'Dodaj učesnika', icon: 'fa-user-plus', ok: 'Dodaj',
      body: `<div class="fm-field"><label class="fm-lbl">Pretraži građanina</label><div class="fm-row"><input class="fm-inp" id="m-q" placeholder="Ime ili ID"><button class="fm-btn" id="m-search" style="flex:0 0 auto">Traži</button></div></div>
        <div class="fm-list" id="m-res" style="max-height:150px;overflow-y:auto;margin-bottom:12px"></div>
        <div class="fm-field"><label class="fm-lbl">...ili upiši ime (osoba van baze)</label><input class="fm-inp" id="m-name" maxlength="100"></div>
        <div class="fm-row"><div class="fm-field"><label class="fm-lbl">Uloga</label><select class="fm-inp" id="m-role"><option value="osumnjiceni">Osumnjičeni</option><option value="osteceni">Oštećeni</option><option value="svedok">Svedok</option><option value="policajac">Policajac</option></select></div>
          <div class="fm-field"><label class="fm-lbl">Napomena</label><input class="fm-inp" id="m-note" maxlength="200"></div></div>`,
      onClick: async (e, mm) => {
        if (e.target.closest('#m-search')) {
          const r = await api('searchPerson', { query: mm.querySelector('#m-q').value });
          mm.querySelector('#m-res').innerHTML = r.ok ? r.results.map((p) => `<div class="fm-item click" data-pick="${p.ref}"><div class="fm-item-t"><b>${esc(p.name)}</b><span>${esc(p.dob || '')}</span></div></div>`).join('') || empty('Nema rezultata.') : empty(r.error);
        }
        const pk = e.target.closest('[data-pick]');
        if (pk) { chosen = Number(pk.dataset.pick); mm.querySelectorAll('[data-pick]').forEach((x) => x.style.borderColor = ''); pk.style.borderColor = 'var(--acc)'; }
      },
      onOk: async (mm) => {
        const r = await api('caseMember', { id: caseId, ref: chosen, name: mm.querySelector('#m-name').value, role: mm.querySelector('#m-role').value, note: mm.querySelector('#m-note').value });
        toast(r.ok ? 'Učesnik je dodat.' : r.error, r.ok ? 'success' : 'error');
        if (r.ok) reload();
        return r.ok;
      }
    });
  }

  function licenseModal(ref, key, status) {
    const opts = status === 'valid' ? [['suspend', 'Suspenduj'], ['revoke', 'Oduzmi']] : [['restore', 'Vrati dozvolu'], ['revoke', 'Oduzmi trajno']];
    simpleModal('Dozvola', 'fa-id-card-clip', [
      { key: 'action', label: 'Akcija', type: 'select', options: opts },
      { key: 'days', label: 'Broj dana (samo suspenzija)', type: 'number', value: 30 }
    ], 'personLicense', { ref, key }, 'Primeni');
  }

  // ============================================================
  //  KLIKOVI
  // ============================================================
  shell.addEventListener('click', async (e) => {
    if (e.target.closest('.fm-modal')) return;
    if (isFib() && await fibClick(e)) return;
    const t = (sel) => e.target.closest(sel);
    let el;
    if ((el = t('[data-nav]'))) return go(el.dataset.nav, null, 'root');
    if ((el = t('[data-person]'))) return go('person', Number(el.dataset.person));
    if ((el = t('[data-plate]'))) return go('vehicle', el.dataset.plate);
    if ((el = t('[data-case]'))) return go('case', Number(el.dataset.case));
    if ((el = t('[data-ptab]'))) { personTab = el.dataset.ptab; return Views.person(cur.arg); }
    if ((el = t('[data-cfilter]'))) { caseFilter = el.dataset.cfilter; return Views.cases(); }
    if ((el = t('[data-wfilter]'))) { wFilter = el.dataset.wfilter; return Views.warrants(); }
    if ((el = t('[data-tfilter]'))) { tFilter = el.dataset.tfilter; return Views.tickets(); }
    if ((el = t('[data-efilter]'))) { eFilter = el.dataset.efilter; return Views.evidence(); }
    if ((el = t('[data-gps]'))) { const [x, y] = el.dataset.gps.split(',').map(Number); post('setWaypoint', { x, y }); return toast('GPS postavljen.', 'success'); }
    if ((el = t('[data-callgps]'))) { post('setWaypoint', { x: Number(el.dataset.x), y: Number(el.dataset.y) }); return toast('GPS postavljen.', 'success'); }
    if ((el = t('[data-call]'))) {
      const r = await api('dispatchAction', { id: Number(el.dataset.id), action: el.dataset.call });
      if (!r.ok) toast(r.error, 'error');
      if (r.ok && el.dataset.call === 'accept') { const g = el.parentElement.querySelector('[data-callgps]'); if (g) post('setWaypoint', { x: Number(g.dataset.x), y: Number(g.dataset.y) }); }
      return Views.dispatch();
    }
    if ((el = t('[data-lic]'))) return licenseModal(cur.arg, el.dataset.lic, el.dataset.licStatus);
    if ((el = t('[data-vflag]'))) {
      const r = await api('vehicleFlag', { plate: content.dataset.plate, field: el.dataset.vflag, state: el.dataset.s === '1', note: '' });
      toast(r.ok ? 'Sačuvano.' : r.error, r.ok ? 'success' : 'error');
      return reload();
    }
    if ((el = t('[data-wstatus]'))) {
      if (!arm(el, 'Sigurno?')) return;
      const r = await api('warrantStatus', { id: Number(el.dataset.id), status: el.dataset.wstatus });
      toast(r.ok ? 'Poternica je ažurirana.' : r.error, r.ok ? 'success' : 'error');
      return reload();
    }
    if ((el = t('[data-void]'))) return simpleModal('Poništi kaznu', 'fa-ban', [{ key: 'reason', label: 'Razlog poništavanja' }], 'ticketVoid', { id: Number(el.dataset.void) }, 'Poništi');
    if ((el = t('[data-evret]'))) {
      if (!arm(el, 'Vrati?')) return;
      const r = await api('evidenceReturn', { id: Number(el.dataset.evret) });
      toast(r.ok ? 'Predmet je vraćen vlasniku.' : r.error, r.ok ? 'success' : 'error');
      return reload();
    }
    if ((el = t('[data-evdes]'))) {
      if (!arm(el, 'Uništi?')) return;
      const r = await api('evidenceDestroy', { id: Number(el.dataset.evdes) });
      toast(r.ok ? 'Dokaz je uništen.' : r.error, r.ok ? 'success' : 'error');
      return reload();
    }
    if ((el = t('[data-trcancel]'))) {
      if (!arm(el, 'Otkaži?')) return;
      const r = await api('transferCancel', { ref: Number(el.dataset.trcancel) });
      toast(r.ok ? 'Transport je otkazan, osoba je oslobođena.' : r.error, r.ok ? 'success' : 'error');
      return reload();
    }
    if ((el = t('[data-prel]'))) {
      if (!arm(el, 'Pusti?')) return;
      const r = await api('prisonRelease', { ref: Number(el.dataset.prel) });
      toast(r.ok ? 'Zatvorenik je pušten.' : r.error, r.ok ? 'success' : 'error');
      return reload();
    }
    if ((el = t('[data-rmember]'))) {
      if (!arm(el, '?')) return;
      await api('caseMemberRemove', { id: Number(content.dataset.caseId), memberId: Number(el.dataset.rmember) });
      return reload();
    }
    if ((el = t('[data-fire]'))) {
      if (!arm(el, 'Otpusti?')) return;
      const r = await api('bossAction', { ref: Number(el.dataset.fire), action: 'fire' });
      toast(r.ok ? r.message : r.error, r.ok ? 'success' : 'error');
      return reload();
    }
    if ((el = t('[data-cs]'))) return simpleModal('Pozivni znak', 'fa-hashtag', [{ key: 'callsign', label: 'Pozivni znak', ph: 'npr. 1-ADAM-12', max: 12 }], 'setCallsign', { ref: Number(el.dataset.cs) });
    if ((el = t('[data-savesal]'))) {
      const g = Number(el.dataset.savesal);
      const inp = content.querySelector(`[data-salary="${g}"]`);
      const r = await api('bossSalary', { grade: g, salary: Number(inp.value) });
      return toast(r.ok ? 'Plata je sačuvana.' : r.error, r.ok ? 'success' : 'error');
    }

    const act = t('[data-act]');
    if (!act) return;
    const ref = cur && cur.arg;
    const P = content._person;
    switch (act.dataset.act) {
      case 'search': return searchPeople();
      case 'vsearch': return searchVehicles();
      case 'wanted': return wantedModal(ref, P && P.wanted ? P.wanted.stars : 0);
      case 'ticket': return ticketModal(ref);
      case 'warrant': return simpleModal('Nova poternica', 'fa-file-signature', [{ key: 'crime', label: 'Krivično delo' }, { key: 'reason', label: 'Razlog / obrazloženje', type: 'area', max: 500 }, { key: 'caseId', label: 'Predmet #', type: 'number' }], 'personWarrant', { ref }, 'Izdaj');
      case 'note': return simpleModal('Novi zapis u dosijeu', 'fa-pen', [{ key: 'kind', label: 'Vrsta', type: 'select', options: [['napomena', 'Službena napomena'], ['izvestaj', 'Izveštaj'], ['dokaz', 'Dokaz'], ['opis', 'Opis događaja']] }, { key: 'content', label: 'Sadržaj', type: 'area', tall: true }, { key: 'caseId', label: 'Predmet #', type: 'number' }], 'personNote', { ref });
      case 'photo': return simpleModal('Fotografija', 'fa-camera', [{ key: 'url', label: 'Link slike (https, prazno = ukloni)', max: 255, value: P && P.person.photo || '' }], 'personPhoto', { ref });
      case 'danger': { const r = await api('personDanger', { ref, state: !(P && P.person.danger) }); toast(r.ok ? 'Sačuvano.' : r.error, r.ok ? 'success' : 'error'); return reload(); }
      case 'caseNew': return simpleModal('Novi predmet', 'fa-folder-plus', [{ key: 'title', label: 'Naslov', max: 120 }, { key: 'eventType', label: 'Vrsta događaja', ph: 'npr. Pljačka prodavnice' }, { key: 'location', label: 'Lokacija' }, { key: 'description', label: 'Opis', type: 'area', tall: true, max: 4000 }], 'caseCreate', {}, 'Otvori predmet', (r) => go('case', r.id));
      case 'caseEntry': return simpleModal('Novi zapis', 'fa-pen', [{ key: 'kind', label: 'Vrsta', type: 'select', options: [['izvestaj', 'Izveštaj'], ['dokaz', 'Dokaz'], ['svedocenje', 'Svedočenje'], ['napomena', 'Napomena']] }, { key: 'content', label: 'Sadržaj', type: 'area', tall: true, max: 4000 }], 'caseEntry', { id: Number(content.dataset.caseId) });
      case 'caseMember': return memberModal(Number(content.dataset.caseId));
      case 'evAdd': return simpleModal('Novi dokaz (opis)', 'fa-box', [{ key: 'label', label: 'Dokaz', ph: 'npr. Čaure 9mm, snimak kamere', max: 100 }, { key: 'reason', label: 'Napomena', max: 255 }], 'evidenceAdd', { caseId: Number(content.dataset.caseId) });
      case 'caseStatus': {
        const r = await api('caseStatus', { id: Number(content.dataset.caseId), status: document.getElementById('pdm-cstatus').value });
        toast(r.ok ? 'Status je promenjen.' : r.error, r.ok ? 'success' : 'error');
        return reload();
      }
      case 'callsign': return simpleModal('Moj pozivni znak', 'fa-hashtag', [{ key: 'callsign', label: 'Pozivni znak', ph: 'npr. 1-ADAM-12', max: 12, value: A.officer.callsign || '' }], 'setCallsign', {}, 'Sačuvaj', async () => { await refreshAccess(); reload(); });
      case 'reqFib': return simpleModal('Zahtev za podršku FIB-a', 'fa-user-secret', [{ key: 'text', label: 'Zašto vam treba FIB?', type: 'area', max: 300 }], 'requestFib', {}, 'Pošalji FIB-u');
      case 'callNew': return simpleModal('Novi dispatch poziv', 'fa-tower-broadcast', [{ key: 'title', label: 'Naslov' }, { key: 'priority', label: 'Prioritet', type: 'select', options: [['NORMAL', 'Normalan'], ['LOW', 'Nizak'], ['HIGH', 'Visok'], ['CRITICAL', 'Kritičan']] }, { key: 'description', label: 'Opis', type: 'area', max: 500 }], 'dispatchCreate', { type: 'other' }, 'Pošalji');
      case 'hire': {
        const r = await api('bossHire', { serverId: Number(document.getElementById('pdm-hire').value) });
        toast(r.ok ? r.message : r.error, r.ok ? 'success' : 'error');
        return reload();
      }
    }
  });

  shell.addEventListener('change', async (e) => {
    const s = e.target.closest('[data-setgrade]');
    if (!s) return;
    const r = await api('bossAction', { ref: Number(s.dataset.setgrade), action: 'setgrade', grade: Number(s.value) });
    toast(r.ok ? r.message : r.error, r.ok ? 'success' : 'error');
    reload();
  });

  backBtn.addEventListener('click', back);
  document.getElementById('pdm-exit').addEventListener('click', closeApp);

  // ============================================================
  //  LABELE
  // ============================================================
  function statusLabel(s) { return ({ aktivan: 'Aktivan', prihvacen: 'Prihvaćen', na_lokaciji: 'Na lokaciji', zavrsen: 'Završen' })[s] || s; }
  function prioLabel(p) { return ({ LOW: 'Nizak', NORMAL: 'Normalan', HIGH: 'Visok', CRITICAL: 'KRITIČAN' })[p] || p; }
  function kindLabel(k) { return ({ hapsenje: 'Hapšenje', privodjenje: 'Privođenje', pustanje: 'Puštanje' })[k] || k; }
  function wAct(a) { return ({ postavljeno: 'Postavljeno', povecano: 'Povećano', smanjeno: 'Smanjeno', uklonjeno: 'Uklonjeno' })[a] || a; }
  function noteKind(k) { return ({ napomena: 'Službena napomena', izvestaj: 'Izveštaj', dokaz: 'Dokaz', opis: 'Opis događaja' })[k] || k; }
  function noteIcon(k) { return ({ napomena: 'fa-note-sticky', izvestaj: 'fa-file-lines', dokaz: 'fa-magnifying-glass', opis: 'fa-align-left' })[k] || 'fa-note-sticky'; }
  function entryKind(k) { return ({ izvestaj: 'Izveštaj', dokaz: 'Dokaz', svedocenje: 'Svedočenje', napomena: 'Napomena', status: 'Promena statusa' })[k] || k; }
  function roleLabel(r) { return ({ osumnjiceni: 'Osumnjičeni', osteceni: 'Oštećeni', svedok: 'Svedok', policajac: 'Policajac' })[r] || r; }
  function casePill(s) { const m = { otvoren: ['acc', 'Otvoren'], u_istrazi: ['warn', 'U istrazi'], zatvoren: ['', 'Zatvoren'], preuzet_fib: ['red', 'Preuzeo FIB'] }[s] || ['', s]; return `<span class="fm-pill ${m[0]}">${m[1]}</span>`; }
  function ticketPill(s) { const m = { neplacena: ['warn', 'Neplaćena'], placena: ['ok', 'Plaćena'], ponistena: ['', 'Poništena'] }[s] || ['', s]; return `<span class="fm-pill ${m[0]}">${m[1]}</span>`; }
  function evPill(s) { const m = { u_dokazima: ['acc', 'U magacinu'], vracen: ['ok', 'Vraćeno'], unisten: ['red', 'Uništeno'] }[s] || ['', s]; return `<span class="fm-pill ${m[0]}">${m[1]}</span>`; }
  function ago(ts) { const s = Math.floor(Date.now() / 1000) - Number(ts || 0); return s < 60 ? 'upravo' : (s < 3600 ? `pre ${Math.floor(s / 60)} min` : `pre ${Math.floor(s / 3600)} h`); }
  function chargeNames(json) {
    try { const ids = JSON.parse(json || '[]'); const map = {}; (A.penalCode || []).forEach((c) => c.items.forEach((i) => { map[i.id] = i.label; })); return ids.map((i) => map[i] || i).join(', '); } catch (e) { return ''; }
  }
  function logLabel(a) {
    return ({ arrest: 'Hapšenje', ticket: 'Kazna', ticket_paid: 'Plaćena kazna', ticket_void: 'Poništena kazna', seize: 'Zaplena', wanted_set: 'Wanted', wanted_clear: 'Skinut wanted',
      case_create: 'Novi predmet', case_status: 'Status predmeta', case_entry: 'Zapis u predmetu', warrant_create: 'Poternica', impound: 'Impound', detain: 'Privođenje', release: 'Puštanje',
      cuff: 'Lisice', uncuff: 'Skinute lisice', tie: 'Vezivanje', untie: 'Odvezivanje', search: 'Pretres', escort: 'Eskort', duty_on: 'Na dužnosti', duty_off: 'Van dužnosti',
      armory_take: 'Oprema', armory_return: 'Vraćena oprema', prison: 'Zatvor', prison_release: 'Izlazak iz zatvora', boss_hire: 'Zaposlen', boss_fire: 'Otpušten',
      boss_promote: 'Unapređenje', boss_demote: 'Degradacija', boss_salary: 'Promena plate', panic: 'PANIC', id_check: 'Legitimisanje', evidence_return: 'Vraćen dokaz',
      evidence_destroy: 'Uništen dokaz', combat_log: 'Izlazak tokom postupka', callsign: 'Pozivni znak',
      case_takeover: 'FIB preuzeo predmet', request_fib: 'Zahtev za FIB', fib_op_create: 'FIB operacija', fib_op_update: 'Izmena operacije', fib_op_member: 'Učesnik operacije',
      fib_lab_request: 'Laboratorija', fib_auth_request: 'Zahtev za nalog', fib_auth_approve: 'Odobren nalog', fib_auth_reject: 'Odbijen nalog',
      fib_tracker_place: 'GPS tracker postavljen', fib_tracker_remove: 'GPS tracker uklonjen', fib_uc_on: 'Undercover uključen', fib_uc_off: 'Undercover isključen',
      transfer_hold: 'Čeka transport', transfer_done: 'Predat zatvoru', transfer_cancel: 'Transport otkazan', roadblock: 'Blokada puta',
      fib_informant_add: 'Novi informant', fib_informant_pay: 'Isplata informantu', fib_ia_view: 'IA pregled', fib_ia_suspend: 'IA suspenzija', fib_ia_lift: 'Ukinuta suspenzija' })[a] || a;
  }

  // ============================================================
  //  OTVARANJE / PRISTUP / PUSH
  // ============================================================
  async function refreshAccess() {
    const r = await api('access');
    if (r && r.ok) A = r;
  }

  const THEMES = {
    police: { cls: 'pd', icon: 'fa-shield-halved', title: 'LSPD MDT', sub: 'Policija', app: 'Policija' },
    fib: { cls: 'fib', icon: 'fa-user-secret', title: 'FIB MDT', sub: 'Federal Investigation Bureau', app: 'FIB MDT' },
    sheriff: { cls: 'sheriff', icon: 'fa-star', title: 'BCSO MDT', sub: "Sheriff's Office", app: 'Sheriff MDT' },
  };
  function applyTheme() {
    const th = THEMES[A && A.agency] || THEMES.police;
    Object.values(THEMES).forEach((t) => shell.classList.toggle(t.cls, t === th));
    const brand = shell.querySelector('.fm-brand');
    if (brand && A) {
      brand.querySelector('.fm-brand-ico i').className = `fa-solid ${th.icon}`;
      brand.querySelector('b').textContent = th.title;
      brand.querySelector('span').textContent = th.sub;
    }
    const glyph = icon.querySelector('.app-icon-glyph');
    if (glyph) {
      glyph.classList.toggle('fibmdt', th.cls === 'fib');
      glyph.classList.toggle('sheriffmdt', th.cls === 'sheriff');
      glyph.querySelector('i').className = `fa-solid ${th.icon}`;
    }
    const lbl = icon.querySelector('.app-icon-label');
    if (lbl) lbl.textContent = th.app;
    if (isFib() && A.fibModule) loadF();
  }

  function openApp() {
    if (!A) return;
    if (!A.onDuty) { toast('MDT radi samo dok si na dužnosti.', 'error'); return; }
    homeScreen.classList.add('hidden');
    screen.classList.remove('hidden');
    hist = []; cur = null;
    go(view || 'dashboard', null, 'root');
  }
  function closeApp() {
    FMDT.close(shell);
    screen.classList.add('hidden');
    homeScreen.classList.remove('hidden');
  }
  icon.addEventListener('click', openApp);

  async function openPerson(serverId) {
    openApp();
    if (!A || !A.onDuty) return;
    const r = await api('searchPerson', { query: String(serverId) });
    if (r.ok && r.results.length === 1) { hist = []; cur = null; go('person', r.results[0].ref, 'push'); }
    else go('citizens', String(serverId), 'root');
  }

  window.addEventListener('message', (ev) => {
    const d = ev.data;
    if (!d || !d.action) return;
    if (d.action === 'openTablet') {
      A = null; icon.classList.add('hidden'); screen.classList.add('hidden'); FMDT.close(shell);
      view = 'dashboard'; personTab = 'pregled';
    }
    if (d.action === 'pdAccess') {
      A = d.access;
      applyTheme();
      icon.classList.toggle('hidden', !A);
      if (A) renderNav();
      if (pendingOpen) {
        const p = pendingOpen; pendingOpen = null; unlockTabletUI();
        if (p.serverId) openPerson(p.serverId);
        else { openApp(); if (p.section === 'fib' && isFib()) go('fib', null, 'root'); }
      }
    }
    if (d.action === 'openApp' && d.app === 'policija') {
      const opts = d.opts || {};
      if (A) {
        unlockTabletUI();
        if (opts.serverId) openPerson(opts.serverId);
        else { openApp(); if (opts.section === 'fib' && isFib()) go('fib', null, 'root'); }
      }
      else pendingOpen = opts;
    }
    if (d.action === 'pdDispatch') {
      if (d.call && d.call.status !== 'zavrsen' && d.isNew) callCount += 1;
      if (d.call && d.call.status === 'zavrsen') callCount = Math.max(0, callCount - 1);
      if (A) renderNav();
      if (!screen.classList.contains('hidden') && cur && (cur.view === 'dispatch' || cur.view === 'dashboard') && !shell.querySelector('.fm-modal')) reload();
    }
  });
})();
