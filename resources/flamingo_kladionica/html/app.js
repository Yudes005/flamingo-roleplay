'use strict';

const RESOURCE = typeof GetParentResourceName === 'function' ? GetParentResourceName() : 'flamingo_kladionica';

async function post(name, data = {}) {
    try {
        const res = await fetch(`https://${RESOURCE}/${name}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=UTF-8' },
            body: JSON.stringify(data),
        });
        return await res.json();
    } catch (e) {
        return null;
    }
}

const $ = (id) => document.getElementById(id);
const arr = (x) => (Array.isArray(x) ? x : []);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const DAYS = ['Ned', 'Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub'];

const ICON = {
    soccer: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7.6l4 2.9-1.5 4.7h-5L8 10.5zM12 3v4.6M16 10.5l4.4-1.4M14.5 15.2l2.7 3.7M9.5 15.2l-2.7 3.7M8 10.5L3.6 9.1"/></svg>',
    basketball: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18M5.6 5.6a9 9 0 0 1 0 12.8M18.4 5.6a9 9 0 0 0 0 12.8"/></svg>',
    all: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
    cup: '<svg viewBox="0 0 24 24"><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    ticket: '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2.5a2.5 2.5 0 0 0 0 5V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2.5a2.5 2.5 0 0 0 0-5zM9 5v14"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    calendar: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
};

const state = {
    offer: null,
    logos: {},
    limits: { minStake: 10, maxStake: 50000, maxWin: 1000000, maxSelections: 15, maxTotalOdds: 10000, quickStakes: [100, 500, 1000, 5000] },
    currency: '$',
    balance: 0,
    sport: 'soccer',
    league: 'all',
    day: 'all',
    search: '',
    tab: 'offer',
    slip: [],
    tickets: [],
    busy: false,
    refreshTimer: null,
};

/* ================= Pomoćne ================= */

const round2 = (n) => Math.round(n * 100) / 100;
const fmtOdd = (n) => Number(n).toFixed(2);
const money = (n) => state.currency + Math.floor(Number(n) || 0).toLocaleString('de-DE');
const pad = (n) => String(n).padStart(2, '0');
const signed = (p) => (Number(p) > 0 ? `+${Number(p)}` : `${Number(p)}`);

function dayKey(ts) {
    const d = new Date(ts * 1000);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dayLabel(key) {
    const now = Date.now() / 1000;
    if (key === dayKey(now)) return 'Danas';
    if (key === dayKey(now + 86400)) return 'Sutra';
    const [y, m, d] = key.split('-').map(Number);
    return `${DAYS[new Date(y, m - 1, d).getDay()]} ${pad(d)}.${pad(m)}.`;
}

const timeStr = (ts) => { const d = new Date(ts * 1000); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const dateTimeStr = (ts) => { const d = new Date(ts * 1000); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}. ${timeStr(ts)}`; };
const fullDateStr = (ts) => { const d = new Date(ts * 1000); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${timeStr(ts)}`; };

function marketName(sport, market) {
    switch (market) {
        case 'h2h': return sport === 'soccer' ? 'Konačan ishod' : 'Pobjednik';
        case 'dc': return 'Dupla šansa';
        case 'totals': return sport === 'soccer' ? 'Ukupno golova' : 'Ukupno poena';
        case 'spreads': return 'Hendikep';
        default: return market;
    }
}

function pickLabel(market, pick, point) {
    switch (market) {
        case 'h2h': return { home: '1', draw: 'X', away: '2' }[pick] || pick;
        case 'dc': return pick;
        case 'totals': return `${pick === 'over' ? 'Više' : 'Manje'} ${point}`;
        case 'spreads': return `${pick === 'home' ? 'H1' : 'H2'} ${signed(point)}`;
        default: return pick;
    }
}

// "Engleska - Premier liga" -> { country: 'Engleska', name: 'Premier liga' }
function splitLeague(name) {
    const parts = String(name || '').split(' - ');
    return parts.length > 1 ? { country: parts[0], name: parts.slice(1).join(' - ') } : { country: '', name: parts[0] };
}

function toast(text, type = '') {
    const el = $('toast');
    el.textContent = text;
    el.className = `toast show ${type}`;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { el.className = 'toast'; }, 3200);
}

/* ================= Grbovi i zastave ================= */

const PREFIXES = new Set(['FC', 'CF', 'AC', 'SC', 'AFC', 'CD', 'UD', 'RC', 'SS', 'AS', 'FK', 'NK', 'KK', 'SK', 'BC', 'CA', 'SV', 'VFB', 'VFL', 'TSG', 'RB', 'OGC', 'US']);

function initials(name) {
    const words = String(name).replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
    const main = words.filter((w) => !PREFIXES.has(w.toUpperCase()));
    const use = main.length ? main : words;
    if (use.length === 1) return use[0].slice(0, 2).toUpperCase();
    return (use[0][0] + use[1][0]).toUpperCase();
}

function hue(name) {
    let h = 0;
    for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) % 3600;
    return h % 360;
}

function crest(name, size = '') {
    const url = state.logos[name];
    const img = url ? `<img src="${esc(url)}" alt="" onerror="this.parentNode.classList.remove('has-logo');this.remove()">` : '';
    return `<span class="crest ${size} ${url ? 'has-logo' : ''}" style="--c1:hsl(${hue(name)},14%,30%)">${esc(initials(name))}${img}</span>`;
}

function flag(code) {
    if (!code || code === 'uefa' || code === 'world') return `<span class="flag">${ICON.cup}</span>`;
    return `<span class="flag"><img src="https://flagcdn.com/w40/${esc(code)}.png" alt="" onerror="this.remove()"></span>`;
}

const leagueOf = (key) => arr(state.offer?.leagues).find((l) => l.key === key) || { key, name: key };

/* ================= Kvote ================= */

function cell(ev, market, pick, small) {
    const m = ev.odds && ev.odds[market];
    if (!m || m[pick] == null) return { locked: true, small };
    let point = null;
    if (market === 'totals') point = m.point;
    if (market === 'spreads') point = pick === 'home' ? m.point : -m.point;
    return { market, pick, point, odds: m[pick], small };
}

function groupsFor(ev) {
    const o = ev.odds || {};
    const tp = o.totals ? o.totals.point : '';
    if (ev.sport === 'soccer') {
        return [
            { title: 'Konačan ishod', heads: ['1', 'X', '2'], cells: [cell(ev, 'h2h', 'home'), cell(ev, 'h2h', 'draw'), cell(ev, 'h2h', 'away')] },
            { title: 'Dupla šansa', heads: ['1X', '12', 'X2'], cells: [cell(ev, 'dc', '1X'), cell(ev, 'dc', '12'), cell(ev, 'dc', 'X2')] },
            { title: 'Golovi', heads: ['Manje', 'Više'], cells: [cell(ev, 'totals', 'under', `${tp}`), cell(ev, 'totals', 'over', `${tp}`)] },
        ];
    }
    const sp = o.spreads ? o.spreads.point : 0;
    return [
        { title: 'Pobjednik', heads: ['1', '2'], cells: [cell(ev, 'h2h', 'home'), cell(ev, 'h2h', 'away')] },
        { title: 'Hendikep', heads: ['1', '2'], cells: [cell(ev, 'spreads', 'home', signed(sp)), cell(ev, 'spreads', 'away', signed(-sp))] },
        { title: 'Poeni', heads: ['Manje', 'Više'], cells: [cell(ev, 'totals', 'under', `${tp}`), cell(ev, 'totals', 'over', `${tp}`)] },
    ];
}

const selectedMap = () => new Map(state.slip.map((s) => [s.id, s]));

function oddBtn(ev, c, sel) {
    if (c.locked) return `<div class="odd locked">–</div>`;
    const isSel = sel && sel.market === c.market && sel.pick === c.pick;
    return `<button class="odd ${isSel ? 'sel' : ''}" data-id="${esc(ev.id)}" data-market="${c.market}" data-pick="${c.pick}">${c.small ? `<small>${esc(c.small)}</small>` : ''}${fmtOdd(c.odds)}</button>`;
}

/* ================= Render: ponuda ================= */

const sportEvents = () => arr(state.offer?.events).filter((e) => e.sport === state.sport);
const leagueEvents = () => sportEvents().filter((e) => state.league === 'all' || e.key === state.league);

function renderSports() {
    $('sports').innerHTML = arr(state.offer?.sports).map((s) => {
        const n = arr(state.offer.events).filter((e) => e.sport === s.key).length;
        return `<button class="side-item ${s.key === state.sport ? 'active' : ''}" data-sport="${esc(s.key)}">
            ${ICON[s.key] || ICON.all}<span class="txt">${esc(s.label)}</span><span class="n">${n}</span></button>`;
    }).join('');
}

function renderLeagues() {
    const events = sportEvents();
    const counts = {};
    events.forEach((e) => { counts[e.key] = (counts[e.key] || 0) + 1; });
    const leagues = arr(state.offer?.leagues).filter((l) => l.sport === state.sport && counts[l.key]);
    $('leagues').innerHTML = `<button class="side-item ${state.league === 'all' ? 'active' : ''}" data-league="all">
            ${ICON.all}<span class="txt">Sve lige</span><span class="n">${events.length}</span></button>`
        + leagues.map((l) => {
            const { country, name } = splitLeague(l.name);
            return `<button class="side-item ${state.league === l.key ? 'active' : ''}" data-league="${esc(l.key)}">
                ${flag(l.flag)}<span class="txt">${esc(name)}${country ? `<small>${esc(country)}</small>` : ''}</span><span class="n">${counts[l.key]}</span></button>`;
        }).join('');
}

function renderHead() {
    const sport = arr(state.offer?.sports).find((s) => s.key === state.sport);
    const events = leagueEvents();
    let title = sport ? sport.label : '';
    if (state.league !== 'all') title = splitLeague(leagueOf(state.league).name).name;
    $('pageTitle').textContent = title;
    const upd = state.offer?.serverTime ? ` · osvježeno u ${timeStr(state.offer.serverTime)}` : '';
    $('pageSub').textContent = `${events.length} utakmica u ponudi${upd}`;
}

function renderFeatured() {
    const show = state.league === 'all' && state.day === 'all' && !state.search.trim();
    const now = Date.now() / 1000;
    const events = sportEvents().sort((a, b) => a.time - b.time);
    const topKeys = new Set(arr(state.offer?.leagues).filter((l) => l.top).map((l) => l.key));
    let list = events.filter((e) => topKeys.has(e.key) && e.time < now + 3 * 86400);
    if (list.length < 3) list = list.concat(events.filter((e) => !list.includes(e)));
    list = list.slice(0, 8);

    $('featuredWrap').classList.toggle('hidden', !show || list.length === 0);
    if (!show) return;
    const sel = selectedMap();
    $('featured').innerHTML = list.map((ev) => {
        const lg = leagueOf(ev.key);
        const cells = ev.sport === 'soccer'
            ? [cell(ev, 'h2h', 'home', '1'), cell(ev, 'h2h', 'draw', 'X'), cell(ev, 'h2h', 'away', '2')]
            : [cell(ev, 'h2h', 'home', '1'), cell(ev, 'h2h', 'away', '2')];
        return `<div class="fcard">
            <div class="fcard-top">${flag(lg.flag)}<span class="lg">${esc(splitLeague(lg.name).name)}</span><span class="tm">${dayLabel(dayKey(ev.time))}, ${timeStr(ev.time)}</span></div>
            <div class="fcard-team">${crest(ev.home, 'md')}<span>${esc(ev.home)}</span></div>
            <div class="fcard-team">${crest(ev.away, 'md')}<span>${esc(ev.away)}</span></div>
            <div class="fodds n${cells.length}">${cells.map((c) => oddBtn(ev, c, sel.get(ev.id))).join('')}</div>
        </div>`;
    }).join('');
}

function renderDays() {
    const keys = [...new Set(leagueEvents().map((e) => dayKey(e.time)))].sort();
    if (state.day !== 'all' && !keys.includes(state.day)) state.day = 'all';
    $('days').innerHTML = [`<button class="day ${state.day === 'all' ? 'active' : ''}" data-day="all">Sve</button>`]
        .concat(keys.map((k) => `<button class="day ${state.day === k ? 'active' : ''}" data-day="${k}">${dayLabel(k)}</button>`))
        .join('');
}

function renderEvents() {
    if (!state.offer || arr(state.offer.events).length === 0) {
        $('events').innerHTML = `<div class="empty">${ICON.calendar}<b>Trenutno nema utakmica u ponudi</b>Ponuda se osvježava automatski, navrati malo kasnije.</div>`;
        return;
    }
    const q = state.search.trim().toLowerCase();
    const events = leagueEvents()
        .filter((e) => state.day === 'all' || dayKey(e.time) === state.day)
        .filter((e) => !q || e.home.toLowerCase().includes(q) || e.away.toLowerCase().includes(q))
        .sort((a, b) => a.time - b.time);

    if (events.length === 0) {
        $('events').innerHTML = `<div class="empty">${ICON.search}<b>Nema rezultata</b>Promijeni ligu, dan ili pretragu.</div>`;
        return;
    }

    const groups = new Map();
    events.forEach((e) => { if (!groups.has(e.key)) groups.set(e.key, []); groups.get(e.key).push(e); });
    const keys = [...groups.keys()].sort((a, b) => (leagueOf(a).order ?? 9999) - (leagueOf(b).order ?? 9999));

    const sel = selectedMap();
    const cols = state.sport === 'soccer' ? 'cols-soccer' : 'cols-basketball';
    const showDate = state.day === 'all';

    $('events').innerHTML = keys.map((key) => {
        const list = groups.get(key);
        const lg = leagueOf(key);
        const { country, name } = splitLeague(lg.name);
        const heads = groupsFor(list[0]);
        return `<div class="lg-block">
            <div class="lg-head ${cols}">
                <div class="lg-name">${flag(lg.flag)}${country ? `<span class="country">${esc(country)}</span><span class="sep">/</span>` : ''}<span>${esc(name)}</span></div>
                ${heads.map((g) => `<div class="lg-grp og n${g.heads.length}"><span class="gt">${g.title}</span>${g.heads.map((h) => `<span>${h}</span>`).join('')}</div>`).join('')}
            </div>
            ${list.map((ev) => `
            <div class="ev ${cols}">
                <div class="ev-info">
                    <div class="ev-time"><b>${timeStr(ev.time)}</b>${showDate ? `<small>${dayLabel(dayKey(ev.time))}</small>` : ''}</div>
                    <div class="ev-teams">
                        <div class="team">${crest(ev.home)}<span>${esc(ev.home)}</span></div>
                        <div class="team">${crest(ev.away)}<span>${esc(ev.away)}</span></div>
                    </div>
                </div>
                ${groupsFor(ev).map((g) => `<div class="og n${g.cells.length}">${g.cells.map((c) => oddBtn(ev, c, sel.get(ev.id))).join('')}</div>`).join('')}
            </div>`).join('')}
        </div>`;
    }).join('');
}

function renderOddsOnly() {
    renderFeatured();
    renderEvents();
}

function renderOffer() {
    renderSports();
    renderLeagues();
    renderHead();
    renderFeatured();
    renderDays();
    renderEvents();
}

/* ================= Tiket (slip) ================= */

const findEvent = (id) => arr(state.offer?.events).find((e) => e.id === id);

function toggleSelection(id, market, pick) {
    const ev = findEvent(id);
    if (!ev) return;
    const c = cell(ev, market, pick);
    if (c.locked) return;

    const idx = state.slip.findIndex((s) => s.id === id);
    if (idx >= 0 && state.slip[idx].market === market && state.slip[idx].pick === pick) {
        state.slip.splice(idx, 1);
    } else {
        const item = { id, market, pick, odds: c.odds, point: c.point, home: ev.home, away: ev.away, sport: ev.sport, key: ev.key, time: ev.time, changed: false };
        if (idx >= 0) {
            state.slip[idx] = item;
        } else {
            if (state.slip.length >= state.limits.maxSelections) {
                return toast(`Maksimalno ${state.limits.maxSelections} parova na tiketu.`, 'err');
            }
            state.slip.push(item);
        }
    }
    renderOddsOnly();
    renderSlip();
}

function slipTotals() {
    const total = round2(state.slip.reduce((acc, s) => acc * s.odds, 1));
    const stake = Math.floor(Number($('stake').value) || 0);
    const win = Math.min(Math.floor(stake * total + 1e-6), state.limits.maxWin);
    return { total, stake, win };
}

function validateSlip() {
    const { total, stake } = slipTotals();
    const L = state.limits;
    if (state.slip.length === 0) return 'Izaberi barem jednu kvotu.';
    if (stake < L.minStake) return `Minimalna uplata je ${money(L.minStake)}.`;
    if (stake > L.maxStake) return `Maksimalna uplata je ${money(L.maxStake)}.`;
    if (stake > state.balance) return 'Nemaš dovoljno keša kod sebe.';
    if (total > L.maxTotalOdds) return `Maksimalna ukupna kvota je ${L.maxTotalOdds}.`;
    return null;
}

function renderSlip(message, msgType) {
    const n = state.slip.length;
    $('slipCount').textContent = n;
    $('slipCount').classList.toggle('on', n > 0);

    $('slipList').innerHTML = n === 0
        ? `<div class="slip-empty">${ICON.ticket}<b>Tiket je prazan</b>Izaberi kvotu u ponudi da dodaš par.</div>`
        : state.slip.map((s, i) => `
        <div class="sitem ${s.changed ? 'changed' : ''}">
            <button class="rm" data-rm="${i}" title="Ukloni">${ICON.x}</button>
            <div class="sitem-teams">${esc(s.home)} – ${esc(s.away)}</div>
            <div class="sitem-meta">${dayLabel(dayKey(s.time))} ${timeStr(s.time)} · ${esc(splitLeague(leagueOf(s.key).name).name)}</div>
            <div class="sitem-pick"><span><em>${marketName(s.sport, s.market)}</em>${esc(pickLabel(s.market, s.pick, s.point))}</span><b>${fmtOdd(s.odds)}</b></div>
            ${s.changed ? '<div class="sitem-note">Kvota je promijenjena</div>' : ''}
        </div>`).join('');

    const { total, win } = slipTotals();
    $('slipOdds').textContent = fmtOdd(total);
    $('slipWin').textContent = money(n ? win : 0);

    const err = validateSlip();
    const msg = $('slipMsg');
    if (message) {
        msg.textContent = message;
        msg.className = `msg ${msgType || ''}`;
    } else {
        msg.textContent = n && err ? err : '';
        msg.className = 'msg';
    }
    $('placeBtn').disabled = !!err || state.busy;
}

function syncSlipWithOffer() {
    let changed = false;
    let removed = 0;
    state.slip = state.slip.filter((s) => {
        const ev = findEvent(s.id);
        const c = ev && cell(ev, s.market, s.pick);
        if (!c || c.locked) { removed++; return false; }
        if (Math.abs(c.odds - s.odds) > 0.001 || c.point !== s.point) {
            s.odds = c.odds;
            s.point = c.point;
            s.changed = true;
            changed = true;
        }
        return true;
    });
    return { changed, removed };
}

function setBalance(v) {
    state.balance = Math.max(0, Math.floor(Number(v) || 0));
    $('balance').textContent = money(state.balance);
}

async function refreshOffer(silent) {
    const offer = await post('refresh');
    if (!offer) return;
    applyOffer(offer);
    const { changed, removed } = syncSlipWithOffer();
    let text = '';
    if (changed) text += 'Neke kvote na tiketu su promijenjene. ';
    if (removed) text += `${removed} par(ova) više nije u ponudi.`;
    renderSlip(text || undefined);
    if (!silent || text) {
        renderOffer();
    } else {
        renderSports();
        renderHead();
        renderOddsOnly();
    }
}

async function placeBet() {
    if (state.busy || validateSlip()) return;
    state.busy = true;
    renderSlip('Uplata u toku...');

    const { stake } = slipTotals();
    const res = await post('placeBet', {
        stake,
        selections: state.slip.map((s) => ({ id: s.id, market: s.market, pick: s.pick, odds: s.odds })),
    });
    state.busy = false;

    if (res && res.ok) {
        state.slip = [];
        setBalance(state.balance - stake);
        renderSlip(`Tiket ${res.code} je uplaćen. Mogući dobitak ${money(res.potential)}.`, 'ok');
        renderOddsOnly();
        toast(`Tiket ${res.code} je uplaćen i nalazi se u inventaru.`, 'ok');
        return;
    }
    if (res && res.reason === 'odds_changed') {
        await refreshOffer(true);
        renderSlip(res.message, 'err');
        return;
    }
    renderSlip(res ? res.message : 'Greška u komunikaciji.', 'err');
}

/* ================= Papirni tiket ================= */

const isPayable = (t) => (t.status === 'won' || t.status === 'void') && !t.paid;

function stampOf(t) {
    if (t.status === 'pending') return ['U IGRI', 'pending'];
    if (t.status === 'lost') return ['GUBITAN', 'lost'];
    if (t.paid) return ['ISPLAĆEN', 'paid'];
    if (t.status === 'won') return ['DOBITAN', 'won'];
    if (t.status === 'void') return ['STORNO', 'void'];
    return [String(t.status).toUpperCase(), 'paid'];
}

const RESULT_LABEL = { won: 'POGODAK', lost: 'PROMAŠAJ', void: 'STORNO', pending: 'U TOKU' };

function barcode(code) {
    let html = '';
    for (const ch of `*${code}*`) {
        const c = ch.charCodeAt(0);
        html += `<i style="width:${1 + (c % 3)}px"></i><i style="width:1px;background:transparent"></i><i style="width:${1 + ((c >> 2) % 2)}px"></i><i style="width:${1 + ((c >> 1) % 2)}px;background:transparent"></i>`;
    }
    return `<div class="p-barcode">${html}</div>`;
}

function paperTicket(t) {
    const [stamp, stampCls] = stampOf(t);
    const pending = t.status === 'pending';
    const sels = arr(t.selections).map((s) => {
        const score = s.homeScore != null && s.awayScore != null ? `Rezultat ${s.homeScore}:${s.awayScore}` : '';
        return `<div class="p-sel">
            <div class="meta">${s.time ? dateTimeStr(s.time) : ''} · ${esc(splitLeague(s.league).name)}</div>
            <div class="teams">${esc(s.home)} - ${esc(s.away)}</div>
            <div class="pick"><span>${marketName(s.sport, s.market)}: ${esc(pickLabel(s.market, s.pick, s.point))}</span><span>${fmtOdd(s.odds)}</span></div>
            <div class="pick"><span class="meta">${score}</span><span class="res ${s.result}">${RESULT_LABEL[s.result] || ''}</span></div>
        </div>`;
    }).join('');

    const winLabel = pending || t.status === 'lost' ? 'Mogući dobitak' : 'Isplata';
    const winValue = pending || t.status === 'lost' ? t.potential_win : t.win_amount;

    return `<div class="paper-shadow"><div class="paper">
        <div class="paper-head"><b>FLAMINGO BET</b><small>Sportska kladionica · Los Santos</small></div>
        <hr>
        <div class="p-row"><span class="k">Tiket br.</span><span>${esc(t.code)}</span></div>
        <div class="p-row"><span class="k">Uplaćen</span><span>${fullDateStr(t.created_at)}</span></div>
        <hr>
        ${sels}
        <hr>
        <div class="p-row"><span class="k">Broj parova</span><span>${arr(t.selections).length}</span></div>
        <div class="p-row"><span class="k">Ukupna kvota</span><span>${fmtOdd(t.total_odds)}</span></div>
        <div class="p-row"><span class="k">Uplata</span><span>${money(t.stake)}</span></div>
        <div class="p-row p-total"><span>${winLabel}</span><span>${money(winValue)}</span></div>
        <div class="stamp-row"><span class="stamp ${stampCls}">${stamp}</span></div>
        ${barcode(t.code)}
        <div class="p-code">${esc(t.code)}</div>
    </div></div>`;
}

function ticketBlock(t) {
    let actions = '';
    if (isPayable(t)) actions = `<button class="btn btn-accent" data-payout="${esc(t.code)}">Isplati ${money(t.win_amount)}</button>`;
    else if (t.status === 'lost') actions = `<button class="btn btn-plain" data-discard="${esc(t.code)}">Baci tiket</button>`;
    return `<div class="tk-wrap">${paperTicket(t)}${actions ? `<div class="tk-actions">${actions}</div>` : ''}</div>`;
}

function updateNavBadge() {
    const n = state.tickets.filter(isPayable).length;
    $('navBadge').textContent = n;
    $('navBadge').classList.toggle('hidden', n === 0);
}

function renderTickets() {
    $('payAllBtn').classList.toggle('hidden', state.tickets.filter(isPayable).length < 2);
    updateNavBadge();
    if (state.tickets.length === 0) {
        $('tickets').innerHTML = `<div class="empty" style="grid-column:1/-1">${ICON.ticket}<b>Nemaš tiketa kod sebe</b>Uplaćeni tiketi se nalaze u tvom inventaru.</div>`;
        return;
    }
    $('tickets').innerHTML = state.tickets.map(ticketBlock).join('');
}

async function loadTickets(show = true) {
    if (show) $('tickets').innerHTML = `<div class="empty" style="grid-column:1/-1">Učitavanje...</div>`;
    state.tickets = arr(await post('getTickets'));
    state.tickets.forEach((t) => { t.selections = arr(t.selections); });
    if (show) renderTickets(); else updateNavBadge();
}

async function payout(code) {
    const res = await post('payout', { code });
    if (res && res.ok) {
        setBalance(state.balance + Number(res.amount || 0));
        toast(`Isplaćeno ${money(res.amount)}.`, 'ok');
    } else {
        toast(res ? res.message : 'Greška.', 'err');
    }
    return res && res.ok;
}

/* ================= Otvaranje / tabovi ================= */

function setTab(tab) {
    state.tab = tab;
    document.querySelectorAll('.nav button[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    $('offerView').classList.toggle('hidden', tab !== 'offer');
    $('ticketsView').classList.toggle('hidden', tab !== 'tickets');
    if (tab === 'tickets') loadTickets();
}

function applyOffer(offer) {
    offer.events = arr(offer.events);
    offer.leagues = arr(offer.leagues);
    offer.sports = arr(offer.sports);
    state.offer = offer;
    state.logos = offer.logos && typeof offer.logos === 'object' ? offer.logos : {};
    if (offer.limits) state.limits = { ...offer.limits, quickStakes: arr(offer.limits.quickStakes) };
    if (offer.currency) state.currency = offer.currency;
    if (offer.balance != null) setBalance(offer.balance);
    if (!offer.sports.find((s) => s.key === state.sport) && offer.sports.length) state.sport = offer.sports[0].key;
    if (state.league !== 'all' && !offer.leagues.find((l) => l.key === state.league)) state.league = 'all';
}

function open(offer, tab) {
    applyOffer(offer);
    syncSlipWithOffer();
    $('stakeCur').textContent = state.currency;
    $('quick').innerHTML = state.limits.quickStakes.map((v) => `<button data-quick="${v}">+${Number(v).toLocaleString('de-DE')}</button>`).join('');
    $('app').classList.remove('hidden');
    renderOffer();
    renderSlip();
    setTab(tab || 'offer');
    if (tab !== 'tickets') loadTickets(false);

    clearInterval(state.refreshTimer);
    state.refreshTimer = setInterval(() => {
        if (!$('app').classList.contains('hidden') && state.tab === 'offer' && !state.busy) refreshOffer(true);
    }, 60000);
}

function close() {
    $('app').classList.add('hidden');
    $('ticketModal').classList.add('hidden');
    clearInterval(state.refreshTimer);
    post('close');
}

function showTicketModal(ticket, currency) {
    if (currency) state.currency = currency;
    ticket.selections = arr(ticket.selections);
    $('ticketModalBody').innerHTML = paperTicket(ticket);
    $('ticketModal').classList.remove('hidden');
}

/* ================= Eventi ================= */

window.addEventListener('message', (e) => {
    const d = e.data || {};
    if (d.action === 'open') open(d.offer, d.tab);
    else if (d.action === 'ticket') showTicketModal(d.ticket, d.currency);
    else if (d.action === 'close') close();
});

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

$('closeBtn').addEventListener('click', close);
$('ticketModalClose').addEventListener('click', close);

document.querySelectorAll('.nav button[data-tab]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));

$('sports').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sport]');
    if (!b) return;
    state.sport = b.dataset.sport;
    state.league = 'all';
    state.day = 'all';
    if (state.tab !== 'offer') setTab('offer');
    renderOffer();
    $('offerView').scrollTop = 0;
});

$('leagues').addEventListener('click', (e) => {
    const b = e.target.closest('[data-league]');
    if (!b) return;
    state.league = b.dataset.league;
    if (state.tab !== 'offer') setTab('offer');
    renderLeagues();
    renderHead();
    renderFeatured();
    renderDays();
    renderEvents();
    $('offerView').scrollTop = 0;
});

$('days').addEventListener('click', (e) => {
    const b = e.target.closest('[data-day]');
    if (!b) return;
    state.day = b.dataset.day;
    renderDays();
    renderFeatured();
    renderEvents();
});

$('search').addEventListener('input', (e) => {
    state.search = e.target.value;
    renderFeatured();
    renderEvents();
});

$('offerView').addEventListener('click', (e) => {
    const b = e.target.closest('button.odd');
    if (b) toggleSelection(b.dataset.id, b.dataset.market, b.dataset.pick);
});

$('slipList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-rm]');
    if (!b) return;
    state.slip.splice(Number(b.dataset.rm), 1);
    renderSlip();
    renderOddsOnly();
});

$('slipClear').addEventListener('click', () => {
    state.slip = [];
    renderSlip();
    renderOddsOnly();
});

$('stake').addEventListener('input', () => renderSlip());

$('quick').addEventListener('click', (e) => {
    const b = e.target.closest('[data-quick]');
    if (!b) return;
    const cur = Math.floor(Number($('stake').value) || 0);
    $('stake').value = Math.min(cur + Number(b.dataset.quick), state.limits.maxStake);
    renderSlip();
});

$('placeBtn').addEventListener('click', placeBet);

$('tickets').addEventListener('click', async (e) => {
    const pay = e.target.closest('[data-payout]');
    const discard = e.target.closest('[data-discard]');
    if (pay) {
        pay.disabled = true;
        await payout(pay.dataset.payout);
        loadTickets();
    } else if (discard) {
        discard.disabled = true;
        await post('discard', { code: discard.dataset.discard });
        loadTickets();
    }
});

$('payAllBtn').addEventListener('click', async () => {
    const payable = state.tickets.filter(isPayable);
    $('payAllBtn').disabled = true;
    for (const t of payable) await payout(t.code);
    $('payAllBtn').disabled = false;
    loadTickets();
});

function updateClock() {
    const d = new Date();
    $('clock').textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
updateClock();
setInterval(updateClock, 1000);
