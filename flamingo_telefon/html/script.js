/* =====================================================================
   FLAMINGO TELEFON 2.0 - iPhone stil
   Protokol prema igri je isti kao u staroj verziji (isti NUI pozivi
   i iste poruke), samo je ceo UI nov.
   ===================================================================== */
const $ = (id) => document.getElementById(id);
const wrapper = $('phone-wrapper');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '$' + Math.floor(Math.abs(Number(n) || 0)).toLocaleString('en-US');
const initials = (s) => String(s || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

function post(endpoint, body) {
    fetch(`https://${typeof GetParentResourceName === 'function' ? GetParentResourceName() : 'flamingo_telefon'}/${endpoint}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=UTF-8' }, body: JSON.stringify(body || {}),
    }).catch(() => {});
}

/* ---------------- Podešavanja (lokalno) ---------------- */
let photos = JSON.parse(localStorage.getItem('fl_photos') || '[]');
const SET = Object.assign({ wall: 1, ring: true, dnd: false, vol: 60 }, JSON.parse(localStorage.getItem('fl_phone') || '{}'));
const saveSet = () => localStorage.setItem('fl_phone', JSON.stringify(SET));
function applyWallpaper() {
    if (typeof SET.wall === 'string' && SET.wall.startsWith('photo:')) {
        const p = photos && photos[Number(SET.wall.split(':')[1])];
        if (p) { $('screen').style.backgroundImage = `url('${p.src}')`; return; }
        SET.wall = 1;
    }
    $('screen').style.backgroundImage = `url('img/wallpapers/w${SET.wall}.jpg')`;
}

/* ---------------- Sat ---------------- */
const DAYS = ['nedelja', 'ponedeljak', 'utorak', 'sreda', 'četvrtak', 'petak', 'subota'];
const MONTHS = ['januar', 'februar', 'mart', 'april', 'maj', 'jun', 'jul', 'avgust', 'septembar', 'oktobar', 'novembar', 'decembar'];
function tickClock() {
    const d = new Date();
    const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    $('clock').textContent = t; $('lock-clock').textContent = t;
    $('lock-date').textContent = `${DAYS[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}`;
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
        g.gain.value = (vol == null ? 0.05 : vol) * (SET.vol / 100);
        o.connect(g); g.connect(c.destination); o.start();
        o.stop(c.currentTime + dur);
    } catch (e) {}
}
let ringInterval = null;
function playRingtone() {
    if (!SET.ring || SET.dnd) return;
    stopRingtone();
    const seq = () => { beep(880, .18, .07); setTimeout(() => beep(1046, .18, .07), 200); };
    seq(); ringInterval = setInterval(seq, 1400);
}
function playRingback() { stopRingtone(); ringInterval = setInterval(() => beep(420, .35, .035), 2000); }
function stopRingtone() { if (ringInterval) clearInterval(ringInterval); ringInterval = null; }

/* ---------------- Navigacija ---------------- */
let currentApp = null;
const APP_IDS = ['phone', 'newcontact', 'messages', 'thread', 'newmsg', 'banka', 'li', 'usluge', 'taxi', 'med', 'pd', 'gallery', 'photo', 'notes', 'note', 'music', 'calc', 'settings'];
function goHome() {
    APP_IDS.forEach((a) => $('app-' + a).classList.add('hidden-screen'));
    $('home').classList.remove('hidden-screen');
    currentApp = null;
}
function openApp(name) {
    if (name === 'camera') { post('openCamera'); return; }
    if (name === 'contacts') { openApp('phone'); setPhoneTab('contacts'); return; }
    const el = $('app-' + name);
    if (!el) return;
    APP_IDS.forEach((a) => $('app-' + a).classList.add('hidden-screen'));
    $('home').classList.add('hidden-screen');
    el.classList.remove('hidden-screen');
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    currentApp = name;
    if (name === 'phone') { post('getContacts'); post('getCallHistory'); }
    if (name === 'messages') post('getConversations');
    if (name === 'banka') openBanka();
    if (name === 'taxi') { setTaxiState('idle'); $('taxi-idle-msg').textContent = ''; }
    if (name === 'med') openMed();
    if (name === 'pd') openPd();
    if (name === 'notes') post('notesGet');
    if (name === 'li') renderLiFeed();
    if (name === 'gallery') renderGallery();
    if (name === 'settings') { $('set-number').textContent = $('phone-number').textContent; renderWalls(); }
}
document.querySelectorAll('.app[data-app]').forEach((a) => a.addEventListener('click', () => openApp(a.dataset.app)));
document.querySelectorAll('[data-serv]').forEach((b) => b.addEventListener('click', () => openApp(b.dataset.serv)));
document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => openApp(b.dataset.back)));
document.querySelectorAll('[data-home]').forEach((b) => b.addEventListener('click', goHome));
$('home-indicator').addEventListener('click', () => { if (currentApp) goHome(); else closePhoneUI(); });

function closePhoneUI() {
    wrapper.classList.add('closing');
    setTimeout(() => { wrapper.classList.add('hidden'); wrapper.classList.remove('closing'); }, 220);
    post('closePhone');
}
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (currentApp) goHome(); else closePhoneUI(); } });

/* ---------------- Lock ---------------- */
function lockPhone() { $('lock-screen').classList.remove('hidden-screen', 'unlocking'); goHome(); renderLockNotifs(); }
$('lock-screen').addEventListener('click', (e) => {
    if (e.target.closest('#lock-cam')) { post('openCamera'); return; }
    if (e.target.closest('#lock-light')) return;
    const ls = $('lock-screen');
    ls.classList.add('unlocking');
    setTimeout(() => ls.classList.add('hidden-screen'), 380);
});
let lockNotifs = [];
function pushNotif(type, title, text) {
    lockNotifs.unshift({ type, title, text, at: Date.now() });
    lockNotifs = lockNotifs.slice(0, 6);
    renderLockNotifs();
    toast(type, title, text);
}
const NOTIF_IC = {
    msg: ['ic-msg', 'fa-comment'], call: ['ic-phone', 'fa-phone'], bank: ['ic-bank', 'fa-building-columns'],
    taxi: ['ic-taxi', 'fa-taxi'], med: ['ic-med', 'fa-kit-medical'], li: ['ic-li', 'fa-tower-broadcast'],
};
function renderLockNotifs() {
    $('lock-notifs').innerHTML = lockNotifs.map((n) => {
        const [cls, ic] = NOTIF_IC[n.type] || NOTIF_IC.msg;
        return `<div class="lock-notif"><div class="ic ${cls}"><i class="fa-solid ${ic}"></i></div><div><b>${esc(n.title)}</b><span>${esc(n.text)}</span></div></div>`;
    }).join('');
}
let toastT = null;
function toast(type, title, text) {
    const [cls, ic] = NOTIF_IC[type] || NOTIF_IC.msg;
    const el = $('toast');
    el.innerHTML = `<div class="ic ${cls}"><i class="fa-solid ${ic}"></i></div><div><b>${esc(title)}</b><span>${esc(text)}</span></div>`;
    el.classList.remove('hidden-screen');
    island(type, title);
    clearTimeout(toastT);
    toastT = setTimeout(() => el.classList.add('hidden-screen'), 3500);
    beep(1100, .08, .04);
}
function island(type, text) {
    const [cls, ic] = NOTIF_IC[type] || NOTIF_IC.msg;
    const isl = $('island');
    $('island-content').innerHTML = `<div class="island-ic ${cls}"><i class="fa-solid ${ic}"></i></div><span>${esc(text)}</span>`;
    isl.classList.add('expanded');
    setTimeout(() => isl.classList.remove('expanded'), 2600);
}

/* =====================================================================
   TELEFON (kontakti, pozivi, tastatura)
   ===================================================================== */
let contacts = [], callHistory = [];
const CALL_END_MESSAGES = {
    no_answer: 'Nema odgovora', missed: 'Propušten poziv', declined: 'Poziv je odbijen', declined_self: null,
    hangup: 'Sagovornik je prekinuo', hangup_self: null, disconnected: 'Sagovornik je izašao iz igre',
    invalid: 'Nevalidan broj.', self: 'Ne možeš zvati sebe.', not_registered: 'Ovaj broj ne postoji.',
    offline: 'Igrač trenutno nije dostupan.', busy: 'Broj je zauzet.', busy_self: 'Već pozivaš nekog.',
    no_sim: 'Nemaš aktivnu SIM karticu - prvo je aktiviraj.',
};
const CALL_STATUS_LABEL = { answered_outgoing: 'Odlazni', answered_incoming: 'Dolazni', missed: 'Propušten', no_answer: 'Nema odgovora', declined: 'Odbijen' };
const findContactName = (num) => (contacts.find((c) => c.number === num) || {}).name || null;
const parseSql = (s) => (s ? new Date(String(s).replace(' ', 'T')) : new Date());
const clock = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const dur = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function setPhoneTab(tab) {
    ['favorites', 'recents', 'contacts', 'keypad'].forEach((t) => $('tab-' + t).classList.toggle('hidden-screen', t !== tab));
    document.querySelectorAll('#phone-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    $('phone-title').textContent = { favorites: 'Omiljeni', recents: 'Nedavni', contacts: 'Kontakti', keypad: 'Tastatura' }[tab];
    $('phone-clear').classList.toggle('hidden-screen', tab !== 'recents');
    if (tab === 'favorites' || tab === 'contacts') renderContacts();
}
document.querySelectorAll('#phone-tabs button').forEach((b) => b.addEventListener('click', () => setPhoneTab(b.dataset.tab)));

function contactRow(c) {
    return `<div class="list-row" data-num="${esc(c.number)}" data-id="${c.id}">
        <div class="avatar">${esc(initials(c.name))}</div>
        <div class="row-main"><b>${esc(c.name)}</b><span>${esc(c.number)}</span></div>
        <div class="row-side">
            <button class="act fav" title="Omiljeni" style="color:${c.favorite ? 'var(--yellow)' : 'var(--faint)'}"><i class="fa-solid fa-star"></i></button>
            <button class="act msg" title="Poruka"><i class="fa-solid fa-comment"></i></button>
            <button class="act call" title="Pozovi" style="color:var(--green)"><i class="fa-solid fa-phone"></i></button>
        </div></div>`;
}
function renderContacts() {
    const q = ($('contact-search').value || '').toLowerCase();
    const list = contacts.filter((c) => !q || c.name.toLowerCase().includes(q) || c.number.includes(q))
        .sort((a, b) => a.name.localeCompare(b.name));
    $('contacts-list').innerHTML = list.map(contactRow).join('');
    $('contacts-empty').classList.toggle('hidden-screen', list.length > 0);
    const favs = contacts.filter((c) => c.favorite);
    $('fav-list').innerHTML = favs.map(contactRow).join('');
    $('fav-empty').classList.toggle('hidden-screen', favs.length > 0);
    $('newmsg-contacts').innerHTML = contacts.map((c) => `<div class="list-row" data-newmsg="${esc(c.number)}"><div class="avatar">${esc(initials(c.name))}</div><div class="row-main"><b>${esc(c.name)}</b><span>${esc(c.number)}</span></div></div>`).join('');
    bindContactRows();
}
function bindContactRows() {
    document.querySelectorAll('#contacts-list .list-row, #fav-list .list-row').forEach((row) => {
        const num = row.dataset.num, id = Number(row.dataset.id);
        const c = contacts.find((x) => x.id === id) || { number: num };
        row.querySelector('.fav').onclick = (e) => { e.stopPropagation(); post('toggleFavorite', { id }); };
        row.querySelector('.msg').onclick = (e) => { e.stopPropagation(); openThread(num); };
        row.querySelector('.call').onclick = (e) => { e.stopPropagation(); pendingCallNumber = num; post('callNumber', { id, number: num, name: c.name || null }); };
        row.oncontextmenu = (e) => { e.preventDefault(); post('deleteContact', { id }); };
    });
    document.querySelectorAll('[data-newmsg]').forEach((r) => r.onclick = () => openThread(r.dataset.newmsg));
}
$('contact-search').addEventListener('input', renderContacts);
$('add-contact-btn').addEventListener('click', () => { $('contact-name-input').value = ''; $('contact-number-input').value = ''; $('contact-modal-msg').textContent = ''; openApp('newcontact'); });
$('contact-number-input').addEventListener('input', (e) => {
    const d = e.target.value.replace(/\D/g, '').slice(0, 7);
    e.target.value = d.length > 3 ? `${d.slice(0, 3)}-${d.slice(3)}` : d;
});
$('contact-save-btn').addEventListener('click', () => {
    const name = $('contact-name-input').value.trim(), number = $('contact-number-input').value.trim();
    if (!name || number.length < 7) { $('contact-modal-msg').textContent = 'Unesi ime i broj (123-4567).'; return; }
    post('addContact', { name, number });
});

function callRow(call) {
    const bad = ['missed', 'no_answer', 'declined'].includes(call.status);
    const name = findContactName(call.number) || call.number;
    const sub = call.status === 'answered'
        ? `${CALL_STATUS_LABEL[call.direction === 'outgoing' ? 'answered_outgoing' : 'answered_incoming']} · ${dur(call.duration || 0)}`
        : (CALL_STATUS_LABEL[call.status] || '');
    return `<div class="list-row" data-call="${call.id}" data-num="${esc(call.number)}">
        <div class="avatar" style="${bad ? 'background:linear-gradient(160deg,#8a3030,#4a1414)' : ''}"><i class="fa-solid fa-${call.direction === 'outgoing' ? 'arrow-up-right-from-square' : 'phone-flip'}"></i></div>
        <div class="row-main"><b style="${bad ? 'color:var(--red)' : ''}">${esc(name)}</b><span>${esc(sub)}</span></div>
        <div class="row-side">${clock(parseSql(call.created_at))}<button class="act call" style="color:var(--green)"><i class="fa-solid fa-phone"></i></button></div></div>`;
}
function renderCallHistory() {
    $('calls-list').innerHTML = callHistory.map(callRow).join('');
    $('calls-empty').classList.toggle('hidden-screen', callHistory.length > 0);
    document.querySelectorAll('#calls-list .list-row').forEach((row) => {
        const num = row.dataset.num;
        row.querySelector('.call').onclick = (e) => { e.stopPropagation(); pendingCallNumber = num; post('callNumber', { id: null, number: num, name: null }); };
        row.oncontextmenu = (e) => { e.preventDefault(); post('deleteCallLog', { id: Number(row.dataset.call) }); };
    });
}
$('phone-clear').addEventListener('click', () => post('clearCallHistory'));

/* Tastatura */
let dialNumber = '';
const KEYS = [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['*', ''], ['0', '+'], ['#', '']];
$('keypad').innerHTML = KEYS.map(([n, s]) => `<button class="key" data-k="${n}"><b>${n}</b><span>${s}</span></button>`).join('');
function renderDial() {
    const d = dialNumber.replace(/\D/g, '');
    $('dial-display').textContent = d.length > 3 ? `${d.slice(0, 3)}-${d.slice(3, 7)}` : d;
}
document.querySelectorAll('.key').forEach((k) => k.addEventListener('click', () => {
    if (dialNumber.replace(/\D/g, '').length >= 7) return;
    dialNumber += k.dataset.k; beep(700 + KEYS.findIndex(([n]) => n === k.dataset.k) * 40, .07, .05); renderDial();
}));
$('dial-back').addEventListener('click', () => { dialNumber = dialNumber.slice(0, -1); renderDial(); });
$('dial-call').addEventListener('click', () => {
    const d = dialNumber.replace(/\D/g, '');
    if (d.length < 7) return;
    const formatted = `${d.slice(0, 3)}-${d.slice(3, 7)}`;
    pendingCallNumber = formatted;
    post('callNumber', { id: null, number: formatted, name: null });
});

/* Ekran poziva */
let callTimer = null, callStart = null, pendingCallNumber = null;
function openCallScreen(number, mode) {
    const name = findContactName(number) || 'Nepoznat broj';
    $('call-avatar').textContent = initials(name === 'Nepoznat broj' ? '?' : name);
    $('call-avatar').classList.add('ringing');
    $('call-name').textContent = name;
    $('call-number').textContent = number || '';
    $('call-status').textContent = mode === 'incoming' ? 'Dolazni poziv...' : 'Zovem...';
    $('call-actions-incoming').classList.toggle('hidden-screen', mode !== 'incoming');
    $('call-actions-active').classList.toggle('hidden-screen', mode === 'incoming');
    $('call-screen').classList.remove('hidden-screen');
    if (wrapper.classList.contains('hidden')) wrapper.classList.remove('hidden');
    $('lock-screen').classList.add('hidden-screen');
}
function closeCallScreen() {
    $('call-screen').classList.add('hidden-screen');
    $('call-avatar').classList.remove('ringing');
    if (callTimer) clearInterval(callTimer);
    callTimer = null;
}
['call-mute', 'call-speaker', 'call-hold'].forEach((id) => $(id).addEventListener('click', () => $(id).classList.toggle('on')));
$('answer-call-btn').addEventListener('click', () => { stopRingtone(); post('answerCall'); });
$('decline-call-btn').addEventListener('click', () => { stopRingtone(); post('declineCall'); closeCallScreen(); });
$('end-call-btn').addEventListener('click', () => { stopRingtone(); post('endCall'); closeCallScreen(); });

/* =====================================================================
   PORUKE
   ===================================================================== */
let conversations = [], threadMessages = [], currentThread = null;
function renderConversations() {
    $('conversations-list').innerHTML = conversations.map((c) => {
        const name = findContactName(c.number) || c.number;
        return `<div class="list-row" data-thread="${esc(c.number)}">
            <div class="avatar">${esc(initials(name))}</div>
            <div class="row-main"><b>${esc(name)}</b><span>${esc(c.last_message || '')}</span></div>
            <div class="row-side">${clock(parseSql(c.created_at))}</div></div>`;
    }).join('');
    $('conversations-empty').classList.toggle('hidden-screen', conversations.length > 0);
    document.querySelectorAll('[data-thread]').forEach((r) => r.onclick = () => openThread(r.dataset.thread));
}
function openThread(number) {
    currentThread = number;
    const name = findContactName(number) || number;
    $('thread-name').textContent = name;
    $('thread-avatar').textContent = initials(name);
    $('thread-messages').innerHTML = '';
    openApp('thread');
    post('getMessages', { number });
}
function bubble(m) {
    return `<div class="msg-bubble ${m.direction === 'out' ? 'sent' : 'received'}">${esc(m.body)}<span class="msg-time">${clock(parseSql(m.created_at))}</span></div>`;
}
function renderThread() {
    $('thread-messages').innerHTML = threadMessages.map(bubble).join('');
    const body = $('app-thread').querySelector('.app-body');
    body.scrollTop = body.scrollHeight;
}
$('thread-input').addEventListener('input', () => { $('thread-send').disabled = !$('thread-input').value.trim(); });
$('thread-send').addEventListener('click', () => {
    const body = $('thread-input').value.trim();
    if (!body || !currentThread) return;
    post('sendMessage', { number: currentThread, body });
    $('thread-input').value = ''; $('thread-send').disabled = true;
});
$('thread-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('thread-send').click(); });
$('thread-call').addEventListener('click', () => { if (currentThread) { pendingCallNumber = currentThread; post('callNumber', { id: null, number: currentThread, name: null }); } });
$('new-msg-btn').addEventListener('click', () => { $('newmsg-number').value = ''; openApp('newmsg'); });
$('newmsg-number').addEventListener('input', (e) => {
    const d = e.target.value.replace(/\D/g, '').slice(0, 7);
    e.target.value = d.length > 3 ? `${d.slice(0, 3)}-${d.slice(3)}` : d;
    if (d.length === 7) openThread(e.target.value);
});

/* =====================================================================
   BANKA
   ===================================================================== */
const bank = { info: null, amount: 0, busy: false };
function openBanka() {
    bank.amount = 0; bank.busy = false;
    $('banka-amount-txt').textContent = '0'; $('banka-target').value = ''; $('banka-memo').value = ''; $('banka-msg').textContent = '';
    $('banka-done').classList.add('hidden-screen');
    $('banka-balance').textContent = '...'; $('banka-holder').textContent = 'Učitavam račun...';
    post('bankaGetInfo');
}
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
    if (bank.info.maxTransfer && a > bank.info.maxTransfer) return `Najveći transfer je ${money(bank.info.maxTransfer)}.`;
    if (a + fee > bank.info.bank) return 'Nemaš dovoljno novca na računu.';
    return '';
}
function renderBank() {
    $('banka-amount-txt').textContent = bank.amount.toLocaleString('en-US');
    const err = bankProblem();
    $('banka-msg').textContent = err;
    $('banka-send').disabled = bank.busy || !bank.amount || !$('banka-target').value.trim() || !!err;
    $('banka-send-label').textContent = bank.busy ? 'Šaljem...' : `Pošalji ${money(bank.amount)}`;
    if (!bank.info) {
        $('banka-balance').textContent = '—'; $('banka-holder').textContent = 'Banka nije dostupna';
        $('banka-recent').innerHTML = '<div class="empty">Pokušaj kasnije.</div>';
        return;
    }
    $('banka-balance').textContent = money(bank.info.bank);
    $('banka-holder').textContent = (bank.info.name || '—').toUpperCase();
    const list = bank.info.recent || [];
    const when = (ts) => {
        const now = bank.info.now || Math.floor(Date.now() / 1000), d = Math.max(0, now - ts);
        if (d < 60) return 'upravo'; if (d < 3600) return `pre ${Math.floor(d / 60)} min`;
        if (d < 86400) return `pre ${Math.floor(d / 3600)}h`; return `pre ${Math.floor(d / 86400)}d`;
    };
    $('banka-recent').innerHTML = list.length ? list.map((t) => {
        const dir = t.type === 'transfer_in' ? 'in' : 'out';
        return `<div class="tx"><div class="tx-ic ${dir}"><i class="fa-solid fa-arrow-${dir === 'in' ? 'down' : 'up'}"></i></div>
            <div class="row-main"><b>${esc(t.party || (dir === 'in' ? 'Primljeno' : 'Poslato'))}</b><span>${esc(t.memo || '')}</span></div>
            <div class="tx-amt ${dir}">${dir === 'in' ? '+' : '-'}${money(t.amount)}<small>${when(t.ts)}</small></div></div>`;
    }).join('') : '<div class="empty">Još nema transakcija.</div>';
}
document.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => {
    const v = b.dataset.add;
    bank.amount = v === 'max' ? bankMax() : (v === 'clear' ? 0 : bank.amount + Number(v));
    renderBank();
}));
$('banka-target').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 5); renderBank(); });
$('banka-send').addEventListener('click', () => {
    if ($('banka-send').disabled) return;
    bank.busy = true; renderBank();
    post('bankaTransfer', { target: $('banka-target').value.trim(), amount: bank.amount, memo: $('banka-memo').value.trim() });
});
$('banka-done-btn').addEventListener('click', () => $('banka-done').classList.add('hidden-screen'));

/* =====================================================================
   LIFEINVADER
   ===================================================================== */
let liFeed = JSON.parse(localStorage.getItem('fl_li') || '[]');
function renderLiFeed() {
    $('li-feed').innerHTML = liFeed.length ? liFeed.map((p) => `
        <div class="li-post"><div class="who"><div class="avatar">${esc(initials($('phone-number').textContent))}</div><div><b>${esc($('phone-number').textContent)}</b></div></div>
        <p>${esc(p.text)}</p><div class="when">${new Date(p.at).toLocaleString('sr-Latn-RS')}</div></div>`).join('')
        : '<div class="empty"><i class="fa-solid fa-tower-broadcast"></i>Još nisi objavio oglas</div>';
}
$('oglasnik-input').addEventListener('input', (e) => { $('li-count').textContent = e.target.value.length; });
$('oglasnik-submit-btn').addEventListener('click', () => {
    const content = $('oglasnik-input').value.trim();
    if (!content) return;
    post('oglasnikSubmit', { content });
    liFeed.unshift({ text: content, at: Date.now() }); liFeed = liFeed.slice(0, 20);
    localStorage.setItem('fl_li', JSON.stringify(liFeed));
    $('oglasnik-input').value = ''; $('li-count').textContent = '0';
    const msg = $('oglasnik-status-msg');
    msg.textContent = 'Oglas poslat!'; msg.style.opacity = '1';
    setTimeout(() => { msg.style.opacity = '0'; }, 2500);
    renderLiFeed();
});

/* =====================================================================
   TAXI
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
const TAXI_STATES = ['idle', 'waiting', 'accepted', 'destination', 'driving'];
function setTaxiState(name) {
    TAXI_STATES.forEach((s) => $('taxi-state-' + s).classList.toggle('hidden-screen', s !== name));
    $('taxi-radar').classList.toggle('hidden-screen', name !== 'waiting' && name !== 'accepted');
    if (name === 'destination') renderTaxiDest();
}
function renderTaxiDest() {
    $('taxi-destination-list').innerHTML = TAXI_DESTINATIONS.map((d, i) => `<button class="dest-btn" data-dest="${i}"><i class="fa-solid fa-location-dot"></i> ${esc(d.label)}</button>`).join('');
    document.querySelectorAll('[data-dest]').forEach((b) => b.onclick = () => {
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
   HITNA
   ===================================================================== */
function setMedState(name) {
    ['idle', 'sending', 'sent', 'failed'].forEach((s) => $('doktor-state-' + s).classList.toggle('hidden-screen', s !== name));
}
function openMed() {
    setMedState('idle');
    $('doktor-reason-input').value = ''; $('doktor-call-btn').disabled = true; $('doktor-idle-msg').textContent = '';
    $('doktor-duty-badge').className = 'duty-badge'; $('doktor-duty-text').textContent = 'Proveravam dežurne...';
    post('hospitalGetDutyStatus');
}
$('doktor-reason-input').addEventListener('input', (e) => { $('doktor-call-btn').disabled = !e.target.value.trim(); });
$('doktor-call-btn').addEventListener('click', () => { setMedState('sending'); post('hospitalCallDoctor', { reason: $('doktor-reason-input').value.trim() }); });
$('doktor-sent-ok-btn').addEventListener('click', goHome);
$('doktor-failed-back-btn').addEventListener('click', () => setMedState('idle'));

/* =====================================================================
   POLICIJA (flamingo_policija)
   ===================================================================== */
function setPdState(name) {
    ['idle', 'sending', 'sent', 'failed'].forEach((s) => $('pd-state-' + s).classList.toggle('hidden-screen', s !== name));
}
function openPd() {
    setPdState('idle');
    $('pd-reason-input').value = ''; $('pd-call-btn').disabled = true; $('pd-idle-msg').textContent = '';
    document.querySelectorAll('#pd-quick button').forEach((b) => b.classList.remove('on'));
    $('pd-duty-badge').className = 'duty-badge'; $('pd-duty-text').textContent = 'Proveravam dežurne...';
    post('policeGetDutyStatus');
}
$('pd-reason-input').addEventListener('input', (e) => { $('pd-call-btn').disabled = !e.target.value.trim(); });
document.querySelectorAll('#pd-quick button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('#pd-quick button').forEach((x) => x.classList.toggle('on', x === b));
    const inp = $('pd-reason-input');
    inp.value = b.dataset.q + (inp.value && !inp.value.startsWith(b.dataset.q) ? ' - ' + inp.value : '');
    $('pd-call-btn').disabled = false;
}));
$('pd-call-btn').addEventListener('click', () => { setPdState('sending'); post('policeCall', { reason: $('pd-reason-input').value.trim() }); });
$('pd-sent-ok-btn').addEventListener('click', goHome);
$('pd-failed-back-btn').addEventListener('click', () => setPdState('idle'));

/* =====================================================================
   BELEŠKE
   ===================================================================== */
let notes = [], currentNote = null;
function renderNotes() {
    $('notes-list').innerHTML = notes.map((n) => `<div class="list-row" data-note="${n.id}">
        <div class="avatar ic-notes" style="border-radius:10px"><i class="fa-solid fa-note-sticky"></i></div>
        <div class="row-main"><b>${esc(n.title || 'Bez naslova')}</b><span>${esc((n.body || '').slice(0, 40))}</span></div>
        <div class="row-side">${n.ts ? new Date(n.ts * 1000).toLocaleDateString('sr-Latn-RS') : ''}</div></div>`).join('');
    $('notes-empty').classList.toggle('hidden-screen', notes.length > 0);
    document.querySelectorAll('[data-note]').forEach((r) => r.onclick = () => {
        currentNote = notes.find((n) => n.id === Number(r.dataset.note));
        $('note-title').value = currentNote.title || ''; $('note-body').value = currentNote.body || '';
        openApp('note');
    });
}
$('note-new').addEventListener('click', () => { currentNote = null; $('note-title').value = ''; $('note-body').value = ''; openApp('note'); });
$('note-save').addEventListener('click', () => {
    post('notesSave', { id: currentNote ? currentNote.id : null, title: $('note-title').value.trim(), body: $('note-body').value });
    openApp('notes');
});
$('note-delete').addEventListener('click', () => { if (currentNote) post('notesDelete', { id: currentNote.id }); openApp('notes'); });

/* =====================================================================
   GALERIJA (slike iz kamere, čuvaju se lokalno na tvom računaru)
   ===================================================================== */
const savePhotos = () => { try { localStorage.setItem('fl_photos', JSON.stringify(photos)); } catch (e) { photos = photos.slice(0, 12); localStorage.setItem('fl_photos', JSON.stringify(photos)); } };
let currentPhoto = null;
function renderGallery() {
    $('gal-grid').innerHTML = photos.map((p, i) => `<div class="gal-item" data-photo="${i}" style="background-image:url('${p.src}')"></div>`).join('');
    $('gal-empty').classList.toggle('hidden-screen', photos.length > 0);
    document.querySelectorAll('[data-photo]').forEach((el) => el.onclick = () => {
        currentPhoto = Number(el.dataset.photo);
        $('photo-view').src = photos[currentPhoto].src;
        openApp('photo');
    });
}
$('gal-cam').addEventListener('click', () => post('openCamera'));
$('photo-del').addEventListener('click', () => { if (currentPhoto != null) { photos.splice(currentPhoto, 1); savePhotos(); } openApp('gallery'); });
$('photo-wall').addEventListener('click', () => {
    if (currentPhoto == null) return;
    SET.wall = 'photo:' + currentPhoto; saveSet(); applyWallpaper();
    toast('msg', 'Galerija', 'Slika je postavljena kao pozadina');
});
// smanji sliku pre čuvanja (da localStorage ne pukne)
function storePhoto(dataUrl) {
    const img = new Image();
    img.onload = () => {
        const w = 720, h = Math.round(img.height * w / img.width);
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        photos.unshift({ src: c.toDataURL('image/jpeg', 0.6), at: Date.now() });
        photos = photos.slice(0, 24);
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
    { name: 'Flamingo FM', sub: 'Dance / House', url: 'https://ice1.somafm.com/beatblender-128-mp3' },
    { name: 'Chill Lounge', sub: 'Lo-fi / Chill', url: 'https://ice1.somafm.com/groovesalad-128-mp3' },
    { name: 'Rock Radio', sub: 'Rock klasici', url: 'https://ice1.somafm.com/bagel-128-mp3' },
    { name: 'Hip Hop', sub: 'Rap / Trap', url: 'https://ice1.somafm.com/seventies-128-mp3' },
    { name: 'Jazz Cafe', sub: 'Jazz / Soul', url: 'https://ice1.somafm.com/sonicuniverse-128-mp3' },
];
const audio = new Audio(); audio.volume = 0.45;
let stationIdx = -1;
function renderStations() {
    $('music-list').innerHTML = STATIONS.map((s, i) => `<div class="list-row" data-st="${i}">
        <div class="avatar ic-music" style="border-radius:10px"><i class="fa-solid fa-tower-cell"></i></div>
        <div class="row-main"><b>${esc(s.name)}</b><span>${esc(s.sub)}</span></div>
        <div class="row-side">${i === stationIdx ? '<i class="fa-solid fa-volume-high" style="color:var(--pink)"></i>' : '<i class="fa-solid fa-play"></i>'}</div></div>`).join('');
    document.querySelectorAll('[data-st]').forEach((r) => r.onclick = () => playStation(Number(r.dataset.st)));
}
function playStation(i) {
    stationIdx = i;
    const s = STATIONS[i];
    audio.src = s.url; audio.play().catch(() => {});
    $('music-title').textContent = s.name; $('music-sub').textContent = s.sub;
    $('music-play').innerHTML = '<i class="fa-solid fa-pause"></i>';
    $('music-cover').classList.add('spin');
    renderStations();
}
$('music-play').addEventListener('click', () => {
    if (!audio.src) { playStation(0); return; }
    if (audio.paused) { audio.play().catch(() => {}); $('music-play').innerHTML = '<i class="fa-solid fa-pause"></i>'; $('music-cover').classList.add('spin'); }
    else { audio.pause(); $('music-play').innerHTML = '<i class="fa-solid fa-play"></i>'; $('music-cover').classList.remove('spin'); }
});
$('music-prev').addEventListener('click', () => playStation((stationIdx - 1 + STATIONS.length) % STATIONS.length));
$('music-next').addEventListener('click', () => playStation((stationIdx + 1) % STATIONS.length));
$('music-vol').addEventListener('input', (e) => { audio.volume = e.target.value / 100; });
$('music-url-play').addEventListener('click', () => {
    const url = $('music-url').value.trim();
    if (!url) return;
    stationIdx = -1; audio.src = url; audio.play().catch(() => {});
    $('music-title').textContent = 'Tvoj link'; $('music-sub').textContent = url.slice(0, 40);
    $('music-play').innerHTML = '<i class="fa-solid fa-pause"></i>'; $('music-cover').classList.add('spin');
    renderStations();
});
renderStations();

/* =====================================================================
   KALKULATOR
   ===================================================================== */
(() => {
    const keys = [['C', 'fn'], ['±', 'fn'], ['%', 'fn'], ['÷', 'op'], ['7', ''], ['8', ''], ['9', ''], ['×', 'op'],
        ['4', ''], ['5', ''], ['6', ''], ['−', 'op'], ['1', ''], ['2', ''], ['3', ''], ['+', 'op'], ['0', 'zero'], [',', ''], ['=', 'op']];
    $('calc-grid').innerHTML = keys.map(([k, c]) => `<button class="${c}" data-c="${k}">${k}</button>`).join('');
    let cur = '0', prev = null, op = null, fresh = true;
    const show = () => { $('calc-display').textContent = cur.length > 9 ? Number(cur).toExponential(4) : cur; };
    const calc = () => {
        const a = parseFloat(prev), b = parseFloat(cur);
        const r = op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : a / b;
        return String(Math.round(r * 1e6) / 1e6);
    };
    document.querySelectorAll('#calc-grid button').forEach((b) => b.addEventListener('click', () => {
        const k = b.dataset.c;
        if (/[0-9]/.test(k)) { cur = fresh || cur === '0' ? k : cur + k; fresh = false; }
        else if (k === ',') { if (!cur.includes('.')) cur += '.'; fresh = false; }
        else if (k === 'C') { cur = '0'; prev = null; op = null; fresh = true; }
        else if (k === '±') cur = String(-parseFloat(cur));
        else if (k === '%') cur = String(parseFloat(cur) / 100);
        else if (k === '=') { if (op && prev !== null) { cur = calc(); op = null; prev = null; fresh = true; } }
        else { if (op && prev !== null && !fresh) cur = calc(); prev = cur; op = k; fresh = true; }
        show();
    }));
    show();
})();

/* =====================================================================
   PODEŠAVANJA
   ===================================================================== */
function renderWalls() {
    $('wall-grid').innerHTML = Array.from({ length: 8 }, (_, i) =>
        `<div class="wall ${SET.wall === i ? 'on' : ''}" data-wall="${i}" style="background-image:url('img/wallpapers/t${i}.jpg')"></div>`).join('');
    document.querySelectorAll('[data-wall]').forEach((w) => w.onclick = () => { SET.wall = Number(w.dataset.wall); saveSet(); applyWallpaper(); renderWalls(); });
    $('sw-ring').classList.toggle('on', SET.ring);
    $('sw-dnd').classList.toggle('on', SET.dnd);
    $('set-vol').value = SET.vol;
}
$('sw-ring').addEventListener('click', () => { SET.ring = !SET.ring; saveSet(); renderWalls(); });
$('sw-dnd').addEventListener('click', () => { SET.dnd = !SET.dnd; saveSet(); renderWalls(); });
$('set-vol').addEventListener('input', (e) => { SET.vol = Number(e.target.value); saveSet(); });

/* =====================================================================
   SIM
   ===================================================================== */
$('sim-number-input').addEventListener('input', (e) => {
    const d = e.target.value.replace(/\D/g, '').slice(0, 7);
    e.target.value = d.length > 3 ? `${d.slice(0, 3)}-${d.slice(3)}` : d;
});
$('sim-generate-btn').addEventListener('click', () => { $('sim-status-msg').textContent = 'Tražim slobodan broj...'; post('requestRandomNumber'); });
$('sim-submit-btn').addEventListener('click', () => {
    const number = $('sim-number-input').value.trim();
    if (number.replace(/\D/g, '').length !== 7) { $('sim-status-msg').textContent = 'Broj mora imati 7 cifara.'; return; }
    $('sim-status-msg').textContent = 'Proveravam dostupnost...';
    post('submitPhoneNumber', { number });
});

/* =====================================================================
   PORUKE IZ IGRE
   ===================================================================== */
window.addEventListener('message', (e) => {
    const d = e.data || {};
    switch (d.action) {
        case 'openPhone':
            wrapper.classList.remove('hidden', 'closing');
            applyWallpaper(); lockPhone(); post('getContacts'); post('getCallHistory');
            break;
        case 'closePhone': wrapper.classList.add('hidden'); break;
        case 'setPhoneNumber': $('phone-number').textContent = d.number || '---'; $('set-number').textContent = d.number || '---'; break;
        case 'openSimSetup': wrapper.classList.remove('hidden'); $('lock-screen').classList.add('hidden-screen'); $('sim-setup').classList.remove('hidden-screen'); break;
        case 'randomNumberResult':
            if (d.number) { $('sim-number-input').value = d.number; $('sim-status-msg').textContent = ''; }
            else $('sim-status-msg').textContent = 'Nema slobodnog broja, probaj ručno.';
            break;
        case 'simResult':
            $('sim-status-msg').style.color = d.success ? 'var(--green)' : 'var(--orange)';
            $('sim-status-msg').textContent = d.success ? `Broj aktiviran: ${d.data}` : d.data;
            if (d.success) { $('phone-number').textContent = d.data; setTimeout(() => $('sim-setup').classList.add('hidden-screen'), 1400); }
            break;

        case 'setContacts': contacts = d.contacts || []; renderContacts(); break;
        case 'contactAdded':
            if (d.success) { contacts.push(d.contact); renderContacts(); openApp('phone'); setPhoneTab('contacts'); }
            else $('contact-modal-msg').textContent = d.message;
            break;
        case 'contactDeleted': contacts = contacts.filter((c) => c.id !== d.id); renderContacts(); break;
        case 'favoriteToggled': { const c = contacts.find((x) => x.id === d.id); if (c) c.favorite = d.favorite; renderContacts(); break; }

        case 'setCallHistory': callHistory = d.calls || []; renderCallHistory(); break;
        case 'callHistoryCleared': callHistory = []; renderCallHistory(); break;

        case 'outgoingCall': openCallScreen(d.number, 'outgoing'); playRingback(); break;
        case 'incomingCall':
            openCallScreen(d.number, 'incoming'); playRingtone();
            pushNotif('call', 'Dolazni poziv', findContactName(d.number) || d.number);
            break;
        case 'callConnected':
            stopRingtone();
            $('call-avatar').classList.remove('ringing');
            $('call-actions-incoming').classList.add('hidden-screen');
            $('call-actions-active').classList.remove('hidden-screen');
            callStart = Date.now();
            $('call-status').textContent = '00:00';
            callTimer = setInterval(() => { $('call-status').textContent = dur(Math.floor((Date.now() - callStart) / 1000)); }, 1000);
            break;
        case 'callEnded': {
            stopRingtone(); if (callTimer) clearInterval(callTimer);
            const msg = CALL_END_MESSAGES[d.reason];
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
            const msg = CALL_END_MESSAGES[d.reason] || 'Poziv nije uspeo.';
            openCallScreen(pendingCallNumber || '', 'outgoing');
            $('call-actions-incoming').classList.add('hidden-screen');
            $('call-actions-active').classList.add('hidden-screen');
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
            if (d.number === currentThread) { threadMessages.push(d.message); renderThread(); }
            else pushNotif('msg', findContactName(d.number) || d.number, (d.message && d.message.body) || 'Nova poruka');
            if (currentApp === 'messages') post('getConversations');
            break;

        case 'bankaInfo': bank.info = d.info || null; renderBank(); break;
        case 'bankaTransferResult': {
            const r = d.result || {};
            bank.busy = false;
            if (r.ok) {
                if (r.info) bank.info = r.info;
                $('banka-done-amount').textContent = money(r.amount);
                $('banka-done').classList.remove('hidden-screen');
                bank.amount = 0; $('banka-target').value = ''; $('banka-memo').value = '';
                pushNotif('bank', 'Banka', `Poslato ${money(r.amount)}`);
            } else $('banka-msg').textContent = r.msg || 'Transfer nije uspeo.';
            renderBank();
            break;
        }

        case 'taxiStatus': {
            const s = d.status;
            if (['waiting', 'accepted', 'in_taxi'].includes(s)) {
                setTaxiState(s === 'in_taxi' ? 'destination' : s);
                if (s === 'accepted') pushNotif('taxi', 'Taxi', 'Vozač je prihvatio poziv!');
                if (s === 'in_taxi') pushNotif('taxi', 'Taxi', 'Izaberi destinaciju');
            } else if (s === 'finished') { setTaxiState('idle'); $('taxi-idle-msg').textContent = 'Vožnja završena. Hvala!'; }
            else if (s === 'cancelled') { setTaxiState('idle'); $('taxi-idle-msg').textContent = 'Otkazao si poziv.'; }
            else if (s === 'driver_cancelled') { setTaxiState('idle'); $('taxi-idle-msg').textContent = 'Vozač je otkazao vožnju.'; pushNotif('taxi', 'Taxi', 'Vozač je otkazao vožnju'); }
            else if (TAXI_MSG[s]) { setTaxiState('idle'); $('taxi-idle-msg').textContent = TAXI_MSG[s]; }
            break;
        }
        case 'taxiOpenDestinationPicker': openApp('taxi'); setTaxiState('destination'); break;
        case 'taxiDestinationConfirmed': setTaxiState('driving'); break;

        case 'hospitalDutyStatusResult': {
            const badge = $('doktor-duty-badge');
            if (!d.available) { badge.className = 'duty-badge offline'; $('doktor-duty-text').textContent = 'Servis nije dostupan.'; }
            else if (d.onDuty > 0) { badge.className = 'duty-badge online'; $('doktor-duty-text').textContent = `${d.onDuty} ${d.onDuty === 1 ? 'doktor' : 'doktora'} na dužnosti`; }
            else { badge.className = 'duty-badge offline'; $('doktor-duty-text').textContent = 'Nema doktora na dužnosti'; }
            break;
        }
        case 'hospitalCallResult':
            if (d.success) { $('doktor-sent-msg').innerHTML = `<b>Poziv poslat!</b><br>Obavešteno je ${d.notified} ${d.notified === 1 ? 'doktor' : 'doktora'}. Sačekaj na lokaciji.`; setMedState('sent'); }
            else { $('doktor-failed-msg').innerHTML = d.reason === 'cooldown' ? 'Prečesto zoveš - sačekaj malo.' : 'Trenutno nema doktora na dužnosti.'; setMedState('failed'); }
            break;

        case 'policeDutyStatusResult': {
            const badge = $('pd-duty-badge');
            if (!d.available) { badge.className = 'duty-badge offline'; $('pd-duty-text').textContent = 'Servis nije dostupan.'; }
            else if (d.onDuty > 0) { badge.className = 'duty-badge online'; $('pd-duty-text').textContent = `${d.onDuty} ${d.onDuty === 1 ? 'policajac' : 'policajaca'} na dužnosti`; }
            else { badge.className = 'duty-badge offline'; $('pd-duty-text').textContent = 'Nema policajaca na dužnosti'; }
            break;
        }
        case 'policeCallResult':
            if (d.success) { $('pd-sent-msg').innerHTML = `<b>Prijava poslata!</b><br>Obavešteno je ${d.notified} ${d.notified === 1 ? 'policajac' : 'policajaca'}. Ostani na bezbednom mestu.`; setPdState('sent'); }
            else { $('pd-failed-msg').innerHTML = d.reason === 'cooldown' ? 'Već si poslao prijavu - sačekaj malo.' : (d.reason === 'unavailable' ? 'Servis nije dostupan.' : 'Trenutno nema policajaca na dužnosti.'); setPdState('failed'); }
            break;

        case 'notesList': notes = d.notes || []; renderNotes(); break;
        case 'noteSaved':
            if (d.note && d.note.error === 'limit') { toast('msg', 'Beleške', 'Dostigao si limit beleški.'); break; }
            post('notesGet'); break;
        case 'noteDeleted': notes = notes.filter((n) => n.id !== d.id); renderNotes(); break;

        case 'cameraMode':
            $('camera-screen').classList.toggle('hidden', !d.on);
            wrapper.classList.toggle('hidden', !!d.on);
            break;
        case 'photoTaken': if (d.data) { storePhoto(d.data); camToast('Slika sačuvana u Galeriju'); } break;
        case 'photoFailed': camToast('Slika nije sačuvana (fali screenshot-basic)'); break;
        case 'cameraShot':
            $('cam-flash').classList.remove('on'); void $('cam-flash').offsetWidth; $('cam-flash').classList.add('on');
            break;
    }
});

applyWallpaper();
