/* ============================================================
   flamingo_banke – NUI
   ============================================================ */
const RES = typeof GetParentResourceName === 'function' ? GetParentResourceName() : 'flamingo_banke';
const IN_GAME = !!window.invokeNative;

const I = {
    bank: '<path d="M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    swap: '<path d="M4 8h15l-4-4M20 16H5l4 4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    in: '<path d="M17 7L7 17M7 9v8h8"/>',
    out: '<path d="M7 17L17 7M9 7h8v8"/>',
    deposit: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>',
    withdraw: '<path d="M12 20V9M7 14l5-5 5 5M4 4h16"/>',
    send: '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/>',
    trend: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
    trendDown: '<path d="M3 7l6 6 4-4 8 8M15 17h6v-6"/>',
    wallet: '<path d="M3 7a2 2 0 012-2h13v4"/><path d="M3 7v10a2 2 0 002 2h15V9H5a2 2 0 01-2-2z"/><path d="M16 14h.01"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    hash: '<path d="M5 9h14M5 15h14M10 3L8 21M16 3l-2 18"/>',
    check: '<path d="M5 12l5 5L20 7"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
    fine: '<path d="M6 2h10l4 4v16H6z"/><path d="M9 8h8M9 12h8M9 16h5"/>'
};
const icon = (n) => `<svg class="ic" viewBox="0 0 24 24">${I[n] || ''}</svg>`;

const TYPES = {
    deposit:      { label: 'Uplata',    dir: 'in'  },
    withdraw:     { label: 'Podizanje', dir: 'out' },
    transfer_in:  { label: 'Primljeno', dir: 'in'  },
    transfer_out: { label: 'Poslato',   dir: 'out' },
    income:       { label: 'Prihod',    dir: 'in'  },
    expense:      { label: 'Rashod',    dir: 'out' },
    fee:          { label: 'Provizija', dir: 'out' }
};
const FILTERS = [
    { id: 'all',          label: 'Sve' },
    { id: 'deposit',      label: 'Uplata' },
    { id: 'withdraw',     label: 'Podizanje' },
    { id: 'transfer_in',  label: 'Primljeno' },
    { id: 'transfer_out', label: 'Poslato' },
    { id: 'other',        label: 'Ostalo' }
];
const MODES = {
    deposit:  { title: 'Uplata',    sub: 'Gotovina na račun', icon: 'deposit',  verb: 'Uplati'  },
    withdraw: { title: 'Podizanje', sub: 'Račun u gotovinu',  icon: 'withdraw', verb: 'Podigni' },
    transfer: { title: 'Transfer',  sub: 'Pošalji igraču',    icon: 'send',     verb: 'Pošalji' }
};

const state = {
    data: null,
    cfg: {},
    view: 'overview',
    filter: 'all',
    search: '',
    mode: 'deposit',
    amount: 0,
    target: '',
    memo: '',
    busy: false,
    fines: [],
    finesLoaded: false,
    finesBusy: false
};

