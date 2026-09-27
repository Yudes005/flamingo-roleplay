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
const SPORT_ICON = { soccer: '⚽', basketball: '🏀' };

const ICONS = {
    x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
    undo: '<svg viewBox="0 0 24 24"><path d="M4 10h11a5 5 0 0 1 0 10H9M4 10l4-4M4 10l4 4"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>',
    trophy: '<svg viewBox="0 0 24 24"><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8M9.5 17h5"/></svg>',
    ticket: '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2.5a2.5 2.5 0 0 0 0 5V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2.5a2.5 2.5 0 0 0 0-5zM9 5v14"/></svg>',
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

function toast(text, type = '') {
    const el = $('toast');
    el.textContent = text;
    el.className = `toast show ${type}`;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { el.className = 'toast'; }, 3200);
}

/* ================= Grbovi i zastave ================= */

const PREFIXES = new Set(['FC', 'CF', 'AC', 'SC', 'AFC', 'CD', 'UD', 'RC', 'SS', 'AS', 'FK', 'NK', 'KK', 'SK', 'BC', 'SL', 'CA', 'SV', 'VFB', 'VFL', 'TSG', 'RB', '1.', 'OGC', 'US']);

function initials(name) {
    const words = String(name).replace(/[^\p{L}\p{N}\s.]/gu, ' ').split(/\s+/).filter(Boolean);
    const main = words.filter((w) => !PREFIXES.has(w.toUpperCase()));
    const use = main.length ? main : words;
    if (use.length === 1) return use[0].slice(0, 3).toUpperCase();
    return (use[0][0] + use[1][0]).toUpperCase();
}

function hue(name) {
    let h = 0;
    for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) % 3600;
    return h % 360;
}

function crest(name, size = '', logo) {
    const h = hue(name);
    const url = logo !== undefined ? logo : state.logos[name];
    const style = `--c1:hsl(${h},70%,52%);--c2:hsl(${(h + 40) % 360},72%,30%)`;
    const img = url ? `<img src="${esc(url)}" alt="" onerror="this.parentNode.classList.remove('has-logo');this.remove()">` : '';
    return `<div class="crest ${size} ${url ? 'has-logo' : ''}" style="${style}">${esc(initials(name))}${img}</div>`;
}

function flag(code) {
    if (!code) return `<span class="flag cup">${ICONS.trophy}</span>`;
    if (code === 'uefa' || code === 'world') return `<span class="flag cup">${ICONS.trophy}</span>`;
    return `<span class="flag"><img src="https://flagcdn.com/w40/${esc(code)}.png" alt="" onerror="this.remove()"></span>`;
}

function leagueOf(key) {
    return arr(state.offer?.leagues).find((l) => l.key === key) || { key, name: key };
}

/* ================= Hero ilustracije ================= */

