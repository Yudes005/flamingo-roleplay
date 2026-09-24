/* =====================================================================
   FLAMINGO TELEFON 3.0 - iOS stil
   Protokol prema igri je ISTI kao u 2.0 (isti NUI pozivi i iste poruke),
   tako da client.lua / server.lua rade bez izmena.
   ===================================================================== */
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);
const wrapper = $('phone-wrapper');
const screenEl = $('screen');
const IN_GAME = !!window.invokeNative || typeof GetParentResourceName === 'function';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (n) => Math.floor(Math.abs(Number(n) || 0)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const money = (n) => num(n) + '$';
const initials = (s) => String(s || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
const pad2 = (n) => String(n).padStart(2, '0');

function post(endpoint, body) {
    if (!IN_GAME) return demoPost(endpoint, body || {});
    fetch(`https://${typeof GetParentResourceName === 'function' ? GetParentResourceName() : 'flamingo_telefon'}/${endpoint}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=UTF-8' }, body: JSON.stringify(body || {}),
    }).catch(() => {});
}

/* ---------------- Skaliranje (manji monitori) ---------------- */
function fitPhone() {
    const s = Math.min(1, (window.innerHeight * 0.94) / 800);
    wrapper.style.setProperty('--scale', s.toFixed(3));
}
window.addEventListener('resize', fitPhone); fitPhone();

/* ---------------- Lokalna podešavanja ---------------- */
const store = {
    get: (k, def) => { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};
let photos = store.get('fl_photos', []);
const SET = Object.assign({ wall: 'ios1', ring: true, dnd: false, vol: 60, lock: true }, store.get('fl_phone', {}));
const saveSet = () => store.set('fl_phone', SET);

const WALLS = [
    { id: 'ios1', src: 'img/wallpapers/ios1.svg' }, { id: 'ios2', src: 'img/wallpapers/ios2.svg' },
    { id: 'ios3', src: 'img/wallpapers/ios3.svg' }, { id: 'ios4', src: 'img/wallpapers/ios4.svg' },
    ...Array.from({ length: 8 }, (_, i) => ({ id: i, src: `img/wallpapers/w${i}.jpg`, thumb: `img/wallpapers/t${i}.jpg` })),
];
function wallSrc() {
    if (typeof SET.wall === 'string' && SET.wall.startsWith('photo:')) {
        const p = photos[Number(SET.wall.split(':')[1])];
        if (p) return p.src;
        SET.wall = 'ios1';
    }
    const w = WALLS.find((x) => x.id === SET.wall) || WALLS[0];
    return w.src;
}
function applyWallpaper() {
    const src = wallSrc();
    $('wall').style.backgroundImage = `url('${src}')`;
    $('call-screen').style.setProperty('--callwall', `url('${src}')`);
}

/* ---------------- Sat / datum ---------------- */
const DAYS = ['nedelja', 'ponedeljak', 'utorak', 'sreda', 'četvrtak', 'petak', 'subota'];
const DAYS_SHORT = ['NED', 'PON', 'UTO', 'SRE', 'ČET', 'PET', 'SUB'];
const MONTHS = ['januar', 'februar', 'mart', 'april', 'maj', 'jun', 'jul', 'avgust', 'septembar', 'oktobar', 'novembar', 'decembar'];
const hm = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
function tickClock() {
    const d = new Date();
    $('clock').textContent = hm(d);
    $('lock-clock').textContent = hm(d);
    $('lock-date').textContent = `${DAYS[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}`;
    $('wc-day').textContent = DAYS[d.getDay()].toUpperCase();
    $('wc-num').textContent = d.getDate();
    $('ic-cal-d').textContent = DAYS_SHORT[d.getDay()];
    $('ic-cal-n').textContent = d.getDate();
}
setInterval(tickClock, 1000); tickClock();

/* ---------------- Zvuci ---------------- */
let actx = null;
const getCtx = () => (actx = actx || new (window.AudioContext || window.webkitAudioContext)());
function beep(freq, dur, vol) {
    if (SET.dnd) return;
    try {
        const c = getCtx(), o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.value = freq;
        g.gain.setValueAtTime((vol == null ? 0.05 : vol) * (SET.vol / 100), c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
        o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + dur);
    } catch (e) {}
}
let ringInterval = null;
function playRingtone() {
    if (!SET.ring || SET.dnd) return;
    stopRingtone();
    const seq = () => { beep(988, .16, .08); setTimeout(() => beep(1319, .16, .08), 170); setTimeout(() => beep(988, .16, .08), 340); };
    seq(); ringInterval = setInterval(seq, 1600);
}
function playRingback() { stopRingtone(); ringInterval = setInterval(() => { beep(425, .9, .03); }, 3000); }
function stopRingtone() { if (ringInterval) clearInterval(ringInterval); ringInterval = null; }

/* ---------------- Avatari (boja po imenu) ---------------- */
const AV_COLORS = [['#ff9a8b', '#ff5e62'], ['#7f7fd5', '#5b5bd6'], ['#43cea2', '#185a9d'], ['#f7b733', '#fc4a1a'], ['#a18cd1', '#7c4dff'], ['#56ccf2', '#2f80ed'], ['#ff6aa8', '#d81b60'], ['#6be585', '#1f9d55']];
function avatarStyle(key) {
    let h = 0; for (const ch of String(key || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const [a, b] = AV_COLORS[h % AV_COLORS.length];
    return `background:linear-gradient(180deg,${a},${b})`;
}
const avatarHTML = (name, key, cls = '') => {
    const known = name && !/^\d{3}-\d{4}$/.test(name);
    return known
        ? `<div class="avatar ${cls}" style="${avatarStyle(key || name)}">${esc(initials(name))}</div>`
        : `<div class="avatar ${cls}"><i class="fa-solid fa-user" style="font-size:60%"></i></div>`;
};

/* =====================================================================
   NAVIGACIJA
   ===================================================================== */
let currentApp = null;
let returnTo = null; // gde vodi "nazad" za Taxi / Hitnu / Policiju
const APP_IDS = ['phone', 'contact', 'newcontact', 'messages', 'thread', 'newmsg', 'banka', 'li', 'usluge', 'taxi', 'med', 'pd', 'gallery', 'photo', 'notes', 'note', 'music', 'calc', 'calendar', 'settings'];
const LIGHT_APPS = ['li'];

function hideApps() { APP_IDS.forEach((a) => $('app-' + a).classList.add('hidden-screen')); }
function goHome() {
    hideApps();
    $('home').classList.remove('hidden-screen');
    screenEl.classList.remove('in-app', 'light-ui');
    currentApp = null;
    updateBadges();
}
function openApp(name, opts = {}) {
    if (name === 'camera') { post('openCamera'); return; }
    if (name === 'contacts') { openApp('phone'); setPhoneTab('contacts'); return; }
    const el = $('app-' + name);
    if (!el) return;
    if (['taxi', 'med', 'pd'].includes(name) && !opts.keepReturn) returnTo = currentApp === 'usluge' ? 'usluge' : null;
    hideApps();
    $('home').classList.add('hidden-screen');
    el.classList.remove('hidden-screen');
    el.classList.toggle('push', !!opts.push);
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    screenEl.classList.add('in-app');
    screenEl.classList.toggle('light-ui', LIGHT_APPS.includes(name));
    currentApp = name;
    if (name === 'phone') { post('getContacts'); post('getCallHistory'); }
    if (name === 'messages') { post('getConversations'); renderConversations(); }
    if (name === 'banka') openBanka();
    if (name === 'taxi' && !opts.keepState) { setTaxiState('idle'); $('taxi-idle-msg').textContent = ''; }
    if (name === 'med') openMed();
    if (name === 'pd') openPd();
    if (name === 'notes') { post('notesGet'); renderNotes(); }
    if (name === 'li') renderLiFeed();
    if (name === 'gallery') renderGallery();
    if (name === 'calendar') { calCursor = new Date(); renderCalendar(); }
    if (name === 'settings') { $('set-number').textContent = myNumber; renderSettings(); }
}
const goBack = () => (returnTo ? openApp(returnTo) : goHome());

$$('.app[data-app], .widget[data-app]').forEach((a) => a.addEventListener('click', () => openApp(a.dataset.app)));
$$('[data-serv]').forEach((b) => b.addEventListener('click', () => openApp(b.dataset.serv)));
$$('[data-back]').forEach((b) => b.addEventListener('click', () => openApp(b.dataset.back, { push: false })));
$$('[data-home]').forEach((b) => b.addEventListener('click', goHome));
$$('[data-back-serv]').forEach((b) => b.addEventListener('click', goBack));
$('taxi-back').addEventListener('click', goBack);
$('home-indicator').addEventListener('click', () => { if (!$('call-screen').classList.contains('hidden-screen')) return; if (currentApp) goHome(); else closePhoneUI(); });

function closePhoneUI() {
    wrapper.classList.add('closing');
    setTimeout(() => { wrapper.classList.add('hidden'); wrapper.classList.remove('closing'); }, 240);
    post('closePhone');
}
window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || wrapper.classList.contains('hidden')) return;
    if (currentApp) goHome(); else closePhoneUI();
});

/* =====================================================================
   LOCK SCREEN, OBAVEŠTENJA, DYNAMIC ISLAND
   ===================================================================== */
function lockPhone() {
    goHome();
    const ls = $('lock-screen');
    ls.classList.remove('unlocking');
    ls.classList.toggle('hidden-screen', !SET.lock);
    screenEl.classList.toggle('locked', !!SET.lock);
    renderLockNotifs();
}
$('lock-screen').addEventListener('click', (e) => {
    if (e.target.closest('#lock-cam')) { post('openCamera'); return; }
    if (e.target.closest('#lock-light')) { $('lock-light').classList.toggle('on'); return; }
    unlockPhone();
});
function unlockPhone() {
    const ls = $('lock-screen');
    if (ls.classList.contains('hidden-screen')) return;
    ls.classList.add('unlocking');
    screenEl.classList.remove('locked');
    const home = $('home'); home.style.animation = 'none'; void home.offsetWidth; home.style.animation = '';
    setTimeout(() => ls.classList.add('hidden-screen'), 420);
}

const NOTIF_IC = {
    msg: ['ic-msg', 'fa-comment', 'Poruke'], call: ['ic-phone', 'fa-phone', 'Telefon'], bank: ['ic-bank', 'fa-building-columns', 'Banka'],
    taxi: ['ic-taxi', 'fa-taxi', 'Taxi'], med: ['ic-med', 'fa-heart-pulse', 'Hitna'], pd: ['ic-pd', 'fa-shield-halved', 'Policija'],
    li: ['ic-li', 'fa-tower-broadcast', 'LifeInvader'], sys: ['ic-notif', 'fa-bell', 'Obaveštenje'],
};
let lockNotifs = [];
function notifHTML(n) {
    const [cls, ic] = NOTIF_IC[n.type] || NOTIF_IC.sys;
    const ago = Math.floor((Date.now() - n.at) / 60000);
    return `<div class="ic ${cls}"><i class="fa-solid ${ic}"></i></div>
        <div><div class="notif-top"><b>${esc(n.title)}</b><small>${ago < 1 ? 'sada' : `pre ${ago} min`}</small></div><span>${esc(n.text)}</span></div>`;
}
function pushNotif(type, title, text, target) {
    lockNotifs.unshift({ type, title, text, target, at: Date.now() });
    lockNotifs = lockNotifs.slice(0, 5);
    renderLockNotifs();
    if (screenEl.classList.contains('locked')) { island(type, title); beep(1320, .09, .04); return; }
    toast(type, title, text, target);
}
function renderLockNotifs() {
    $('lock-notifs').innerHTML = lockNotifs.map((n) => `<div class="lock-notif">${notifHTML(n)}</div>`).join('');
}
let toastT = null, toastTarget = null;
function toast(type, title, text, target) {
    const el = $('toast');
    toastTarget = target || null;
    el.innerHTML = notifHTML({ type, title, text, at: Date.now() });
    el.classList.remove('hidden-screen');
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    island(type, title);
    clearTimeout(toastT);
    toastT = setTimeout(() => el.classList.add('hidden-screen'), 3800);
    beep(1320, .09, .04); setTimeout(() => beep(1760, .12, .035), 110);
}
$('toast').addEventListener('click', () => {
    $('toast').classList.add('hidden-screen');
    if (!toastTarget) return;
    $('lock-screen').classList.add('hidden-screen'); screenEl.classList.remove('locked');
    toastTarget();
});
let islandT = null;
function island(type, text) {
    const [cls, ic] = NOTIF_IC[type] || NOTIF_IC.sys;
    $('island-content').innerHTML = `<div class="island-ic ${cls}"><i class="fa-solid ${ic}"></i></div><span>${esc(text)}</span>`;
    $('island').classList.add('expanded');
    clearTimeout(islandT);
    islandT = setTimeout(() => $('island').classList.remove('expanded'), 2600);
}

/* ---------------- Bedževi (propušteni pozivi, nepročitane poruke) ---------------- */
let unread = store.get('fl_unread', {});
let seenCallId = store.get('fl_seen_call', 0);
const unreadTotal = (except) => Object.entries(unread).reduce((s, [k, v]) => s + (k === except ? 0 : v), 0);
function setBadge(el, n) { el.textContent = n > 99 ? '99+' : n; el.classList.toggle('hidden', !n); }
function updateBadges() {
    setBadge($('msg-badge'), unreadTotal());
    setBadge($('call-badge'), callHistory.filter((c) => c.status === 'missed' && c.id > seenCallId).length);
}

/* =====================================================================
   TELEFON (kontakti, pozivi, tastatura)
   ===================================================================== */
let contacts = [], callHistory = [], myNumber = '---';
const CALL_END_MESSAGES = {
    no_answer: 'Nema odgovora', missed: 'Propušten poziv', declined: 'Poziv je odbijen', declined_self: null,
    hangup: 'Poziv je završen', hangup_self: null, disconnected: 'Sagovornik je izašao iz igre',
    invalid: 'Nevalidan broj', self: 'Ne možeš zvati sebe', not_registered: 'Ovaj broj ne postoji',
    offline: 'Korisnik nije dostupan', busy: 'Broj je zauzet', busy_self: 'Već imaš poziv u toku',
    no_sim: 'Nemaš aktivnu SIM karticu',
};
const CALL_STATUS_LABEL = { answered_outgoing: 'Odlazni', answered_incoming: 'Dolazni', missed: 'Propušten', no_answer: 'Nema odgovora', declined: 'Odbijen' };
const findContact = (n) => contacts.find((c) => c.number === n) || null;
const findContactName = (n) => (findContact(n) || {}).name || null;
const parseSql = (s) => {
    if (!s) return new Date();
    if (typeof s === 'number') return new Date(s > 1e12 ? s : s * 1000);
    const d = new Date(String(s).replace(' ', 'T'));
    return isNaN(d) ? new Date() : d;
};
const dur = (s) => `${Math.floor(s / 60)}:${pad2(s % 60)}`;
const sameDay = (a, b) => a.toDateString() === b.toDateString();
function shortWhen(d) {
    const now = new Date();
    if (sameDay(d, now)) return hm(d);
    const y = new Date(now); y.setDate(now.getDate() - 1);
    if (sameDay(d, y)) return 'Juče';
    if (now - d < 6 * 86400000) return DAYS[d.getDay()];
    return `${d.getDate()}.${d.getMonth() + 1}.${String(d.getFullYear()).slice(2)}.`;
}
const formatNum = (v) => { const d = String(v).replace(/\D/g, '').slice(0, 7); return d.length > 3 ? `${d.slice(0, 3)}-${d.slice(3)}` : d; };
const startCall = (number, id, name) => { pendingCallNumber = number; post('callNumber', { id: id ?? null, number, name: name ?? null }); };

let phoneTab = 'recents', callSeg = 'all';
function setPhoneTab(tab) {
    phoneTab = tab;
    ['favorites', 'recents', 'contacts', 'keypad'].forEach((t) => $('tab-' + t).classList.toggle('hidden-screen', t !== tab));
    $$('#phone-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    $('phone-title').textContent = { favorites: 'Omiljeni', recents: 'Nedavni', contacts: 'Kontakti', keypad: '' }[tab];
    $('phone-title').classList.toggle('hidden-screen', tab === 'keypad');
    $('phone-clear').classList.toggle('hidden-screen', tab !== 'recents' || !callHistory.length);
    $('phone-add').classList.toggle('hidden-screen', tab !== 'contacts' && tab !== 'favorites');
    if (tab === 'recents') markCallsSeen();
    renderContacts();
}
$$('#phone-tabs button').forEach((b) => b.addEventListener('click', () => setPhoneTab(b.dataset.tab)));
$$('#calls-seg button').forEach((b) => b.addEventListener('click', () => {
    callSeg = b.dataset.seg;
    $$('#calls-seg button').forEach((x) => x.classList.toggle('on', x === b));
    renderCallHistory();
}));
function markCallsSeen() {
    const max = callHistory.reduce((m, c) => Math.max(m, c.id || 0), 0);
    if (max > seenCallId) { seenCallId = max; store.set('fl_seen_call', seenCallId); }
    updateBadges();
}

function renderContacts() {
    const q = ($('contact-search').value || '').toLowerCase();
    const list = contacts.filter((c) => !q || c.name.toLowerCase().includes(q) || c.number.includes(q))
        .sort((a, b) => a.name.localeCompare(b.name, 'sr'));
    let html = '', letter = '';
    list.forEach((c, i) => {
        const L = (c.name[0] || '#').toUpperCase();
        if (L !== letter) { if (html) html += '</div>'; letter = L; html += `<div class="letter">${esc(L)}</div><div class="group">`; }
        html += `<div class="row tap has-av" data-cid="${c.id}">${avatarHTML(c.name, c.number, 'sm')}<div class="row-main"><b>${esc(c.name)}</b></div>${c.favorite ? '<i class="fa-solid fa-star" style="color:var(--yellow);font-size:12px"></i>' : ''}</div>`;
        if (i === list.length - 1) html += '</div>';
    });
    $('contacts-list').innerHTML = html;
    $('contacts-empty').classList.toggle('hidden-screen', list.length > 0 || !!q);
    $('my-card-num').textContent = myNumber;

    const favs = contacts.filter((c) => c.favorite);
    $('fav-list').innerHTML = favs.map((c) => `<div class="fav" data-fav="${c.id}">${avatarHTML(c.name, c.number)}<b>${esc(c.name)}</b><span><i class="fa-solid fa-phone"></i>mobilni</span></div>`).join('');
    $('fav-empty').classList.toggle('hidden-screen', favs.length > 0);

    $('newmsg-contacts').innerHTML = contacts.slice().sort((a, b) => a.name.localeCompare(b.name, 'sr')).map((c) =>
        `<div class="row tap has-av" data-newmsg="${esc(c.number)}">${avatarHTML(c.name, c.number, 'sm')}<div class="row-main"><b>${esc(c.name)}</b><span>${esc(c.number)}</span></div></div>`).join('')
        || '<div class="row"><div class="row-main"><span>Nemaš kontakata</span></div></div>';

    $$('[data-cid]').forEach((r) => {
        const c = contacts.find((x) => x.id === Number(r.dataset.cid));
        r.onclick = () => openContact(c);
        r.oncontextmenu = (e) => { e.preventDefault(); post('deleteContact', { id: c.id }); };
    });
    $$('[data-fav]').forEach((r) => {
        const c = contacts.find((x) => x.id === Number(r.dataset.fav));
        r.onclick = () => startCall(c.number, c.id, c.name);
        r.oncontextmenu = (e) => { e.preventDefault(); openContact(c); };
    });
    $$('[data-newmsg]').forEach((r) => r.onclick = () => openThread(r.dataset.newmsg));
    if (currentApp === 'contact' && currentContact) {
        const fresh = contacts.find((x) => x.id === currentContact.id);
        if (fresh) fillContact(fresh);
    }
}
$('contact-search').addEventListener('input', renderContacts);

/* Kontakt detalji */
let currentContact = null, contactReturn = 'phone';
function fillContact(c) {
    currentContact = c;
    const av = $('cd-avatar');
    av.textContent = initials(c.name); av.setAttribute('style', avatarStyle(c.number));
    $('cd-name').textContent = c.name;
    $('cd-number').textContent = c.number;
    $('cd-number2').textContent = c.number;
    $('cd-fav').classList.toggle('on', !!c.favorite);
}
function openContact(c) {
    if (!c) return;
    contactReturn = currentApp === 'phone' ? 'phone' : (currentApp || 'phone');
    fillContact(c);
    openApp('contact', { push: true });
}
$('contact-back').addEventListener('click', () => openApp(contactReturn));
$('cd-msg').addEventListener('click', () => currentContact && openThread(currentContact.number));
$('cd-call').addEventListener('click', () => currentContact && startCall(currentContact.number, currentContact.id, currentContact.name));
$('cd-fav').addEventListener('click', () => currentContact && post('toggleFavorite', { id: currentContact.id }));
$('cd-delete').addEventListener('click', () => { if (currentContact) { post('deleteContact', { id: currentContact.id }); openApp('phone'); } });

/* Novi kontakt */
function newContact(number) {
    $('contact-name-input').value = ''; $('contact-number-input').value = number || ''; $('contact-modal-msg').textContent = '';
    openApp('newcontact');
    setTimeout(() => $('contact-name-input').focus(), 50);
}
$('phone-add').addEventListener('click', () => newContact(''));
$('nc-cancel').addEventListener('click', () => openApp('phone'));
$('contact-number-input').addEventListener('input', (e) => { e.target.value = formatNum(e.target.value); });
$('contact-save-btn').addEventListener('click', () => {
    const name = $('contact-name-input').value.trim(), number = $('contact-number-input').value.trim();
    if (!name || number.replace(/\D/g, '').length < 7) { $('contact-modal-msg').textContent = 'Unesi ime i broj u formatu 123-4567.'; return; }
    post('addContact', { name, number });
});

/* Nedavni pozivi */
function renderCallHistory() {
    const list = callSeg === 'missed' ? callHistory.filter((c) => ['missed', 'no_answer', 'declined'].includes(c.status)) : callHistory;
    $('calls-list').innerHTML = list.map((call) => {
        const bad = ['missed', 'no_answer', 'declined'].includes(call.status);
        const name = findContactName(call.number) || call.number;
        const sub = call.status === 'answered'
            ? `${CALL_STATUS_LABEL[call.direction === 'outgoing' ? 'answered_outgoing' : 'answered_incoming']} · ${dur(call.duration || 0)}`
            : (CALL_STATUS_LABEL[call.status] || 'mobilni');
        return `<div class="row tap call-row ${bad ? 'bad' : ''}" data-call="${call.id}" data-num="${esc(call.number)}">
            <span class="dir">${call.direction === 'outgoing' ? '<i class="fa-solid fa-phone-flip"></i>' : ''}</span>
            <div class="row-main"><b>${esc(name)}</b><span>${esc(sub)}</span></div>
            <div class="row-side">${shortWhen(parseSql(call.created_at))}<button class="info-btn" data-info="${esc(call.number)}"><i class="fa-solid fa-circle-info"></i></button></div></div>`;
    }).join('');
    $('calls-list').classList.toggle('hidden-screen', !list.length);
    $('calls-empty').classList.toggle('hidden-screen', list.length > 0);
    $('phone-clear').classList.toggle('hidden-screen', phoneTab !== 'recents' || !callHistory.length);
    $$('#calls-list .row').forEach((row) => {
        const n = row.dataset.num;
        row.onclick = (e) => {
            if (e.target.closest('[data-info]')) { const c = findContact(n); if (c) openContact(c); else newContact(n); return; }
            startCall(n);
        };
        row.oncontextmenu = (e) => { e.preventDefault(); post('deleteCallLog', { id: Number(row.dataset.call) }); callHistory = callHistory.filter((c) => c.id !== Number(row.dataset.call)); renderCallHistory(); };
    });
}
$('phone-clear').addEventListener('click', () => post('clearCallHistory'));

/* Tastatura */
let dialNumber = '';
const KEYS = [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['*', ''], ['0', '+'], ['#', '']];
$('keypad').innerHTML = KEYS.map(([n, s]) => `<button class="key" data-k="${n}"><b>${n}</b><span>${s}</span></button>`).join('');
function renderDial() {
    const d = dialNumber.replace(/\D/g, '');
    $('dial-display').textContent = formatNum(d);
    $('dial-add').classList.toggle('hidden-screen', d.length !== 7 || !!findContact(formatNum(d)));
    $('dial-back').style.visibility = d ? 'visible' : 'hidden';
}
$$('#keypad .key').forEach((k) => k.addEventListener('click', () => {
    if (!/\d/.test(k.dataset.k) || dialNumber.length >= 7) return;
    dialNumber += k.dataset.k; beep(700 + Number(k.dataset.k) * 45, .08, .05); renderDial();
}));
$('dial-back').addEventListener('click', () => { dialNumber = dialNumber.slice(0, -1); renderDial(); });
$('dial-add').addEventListener('click', () => newContact(formatNum(dialNumber)));
$('dial-call').addEventListener('click', () => {
    const d = dialNumber.replace(/\D/g, '');
    if (d.length < 7) { if (!d && callHistory[0]) { dialNumber = callHistory[0].number.replace(/\D/g, ''); renderDial(); } return; }
    startCall(formatNum(d));
});
renderDial();

/* Ekran poziva */
let callTimer = null, callStart = null, pendingCallNumber = null, incomingNumber = null;
function openCallScreen(number, mode) {
    const name = findContactName(number);
    const av = $('call-avatar');
    if (name) { av.textContent = initials(name); av.setAttribute('style', avatarStyle(number)); }
    else { av.innerHTML = '<i class="fa-solid fa-user"></i>'; av.removeAttribute('style'); }
    av.classList.add('ringing');
    $('call-name').textContent = name || number || 'Nepoznat broj';
    $('call-number').textContent = name ? `mobilni ${number}` : 'mobilni';
    $('call-status').textContent = mode === 'incoming' ? 'Dolazni poziv' : 'Pozivam...';
    $('call-pad').style.visibility = mode === 'incoming' ? 'hidden' : 'visible';
    $$('#call-pad button').forEach((b) => b.classList.remove('on'));
    $('call-actions-incoming').classList.toggle('hidden-screen', mode !== 'incoming');
    $('call-actions-active').classList.toggle('hidden-screen', mode === 'incoming');
    $('call-screen').classList.remove('hidden-screen');
    if (wrapper.classList.contains('hidden')) { wrapper.classList.remove('hidden'); applyWallpaper(); }
    $('lock-screen').classList.add('hidden-screen'); screenEl.classList.remove('locked');
}
function closeCallScreen() {
    $('call-screen').classList.add('hidden-screen');
    $('call-avatar').classList.remove('ringing');
    if (callTimer) clearInterval(callTimer);
    callTimer = null;
}
['call-mute', 'call-speaker', 'call-hold', 'call-keys'].forEach((id) => $(id).addEventListener('click', () => $(id).classList.toggle('on')));
$('answer-call-btn').addEventListener('click', () => { stopRingtone(); post('answerCall'); });
$('decline-call-btn').addEventListener('click', () => { stopRingtone(); post('declineCall'); closeCallScreen(); });
$('end-call-btn').addEventListener('click', () => { stopRingtone(); post('endCall'); closeCallScreen(); });

/* =====================================================================
   PORUKE
   ===================================================================== */
let conversations = [], threadMessages = [], currentThread = null;
function renderConversations() {
    const q = ($('conv-search').value || '').toLowerCase();
    const list = conversations.filter((c) => {
        const name = findContactName(c.number) || c.number;
        return !q || name.toLowerCase().includes(q) || String(c.last_message || '').toLowerCase().includes(q);
    });
    $('conversations-list').innerHTML = list.map((c) => {
        const name = findContactName(c.number) || c.number;
        return `<div class="conv ${unread[c.number] ? 'unread' : ''}" data-thread="${esc(c.number)}">
            <span class="dot"></span>${avatarHTML(findContactName(c.number), c.number)}
            <div class="conv-main"><div class="conv-top"><b>${esc(name)}</b><small>${shortWhen(parseSql(c.created_at))}<i class="fa-solid fa-chevron-right"></i></small></div>
            <div class="conv-msg">${esc(c.last_message || '')}</div></div></div>`;
    }).join('');
    $('conversations-empty').classList.toggle('hidden-screen', list.length > 0 || !!q);
    $$('[data-thread]').forEach((r) => r.onclick = () => openThread(r.dataset.thread));
}
$('conv-search').addEventListener('input', renderConversations);
function openThread(number) {
    currentThread = number;
    if (unread[number]) { delete unread[number]; store.set('fl_unread', unread); }
    const name = findContactName(number);
    $('thread-name').textContent = name || number;
    const av = $('thread-avatar');
    if (name) { av.textContent = initials(name); av.setAttribute('style', avatarStyle(number)); }
    else { av.innerHTML = '<i class="fa-solid fa-user" style="font-size:60%"></i>'; av.removeAttribute('style'); }
    const other = unreadTotal(number);
    $('thread-unread').textContent = other ? other : '';
    threadMessages = [];
    $('thread-messages').innerHTML = '';
    openApp('thread', { push: true });
    post('getMessages', { number });
}
function dayLabel(d) {
    const now = new Date();
    if (sameDay(d, now)) return `Danas ${hm(d)}`;
    const y = new Date(now); y.setDate(now.getDate() - 1);
    if (sameDay(d, y)) return `Juče ${hm(d)}`;
    return `${DAYS[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]} ${hm(d)}`;
}
function renderThread() {
    let html = '', prev = null;
    threadMessages.forEach((m, i) => {
        const d = parseSql(m.created_at);
        if (!prev || d - parseSql(prev.created_at) > 30 * 60000) html += `<div class="msg-day">${dayLabel(d)}</div>`;
        const next = threadMessages[i + 1];
        const dir = m.direction === 'out' ? 'sent' : 'received';
        const lastOfRun = !next || next.direction !== m.direction || parseSql(next.created_at) - d > 5 * 60000;
        html += `<div class="msg-bubble ${dir} ${lastOfRun ? '' : 'grp'}">${esc(m.body)}</div>`;
        if (lastOfRun && (!next || parseSql(next.created_at) - d > 5 * 60000)) html += `<div class="msg-time ${dir}">${hm(d)}</div>`;
        prev = m;
    });
    $('thread-messages').innerHTML = html;
    const body = $('app-thread').querySelector('.app-body');
    body.scrollTop = body.scrollHeight;
}
$('thread-input').addEventListener('input', () => { $('thread-send').disabled = !$('thread-input').value.trim(); });
$('thread-send').addEventListener('click', () => {
    const body = $('thread-input').value.trim();
    if (!body || !currentThread) return;
    post('sendMessage', { number: currentThread, body });
    $('thread-input').value = ''; $('thread-send').disabled = true;
    beep(880, .06, .03);
});
$('thread-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('thread-send').click(); });
$('thread-call').addEventListener('click', () => { if (currentThread) startCall(currentThread); });
$('new-msg-btn').addEventListener('click', () => { $('newmsg-number').value = ''; openApp('newmsg'); setTimeout(() => $('newmsg-number').focus(), 50); });
$('newmsg-number').addEventListener('input', (e) => {
    e.target.value = formatNum(e.target.value);
    if (e.target.value.length === 8) openThread(e.target.value);
});

/* =====================================================================
   BANKA (flamingo_banke)
   ===================================================================== */
const bank = { info: null, amount: 0, busy: false };
function openBanka() {
    bank.amount = 0; bank.busy = false;
    $('banka-target').value = ''; $('banka-memo').value = ''; $('banka-msg').textContent = '';
    $('banka-done').classList.add('hidden-screen');
    if (!bank.info) { $('banka-balance').textContent = '...'; $('banka-holder').textContent = 'Učitavam...'; }
    renderBank();
    post('bankaGetInfo');
}
$('banka-refresh').addEventListener('click', () => post('bankaGetInfo'));
function bankMax() {
    if (!bank.info) return 0;
    const fee = Number(bank.info.fee) || 0;
    const byFee = Math.floor(bank.info.bank / (1 + fee / 100));
    return Math.max(0, Math.min(byFee, bank.info.maxTransfer || byFee));
}
function bankProblem() {
    if (!bank.info) return 'Banka trenutno nije dostupna.';
    const a = bank.amount;
    if (!a) return '';
    const fee = Math.floor(a * (Number(bank.info.fee) || 0) / 100);
    if (bank.info.maxTransfer && a > bank.info.maxTransfer) return `Tvoja kartica dozvoljava najviše ${money(bank.info.maxTransfer)} po transferu.`;
    if (a + fee > bank.info.bank) return 'Nemaš dovoljno novca na računu.';
    return '';
}
function whenTs(ts, now) {
    const d = Math.max(0, (now || Math.floor(Date.now() / 1000)) - ts);
    if (d < 60) return 'upravo'; if (d < 3600) return `pre ${Math.floor(d / 60)} min`;
    if (d < 86400) return `pre ${Math.floor(d / 3600)}h`; return `pre ${Math.floor(d / 86400)}d`;
}
function renderBankWidget() {
    $('wb-bal').textContent = bank.info ? money(bank.info.bank) : '•••••';
}
function renderBank() {
    renderBankWidget();
    $('banka-amount-txt').textContent = num(bank.amount);
    const err = bankProblem();
    $('banka-msg').textContent = bank.amount ? err : '';
    $('banka-send').disabled = bank.busy || !bank.amount || !$('banka-target').value.trim() || !!err;
    $('banka-send-label').textContent = bank.busy ? 'Šaljem...' : (bank.amount ? `Pošalji ${money(bank.amount)}` : 'Pošalji');
    const card = $('bank-card');
    card.className = 'bank-card' + (bank.info && bank.info.theme ? ` t-${bank.info.theme}` : '');
    if (!bank.info) {
        $('banka-balance').textContent = '—'; $('banka-holder').textContent = 'Banka nije dostupna';
        $('banka-limits').innerHTML = '';
        $('banka-recent').innerHTML = '<div class="row"><div class="row-main"><span>Pokušaj kasnije.</span></div></div>';
        return;
    }
    const i = bank.info;
    $('banka-balance').textContent = money(i.bank);
    $('banka-holder').textContent = i.name || '—';
    card.querySelector('.bc-tier').textContent = i.tierLabel ? `${i.tierLabel}` : 'Banka';
    $('banka-limits').innerHTML = `
        <div><span>Limit transfera</span><b>${i.maxTransfer ? money(i.maxTransfer) : 'Bez limita'}</b></div>
        <div><span>Provizija</span><b>${Number(i.fee) ? `${i.fee}%` : 'Bez provizije'}</b></div>`;
    const list = i.recent || [];
    $('banka-recent').innerHTML = list.length ? list.map((t) => {
        const dir = t.type === 'transfer_in' ? 'in' : 'out';
        return `<div class="tx"><div class="tx-ic ${dir}"><i class="fa-solid fa-arrow-${dir === 'in' ? 'down' : 'up'}"></i></div>
            <div class="row-main"><b>${esc(t.party || (dir === 'in' ? 'Primljeno' : 'Poslato'))}</b><span>${esc(t.memo || (dir === 'in' ? 'Primljen novac' : 'Poslat novac'))}</span></div>
            <div class="tx-amt ${dir}">${dir === 'in' ? '+' : '-'}${money(t.amount)}<small>${whenTs(t.ts, i.now)}</small></div></div>`;
    }).join('') : '<div class="row"><div class="row-main"><span>Još nema transfera.</span></div></div>';
}
$$('[data-add]').forEach((b) => b.addEventListener('click', () => {
    const v = b.dataset.add;
    bank.amount = v === 'max' ? bankMax() : (v === 'clear' ? 0 : Math.min(2147483647, bank.amount + Number(v)));
    renderBank();
}));
$('banka-target').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 5); renderBank(); });
$('banka-send').addEventListener('click', () => {
    if ($('banka-send').disabled) return;
    bank.busy = true; renderBank();
    bank.lastTarget = $('banka-target').value.trim();
    post('bankaTransfer', { target: bank.lastTarget, amount: bank.amount, memo: $('banka-memo').value.trim() });
});
$('banka-done-btn').addEventListener('click', () => $('banka-done').classList.add('hidden-screen'));

/* =====================================================================
   LIFEINVADER
   ===================================================================== */
let liFeed = store.get('fl_li', []);
function renderLiFeed() {
    $('li-feed').innerHTML = liFeed.length ? liFeed.map((p) => {
        const d = new Date(p.at);
        return `<div class="li-post"><div class="who">${avatarHTML(null, myNumber, 'sm')}<div><b>${esc(myNumber)}</b><span>${shortWhen(d)} · ${hm(d)}</span></div></div>
            <p>${esc(p.text)}</p><span class="tag"><i class="fa-solid fa-tower-broadcast"></i>Objavljeno</span></div>`;
    }).join('') : '<div class="empty"><i class="fa-solid fa-tower-broadcast"></i><b>Još nema oglasa</b><span>Tvoji objavljeni oglasi biće ovde</span></div>';
}
$('oglasnik-input').addEventListener('input', (e) => { $('li-count').textContent = e.target.value.length; });
$('oglasnik-submit-btn').addEventListener('click', () => {
    const content = $('oglasnik-input').value.trim();
    if (!content) return;
    post('oglasnikSubmit', { content });
    liFeed.unshift({ text: content, at: Date.now() }); liFeed = liFeed.slice(0, 20);
    store.set('fl_li', liFeed);
    $('oglasnik-input').value = ''; $('li-count').textContent = '0';
    const msg = $('oglasnik-status-msg');
    msg.textContent = 'Oglas je poslat!'; msg.style.opacity = '1';
    setTimeout(() => { msg.style.opacity = '0'; }, 2500);
    renderLiFeed();
});

/* =====================================================================
   TAXI (flamingo_taxi)
   ===================================================================== */
const TAXI_DESTINATIONS = [
    { label: 'Legion Square', coords: { x: 215.6, y: -800.0, z: 30.7 } },
    { label: 'Aerodrom', coords: { x: -1037.0, y: -2737.0, z: 20.2 } },
    { label: 'Bolnica', coords: { x: 298.6, y: -584.0, z: 43.3 } },
    { label: 'Sandy Shores', coords: { x: 1961.0, y: 3740.0, z: 32.3 } },
    { label: 'Paleto Bay', coords: { x: -140.0, y: 6266.0, z: 31.0 } },
    { label: 'Vinewood', coords: { x: 320.0, y: 180.0, z: 104.0 } },
    { label: 'Vespucci Beach', coords: { x: -1180.0, y: -1520.0, z: 4.0 } },
];
const DEST_IC = ['fa-landmark', 'fa-plane', 'fa-hospital', 'fa-sun', 'fa-tree', 'fa-star', 'fa-umbrella-beach'];
const TAXI_STATES = ['idle', 'waiting', 'accepted', 'destination', 'driving'];
function setTaxiState(name) {
    TAXI_STATES.forEach((s) => $('taxi-state-' + s).classList.toggle('hidden-screen', s !== name));
    $('taxi-radar').classList.toggle('hidden-screen', name !== 'waiting' && name !== 'accepted');
    if (name === 'destination') renderTaxiDest();
}
function renderTaxiDest() {
    $('taxi-destination-list').innerHTML = TAXI_DESTINATIONS.map((d, i) =>
        `<button class="row has-ic dest" data-dest="${i}"><div class="set-ic" style="background:#ffd60a;color:#1c1c1e"><i class="fa-solid ${DEST_IC[i] || 'fa-location-dot'}"></i></div><div class="row-main"><b>${esc(d.label)}</b></div><i class="fa-solid fa-chevron-right chev"></i></button>`).join('');
    $$('[data-dest]').forEach((b) => b.onclick = () => {
        const d = TAXI_DESTINATIONS[Number(b.dataset.dest)];
        post('taxiChooseDestination', { label: d.label, coords: d.coords });
        setTaxiState('driving');
    });
}
$('taxi-call-btn').addEventListener('click', () => { $('taxi-idle-msg').textContent = ''; post('taxiRequestRide'); });
$('taxi-cancel-waiting-btn').addEventListener('click', () => post('taxiCancelRide'));
$('taxi-cancel-accepted-btn').addEventListener('click', () => post('taxiCancelRide'));
$('taxi-custom-dest-btn').addEventListener('click', () => { post('taxiSetCustomDestination'); setTaxiState('driving'); });
const TAXI_MSG = { no_drivers: 'Trenutno nema vozača na dužnosti.', cooldown: 'Prečesto otkazuješ - sačekaj malo.', already_waiting: 'Već čekaš taxi.' };

/* =====================================================================
   HITNA (flamingo_bolnica)
   ===================================================================== */
function setMedState(name) { ['idle', 'sending', 'sent', 'failed'].forEach((s) => $('doktor-state-' + s).classList.toggle('hidden-screen', s !== name)); }
function openMed() {
    setMedState('idle');
    $('doktor-reason-input').value = ''; $('doktor-call-btn').disabled = true; $('doktor-idle-msg').textContent = '';
    $('doktor-duty-badge').className = 'duty-badge'; $('doktor-duty-text').textContent = 'Proveravam dežurne...';
    post('hospitalGetDutyStatus');
}
$('doktor-reason-input').addEventListener('input', (e) => { $('doktor-call-btn').disabled = !e.target.value.trim(); });
$('doktor-call-btn').addEventListener('click', () => { setMedState('sending'); post('hospitalCallDoctor', { reason: $('doktor-reason-input').value.trim() }); });
$('doktor-sent-ok-btn').addEventListener('click', goBack);
$('doktor-failed-back-btn').addEventListener('click', () => setMedState('idle'));

/* =====================================================================
   POLICIJA (flamingo_policija)
   ===================================================================== */
function setPdState(name) { ['idle', 'sending', 'sent', 'failed'].forEach((s) => $('pd-state-' + s).classList.toggle('hidden-screen', s !== name)); }
function openPd() {
    setPdState('idle');
    $('pd-reason-input').value = ''; $('pd-call-btn').disabled = true; $('pd-idle-msg').textContent = '';
    $$('#pd-quick button').forEach((b) => b.classList.remove('on'));
    $('pd-duty-badge').className = 'duty-badge'; $('pd-duty-text').textContent = 'Proveravam dežurne...';
    post('policeGetDutyStatus');
}
$('pd-reason-input').addEventListener('input', (e) => { $('pd-call-btn').disabled = !e.target.value.trim(); });
$$('#pd-quick button').forEach((b) => b.addEventListener('click', () => {
    $$('#pd-quick button').forEach((x) => x.classList.toggle('on', x === b));
    const inp = $('pd-reason-input');
    const rest = inp.value.replace(/^(Pucnjava u blizini|Pljačka u toku|Tuča \/ napad|Krađa vozila)( - )?/, '');
    inp.value = b.dataset.q + (rest ? ' - ' + rest : '');
    $('pd-call-btn').disabled = false;
}));
$('pd-call-btn').addEventListener('click', () => { setPdState('sending'); post('policeCall', { reason: $('pd-reason-input').value.trim() }); });
$('pd-sent-ok-btn').addEventListener('click', goBack);
$('pd-failed-back-btn').addEventListener('click', () => setPdState('idle'));

/* =====================================================================
   BELEŠKE (baza, tabela phone_notes)
   ===================================================================== */
let notes = [], currentNote = null;
const noteDate = (n) => (n && n.ts ? new Date(n.ts * 1000) : new Date());
function renderNotes() {
    const q = ($('notes-search').value || '').toLowerCase();
    const list = notes.filter((n) => !q || `${n.title} ${n.body}`.toLowerCase().includes(q));
    $('notes-list').innerHTML = list.map((n) => {
        const firstLine = String(n.body || '').split('\n').find((l) => l.trim()) || 'Nema dodatnog teksta';
        return `<div class="row tap" data-note="${n.id}"><div class="row-main"><b>${esc(n.title || 'Nova beleška')}</b><span>${shortWhen(noteDate(n))} <em>${esc(firstLine.slice(0, 60))}</em></span></div></div>`;
    }).join('');
    $('notes-list').classList.toggle('hidden-screen', !list.length);
    $('notes-empty').classList.toggle('hidden-screen', list.length > 0 || !!q);
    $('notes-count').textContent = `${notes.length} ${notes.length === 1 ? 'beleška' : (notes.length % 10 >= 2 && notes.length % 10 <= 4 && (notes.length < 10 || notes.length > 20) ? 'beleške' : 'beleški')}`;
    $$('[data-note]').forEach((r) => r.onclick = () => {
        currentNote = notes.find((n) => n.id === Number(r.dataset.note));
        openNote(currentNote);
    });
}
function openNote(n) {
    $('note-title').value = n ? (n.title || '') : '';
    $('note-body').value = n ? (n.body || '') : '';
    const d = noteDate(n);
    $('note-date').textContent = `${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}. u ${hm(d)}`;
    $('note-delete').classList.toggle('hidden-screen', !n);
    openApp('note', { push: true });
    if (!n) setTimeout(() => $('note-title').focus(), 50);
}
$('notes-search').addEventListener('input', renderNotes);
$('note-new').addEventListener('click', () => { currentNote = null; openNote(null); });
$('note-save').addEventListener('click', () => {
    const title = $('note-title').value.trim(), body = $('note-body').value;
    if (title || body.trim()) post('notesSave', { id: currentNote ? currentNote.id : null, title, body });
    openApp('notes');
});
$('note-delete').addEventListener('click', () => { if (currentNote) post('notesDelete', { id: currentNote.id }); openApp('notes'); });

/* =====================================================================
   GALERIJA (slike iz kamere, čuvaju se lokalno na računaru igrača)
   ===================================================================== */
const savePhotos = () => { try { localStorage.setItem('fl_photos', JSON.stringify(photos)); } catch (e) { photos = photos.slice(0, 12); store.set('fl_photos', photos); } };
let currentPhoto = null;
function renderGallery() {
    $('gal-grid').innerHTML = photos.map((p, i) => `<div class="gal-item" data-photo="${i}" style="background-image:url('${p.src}')"></div>`).join('');
    $('gal-count').textContent = photos.length ? `${photos.length} ${photos.length === 1 ? 'fotografija' : 'fotografija'}` : '';
    $('gal-empty').classList.toggle('hidden-screen', photos.length > 0);
    $$('[data-photo]').forEach((el) => el.onclick = () => {
        currentPhoto = Number(el.dataset.photo);
        const p = photos[currentPhoto];
        $('photo-view').src = p.src;
        const d = new Date(p.at || Date.now());
        $('photo-date').textContent = `${d.getDate()}. ${MONTHS[d.getMonth()]}`;
        openApp('photo', { push: true });
    });
}
$('gal-cam').addEventListener('click', () => post('openCamera'));
$('photo-del').addEventListener('click', () => {
    if (currentPhoto != null) {
        photos.splice(currentPhoto, 1);
        if (typeof SET.wall === 'string' && SET.wall.startsWith('photo:')) {
            const w = Number(SET.wall.split(':')[1]);
            if (w === currentPhoto) SET.wall = 'ios1'; else if (w > currentPhoto) SET.wall = 'photo:' + (w - 1);
            saveSet(); applyWallpaper();
        }
        savePhotos();
    }
    openApp('gallery');
});
$('photo-wall').addEventListener('click', () => {
    if (currentPhoto == null) return;
    SET.wall = 'photo:' + currentPhoto; saveSet(); applyWallpaper();
    toast('sys', 'Fotografije', 'Slika je postavljena kao pozadina');
});
function storePhoto(dataUrl) {
    const img = new Image();
    img.onload = () => {
        const w = 720, h = Math.round(img.height * w / img.width);
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        photos.unshift({ src: c.toDataURL('image/jpeg', 0.6), at: Date.now() });
        photos = photos.slice(0, 24);
        if (typeof SET.wall === 'string' && SET.wall.startsWith('photo:')) { SET.wall = 'photo:' + (Number(SET.wall.split(':')[1]) + 1); saveSet(); }
        savePhotos();
        if (currentApp === 'gallery') renderGallery();
    };
    img.src = dataUrl;
}
function camToast(text) {
    const t = $('cam-toast');
    t.textContent = text; t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), 2200);
}

/* =====================================================================
   MUZIKA (radio + svoj link) - čuje samo igrač
   ===================================================================== */
const STATIONS = [
    { name: 'Flamingo FM', sub: 'Dance / House', url: 'https://ice1.somafm.com/beatblender-128-mp3', c: ['#ff5f8a', '#c2185b'], ic: 'fa-fire' },
    { name: 'Chill Lounge', sub: 'Lo-fi / Chill', url: 'https://ice1.somafm.com/groovesalad-128-mp3', c: ['#43cea2', '#185a9d'], ic: 'fa-leaf' },
    { name: 'Rock Radio', sub: 'Rock klasici', url: 'https://ice1.somafm.com/bagel-128-mp3', c: ['#f7b733', '#fc4a1a'], ic: 'fa-guitar' },
    { name: 'Retro 70s', sub: 'Hitovi 70-ih', url: 'https://ice1.somafm.com/seventies-128-mp3', c: ['#a18cd1', '#5b2bd6'], ic: 'fa-record-vinyl' },
    { name: 'Space Jazz', sub: 'Jazz / Ambient', url: 'https://ice1.somafm.com/sonicuniverse-128-mp3', c: ['#56ccf2', '#2f3ded'], ic: 'fa-moon' },
];
const audio = new Audio(); audio.volume = 0.45;
let stationIdx = -1;
function setPlaying(on) {
    $('music-play').innerHTML = `<i class="fa-solid fa-${on ? 'pause' : 'play'}"></i>`;
    $('app-music').classList.toggle('playing', on);
}
function renderStations() {
    $('music-list').innerHTML = STATIONS.map((s, i) => `<div class="row tap has-av ${i === stationIdx ? 'now' : ''}" data-st="${i}">
        <div class="st-cover" style="background:linear-gradient(135deg,${s.c[0]},${s.c[1]})"><i class="fa-solid ${s.ic}"></i></div>
        <div class="row-main"><b>${esc(s.name)}</b><span>${esc(s.sub)}</span></div>
        <div class="row-side">${i === stationIdx && !audio.paused ? '<i class="fa-solid fa-chart-simple"></i>' : '<i class="fa-solid fa-play"></i>'}</div></div>`).join('');
    $$('[data-st]').forEach((r) => r.onclick = () => playStation(Number(r.dataset.st)));
}
function playStation(i) {
    stationIdx = i;
    const s = STATIONS[i];
    audio.src = s.url; audio.play().catch(() => {});
    $('music-title').textContent = s.name; $('music-sub').textContent = s.sub;
    $('music-cover').style.background = `linear-gradient(135deg,${s.c[0]},${s.c[1]})`;
    $('music-cover').querySelector('i').className = `fa-solid ${s.ic}`;
    setPlaying(true);
    renderStations();
}
$('music-play').addEventListener('click', () => {
    if (!audio.src) { playStation(0); return; }
    if (audio.paused) { audio.play().catch(() => {}); setPlaying(true); } else { audio.pause(); setPlaying(false); }
    renderStations();
});
$('music-prev').addEventListener('click', () => playStation((stationIdx - 1 + STATIONS.length) % STATIONS.length));
$('music-next').addEventListener('click', () => playStation((stationIdx + 1) % STATIONS.length));
$('music-vol').addEventListener('input', (e) => { audio.volume = e.target.value / 100; });
$('music-url-play').addEventListener('click', () => {
    const url = $('music-url').value.trim();
    if (!url) return;
    stationIdx = -1; audio.src = url; audio.play().catch(() => {});
    $('music-title').textContent = 'Tvoj link'; $('music-sub').textContent = url.replace(/^https?:\/\//, '').slice(0, 34);
    $('music-cover').style.background = ''; $('music-cover').querySelector('i').className = 'fa-solid fa-link';
    setPlaying(true); renderStations();
});
renderStations();

/* =====================================================================
   KALKULATOR (iOS ponašanje)
   ===================================================================== */
(() => {
    const keys = [['AC', 'fn'], ['±', 'fn'], ['%', 'fn'], ['÷', 'op'], ['7', ''], ['8', ''], ['9', ''], ['×', 'op'],
        ['4', ''], ['5', ''], ['6', ''], ['−', 'op'], ['1', ''], ['2', ''], ['3', ''], ['+', 'op'], ['0', 'zero'], [',', ''], ['=', 'op']];
    $('calc-grid').innerHTML = keys.map(([k, c]) => `<button class="${c}" data-c="${k}">${k}</button>`).join('');
    let cur = '0', prev = null, op = null, fresh = true;
    const fmt = (s) => {
        if (s === 'Greška') return s;
        const n = Number(s);
        if (!isFinite(n)) return 'Greška';
        if (Math.abs(n) >= 1e9) return n.toExponential(3).replace('.', ',');
        const [i, d] = String(s).split('.');
        return i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (d !== undefined ? ',' + d : '');
    };
    const calc = () => {
        const a = parseFloat(prev), b = parseFloat(cur);
        const r = op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : (b === 0 ? NaN : a / b);
        return isFinite(r) ? String(Math.round(r * 1e9) / 1e9) : 'Greška';
    };
    const show = () => {
        const t = fmt(cur);
        const el = $('calc-display');
        el.textContent = t;
        el.style.fontSize = t.length > 9 ? '48px' : t.length > 7 ? '62px' : '';
        $('calc-expr').textContent = op && prev !== null ? `${fmt(prev)} ${op}` : '';
        $$('#calc-grid .op').forEach((b) => b.classList.toggle('on', b.dataset.c === op && fresh && b.dataset.c !== '='));
        $$('#calc-grid [data-c="AC"]').forEach((b) => { b.textContent = cur !== '0' && !fresh ? 'C' : 'AC'; });
    };
    $$('#calc-grid button').forEach((b) => b.addEventListener('click', () => {
        const k = b.dataset.c;
        if (cur === 'Greška' && k !== 'AC') { cur = '0'; prev = null; op = null; fresh = true; }
        if (/[0-9]/.test(k)) { if (cur.replace(/[-.]/g, '').length >= 9 && !fresh) return; cur = fresh || cur === '0' ? k : cur + k; fresh = false; }
        else if (k === ',') { if (fresh) { cur = '0.'; fresh = false; } else if (!cur.includes('.')) cur += '.'; }
        else if (k === 'AC') { if (b.textContent === 'C') { cur = '0'; fresh = true; } else { cur = '0'; prev = null; op = null; fresh = true; } }
        else if (k === '±') cur = cur.startsWith('-') ? cur.slice(1) : (cur === '0' ? cur : '-' + cur);
        else if (k === '%') cur = String(parseFloat(cur) / 100);
        else if (k === '=') { if (op && prev !== null) { cur = calc(); op = null; prev = null; fresh = true; } }
        else { if (op && prev !== null && !fresh) cur = calc(); prev = cur; op = k; fresh = true; }
        show();
    }));
    show();
})();

/* =====================================================================
   KALENDAR
   ===================================================================== */
let calCursor = new Date();
function renderCalendar() {
    const y = calCursor.getFullYear(), m = calCursor.getMonth();
    const today = new Date();
    const title = MONTHS[m][0].toUpperCase() + MONTHS[m].slice(1);
    $('cal-title').textContent = `${title} ${y}`;
    const first = new Date(y, m, 1);
    const offset = (first.getDay() + 6) % 7; // ponedeljak prvi
    const days = new Date(y, m + 1, 0).getDate();
    const prevDays = new Date(y, m, 0).getDate();
    let html = '';
    for (let i = 0; i < offset; i++) html += `<span class="muted">${prevDays - offset + i + 1}</span>`;
    for (let d = 1; d <= days; d++) {
        const isToday = d === today.getDate() && m === today.getMonth() && y === today.getFullYear();
        const dow = (offset + d - 1) % 7;
        html += `<span class="${isToday ? 'today' : dow >= 5 ? 'wk' : ''}">${d}</span>`;
    }
    const tail = (7 - ((offset + days) % 7)) % 7;
    for (let i = 1; i <= tail; i++) html += `<span class="muted">${i}</span>`;
    $('cal-grid').innerHTML = html;
    $('cal-today-card').innerHTML = `<div class="big">${today.getDate()}</div><div><b>${DAYS[today.getDay()][0].toUpperCase() + DAYS[today.getDay()].slice(1)}, ${today.getDate()}. ${MONTHS[today.getMonth()]}</b><span>Nema zakazanih događaja</span></div>`;
}
$('cal-prev').addEventListener('click', () => { calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() - 1, 1); renderCalendar(); });
$('cal-next').addEventListener('click', () => { calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() + 1, 1); renderCalendar(); });
$('cal-today').addEventListener('click', () => { calCursor = new Date(); renderCalendar(); });

/* =====================================================================
   PODEŠAVANJA
   ===================================================================== */
function renderSettings() {
    const photoWall = typeof SET.wall === 'string' && SET.wall.startsWith('photo:');
    $('wall-grid').innerHTML = WALLS.map((w) =>
        `<div class="wall-opt ${SET.wall === w.id ? 'on' : ''}" data-wall="${w.id}" style="background-image:url('${w.thumb || w.src}')"></div>`).join('')
        + (photoWall ? `<div class="wall-opt on" style="background-image:url('${wallSrc()}')"></div>` : '');
    $$('[data-wall]').forEach((el) => el.onclick = () => {
        const id = el.dataset.wall;
        SET.wall = /^\d+$/.test(id) ? Number(id) : id;
        saveSet(); applyWallpaper(); renderSettings();
    });
    $('sw-ring').classList.toggle('on', SET.ring);
    $('sw-dnd').classList.toggle('on', SET.dnd);
    $('sw-lock').classList.toggle('on', SET.lock);
    $('set-vol').value = SET.vol;
}
$('sw-ring').addEventListener('click', () => { SET.ring = !SET.ring; saveSet(); renderSettings(); });
$('sw-dnd').addEventListener('click', () => { SET.dnd = !SET.dnd; saveSet(); renderSettings(); });
$('sw-lock').addEventListener('click', () => { SET.lock = !SET.lock; saveSet(); renderSettings(); });
$('set-vol').addEventListener('input', (e) => { SET.vol = Number(e.target.value); saveSet(); });

/* =====================================================================
   SIM
   ===================================================================== */
$('sim-number-input').addEventListener('input', (e) => { e.target.value = formatNum(e.target.value); });
$('sim-generate-btn').addEventListener('click', () => { $('sim-status-msg').style.color = ''; $('sim-status-msg').textContent = 'Tražim slobodan broj...'; post('requestRandomNumber'); });
$('sim-submit-btn').addEventListener('click', () => {
    const number = $('sim-number-input').value.trim();
    $('sim-status-msg').style.color = '';
    if (number.replace(/\D/g, '').length !== 7) { $('sim-status-msg').textContent = 'Broj mora imati 7 cifara.'; return; }
    $('sim-status-msg').textContent = 'Proveravam dostupnost...';
    post('submitPhoneNumber', { number });
});

/* =====================================================================
   PORUKE IZ IGRE
   ===================================================================== */
function handle(d) {
    switch (d.action) {
        case 'openPhone':
            wrapper.classList.remove('hidden', 'closing');
            applyWallpaper(); lockPhone(); post('getContacts'); post('getCallHistory'); post('bankaGetInfo');
            break;
        case 'closePhone': wrapper.classList.add('hidden'); break;
        case 'setPhoneNumber':
            myNumber = d.number || '---';
            $('set-number').textContent = myNumber; $('my-card-num').textContent = myNumber;
            break;
        case 'openSimSetup':
            wrapper.classList.remove('hidden'); applyWallpaper();
            $('lock-screen').classList.add('hidden-screen'); screenEl.classList.remove('locked'); $('sim-setup').classList.remove('hidden-screen');
            break;
        case 'randomNumberResult':
            if (d.number) { $('sim-number-input').value = d.number; $('sim-status-msg').textContent = ''; }
            else $('sim-status-msg').textContent = 'Nema slobodnog broja, probaj ručno.';
            break;
        case 'simResult':
            $('sim-status-msg').style.color = d.success ? 'var(--green)' : 'var(--orange)';
            $('sim-status-msg').textContent = d.success ? `Broj aktiviran: ${d.data}` : d.data;
            if (d.success) { myNumber = d.data; setTimeout(() => $('sim-setup').classList.add('hidden-screen'), 1400); }
            break;

        case 'setContacts': contacts = d.contacts || []; renderContacts(); renderCallHistory(); if (currentApp === 'messages') renderConversations(); break;
        case 'contactAdded':
            if (d.success) { contacts.push(d.contact); setPhoneTab('contacts'); contactReturn = 'phone'; fillContact(d.contact); openApp('contact', { push: true }); }
            else $('contact-modal-msg').textContent = d.message;
            break;
        case 'contactDeleted':
            contacts = contacts.filter((c) => c.id !== d.id); renderContacts();
            if (currentApp === 'contact' && currentContact && currentContact.id === d.id) openApp('phone');
            break;
        case 'favoriteToggled': { const c = contacts.find((x) => x.id === d.id); if (c) c.favorite = d.favorite; renderContacts(); break; }

        case 'setCallHistory': callHistory = d.calls || []; renderCallHistory(); if (currentApp === 'phone' && phoneTab === 'recents') markCallsSeen(); else updateBadges(); break;
        case 'callHistoryCleared': callHistory = []; renderCallHistory(); updateBadges(); break;

        case 'outgoingCall': openCallScreen(d.number, 'outgoing'); playRingback(); break;
        case 'incomingCall':
            incomingNumber = d.number;
            openCallScreen(d.number, 'incoming'); playRingtone();
            island('call', findContactName(d.number) || d.number);
            break;
        case 'callConnected':
            stopRingtone();
            $('call-avatar').classList.remove('ringing');
            $('call-actions-incoming').classList.add('hidden-screen');
            $('call-actions-active').classList.remove('hidden-screen');
            $('call-pad').style.visibility = 'visible';
            callStart = Date.now();
            $('call-status').textContent = '0:00';
            callTimer = setInterval(() => { $('call-status').textContent = dur(Math.floor((Date.now() - callStart) / 1000)); }, 1000);
            break;
        case 'callEnded': {
            stopRingtone(); if (callTimer) clearInterval(callTimer);
            const msg = CALL_END_MESSAGES[d.reason];
            if (d.reason === 'missed') pushNotif('call', 'Propušten poziv', (incomingNumber && (findContactName(incomingNumber) || incomingNumber)) || 'Pogledaj Nedavne', () => { openApp('phone'); setPhoneTab('recents'); });
            if (msg) {
                $('call-actions-incoming').classList.add('hidden-screen');
                $('call-actions-active').classList.add('hidden-screen');
                $('call-status').textContent = msg;
                setTimeout(closeCallScreen, 1400);
            } else closeCallScreen();
            post('getCallHistory');
            break;
        }
        case 'callFailed': {
            stopRingtone(); if (callTimer) clearInterval(callTimer);
            const msg = CALL_END_MESSAGES[d.reason] || 'Poziv nije uspeo';
            openCallScreen(pendingCallNumber || '', 'outgoing');
            $('call-actions-incoming').classList.add('hidden-screen');
            $('call-actions-active').classList.add('hidden-screen');
            $('call-pad').style.visibility = 'hidden';
            $('call-status').textContent = msg;
            setTimeout(closeCallScreen, 1600);
            pendingCallNumber = null;
            post('getCallHistory');
            break;
        }

        case 'setConversations': conversations = d.conversations || []; renderConversations(); break;
        case 'setMessages': if (d.number === currentThread) { threadMessages = d.messages || []; renderThread(); } break;
        case 'messageSent': if (d.message && d.message.number === currentThread) { threadMessages.push(d.message); renderThread(); } break;
        case 'newMessage':
            if (d.number === currentThread && currentApp === 'thread') { threadMessages.push(d.message); renderThread(); beep(1175, .08, .04); }
            else {
                unread[d.number] = (unread[d.number] || 0) + 1; store.set('fl_unread', unread);
                pushNotif('msg', findContactName(d.number) || d.number, (d.message && d.message.body) || 'Nova poruka', () => openThread(d.number));
                updateBadges();
            }
            if (currentApp === 'messages') post('getConversations');
            break;

        case 'bankaInfo': bank.info = d.info || null; renderBank(); break;
        case 'bankaTransferResult': {
            const r = d.result || {};
            bank.busy = false;
            if (r.ok) {
                if (r.info) bank.info = r.info;
                $('banka-done-amount').textContent = money(r.amount);
                $('banka-done-to').textContent = r.targetName ? `Poslato: ${r.targetName}` : 'Novac je poslat';
                $('banka-done').classList.remove('hidden-screen');
                bank.amount = 0; $('banka-target').value = ''; $('banka-memo').value = '';
                pushNotif('bank', 'Banka', `Poslato ${money(r.amount)}${r.targetName ? ` · ${r.targetName}` : ''}`);
            } else $('banka-msg').textContent = r.msg || 'Transfer nije uspeo.';
            renderBank();
            break;
        }

        case 'taxiStatus': {
            const s = d.status;
            if (['waiting', 'accepted', 'in_taxi'].includes(s)) {
                setTaxiState(s === 'in_taxi' ? 'destination' : s);
                if (s === 'accepted') pushNotif('taxi', 'Taxi', 'Vozač je prihvatio poziv!', () => openApp('taxi', { keepState: true }));
                if (s === 'in_taxi') pushNotif('taxi', 'Taxi', 'Izaberi destinaciju', () => openApp('taxi', { keepState: true }));
            } else if (s === 'finished') { setTaxiState('idle'); $('taxi-idle-msg').textContent = 'Vožnja završena. Hvala!'; }
            else if (s === 'cancelled') { setTaxiState('idle'); $('taxi-idle-msg').textContent = 'Otkazao si poziv.'; }
            else if (s === 'driver_cancelled') { setTaxiState('idle'); $('taxi-idle-msg').textContent = 'Vozač je otkazao vožnju.'; pushNotif('taxi', 'Taxi', 'Vozač je otkazao vožnju'); }
            else if (TAXI_MSG[s]) { setTaxiState('idle'); $('taxi-idle-msg').textContent = TAXI_MSG[s]; }
            break;
        }
        case 'taxiOpenDestinationPicker': openApp('taxi', { keepState: true }); setTaxiState('destination'); break;
        case 'taxiDestinationConfirmed': setTaxiState('driving'); break;

        case 'hospitalDutyStatusResult': {
            const badge = $('doktor-duty-badge');
            if (!d.available) { badge.className = 'duty-badge offline'; $('doktor-duty-text').textContent = 'Servis nije dostupan'; }
            else if (d.onDuty > 0) { badge.className = 'duty-badge online'; $('doktor-duty-text').textContent = `${d.onDuty} ${d.onDuty === 1 ? 'doktor' : 'doktora'} na dužnosti`; }
            else { badge.className = 'duty-badge offline'; $('doktor-duty-text').textContent = 'Nema doktora na dužnosti'; }
            break;
        }
        case 'hospitalCallResult':
            if (d.success) { $('doktor-sent-msg').innerHTML = `<b>Poziv je poslat!</b><br>Obavešteno: ${d.notified} ${d.notified === 1 ? 'doktor' : 'doktora'}. Ostani na lokaciji.`; setMedState('sent'); }
            else { $('doktor-failed-msg').innerHTML = `<b>Poziv nije poslat</b><br>${d.reason === 'cooldown' ? 'Prečesto zoveš - sačekaj malo.' : 'Trenutno nema doktora na dužnosti.'}`; setMedState('failed'); }
            break;

        case 'policeDutyStatusResult': {
            const badge = $('pd-duty-badge');
            if (!d.available) { badge.className = 'duty-badge offline'; $('pd-duty-text').textContent = 'Servis nije dostupan'; }
            else if (d.onDuty > 0) { badge.className = 'duty-badge online'; $('pd-duty-text').textContent = `${d.onDuty} ${d.onDuty === 1 ? 'policajac' : 'policajaca'} na dužnosti`; }
            else { badge.className = 'duty-badge offline'; $('pd-duty-text').textContent = 'Nema policajaca na dužnosti'; }
            break;
        }
        case 'policeCallResult':
            if (d.success) { $('pd-sent-msg').innerHTML = `<b>Prijava je poslata!</b><br>Obavešteno: ${d.notified} ${d.notified === 1 ? 'policajac' : 'policajaca'}. Ostani na bezbednom mestu.`; setPdState('sent'); }
            else { $('pd-failed-msg').innerHTML = `<b>Prijava nije poslata</b><br>${d.reason === 'cooldown' ? 'Već si poslao prijavu - sačekaj malo.' : (d.reason === 'unavailable' ? 'Servis nije dostupan.' : 'Trenutno nema policajaca na dužnosti.')}`; setPdState('failed'); }
            break;

        case 'notesList': notes = d.notes || []; renderNotes(); break;
        case 'noteSaved':
            if (d.note && d.note.error === 'limit') { toast('sys', 'Beleške', 'Dostigao si limit beleški.'); break; }
            post('notesGet'); break;
        case 'noteDeleted': notes = notes.filter((n) => n.id !== d.id); renderNotes(); break;

        case 'cameraMode':
            $('camera-screen').classList.toggle('hidden', !d.on);
            wrapper.classList.toggle('hidden', !!d.on);
            break;
        case 'photoTaken': if (d.data) { storePhoto(d.data); camToast('Slika je sačuvana u Fotografije'); } break;
        case 'photoFailed': camToast('Slika nije sačuvana (fali screenshot-basic)'); break;
        case 'cameraShot':
            $('cam-flash').classList.remove('on'); void $('cam-flash').offsetWidth; $('cam-flash').classList.add('on');
            break;
    }
}
window.addEventListener('message', (e) => handle(e.data || {}));

applyWallpaper();
updateBadges();

/* =====================================================================
   DEMO (samo u browseru, u igri se ne koristi)
   ===================================================================== */
function demoPost(endpoint, body) {
    const now = Date.now(), sql = (minAgo) => new Date(now - minAgo * 60000).toISOString().replace('T', ' ').slice(0, 19);
    const reply = (d) => setTimeout(() => handle(d), 30);
    const demoContacts = [
        { id: 1, name: 'Marko Petrović', number: '555-0142', favorite: true },
        { id: 2, name: 'Ana Jovanović', number: '555-8830', favorite: true },
        { id: 3, name: 'Stefan Ilić', number: '555-2211', favorite: false },
        { id: 4, name: 'Mehaničar Joca', number: '555-7001', favorite: false },
        { id: 5, name: 'Nikola Taxi', number: '555-3434', favorite: true },
        { id: 6, name: 'Bojana', number: '555-9090', favorite: false },
    ];
    switch (endpoint) {
        case 'getContacts': if (!contacts.length) reply({ action: 'setContacts', contacts: demoContacts }); break;
        case 'getCallHistory': reply({ action: 'setCallHistory', calls: [
            { id: 9, number: '555-0142', direction: 'incoming', status: 'missed', created_at: sql(12) },
            { id: 8, number: '555-8830', direction: 'outgoing', status: 'answered', duration: 185, created_at: sql(80) },
            { id: 7, number: '555-4455', direction: 'incoming', status: 'answered', duration: 42, created_at: sql(300) },
            { id: 6, number: '555-3434', direction: 'outgoing', status: 'no_answer', created_at: sql(1500) },
            { id: 5, number: '555-2211', direction: 'incoming', status: 'answered', duration: 610, created_at: sql(3000) },
        ] }); break;
        case 'getConversations': reply({ action: 'setConversations', conversations: [
            { number: '555-0142', last_message: 'Brate jesi li slobodan večeras? Idemo do Vinewooda.', created_at: sql(5) },
            { number: '555-8830', last_message: 'Hvala ti puno za pomoć!', created_at: sql(95) },
            { number: '555-6123', last_message: 'Auto je spreman, možeš doći po njega.', created_at: sql(1600) },
        ] }); break;
        case 'getMessages': reply({ action: 'setMessages', number: body.number, messages: [
            { direction: 'in', body: 'Ćao, gde si?', created_at: sql(40) },
            { direction: 'out', body: 'Tu sam kod Legion Square-a', created_at: sql(38) },
            { direction: 'out', body: 'Šta ima?', created_at: sql(38) },
            { direction: 'in', body: 'Brate jesi li slobodan večeras? Idemo do Vinewooda.', created_at: sql(5) },
        ] }); break;
        case 'sendMessage': reply({ action: 'messageSent', message: { number: body.number, direction: 'out', body: body.body, created_at: sql(0) } }); break;
        case 'bankaGetInfo': reply({ action: 'bankaInfo', info: { name: 'Dušan Dimitrijević', bank: 185750, recent: [
            { type: 'transfer_in', party: 'Marko Petrović', memo: 'Za auto', amount: 45000, ts: now / 1000 - 3600 },
            { type: 'transfer_out', party: 'Stefan Jovanović', memo: 'Kirija', amount: 12500, ts: now / 1000 - 86400 * 2 },
        ], now: now / 1000, fee: 0, maxTransfer: 2000000, tierLabel: 'Premium', theme: 'dark' } }); break;
        case 'notesGet': reply({ action: 'notesList', notes: [
            { id: 1, title: 'Kupovina', body: 'Hleb\nMleko\nGorivo za auto', ts: now / 1000 - 3600 },
            { id: 2, title: 'Brojevi', body: 'Mehaničar - 555-7001', ts: now / 1000 - 86400 * 3 },
        ] }); break;
        case 'hospitalGetDutyStatus': reply({ action: 'hospitalDutyStatusResult', available: true, onDuty: 2 }); break;
        case 'policeGetDutyStatus': reply({ action: 'policeDutyStatusResult', available: true, onDuty: 4 }); break;
        case 'closePhone': setTimeout(() => handle({ action: 'openPhone' }), 800); break;
    }
}
if (!IN_GAME) window.addEventListener('DOMContentLoaded', () => {
    handle({ action: 'setPhoneNumber', number: '555-1212' });
    handle({ action: 'openPhone' });
    const q = new URLSearchParams(location.search);
    if (q.has('unlock') || q.has('app')) { $('lock-screen').classList.add('hidden-screen'); screenEl.classList.remove('locked'); }
    if (q.has('notif')) setTimeout(() => handle({ action: 'newMessage', number: '555-0142', message: { body: 'Brate jesi li slobodan večeras?', direction: 'in' } }), 50);
    if (q.get('app')) setTimeout(() => { openApp(q.get('app')); if (q.get('tab')) setPhoneTab(q.get('tab')); if (q.get('thread')) openThread(q.get('thread')); }, 80);
    if (q.has('call')) setTimeout(() => handle({ action: 'incomingCall', number: '555-0142' }), 100);
});