/* ---------------- helpers ---------------- */
const $ = (s) => document.querySelector(s);
// 240000 -> "240.000$" (isto kao u ostalim Flamingo skriptama)
const money = (n) => Math.floor(Math.abs(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '$';
const short = (n) => n >= 1e6 ? (n / 1e6).toFixed(n % 1e6 ? 1 : 0) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(n);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dirOf = (t) => (TYPES[t.type] || { dir: 'in' }).dir;
const labelOf = (t) => (TYPES[t.type] || { label: t.type }).label;

function when(ts) {
    const diff = Math.max(0, (state.data.now || Date.now() / 1000) - ts);
    if (diff < 60) return 'upravo';
    if (diff < 3600) return `pre ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `pre ${Math.floor(diff / 3600)}h`;
    if (diff < 86400 * 7) return `pre ${Math.floor(diff / 86400)}d`;
    const d = new Date(ts * 1000);
    return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}.`;
}

function post(name, body) {
    return fetch(`https://${RES}/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(body || {})
    }).then((r) => r.json()).catch(() => null);
}

let toastTimer;
function toast(msg, ok = true) {
    // U igri sve notifikacije idu preko esx_notify (client.lua). Ovo je samo za demo u browseru.
    if (IN_GAME) return;
    const el = $('#toast');
    el.className = 'toast show' + (ok ? '' : ' err');
    el.innerHTML = icon(ok ? 'check' : 'alert') + `<span>${esc(msg)}</span>`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

/* ---------------- header ---------------- */
function renderHeader() {
    const d = state.data;
    $('#balBank').textContent = money(d.bank);
    $('#balCash').textContent = money(d.cash);
    $('#acctPlace').textContent = d.kind === 'atm' ? 'Bankomat' : (d.place || 'Banka');
    $('.bank').classList.toggle('is-atm', isAtm());
    $('#brandSub').textContent = isAtm() ? 'Bankomat' : 'Banka';
    const parts = String(d.name || '').trim().split(/\s+/);
    $('#meName').textContent = d.name || '-';
    $('#avatar').textContent = ((parts[0] || '-')[0] + (parts[1] || '-')[0]).toUpperCase();
    document.querySelectorAll('.nav-btn[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === state.view));
    document.querySelectorAll('.nav-btn[data-atm-mode]').forEach((b) => b.classList.toggle('active', b.dataset.atmMode === state.mode));
}

/* ---------------- statistika ---------------- */
function periodTx() {
    const from = state.data.now - (state.cfg.statsDays || 30) * 86400;
    return state.data.transactions.filter((t) => t.ts >= from);
}

function txRow(t) {
    const dir = dirOf(t);
    return `
    <div class="tx">
        <div class="tx-ic ${dir}">${icon(dir)}</div>
        <div class="tx-t"><strong>${esc(t.title)}</strong><span>${esc(t.memo || '—')}</span></div>
        <div class="tx-party">${esc(t.party || '—')}</div>
        <div class="pill">${esc(labelOf(t))}</div>
        <div class="amt ${dir}">${dir === 'in' ? '+' : '-'}${money(t.amount)}</div>
        <div class="when">${when(t.ts)}</div>
    </div>`;
}

const txHead = `
    <div class="tx tx-head">
        <div></div><div>Opis</div><div class="h-party">Strana</div><div class="h-type">Tip</div>
        <div class="r">Iznos</div><div class="r">Kada</div>
    </div>`;

function niceMax(v) {
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function chartSVG(txs) {
    const days = state.cfg.statsDays || 30;
    const W = 620, H = 200, L = 36, R = 8, T = 10, B = 22;
    const today = new Date(state.data.now * 1000); today.setHours(0, 0, 0, 0);
    const start = today.getTime() / 1000 - (days - 1) * 86400;

    const inA = new Array(days).fill(0), outA = new Array(days).fill(0);
    txs.forEach((t) => {
        const i = Math.floor((t.ts - start) / 86400);
        if (i >= 0 && i < days) (dirOf(t) === 'in' ? inA : outA)[i] += t.amount;
    });

    const max = niceMax(Math.max(1000, ...inA, ...outA));
    const x = (i) => L + (i * (W - L - R)) / (days - 1);
    const y = (v) => H - B - (v / max) * (H - B - T);

    const line = (a) => a.map((v, i) => {
        if (i === 0) return `M${x(0)},${y(v)}`;
        const mx = (x(i - 1) + x(i)) / 2;
        return `C${mx},${y(a[i - 1])} ${mx},${y(v)} ${x(i)},${y(v)}`;
    }).join(' ');
    const area = (a) => `${line(a)} L${x(days - 1)},${y(0)} L${x(0)},${y(0)} Z`;

    let grid = '';
    for (let k = 0; k <= 5; k++) {
        const v = (max / 5) * k;
        grid += `<line class="grid-l" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/>`;
        grid += `<text class="ax" x="${L - 6}" y="${y(v) + 3}" text-anchor="end">${short(v)}</text>`;
    }
    let labels = '';
    for (let i = 0; i < days; i += Math.ceil(days / 10)) {
        const d = new Date((start + i * 86400) * 1000);
        labels += `<text class="ax" x="${x(i)}" y="${H - 6}" text-anchor="middle">${d.getDate()}.${d.getMonth() + 1}.</text>`;
    }

    return `
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Primljen i potrošen novac po danima">
        <defs>
            <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3ddc97" stop-opacity=".35"/><stop offset="1" stop-color="#3ddc97" stop-opacity="0"/></linearGradient>
            <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6a3d" stop-opacity=".30"/><stop offset="1" stop-color="#ff6a3d" stop-opacity="0"/></linearGradient>
        </defs>
        ${grid}
        <path d="${area(outA)}" fill="url(#gOut)"/>
        <path d="${line(outA)}" fill="none" stroke="#ff6a3d" stroke-width="1.8"/>
        <path d="${area(inA)}" fill="url(#gIn)"/>
        <path d="${line(inA)}" fill="none" stroke="#3ddc97" stroke-width="1.8"/>
        ${labels}
    </svg>`;
}

function donutSVG(bank, cash) {
    const total = bank + cash;
    const r = 52, c = 2 * Math.PI * r;
    const bankLen = total > 0 ? (bank / total) * c : 0;
    const gap = bank > 0 && cash > 0 ? 3 : 0;
    return `
    <svg width="150" height="150" viewBox="0 0 150 150">
        <circle cx="75" cy="75" r="${r}" fill="none" stroke="rgba(255,255,255,.05)" stroke-width="16"/>
        ${cash > 0 ? `<circle cx="75" cy="75" r="${r}" fill="none" stroke="#7a1d45" stroke-width="16"
            stroke-dasharray="${Math.max(0, c - bankLen - gap)} ${c}" stroke-dashoffset="${-(bankLen + gap / 2)}" transform="rotate(-90 75 75)"/>` : ''}
        ${bank > 0 ? `<circle cx="75" cy="75" r="${r}" fill="none" stroke="#ff2f7e" stroke-width="16"
            stroke-dasharray="${Math.max(0, bankLen - gap)} ${c}" stroke-dashoffset="${-gap / 2}" transform="rotate(-90 75 75)"/>` : ''}
    </svg>`;
}

/* ---------------- Pregled ---------------- */
function renderOverview() {
    const d = state.data;
    const txs = periodTx();
    const inSum = txs.filter((t) => dirOf(t) === 'in').reduce((s, t) => s + t.amount, 0);
    const outSum = txs.filter((t) => dirOf(t) === 'out').reduce((s, t) => s + t.amount, 0);
    const outCount = txs.filter((t) => dirOf(t) === 'out').length;
    const net = inSum - outSum;
    const avg = txs.length ? Math.round((inSum + outSum) / txs.length) : 0;
    const days = state.cfg.statsDays || 30;
    const total = d.bank + d.cash;
    const pct = (v) => (total > 0 ? Math.round((v / total) * 100) : 0);
    const recent = d.transactions.slice(0, 5);

    $('#view').innerHTML = `
    <div class="stats">
        <div class="card stat">
            <span class="label">Primljeno</span><div class="badge">${icon('deposit')}</div>
            <div class="val">${money(inSum)}</div>
            <div class="sub">u poslednjih ${days} dana</div>
        </div>
        <div class="card stat">
            <span class="label">Potrošeno</span><div class="badge">${icon('withdraw')}</div>
            <div class="val">${money(outSum)}</div>
            <div class="sub">kroz ${outCount} ${outCount === 1 ? 'isplatu' : 'isplata'}</div>
        </div>
        <div class="card stat">
            <span class="label">Bilans</span><div class="badge">${icon(net >= 0 ? 'trend' : 'trendDown')}</div>
            <div class="val" style="color:${net < 0 ? 'var(--out)' : 'var(--text)'}">${net < 0 ? '-' : ''}${money(net)}</div>
            <div class="sub">primljeno minus potrošeno</div>
        </div>
        <div class="card stat">
            <span class="label">Prosečna transakcija</span><div class="badge">${icon('wallet')}</div>
            <div class="val">${money(avg)}</div>
            <div class="sub">od ukupno ${txs.length} ${txs.length === 1 ? 'transakcije' : 'transakcija'}</div>
        </div>
    </div>

    <div class="row2">
        <div class="card">
            <div class="card-h">
                <div><h3>Kretanje novca</h3><p>Koliko je novca ušlo i izašlo sa računa, dan po dan</p></div>
                <div class="legend"><span><i style="background:var(--in)"></i>Primljeno</span><span><i style="background:var(--out)"></i>Potrošeno</span></div>
            </div>
            <div class="chart">${chartSVG(txs)}</div>
        </div>
        <div class="card">
            <div class="card-h"><div><h3>Raspodela</h3><p>Gde ti je novac</p></div></div>
            <div class="donut">
                ${donutSVG(d.bank, d.cash)}
                <div class="donut-center"><div><b>${short(total)}</b><span>Ukupno</span></div></div>
            </div>
            <div class="dist">
                <div class="dist-row"><i class="sw" style="background:#ff2f7e"></i>Na računu (${pct(d.bank)}%)<b>${money(d.bank)}</b></div>
                <div class="dist-row"><i class="sw" style="background:#7a1d45"></i>Gotovina kod sebe (${pct(d.cash)}%)<b>${money(d.cash)}</b></div>
            </div>
        </div>
    </div>

    <div class="card recent">
        <div class="card-h">
            <div><h3>Poslednje transakcije</h3><p>Najnovija aktivnost na računu</p></div>
            <button class="link" data-go="history">Prikaži sve</button>
        </div>
        ${recent.length ? recent.map(txRow).join('') : '<div class="empty">Još nema transakcija. Uplati gotovinu na račun da počneš.</div>'}
    </div>`;
}

/* ---------------- Istorija ---------------- */
function filteredTx() {
    const q = state.search.trim().toLowerCase();
    return state.data.transactions.filter((t) => {
        if (state.filter === 'other') { if (!['income', 'expense', 'fee'].includes(t.type)) return false; }
        else if (state.filter !== 'all' && t.type !== state.filter) return false;
        if (!q) return true;
        return [t.title, t.memo, t.party].some((v) => String(v || '').toLowerCase().includes(q));
    });
}

function renderHistory() {
    $('#view').innerHTML = `
    <div class="card">
        <div class="hist-top">
            <label class="search">${icon('search')}<input id="search" placeholder="Pretraži opis, napomenu, stranu..." value="${esc(state.search)}"></label>
            <div class="filters">
                ${FILTERS.map((f) => `<button class="chip ${state.filter === f.id ? 'active' : ''}" data-filter="${f.id}">${f.label}</button>`).join('')}
            </div>
        </div>
        <div class="hist-sum" id="histSum"></div>
        ${txHead}
        <div id="histList"></div>
    </div>`;
    $('#search').addEventListener('input', (e) => { state.search = e.target.value; renderHistoryList(); });
    renderHistoryList();
}

function renderHistoryList() {
    const list = filteredTx();
    const inSum = list.filter((t) => dirOf(t) === 'in').reduce((s, t) => s + t.amount, 0);
    const outSum = list.filter((t) => dirOf(t) === 'out').reduce((s, t) => s + t.amount, 0);
    $('#histSum').innerHTML = `
        <div><span class="label">Prikazano</span><b>${list.length} od ${state.data.transactions.length}</b></div>
        <div><span class="label">Ukupno primljeno</span><b style="color:var(--in)">+${money(inSum)}</b></div>
        <div><span class="label">Ukupno poslato</span><b style="color:var(--out)">-${money(outSum)}</b></div>`;
    $('#histList').innerHTML = list.length
        ? list.map(txRow).join('')
        : `<div class="empty">${state.search || state.filter !== 'all' ? 'Nema transakcija za ovu pretragu. Promeni filter ili obriši tekst.' : 'Još nema transakcija.'}</div>`;
}

/* ---------------- Kazne (plaćanje isključivo u banci) ---------------- */
function fineRow(f) {
    return `
    <div class="fine-row">
        <div class="tx-ic out">${icon('fine')}</div>
        <div class="fine-t"><strong>#${f.id} · ${esc(f.reason)}</strong><span>${esc(f.officer_name)} · ${esc(f.created)}</span></div>
        <div class="amt out">${money(f.amount)}</div>
        <button class="btn sm primary" data-fine-pay="${f.id}" ${state.finesBusy ? 'disabled' : ''}>Plati</button>
    </div>`;
}

function renderFines() {
    const list = state.fines || [];
    const total = list.reduce((s, f) => s + f.amount, 0);
    $('#view').innerHTML = `
    <div class="card">
        <div class="card-h">
            <div><h3>Neplaćene kazne</h3><p>${list.length ? `${list.length} ${list.length === 1 ? 'kazna' : 'kazni'} · ukupno ${money(total)}` : 'Nemaš neplaćenih kazni.'}</p></div>
            <span class="fine-note">${icon('bank')}Plaćanje sa računa, na šalteru banke</span>
        </div>
        <div class="fine-list">
            ${list.length ? list.map(fineRow).join('') : '<div class="empty">Sve je čisto - nemaš neplaćenih kazni.</div>'}
        </div>
    </div>`;
}

async function loadFines() {
    state.finesLoaded = true;
    const list = IN_GAME ? await post('getFines') : demoFines();
    state.fines = Array.isArray(list) ? list : [];
    if (state.view === 'fines') renderFines();
}

function demoFines() {
    return [
        { id: 501, amount: 1500, reason: 'Brza vožnja', officer_name: 'Officer Perić', created: '21.9.2026 18:40' },
        { id: 498, amount: 4000, reason: 'Vožnja bez dozvole', officer_name: 'Officer Perić', created: '19.9.2026 21:05' }
    ];
}

async function payFine(id) {
    if (state.finesBusy) return;
    state.finesBusy = true;
    renderFines();
    const res = IN_GAME ? await post('payFine', { id }) : demoPayFine(id);
    state.finesBusy = false;

    if (!res || !res.ok) {
        toast((res && res.msg) || 'Kazna nije mogla da se plati.', false);
        renderFines();
        return;
    }

    Object.assign(state.data, res);
    state.fines = state.fines.filter((f) => f.id !== id);
    toast(res.msg || 'Kazna je plaćena.');
    renderHeader();
    renderFines();
}

function demoPayFine(id) {
    const f = state.fines.find((x) => x.id === id);
    if (!f) return { ok: false, msg: 'Kazna nije pronađena.' };
    if (state.data.bank < f.amount) return { ok: false, msg: 'Nemaš dovoljno novca na računu.' };
    state.data.bank -= f.amount;
    return { ok: true, msg: 'Kazna je plaćena.', now: Math.floor(Date.now() / 1000) };
}

/* ---------------- Uplata / podizanje / transfer ---------------- */
const isAtm = () => state.data && state.data.kind === 'atm';
const atmCfg = () => state.cfg.atm || { maxWithdraw: 100000, maxDeposit: 100000, withdrawFee: 5, depositFee: 5 };
const atmLimit = () => (state.mode === 'withdraw' ? atmCfg().maxWithdraw : atmCfg().maxDeposit);
const feePct = () => {
    if (isAtm()) return (state.mode === 'withdraw' ? atmCfg().withdrawFee : atmCfg().depositFee) || 0;
    return state.mode === 'transfer' ? (state.cfg.fee || 0) : 0;
};

function modeAllowed(m) {
    return isAtm() ? (m === 'withdraw' || m === 'deposit') : true;
}

function maxFor() {
    const d = state.data, c = state.cfg;
    if (isAtm()) {
        if (state.mode === 'deposit') return Math.min(d.cash, atmLimit());
        let a = Math.floor(d.bank / (1 + feePct() / 100));
        while (a > 0 && a + feeOf(a) > d.bank) a--;
        return Math.max(0, Math.min(a, atmLimit()));
    }
    if (state.mode === 'deposit') return d.cash;
    if (state.mode === 'withdraw') return d.bank;
    const byFee = Math.floor(d.bank / (1 + (c.fee || 0) / 100));
    return Math.min(byFee, c.maxTransfer || byFee);
}
const feeOf = (a) => Math.floor((a * feePct()) / 100);

function problem() {
    const a = state.amount, d = state.data, c = state.cfg;
    if (state.mode === 'transfer' && !String(state.target).trim()) return a ? 'Unesi ID igrača kome šalješ novac.' : '';
    if (!a) return '';
    if (isAtm()) {
        if (a > atmLimit()) return `Na bankomatu najviše ${money(atmLimit())} po transakciji.`;
        if (state.mode === 'deposit') {
            if (a > d.cash) return 'Nemaš toliko gotovine kod sebe.';
            if (a - feeOf(a) < 1) return 'Iznos je premali.';
        } else if (a + feeOf(a) > d.bank) {
            return `Nemaš dovoljno na računu (${money(a + feeOf(a))} sa provizijom).`;
        }
        return '';
    }
    if (state.mode === 'deposit' && a > d.cash) return 'Nemaš toliko gotovine kod sebe.';
    if (state.mode === 'withdraw') {
        if (a > d.bank) return 'Nemaš toliko novca na računu.';
    }
    if (state.mode === 'transfer') {
        if (c.maxTransfer && a > c.maxTransfer) return `Najveći transfer je ${money(c.maxTransfer)}.`;
        if (a + feeOf(a) > d.bank) return 'Nemaš dovoljno novca na računu.';
    }
    return '';
}

function renderActions() {
    if (!modeAllowed(state.mode)) state.mode = 'withdraw';
    const quick = isAtm() ? (atmCfg().quick || [1000, 5000, 10000, 25000, 50000]) : (state.cfg.quick || [50, 100, 500, 1000, 5000, 10000]);
    const modeIds = isAtm() ? ['withdraw', 'deposit'] : Object.keys(MODES);

    $('#view').innerHTML = `
    <div class="card modes" style="grid-template-columns: repeat(${modeIds.length}, 1fr)">
        ${modeIds.map((id) => { const x = MODES[id]; return `
            <button class="mode ${state.mode === id ? 'active' : ''}" data-mode="${id}">
                <div class="mode-ic">${icon(x.icon)}</div>
                <div><strong>${x.title}</strong><span>${isAtm() ? `${x.sub}, provizija ${id === 'withdraw' ? atmCfg().withdrawFee : atmCfg().depositFee}%` : x.sub}</span></div>
            </button>`; }).join('')}
    </div>

    <div class="act-grid">
        <div class="act-left">
            <div class="card amount-card">
                <div class="amount-top">
                    <div><span class="label">Sa</span><strong>${state.mode === 'deposit' ? 'Gotovina kod sebe' : 'Lični račun'}</strong></div>
                    <div class="avail">${money(state.mode === 'deposit' ? state.data.cash : state.data.bank)}</div>
                </div>
                <div class="amount-input">
                    <span>USD</span>
                    <input id="amt" inputmode="numeric" placeholder="0" value="${state.amount || ''}" aria-label="Iznos">
                    <button class="clear" id="clearAmt">Obriši</button>
                </div>
                <div class="quick">
                    ${quick.map((q) => `<button class="q" data-add="${q}">+${q.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}</button>`).join('')}
                    <button class="q" data-add="max">Sve</button>
                </div>
            </div>

            ${isAtm() ? '' : `<div class="card field-card">
                ${state.mode === 'transfer' ? `
                <div class="field">
                    <span class="label">ID igrača</span>
                    <label class="input">${icon('hash')}<input id="target" inputmode="numeric" placeholder="npr. 12" value="${esc(state.target)}"></label>
                </div>` : ''}
                <div class="field">
                    <span class="label">Napomena (nije obavezno)</span>
                    <label class="input">${icon('pen')}<input id="memo" maxlength="64" placeholder="${state.mode === 'transfer' ? 'Za šta šalješ novac' : 'Za šta je uplata'}" value="${esc(state.memo)}"></label>
                </div>
            </div>`}
        </div>

        <div class="act-right">
            <div class="card summary"><h3>Pregled</h3><div id="sumRows"></div></div>
            <div class="card total-card"><span class="label" id="totalLabel">Ukupno</span><b id="totalVal">$0</b></div>
        </div>
    </div>

    <button class="go" id="goBtn"></button>
    <div class="warn" id="warn"></div>`;

    const amt = $('#amt');
    amt.addEventListener('input', () => {
        const v = parseInt(amt.value.replace(/\D/g, ''), 10) || 0;
        state.amount = Math.min(v, 2147483647);
        amt.value = state.amount ? state.amount : '';
        updateSummary();
    });
    amt.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    $('#clearAmt').addEventListener('click', () => { state.amount = 0; amt.value = ''; updateSummary(); });
    const memoEl = $('#memo');
    if (memoEl) memoEl.addEventListener('input', (e) => { state.memo = e.target.value; });
    const tgt = $('#target');
    if (tgt) tgt.addEventListener('input', () => { tgt.value = tgt.value.replace(/\D/g, ''); state.target = tgt.value; updateSummary(); });
    $('#goBtn').addEventListener('click', submit);
    updateSummary();
}

function updateSummary() {
    const a = state.amount, fee = feeOf(a), d = state.data;
    const to = state.mode === 'deposit' ? 'Lični račun'
        : state.mode === 'withdraw' ? 'Gotovina kod sebe'
        : (state.target ? `Igrač ID ${esc(state.target)}` : '—');

    let rows = `
        <div class="sum-row"><span>Vrsta</span><span>${MODES[state.mode].title}</span></div>
        <div class="sum-row"><span>Na</span><span>${to}</span></div>
        <div class="sum-row"><span>Iznos</span><span class="mono">${money(a)}</span></div>`;
    if (state.mode === 'transfer') rows += `<div class="sum-row"><span>Provizija</span><span class="mono">${state.cfg.fee ? `${money(fee)} (${state.cfg.fee}%)` : 'Bez provizije'}</span></div>`;

    if (isAtm()) {
        rows = `
        <div class="sum-row"><span>Vrsta</span><span>${MODES[state.mode].title} na bankomatu</span></div>
        <div class="sum-row"><span>${state.mode === 'withdraw' ? 'Dobijaš' : 'Ubacuješ'}</span><span class="mono">${money(a)}</span></div>
        <div class="sum-row"><span>Provizija</span><span class="mono" style="color:var(--out)">${state.mode === 'withdraw' ? '+' : '-'}${money(fee)} (${feePct()}%)</span></div>
        <div class="sum-row"><span>Limit</span><span class="mono">${money(atmLimit())}</span></div>`;
    }

    $('#sumRows').innerHTML = rows;
    if (isAtm() && state.mode === 'deposit') {
        $('#totalLabel').textContent = 'Stiže na račun';
        $('#totalVal').textContent = money(Math.max(0, a - fee));
    } else {
        $('#totalLabel').textContent = isAtm() ? 'Skida se sa računa' : 'Ukupno';
        $('#totalVal').textContent = money(a + fee);
    }

    const err = problem();
    $('#warn').textContent = err;
    const btn = $('#goBtn');
    btn.disabled = !a || !!err || state.busy;
    btn.innerHTML = icon(MODES[state.mode].icon) + `${MODES[state.mode].verb} ${money(a)}`;
}

async function submit() {
    if (state.busy || !state.amount || problem()) return;
    state.busy = true;
    updateSummary();

    const payload = isAtm() ? { action: state.mode, amount: state.amount } : { action: state.mode, amount: state.amount, memo: state.memo, target: state.target };
    const res = IN_GAME ? await post('action', payload) : demoAction(payload);
    state.busy = false;

    if (!res || !res.ok) {
        toast((res && res.msg) || 'Transakcija nije uspela.', false);
        updateSummary();
        return;
    }

    Object.assign(state.data, res);
    state.amount = 0;
    state.memo = '';
    toast(res.msg || 'Transakcija uspešna.');
    renderHeader();
    renderActions();
}

/* ---------------- routing ---------------- */
function render() {
    renderHeader();
    $('#view').className = 'view' + (state.view === 'actions' ? ' actions-view' : '');
    if (state.view === 'history') renderHistory();
    else if (state.view === 'actions') renderActions();
    else if (state.view === 'fines') renderFines();
    else renderOverview();
}

function go(view, mode) {
    state.view = view;
    if (mode) { state.mode = mode; state.amount = 0; }
    render();
    if (view === 'fines' && !state.finesBusy) loadFines();
}

function openUI(data, cfg) {
    if (data.noAccount) return openNoAccountUI(data);

    $('#noacc').classList.add('hidden');
    $('.bank').classList.remove('hidden');

    state.data = data;
    state.data.transactions = data.transactions || [];
    state.cfg = cfg || {};
    state.view = data.kind === 'atm' ? 'actions' : 'overview';
    state.filter = 'all';
    state.search = '';
    state.amount = 0; state.target = ''; state.memo = ''; state.busy = false;
    state.mode = data.kind === 'atm' ? 'withdraw' : 'deposit';
    state.fines = []; state.finesLoaded = false; state.finesBusy = false;
    $('.bank').classList.toggle('no-fines', !(state.cfg.fines && state.cfg.fines.enabled));
    const navFines = $('#navFines');
    if (navFines) navFines.classList.toggle('nav-bank', !(state.cfg.fines && state.cfg.fines.atm));
    $('#app').classList.remove('hidden');
    render();
}

function openNoAccountUI(data) {
    $('.bank').classList.add('hidden');
    $('#noaccText').textContent = 'Izgleda da još uvek nemaš otvoren bankovni račun. Otvori ga besplatno na šalteru i dobićeš bankovnu karticu za korišćenje bankomata.';
    $('#noacc').classList.remove('hidden');
    $('#app').classList.remove('hidden');
}

async function openAccount() {
    if (state.busy) return;
    state.busy = true;
    const res = IN_GAME ? await post('openAccount') : demoOpenAccount();
    state.busy = false;

    if (!res || !res.ok) {
        toast((res && res.msg) || 'Otvaranje računa nije uspelo.', false);
        return;
    }
    toast(res.msg || 'Račun je otvoren.');
    openUI(res, state.cfg);
}

function demoOpenAccount() {
    return {
        ok: true, msg: 'Račun je otvoren! Dobio si bankovnu karticu.',
        name: 'Dušan Dimitrijević', bank: 0, cash: 12400, transactions: [],
        now: Math.floor(Date.now() / 1000), kind: 'bank', place: 'Fleeca Banka', hasAccount: true
    };
}

function closeUI() {
    $('#app').classList.add('hidden');
    if (IN_GAME) post('close');
}

/* ---------------- events ---------------- */
document.querySelectorAll('[data-i]').forEach((el) => { el.innerHTML = icon(el.dataset.i); });

document.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-view]');
    if (nav) return go(nav.dataset.view);
    const link = e.target.closest('[data-go]');
    if (link) return go(link.dataset.go);
    const chip = e.target.closest('[data-filter]');
    if (chip) {
        state.filter = chip.dataset.filter;
        document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === chip));
        return renderHistoryList();
    }
    const atmNav = e.target.closest('[data-atm-mode]');
    if (atmNav) { state.mode = atmNav.dataset.atmMode; state.amount = 0; renderHeader(); return renderActions(); }
    const mode = e.target.closest('[data-mode]');
    if (mode && !mode.disabled) { state.mode = mode.dataset.mode; state.amount = 0; renderHeader(); return renderActions(); }
    const add = e.target.closest('[data-add]');
    if (add) {
        const max = maxFor();
        state.amount = add.dataset.add === 'max' ? Math.max(0, max) : state.amount + Number(add.dataset.add);
        $('#amt').value = state.amount || '';
        return updateSummary();
    }
    const finePay = e.target.closest('[data-fine-pay]');
    if (finePay && !finePay.disabled) return payFine(Number(finePay.dataset.finePay));
});

$('#btnTransfer').addEventListener('click', () => go('actions', modeAllowed('transfer') ? 'transfer' : 'withdraw'));
$('#btnHistory').addEventListener('click', () => go('history'));
$('#btnClose').addEventListener('click', closeUI);
$('#btnOpenAccount').addEventListener('click', openAccount);
$('#btnNoaccClose').addEventListener('click', closeUI);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeUI(); });

window.addEventListener('message', (e) => {
    const m = e.data || {};
    if (m.action === 'open') openUI(m.data, m.config);
    if (m.action === 'close') $('#app').classList.add('hidden');
});

/* ---------------- demo (samo u browseru, ne u igri) ---------------- */
function demoAction(p) {
    const d = state.data, now = Math.floor(Date.now() / 1000);
    const push = (type, title, memo, party, amount) => d.transactions.unshift({ id: Date.now(), type, title, memo, party, amount, ts: now });
    const f = isAtm() ? feeOf(p.amount) : 0;
    if (isAtm() && p.action === 'deposit') { d.cash -= p.amount; d.bank += p.amount - f; return { ok: true, msg: 'Uplata uspešna.', now }; }
    if (isAtm() && p.action === 'withdraw') { d.bank -= p.amount + f; d.cash += p.amount; return { ok: true, msg: 'Podizanje uspešno.', now }; }
    if (p.action === 'deposit') { d.cash -= p.amount; d.bank += p.amount; push('deposit', 'Uplata na račun', p.memo || 'Gotovina na račun', 'Fleeca Banka', p.amount); }
    if (p.action === 'withdraw') { d.bank -= p.amount; d.cash += p.amount; push('withdraw', 'Podizanje novca', p.memo || 'Račun u gotovinu', 'Fleeca Banka', p.amount); }
    if (p.action === 'transfer') { d.bank -= p.amount; push('transfer_out', 'Poslat novac', p.memo || 'Transfer na račun', `Igrač ${p.target}`, p.amount); }
    return { ok: true, msg: 'Transakcija uspešna.', now };
}

if (!IN_GAME) window.addEventListener('DOMContentLoaded', () => {
    const now = Math.floor(Date.now() / 1000), day = 86400;
    const tx = [
        ['income', 'Plata', 'Payday', 'Država', 2500, 0.1],
        ['transfer_in', 'Primljen novac', 'Za auto', 'Marko Petrović', 45000, 0.4],
        ['withdraw', 'Podizanje novca', 'Račun u gotovinu', 'Bankomat', 5000, 2],
        ['deposit', 'Uplata na račun', 'Gotovina na račun', 'Fleeca Banka', 28000, 6],
        ['transfer_out', 'Poslat novac', 'Kirija', 'Stefan Jovanović', 12500, 9],
        ['expense', 'Kazna', 'Brza vožnja', 'LSPD', 1500, 13],
        ['income', 'Posao', 'Rudar isplata', 'Rudnik', 22500, 17],
        ['transfer_out', 'Poslat novac', 'Dug', 'Nikola Ilić', 3200, 22],
        ['deposit', 'Uplata na račun', 'Gotovina na račun', 'Fleeca Banka', 15000, 27]
    ].map(([type, title, memo, party, amount, ago], i) => ({ id: i, type, title, memo, party, amount, ts: now - Math.floor(ago * day) }));
    const demoAtm = location.search.includes('atm');
    openUI(
        { name: 'Dušan Dimitrijević', bank: 185750, cash: 12400, transactions: tx, now, kind: demoAtm ? 'atm' : 'bank', place: demoAtm ? 'Bankomat' : 'Fleeca Banka' },
        { quick: [50, 100, 500, 1000, 5000, 10000], atm: { maxWithdraw: 100000, maxDeposit: 100000, withdrawFee: 5, depositFee: 5, quick: [1000, 5000, 10000, 25000, 50000, 100000] }, fee: 0, maxTransfer: 10000000, statsDays: 30, fines: { enabled: true, atm: false } }
    );
});