const HERO_ART = {
    soccer: `<svg viewBox="0 0 620 150" preserveAspectRatio="xMaxYMid slice">
        <defs>
            <radialGradient id="hgs" cx="78%" cy="50%" r="55%"><stop offset="0" stop-color="#ff4fa3" stop-opacity=".55"/><stop offset="1" stop-color="#ff4fa3" stop-opacity="0"/></radialGradient>
            <linearGradient id="fds" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".45" stop-color="#fff" stop-opacity=".18"/></linearGradient>
            <radialGradient id="ball" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#c9c3d6"/></radialGradient>
        </defs>
        <rect width="620" height="150" fill="url(#hgs)"/>
        <g fill="none" stroke="url(#fds)" stroke-width="2">
            <rect x="30" y="12" width="570" height="126" rx="6"/><line x1="315" y1="12" x2="315" y2="138"/>
            <circle cx="315" cy="75" r="32"/><circle cx="315" cy="75" r="3" fill="#fff" fill-opacity=".2"/>
            <rect x="30" y="40" width="62" height="70"/><rect x="538" y="40" width="62" height="70"/>
            <rect x="30" y="60" width="22" height="30"/><rect x="578" y="60" width="22" height="30"/>
        </g>
        <g transform="translate(482 75)">
            <circle r="46" fill="#ff4fa3" opacity=".25" style="filter:blur(8px)"/>
            <circle r="40" fill="url(#ball)"/>
            <path d="M0-13l12.4 9-4.7 14.6H-7.7L-12.4-4z" fill="#1b1424"/>
            <path d="M0-13V-39M12.4-4l24-8M7.7 10.6l15 20M-7.7 10.6l-15 20M-12.4-4l-24-8" stroke="#1b1424" stroke-width="2.4" fill="none"/>
            <path d="M-14-38l14 -1 14 1M34-20l4 13-2 13M22 33l-11 6-13 0M-22 33l-11-8-3-12M-38-6l2-14 9-11" stroke="#1b1424" stroke-width="2" fill="none" opacity=".6"/>
        </g>
    </svg>`,
    basketball: `<svg viewBox="0 0 620 150" preserveAspectRatio="xMaxYMid slice">
        <defs>
            <radialGradient id="hgb" cx="78%" cy="50%" r="55%"><stop offset="0" stop-color="#ff8a3d" stop-opacity=".5"/><stop offset="1" stop-color="#ff8a3d" stop-opacity="0"/></radialGradient>
            <linearGradient id="fdb" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".45" stop-color="#fff" stop-opacity=".18"/></linearGradient>
            <radialGradient id="bball" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#ffa45c"/><stop offset="1" stop-color="#c2410c"/></radialGradient>
        </defs>
        <rect width="620" height="150" fill="url(#hgb)"/>
        <g fill="none" stroke="url(#fdb)" stroke-width="2">
            <rect x="30" y="12" width="570" height="126" rx="6"/><line x1="315" y1="12" x2="315" y2="138"/>
            <circle cx="315" cy="75" r="26"/>
            <rect x="30" y="50" width="80" height="50"/><rect x="520" y="50" width="80" height="50"/>
            <path d="M30 22h40a53 53 0 0 1 0 106H30M600 22h-40a53 53 0 0 0 0 106h40"/>
        </g>
        <g transform="translate(482 75)">
            <circle r="46" fill="#ff8a3d" opacity=".3" style="filter:blur(8px)"/>
            <circle r="40" fill="url(#bball)"/>
            <g stroke="#3b1406" stroke-width="2.4" fill="none">
                <line x1="-40" y1="0" x2="40" y2="0"/><line x1="0" y1="-40" x2="0" y2="40"/>
                <path d="M-28-28a40 40 0 0 1 0 56M28-28a40 40 0 0 0 0 56"/>
            </g>
        </g>
    </svg>`,
};

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
            { title: 'Golovi', heads: ['Manje', 'Više'], cells: [cell(ev, 'totals', 'under', `M ${tp}`), cell(ev, 'totals', 'over', `V ${tp}`)] },
        ];
    }
    const sp = o.spreads ? o.spreads.point : 0;
    return [
        { title: 'Pobjednik', heads: ['1', '2'], cells: [cell(ev, 'h2h', 'home'), cell(ev, 'h2h', 'away')] },
        { title: 'Hendikep', heads: ['H1', 'H2'], cells: [cell(ev, 'spreads', 'home', `H1 ${signed(sp)}`), cell(ev, 'spreads', 'away', `H2 ${signed(-sp)}`)] },
        { title: 'Poeni', heads: ['Manje', 'Više'], cells: [cell(ev, 'totals', 'under', `M ${tp}`), cell(ev, 'totals', 'over', `V ${tp}`)] },
    ];
}

function selectedMap() {
    return new Map(state.slip.map((s) => [s.id, s]));
}

function oddBtn(ev, c, sel, withSmall = true) {
    if (c.locked) return `<div class="odd locked">–</div>`;
    const isSel = sel && sel.market === c.market && sel.pick === c.pick;
    return `<button class="odd ${isSel ? 'sel' : ''}" data-id="${esc(ev.id)}" data-market="${c.market}" data-pick="${c.pick}">
        ${withSmall && c.small ? `<small>${esc(c.small)}</small>` : ''}${fmtOdd(c.odds)}</button>`;
}

