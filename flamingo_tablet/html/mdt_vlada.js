// ============================================================
//  MDT VLADA - redizajn (isti dizajn sistem kao MDT Policije)
//  Podaci + provere: flamingo_vlada (mdt/server.lua)
//  Rute ostaju iste: mdt:search, mdt:profile, mdt:noteAdd, mdt:noteDelete,
//  mdt:documents, mdt:audit, mdt:issue
// ============================================================
(() => {
  const { esc, money, initials, stars, empty, loading, toast, arm } = window.FMDT;
  const icon = document.getElementById('app-mdt');
  const screen = document.getElementById('app-screen-mdt');
  const shell = document.getElementById('gvm');
  const content = document.getElementById('gvm-content');
  const headT = document.getElementById('gvm-head-title');
  const headS = document.getElementById('gvm-head-sub');
  const backBtn = document.getElementById('gvm-back');
  const navEl = document.getElementById('gvm-nav');

  const NOTE_MAX = 500;
  const DOC_ACTIONS = {
    idcard_issue: ['Izdata lična karta', 'fa-id-card', 'ok'], idcard_renew: ['Obnovljena lična karta', 'fa-rotate', 'acc'],
    license_issue: ['Izdata dozvola', 'fa-file-signature', 'ok'], license_renew: ['Obnovljena dozvola', 'fa-rotate', 'acc']
  };
  const AUDIT = { mdt_search: ['Pretražio građane', 'fa-magnifying-glass'], mdt_view: ['Otvorio profil', 'fa-eye'], mdt_note_add: ['Dodao belešku', 'fa-note-sticky'], mdt_note_delete: ['Obrisao belešku', 'fa-trash'] };

  let A = null;
  let view = 'citizens';
  let profileRef = null;
  let lastQuery = '';
  let issueTimer = null;

  function renderNav() {
    const items = [['citizens', 'fa-users-viewfinder', 'Građani'], ['documents', 'fa-id-card', 'Izdata dokumenta']];
    if (A && A.isBoss) items.push(['audit', 'fa-eye', 'Evidencija']);
    navEl.innerHTML = '<div class="fm-nav-sec">Registar</div>' + items.map((i) =>
      `<button class="fm-nav-btn ${view === i[0] ? 'active' : ''}" data-nav="${i[0]}"><i class="fa-solid ${i[1]}"></i>${i[2]}</button>`).join('');
    const me = (typeof currentPlayer !== 'undefined' && currentPlayer && currentPlayer.name) || 'Službenik';
    document.getElementById('gvm-me').innerHTML = `<div class="fm-me-av">${esc(initials(me))}</div>
      <div class="fm-me-t"><b>${esc(me)}</b><span>${A && A.isBoss ? 'Uprava' : 'Službenik'}</span></div>`;
  }

  function setHead(t, s, canBack) { headT.textContent = t; headS.textContent = s || ''; backBtn.classList.toggle('hidden', !canBack); }

  function go(v) {
    view = v;
    renderNav();
    content.innerHTML = loading();
    if (v === 'citizens') return viewCitizens();
    if (v === 'documents' || v === 'audit') return viewList(v);
  }

  // ---------- GRAĐANI ----------
  function viewCitizens() {
    profileRef = null;
    setHead('Građani', 'Registar stanovnika · pretraga po imenu ili prezimenu');
    content.innerHTML = `<div class="fm-search"><i class="fa-solid fa-magnifying-glass"></i><input class="fm-inp" id="gvm-q" placeholder="Ime i/ili prezime" value="${esc(lastQuery)}">
      <button class="fm-btn acc" data-act="search">Traži</button></div><div id="gvm-res">${empty('Unesi ime građanina.', 'fa-users')}</div>`;
    const inp = document.getElementById('gvm-q');
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') search(); });
    if (lastQuery) search(); else inp.focus();
  }

  async function search() {
    const q = document.getElementById('gvm-q').value.trim();
    if (!q) return;
    lastQuery = q;
    const res = document.getElementById('gvm-res');
    res.innerHTML = loading('Pretraga...');
    const r = await postAsync('mdt:search', { query: q });
    if (!r || !r.ok) { res.innerHTML = empty((r && r.error) || 'Pretraga nije uspela.', 'fa-circle-exclamation'); return; }
    res.innerHTML = `<div class="fm-list">${r.results.map((c) => `
      <div class="fm-item click" data-ref="${c.ref}"><div class="fm-item-ico"><i class="fa-solid fa-user"></i></div>
        <div class="fm-item-t"><b>${esc(c.name)}</b><span>${esc(c.dob || 'nepoznat datum rođenja')}${c.sex ? ' · ' + esc(c.sex) : ''}</span></div>
        <div class="fm-item-r">${c.online ? '<span class="fm-pill ok">Online</span>' : ''}<i class="fa-solid fa-chevron-right" style="color:var(--faint)"></i></div></div>`).join('') || empty('Nema rezultata.', 'fa-user-slash')}</div>
      ${r.truncated ? '<p class="fm-time" style="margin-top:8px">Prikazani su prvi rezultati - suzi pretragu.</p>' : ''}`;
  }

  // ---------- PROFIL ----------
  function docStatus(row) {
    if (!row.owned) return ['', 'Nema'];
    const s = row.status;
    if (s === 'revoked') return ['red', 'Oduzeta', true];
    if (s === 'suspended') return ['red', 'Suspendovana', true];
    if (s === 'expired') return ['warn', 'Istekla'];
    return ['ok', 'Važeća'];
  }

  async function viewProfile(ref, keepScroll) {
    profileRef = ref;
    const scroll = content.scrollTop;
    if (!keepScroll) content.innerHTML = loading('Učitavam profil...');
    const d = await postAsync('mdt:profile', { ref });
    if (profileRef !== ref) return;
    if (!d || !d.ok) { setHead('Profil', '', true); content.innerHTML = empty((d && d.error) || 'Profil nije moguće učitati.', 'fa-user-slash'); return; }
    const c = d.citizen;
    const docs = d.documents || {};
    const perms = d.perms || {};
    const idc = docs.idcard || null;
    const online = !!(c.online && c.serverId);
    setHead(c.name, 'Profil građanina', true);

    const rows = [];
    if (docs.available) {
      rows.push({ kind: 'idcard', category: '', title: 'Lična karta', icon: 'fa-id-card', issuable: true, owned: !!idc, status: idc && idc.status, number: idc && idc.number, expiresAt: idc && idc.expiresAt });
      (docs.licenses || []).forEach((l) => rows.push({ kind: 'license', category: l.key, title: l.label, icon: 'fa-file-signature', issuable: !!l.issuable, owned: !!l.owned, status: l.status, number: l.number, expiresAt: l.expiresAt }));
    }
    const docsHtml = docs.available ? rows.map((r) => {
      const s = docStatus(r);
      let act = '';
      if (perms.canIssue && r.issuable) {
        if (s[2]) act = '<span class="fm-time">Obrati se policiji</span>';
        else {
          const mode = r.owned ? 'renew' : 'issue';
          act = `<button class="fm-btn sm ${mode === 'issue' ? 'acc' : ''}" data-issue="${esc(r.kind)}" data-category="${esc(r.category)}" data-mode="${mode}" ${online ? '' : 'disabled title="Građanin mora biti online i u blizini."'}>${mode === 'renew' ? 'Obnovi' : 'Izdaj'}</button>`;
        }
      }
      return `<div class="fm-lic"><i class="fa-solid ${r.icon}" style="color:var(--acc2);width:16px"></i>
        <div style="flex:1;min-width:0"><b style="display:block;font-size:12.5px">${esc(r.title)}</b><span class="fm-time">${esc([r.number ? 'Br. ' + r.number : '', r.owned && r.expiresAt ? 'važi do ' + r.expiresAt : ''].filter(Boolean).join(' · ') || (r.owned ? '' : 'Građanin nema ovaj dokument'))}</span></div>
        <span class="fm-pill ${s[0]}">${s[1]}</span>${act}</div>`;
    }).join('') : '<p class="fm-time">Podaci o dokumentima trenutno nisu dostupni.</p>';

    const pol = d.police;
    const polHtml = pol ? `<div class="fm-kv">
        <div><span>Potraga</span><b>${pol.stars ? stars(pol.stars) : '<span style="color:var(--ok)">Nema</span>'}</b></div>
        <div><span>Poternice</span><b style="color:${pol.warrants ? 'var(--red)' : 'inherit'}">${pol.warrants}</b></div>
        <div><span>Neplaćene kazne</span><b>${pol.unpaidFines} · ${money(pol.unpaidTotal)}</b></div>
        <div><span>Hapšenja</span><b>${pol.arrests}</b></div>
        <div style="grid-column:span 2"><span>Status</span><b>${pol.inPrison ? '<span style="color:var(--red)">Trenutno u zatvoru</span>' : 'Slobodan'}</b></div>
      </div>
      ${pol.warrants || pol.stars ? '<p class="fm-time" style="margin-top:8px;color:var(--warn)"><i class="fa-solid fa-triangle-exclamation"></i> Osoba ima aktivne policijske mere - razmisli pre izdavanja dokumenata i obavesti policiju.</p>' : ''}`
      : '<p class="fm-time">Policijski sistem nije dostupan.</p>';

    const notes = d.notes || [];
    const fields = [['Datum rođenja', c.dob], ['Pol', c.sex], ['Visina', c.height ? c.height + ' cm' : null], ['Telefon', c.phone],
      ['Matični broj', idc && idc.personalId], ['Krvna grupa', idc && idc.bloodType], ['Zaposlenje', c.job ? (c.grade ? `${c.job} - ${c.grade}` : c.job) : null]].filter((f) => f[1]);

    content.innerHTML = `
      <div class="fm-prof ${pol && (pol.stars || pol.warrants) ? 'danger' : ''}">
        <div class="fm-photo">${esc(initials(c.name))}</div>
        <div class="fm-prof-t"><h2>${esc(c.name)}</h2><div class="fm-prof-tags">
          ${online ? `<span class="fm-pill ok">Online · ID ${c.serverId}</span>` : '<span class="fm-pill">Offline</span>'}
          ${c.job ? `<span class="fm-pill acc">${esc(c.job)}</span>` : ''}
          ${idc ? '' : '<span class="fm-pill red">Bez lične karte</span>'}</div></div>
        <div class="fm-prof-act"><button class="fm-btn sm" data-act="refresh"><i class="fa-solid fa-rotate"></i> Osveži</button></div>
      </div>
      <div class="fm-2col">
        <div>
          <div class="fm-card"><div class="fm-card-h"><i class="h-ico fa-solid fa-address-card"></i><b>Lični podaci</b></div>
            <div class="fm-kv" style="grid-template-columns:1fr 1fr">${fields.map((f) => `<div><span>${esc(f[0])}</span><b>${esc(f[1])}</b></div>`).join('') || '<p class="fm-time">Nema podataka.</p>'}</div></div>
          <div class="fm-card"><div class="fm-card-h"><i class="h-ico fa-solid fa-shield-halved"></i><b>Policijski status</b><span class="fm-time">samo za čitanje</span></div>${polHtml}</div>
        </div>
        <div>
          <div class="fm-card"><div class="fm-card-h"><i class="h-ico fa-solid fa-id-card"></i><b>Dokumenta</b></div>${docsHtml}
            ${docs.available && perms.canIssue && !online ? '<p class="fm-time" style="margin-top:8px"><i class="fa-solid fa-circle-info"></i> Dokumenta se izdaju samo kad je građanin online i u tvojoj blizini.</p>' : ''}</div>
        </div>
      </div>
      <div class="fm-card"><div class="fm-card-h"><i class="h-ico fa-solid fa-note-sticky"></i><b>Beleške vlade (${notes.length})</b></div>
        ${perms.canNote ? `<textarea class="fm-inp" id="gvm-note" maxlength="${NOTE_MAX}" placeholder="Nova beleška o građaninu..."></textarea>
          <div style="display:flex;align-items:center;justify-content:space-between;margin:8px 0 12px"><span class="fm-time" id="gvm-note-cnt">0 / ${NOTE_MAX}</span>
          <button class="fm-btn sm acc" data-act="note"><i class="fa-solid fa-plus"></i> Dodaj belešku</button></div>` : ''}
        <div class="fm-list">${notes.map((n) => `<div class="fm-item"><div class="fm-item-ico"><i class="fa-solid fa-note-sticky"></i></div>
          <div class="fm-item-t"><span>${esc(n.author)} · ${esc(n.createdAt)}</span><p>${esc(n.text)}</p></div>
          ${n.canDelete ? `<button class="fm-btn sm red" data-delnote="${n.id}"><i class="fa-solid fa-trash"></i></button>` : ''}</div>`).join('') || '<p class="fm-time">Nema beleški.</p>'}</div>
      </div>`;
    if (keepScroll) content.scrollTop = scroll;
    const ta = document.getElementById('gvm-note');
    if (ta) ta.addEventListener('input', () => { document.getElementById('gvm-note-cnt').textContent = `${ta.value.length} / ${NOTE_MAX}`; });
    content._profile = d;
  }

  // ---------- LISTE ----------
  async function viewList(kind) {
    const isDocs = kind === 'documents';
    setHead(isDocs ? 'Izdata dokumenta' : 'Evidencija', isDocs ? 'Nedavno izdate i obnovljene lične karte i dozvole' : 'Ko je pretraživao, otvarao profile i pisao beleške');
    const r = await postAsync(isDocs ? 'mdt:documents' : 'mdt:audit', {});
    if (!r || !r.ok) { content.innerHTML = empty((r && r.error) || 'Podaci nisu dostupni.'); return; }
    content.innerHTML = `<div class="fm-list">${r.list.map((it) => {
      let title, sub, ic, tone = '';
      if (isDocs) {
        const m = DOC_ACTIONS[it.action] || [it.action, 'fa-file-lines', ''];
        title = it.action.indexOf('license') === 0 && it.detail ? `${m[0]}: ${it.detail}` : m[0];
        sub = `${it.target || 'Nepoznat građanin'} · službenik ${it.actor || '?'}`; ic = m[1]; tone = m[2] === 'ok' ? 'g' : '';
      } else {
        const m = AUDIT[it.action] || [it.action, 'fa-clipboard-list'];
        title = `${it.actor || '?'} · ${m[0]}${it.target ? ': ' + it.target : ''}`; sub = it.detail || ''; ic = m[1];
      }
      return `<div class="fm-item ${it.ref ? 'click' : ''}" ${it.ref ? `data-ref="${it.ref}"` : ''}><div class="fm-item-ico ${tone}"><i class="fa-solid ${ic}"></i></div>
        <div class="fm-item-t"><b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div><span class="fm-time">${esc(it.createdAt || '')}</span></div>`;
    }).join('') || empty('Za sada nema zapisa.')}</div>`;
  }

  // ---------- KLIKOVI ----------
  shell.addEventListener('click', async (e) => {
    const t = (s) => e.target.closest(s);
    let el;
    if ((el = t('[data-nav]'))) return go(el.dataset.nav);
    if ((el = t('[data-ref]'))) { if (view !== 'citizens') { view = 'citizens'; renderNav(); } return viewProfile(Number(el.dataset.ref)); }
    if ((el = t('[data-issue]'))) {
      if (el.disabled || !arm(el, 'Potvrdi')) return;
      const d = content._profile;
      if (!d || !d.citizen.serverId) return;
      content.querySelectorAll('[data-issue]').forEach((b) => { b.disabled = true; });
      post('mdt:issue', { kind: el.dataset.issue, category: el.dataset.category || undefined, mode: el.dataset.mode, targetId: d.citizen.serverId });
      clearTimeout(issueTimer);
      issueTimer = setTimeout(() => { if (profileRef) viewProfile(profileRef, true); }, 3500);
      return;
    }
    if ((el = t('[data-delnote]'))) {
      if (!arm(el, '')) return;
      const r = await postAsync('mdt:noteDelete', { ref: profileRef, id: Number(el.dataset.delnote) });
      toast(r && r.ok ? 'Beleška je obrisana.' : ((r && r.error) || 'Beleška nije obrisana.'), r && r.ok ? 'success' : 'error');
      return viewProfile(profileRef, true);
    }
    const act = t('[data-act]');
    if (!act) return;
    if (act.dataset.act === 'search') return search();
    if (act.dataset.act === 'refresh') return viewProfile(profileRef, true);
    if (act.dataset.act === 'note') {
      const ta = document.getElementById('gvm-note');
      const text = ta.value.trim();
      if (!text) return;
      act.disabled = true;
      const r = await postAsync('mdt:noteAdd', { ref: profileRef, text });
      toast(r && r.ok ? 'Beleška je sačuvana.' : ((r && r.error) || 'Beleška nije sačuvana.'), r && r.ok ? 'success' : 'error');
      return viewProfile(profileRef, true);
    }
  });

  backBtn.addEventListener('click', () => { if (profileRef) viewCitizens(); });
  document.getElementById('gvm-exit').addEventListener('click', closeApp);

  function openApp() {
    if (!A || !A.canUse) return;
    homeScreen.classList.add('hidden');
    screen.classList.remove('hidden');
    if (profileRef) { renderNav(); viewProfile(profileRef, true); } else go(view);
  }
  function closeApp() {
    screen.classList.add('hidden');
    homeScreen.classList.remove('hidden');
  }
  icon.addEventListener('click', openApp);

  window.addEventListener('message', (ev) => {
    const d = ev.data;
    if (!d || !d.action) return;
    if (d.action === 'openTablet') {
      A = null; view = 'citizens'; profileRef = null; lastQuery = '';
      icon.classList.add('hidden'); screen.classList.add('hidden');
    }
    if (d.action === 'mdtAccess') {
      A = d.access || null;
      icon.classList.toggle('hidden', !(A && A.canUse));
      if (A && A.canUse) renderNav();
    }
    if (d.action === 'mdtIssueResult') {
      clearTimeout(issueTimer);
      const type = ['success', 'error', 'info'].includes(d.type) ? d.type : 'info';
      toast(d.message || 'Gotovo.', type);
      setTimeout(() => { if (profileRef && !screen.classList.contains('hidden')) viewProfile(profileRef, true); }, 500);
    }
  });
})();