/* ================= Render: ponuda ================= */

const sportEvents = () => arr(state.offer?.events).filter((e) => e.sport === state.sport);
const leagueEvents = () => sportEvents().filter((e) => state.league === 'all' || e.key === state.league);

function renderSports() {
    $('sports').innerHTML = arr(state.offer?.sports).map((s) => {
        const n = arr(state.offer.events).filter((e) => e.sport === s.key).length;
        return `<button class="sport-btn ${s.key === state.sport ? 'active' : ''}" data-sport="${esc(s.key)}">
            <span class="ball">${SPORT_ICON[s.key] || '•'}</span>${esc(s.label)}<span class="n">${n}</span></button>`;
    }).join('');
}

function renderHero() {
    const events = sportEvents();
    const sport = arr(state.offer?.sports).find((s) => s.key === state.sport);
    const today = events.filter((e) => dayKey(e.time) === dayKey(Date.now() / 1000)).length;
    const leagues = new Set(events.map((e) => e.key)).size;
    const hero = $('hero');
    hero.className = `hero ${state.sport}`;
    hero.innerHTML = `
        <div class="hero-art">${HERO_ART[state.sport] || HERO_ART.soccer}</div>
        <div class="hero-kicker">Flamingo Bet · prave kvote</div>
        <h1>${esc(sport ? sport.label : '')}</h1>
        <div class="hero-stats">
            <span><b>${events.length}</b> utakmica</span>
            <span><b>${today}</b> danas</span>
            <span><b>${leagues}</b> liga</span>
        </div>`;
}

function renderFeatured() {
    const now = Date.now() / 1000;
    const events = sportEvents().sort((a, b) => a.time - b.time);
    const topKeys = new Set(arr(state.offer?.leagues).filter((l) => l.top).map((l) => l.key));
    let list = events.filter((e) => topKeys.has(e.key) && e.time < now + 3 * 86400);
    if (list.length < 4) list = list.concat(events.filter((e) => !list.includes(e))).slice(0, 8);
    list = list.slice(0, 10);

    $('featuredWrap').classList.toggle('hidden', list.length === 0);
    const sel = selectedMap();
    $('featured').innerHTML = list.map((ev) => {
        const lg = leagueOf(ev.key);
        const soon = ev.time - now < 3 * 3600;
        const cells = ev.sport === 'soccer'
            ? [cell(ev, 'h2h', 'home', '1'), cell(ev, 'h2h', 'draw', 'X'), cell(ev, 'h2h', 'away', '2')]
            : [cell(ev, 'h2h', 'home', '1'), cell(ev, 'h2h', 'away', '2')];
        return `<div class="fcard">
            <div class="fcard-top">
                <div class="fcard-league">${flag(lg.flag)}<span>${esc(lg.name)}</span></div>
                <span class="time-pill ${soon ? 'soon' : ''}">${dayLabel(dayKey(ev.time))} ${timeStr(ev.time)}</span>
            </div>
            <div class="fcard-teams">
                <div class="fteam">${crest(ev.home, 'lg')}<div class="nm">${esc(ev.home)}</div></div>
                <div class="vs">VS</div>
                <div class="fteam">${crest(ev.away, 'lg')}<div class="nm">${esc(ev.away)}</div></div>
            </div>
            <div class="fodds n${cells.length}">${cells.map((c) => oddBtn(ev, c, sel.get(ev.id))).join('')}</div>
        </div>`;
    }).join('');
}

function renderLeagues() {
    const events = sportEvents();
    const counts = {};
    events.forEach((e) => { counts[e.key] = (counts[e.key] || 0) + 1; });
    const leagues = arr(state.offer?.leagues).filter((l) => l.sport === state.sport && counts[l.key]);
    $('leagues').innerHTML = `<button class="chip ${state.league === 'all' ? 'active' : ''}" data-league="all">Sve lige <span class="n">${events.length}</span></button>`
        + leagues.map((l) => `<button class="chip ${state.league === l.key ? 'active' : ''}" data-league="${esc(l.key)}">
            ${flag(l.flag)}${esc(l.name)} <span class="n">${counts[l.key]}</span></button>`).join('');
}

function renderDays() {
    const keys = [...new Set(leagueEvents().map((e) => dayKey(e.time)))].sort();
    if (state.day !== 'all' && !keys.includes(state.day)) state.day = 'all';
    $('days').innerHTML = [`<button class="chip ${state.day === 'all' ? 'active' : ''}" data-day="all">Svi dani</button>`]
        .concat(keys.map((k) => `<button class="chip ${state.day === k ? 'active' : ''}" data-day="${k}">${dayLabel(k)}</button>`))
        .join('');
}

function renderEvents() {
    if (!state.offer || arr(state.offer.events).length === 0) {
        $('events').innerHTML = `<div class="empty"><div class="ico">🏟️</div><b>Trenutno nema utakmica u ponudi</b>Ponuda se osvježava automatski, navrati malo kasnije.</div>`;
        return;
    }
    const q = state.search.trim().toLowerCase();
    const events = leagueEvents()
        .filter((e) => state.day === 'all' || dayKey(e.time) === state.day)
        .filter((e) => !q || e.home.toLowerCase().includes(q) || e.away.toLowerCase().includes(q))
        .sort((a, b) => a.time - b.time);

    if (events.length === 0) {
        $('events').innerHTML = `<div class="empty"><div class="ico">🔍</div><b>Nema utakmica</b>Promijeni ligu, dan ili pretragu.</div>`;
        return;
    }

    const groups = new Map();
    events.forEach((e) => { if (!groups.has(e.key)) groups.set(e.key, []); groups.get(e.key).push(e); });
    const keys = [...groups.keys()].sort((a, b) => (leagueOf(a).order ?? 9999) - (leagueOf(b).order ?? 9999));

    const sel = selectedMap();
    const cols = state.sport === 'soccer' ? 'cols-soccer' : 'cols-basketball';
    const showDate = state.day === 'all';

    $('events').innerHTML = keys.map((key, i) => {
        const list = groups.get(key);
        const lg = leagueOf(key);
        const heads = groupsFor(list[0]);
        const rows = list.map((ev) => `
            <div class="ev ${cols}">
                <div class="ev-info">
                    <div class="ev-time"><b>${timeStr(ev.time)}</b>${showDate ? `<small>${dayLabel(dayKey(ev.time))}</small>` : ''}</div>
                    <div class="ev-teams">
                        <div class="team">${crest(ev.home)}<span>${esc(ev.home)}</span></div>
                        <div class="team">${crest(ev.away)}<span>${esc(ev.away)}</span></div>
                    </div>
                </div>
                ${groupsFor(ev).map((g) => `<div class="og n${g.cells.length}">${g.cells.map((c) => oddBtn(ev, c, sel.get(ev.id))).join('')}</div>`).join('')}
            </div>`).join('');
        return `<div class="lg-block" style="animation-delay:${Math.min(i, 6) * 40}ms">
            <div class="lg-head ${cols}">
                <div class="lg-name">${flag(lg.flag)}${esc(lg.name)}<span class="cnt">${list.length}</span></div>
                ${heads.map((g) => `<div class="lg-grp og n${g.heads.length}"><span class="gt">${g.title}</span>${g.heads.map((h) => `<span>${h}</span>`).join('')}</div>`).join('')}
            </div>
            ${rows}
        </div>`;
    }).join('');
}

function renderOddsOnly() {
    renderFeatured();
    renderEvents();
}

function renderOffer() {
    renderSports();
    renderHero();
    renderFeatured();
    renderLeagues();
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
        const item = { id, market, pick, odds: c.odds, point: c.point, home: ev.home, away: ev.away, sport: ev.sport, time: ev.time, changed: false };
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

const EMPTY_SLIP = `<div class="slip-empty">${ICONS.ticket}<b>Tiket je prazan</b>Klikni na kvotu u ponudi<br>da dodaš par na tiket.</div>`;

function renderSlip(message, msgType) {
    const n = state.slip.length;
    $('slipCount').textContent = n;
    $('slipCountLbl').textContent = n === 1 ? 'par' : (n >= 2 && n <= 4 ? 'para' : 'parova');

    $('slipList').innerHTML = n === 0 ? EMPTY_SLIP : state.slip.map((s, i) => `
        <div class="sitem ${s.changed ? 'changed' : ''}">
            <button class="rm" data-rm="${i}">${ICONS.x}</button>
            <div class="sitem-teams">${crest(s.home, 'sm')}<span class="t">${esc(s.home)}</span><span class="x">vs</span>${crest(s.away, 'sm')}<span class="t">${esc(s.away)}</span></div>
            <div class="sitem-meta">${dateTimeStr(s.time)} · ${marketName(s.sport, s.market)}</div>
            <div class="sitem-pick"><span>${esc(pickLabel(s.market, s.pick, s.point))}</span><b>${fmtOdd(s.odds)}</b></div>
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
    if (!silent || text) renderOffer(); else { renderSports(); renderHero(); renderOddsOnly(); }
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
        renderSlip(`Tiket ${res.code} uplaćen · mogući dobitak ${money(res.potential)}`, 'ok');
        renderOddsOnly();
        toast(`Tiket ${res.code} je uplaćen i nalazi se u inventaru`, 'ok');
        return;
    }
    if (res && res.reason === 'odds_changed') {
        await refreshOffer(true);
        renderSlip(res.message, 'err');
        return;
    }
    renderSlip(res ? res.message : 'Greška u komunikaciji.', 'err');
}

/* ================= Moji tiketi ================= */

const isPayable = (t) => (t.status === 'won' || t.status === 'void') && !t.paid;

function ticketStatus(t) {
    if (t.status === 'pending') return ['U igri', 'pending'];
    if (t.status === 'lost') return ['Gubitan', 'lost'];
    if (t.paid) return ['Isplaćen', 'paid'];
    if (t.status === 'won') return ['Dobitan', 'won'];
    if (t.status === 'void') return ['Storniran', 'void'];
    return [t.status, 'paid'];
}

const RESULT_ICON = { won: ICONS.check, lost: ICONS.x, void: ICONS.undo, pending: ICONS.clock };

function barcode(code) {
    let html = '';
    for (const ch of String(code)) {
        const c = ch.charCodeAt(0);
        html += `<i style="width:${1 + (c % 3)}px"></i><i style="width:${1 + ((c >> 2) % 3)}px;opacity:${(c % 2) ? 1 : .6}"></i><i style="width:${2 + ((c >> 1) % 2)}px"></i>`;
    }
    return `<div class="barcode">${html}</div>`;
}

function ticketCard(t, withActions) {
    const [label, cls] = ticketStatus(t);
    const pending = t.status === 'pending';
    const sels = arr(t.selections).map((s) => {
        const score = s.homeScore != null && s.awayScore != null ? `<span class="score">${s.homeScore}:${s.awayScore}</span>` : '';
        return `<div class="tsel">
            <div class="res ${s.result}">${RESULT_ICON[s.result] || ICONS.clock}</div>
            <div style="min-width:0">
                <div class="tsel-teams">${crest(s.home, 'sm', s.homeLogo || null)}<span class="t">${esc(s.home)}</span>
                    <span style="color:var(--dim)">–</span>${crest(s.away, 'sm', s.awayLogo || null)}<span class="t">${esc(s.away)}</span>${score}</div>
                <div class="tsel-meta">${s.time ? dateTimeStr(s.time) : ''} · ${esc(s.league)} · ${marketName(s.sport, s.market)}</div>
            </div>
            <div class="tsel-pk"><span>${esc(pickLabel(s.market, s.pick, s.point))}</span><b>${fmtOdd(s.odds)}</b></div>
        </div>`;
    }).join('');

    let actions = '';
    if (withActions) {
        if (isPayable(t)) actions = `<button class="btn-primary" data-payout="${esc(t.code)}">Isplati ${money(t.win_amount)}</button>`;
        else if (t.status === 'lost') actions = `<button class="btn-ghost" data-discard="${esc(t.code)}">Baci tiket</button>`;
    }

    return `<div class="tk ${cls}">
        <div class="tk-head">
            <div class="tk-brand"><div class="mini">F</div><div><div class="tk-code">${esc(t.code)}</div><div class="tk-date">Uplaćen ${dateTimeStr(t.created_at)}</div></div></div>
            <span class="status">${label}</span>
        </div>
        ${sels}
        <div class="perf"></div>
        <div class="tk-sum">
            <div>Uplata<b>${money(t.stake)}</b></div>
            <div>Kvota<b>${fmtOdd(t.total_odds)}</b></div>
            <div class="w">${pending ? 'Mogući dobitak' : 'Dobitak'}<b>${money(pending || t.status === 'lost' ? t.potential_win : t.win_amount)}</b></div>
        </div>
        <div class="tk-bottom">${barcode(t.code)}<div class="tk-actions">${actions}</div></div>
    </div>`;
}

function updateRailBadge() {
    const n = state.tickets.filter(isPayable).length;
    $('railBadge').textContent = n;
    $('railBadge').classList.toggle('hidden', n === 0);
}

function renderTickets() {
    const payable = state.tickets.filter(isPayable);
    $('payAllBtn').classList.toggle('hidden', payable.length < 2);
    updateRailBadge();
    if (state.tickets.length === 0) {
        $('tickets').innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="ico">🎟️</div><b>Nemaš tiketa kod sebe</b>Uplaćeni tiketi se nalaze u tvom inventaru.</div>`;
        return;
    }
    $('tickets').innerHTML = state.tickets.map((t) => ticketCard(t, true)).join('');
}

async function loadTickets(show = true) {
    if (show) $('tickets').innerHTML = `<div class="empty" style="grid-column:1/-1">Učitavanje...</div>`;
    state.tickets = arr(await post('getTickets'));
    state.tickets.forEach((t) => { t.selections = arr(t.selections); });
    if (show) renderTickets(); else updateRailBadge();
}

async function payout(code) {
    const res = await post('payout', { code });
    if (res && res.ok) {
        setBalance(state.balance + Number(res.amount || 0));
        toast(`Isplaćeno ${money(res.amount)} · čestitamo!`, 'ok');
    } else {
        toast(res ? res.message : 'Greška.', 'err');
    }
    return res && res.ok;
}

/* ================= Otvaranje / tabovi ================= */

function setTab(tab) {
    state.tab = tab;
    document.querySelectorAll('.rail-btn[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    $('offerView').classList.toggle('hidden', tab !== 'offer');
    $('ticketsView').classList.toggle('hidden', tab !== 'tickets');
    document.querySelector('.topbar .sport-switch').style.visibility = tab === 'offer' ? 'visible' : 'hidden';
    document.querySelector('.topbar .search').style.visibility = tab === 'offer' ? 'visible' : 'hidden';
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
    $('ticketModalBody').innerHTML = ticketCard(ticket, false);
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

document.querySelectorAll('.rail-btn[data-tab]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));

$('sports').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sport]');
    if (!b) return;
    state.sport = b.dataset.sport;
    state.league = 'all';
    state.day = 'all';
    renderOffer();
    $('offerView').scrollTop = 0;
});

$('leagues').addEventListener('click', (e) => {
    const b = e.target.closest('[data-league]');
    if (!b) return;
    state.league = b.dataset.league;
    renderLeagues();
    renderDays();
    renderEvents();
});

$('days').addEventListener('click', (e) => {
    const b = e.target.closest('[data-day]');
    if (!b) return;
    state.day = b.dataset.day;
    renderDays();
    renderEvents();
});

$('search').addEventListener('input', (e) => {
    state.search = e.target.value;
    renderEvents();
});

document.querySelectorAll('[data-scroll]').forEach((b) => b.addEventListener('click', () => {
    $('featured').scrollBy({ left: Number(b.dataset.scroll) * 628, behavior: 'smooth' });
}));

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
