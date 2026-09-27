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
const SPORT_ICONS = { soccer: '⚽', basketball: '🏀' };

const state = {
    offer: null,
    limits: { minStake: 10, maxStake: 50000, maxWin: 1000000, maxSelections: 15, maxTotalOdds: 10000, quickStakes: [100, 500, 1000, 5000] },
    currency: '$',
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

/* ---------------- Pomoćne ---------------- */

const round2 = (n) => Math.round(n * 100) / 100;
const fmtOdd = (n) => Number(n).toFixed(2);
const money = (n) => state.currency + Math.floor(Number(n) || 0).toLocaleString('de-DE');
const pad = (n) => String(n).padStart(2, '0');

function dayKey(ts) {
    const d = new Date(ts * 1000);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dayLabel(key) {
    const today = dayKey(Date.now() / 1000);
    const tomorrow = dayKey(Date.now() / 1000 + 86400);
    if (key === today) return 'Danas';
    if (key === tomorrow) return 'Sutra';
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return `${DAYS[date.getDay()]} ${pad(d)}.${pad(m)}.`;
}

function timeStr(ts) {
    const d = new Date(ts * 1000);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function dateTimeStr(ts) {
    const d = new Date(ts * 1000);
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}. ${timeStr(ts)}`;
}

function signed(p) {
    const n = Number(p);
    return n > 0 ? `+${n}` : `${n}`;
}

function marketName(sport, market) {
    switch (market) {
        case 'h2h': return sport === 'soccer' ? 'Konačan ishod' : 'Pobjednik (uklj. produžetke)';
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

/* ---------------- Kvote za jedan meč ---------------- */

function cell(ev, market, pick, small) {
    const m = ev.odds[market];
    if (!m || m[pick] == null) return { locked: true, small };
    let point = null;
    if (market === 'totals') point = m.point;
    if (market === 'spreads') point = pick === 'home' ? m.point : -m.point;
    return { market, pick, point, odds: m[pick], small };
}

function groupsFor(ev) {
    const o = ev.odds;
    if (ev.sport === 'soccer') {
        const tp = o.totals ? o.totals.point : '';
        return [
            { title: 'Konačan ishod', heads: ['1', 'X', '2'], cells: [cell(ev, 'h2h', 'home'), cell(ev, 'h2h', 'draw'), cell(ev, 'h2h', 'away')] },
            { title: 'Dupla šansa', heads: ['1X', '12', 'X2'], cells: [cell(ev, 'dc', '1X'), cell(ev, 'dc', '12'), cell(ev, 'dc', 'X2')] },
            { title: 'Golovi', heads: ['Manje', 'Više'], cells: [cell(ev, 'totals', 'under', `M ${tp}`), cell(ev, 'totals', 'over', `V ${tp}`)] },
        ];
    }
    const sp = o.spreads ? o.spreads.point : 0;
    const tp = o.totals ? o.totals.point : '';
    return [
        { title: 'Pobjednik', heads: ['1', '2'], cells: [cell(ev, 'h2h', 'home'), cell(ev, 'h2h', 'away')] },
        { title: 'Hendikep', heads: ['H1', 'H2'], cells: [cell(ev, 'spreads', 'home', `H1 ${signed(sp)}`), cell(ev, 'spreads', 'away', `H2 ${signed(-sp)}`)] },
        { title: 'Poeni', heads: ['Manje', 'Više'], cells: [cell(ev, 'totals', 'under', `M ${tp}`), cell(ev, 'totals', 'over', `V ${tp}`)] },
    ];
}

/* ---------------- Render: ponuda ---------------- */

function sportEvents() {
    return (state.offer?.events || []).filter((e) => e.sport === state.sport);
}

function renderSports() {
    const sports = state.offer?.sports || [];
    $('sports').innerHTML = sports.map((s) => {
        const count = (state.offer.events || []).filter((e) => e.sport === s.key).length;
        return `<button class="sport-btn ${s.key === state.sport ? 'active' : ''}" data-sport="${esc(s.key)}">
            <span class="ico">${SPORT_ICONS[s.key] || '•'}</span>${esc(s.label)}<span class="count">${count}</span></button>`;
    }).join('');
}

function renderLeagues() {
    const events = sportEvents();
    const counts = {};
    events.forEach((e) => { counts[e.key] = (counts[e.key] || 0) + 1; });
    const leagues = (state.offer?.leagues || []).filter((l) => l.sport === state.sport && counts[l.key]);

    let html = `<button class="league-btn ${state.league === 'all' ? 'active' : ''}" data-league="all">Sve lige<span class="count">${events.length}</span></button>`;
    html += leagues.map((l) => `<button class="league-btn ${state.league === l.key ? 'active' : ''}" data-league="${esc(l.key)}">
        ${esc(l.name)}<span class="count">${counts[l.key]}</span></button>`).join('');
    $('leagues').innerHTML = html;
}

function filteredByLeague() {
    return sportEvents().filter((e) => state.league === 'all' || e.key === state.league);
}

function renderDays() {
    const keys = [...new Set(filteredByLeague().map((e) => dayKey(e.time)))].sort();
    if (state.day !== 'all' && !keys.includes(state.day)) state.day = 'all';
    $('days').innerHTML = [`<button class="day-btn ${state.day === 'all' ? 'active' : ''}" data-day="all">Sve</button>`]
        .concat(keys.map((k) => `<button class="day-btn ${state.day === k ? 'active' : ''}" data-day="${k}">${dayLabel(k)}</button>`))
        .join('');
}

function renderEvents() {
    const q = state.search.trim().toLowerCase();
    const events = filteredByLeague()
        .filter((e) => state.day === 'all' || dayKey(e.time) === state.day)
        .filter((e) => !q || e.home.toLowerCase().includes(q) || e.away.toLowerCase().includes(q))
        .sort((a, b) => a.time - b.time);

    if (!state.offer || state.offer.events.length === 0) {
        $('events').innerHTML = `<div class="empty"><b>Trenutno nema utakmica u ponudi</b>
            Ponuda se osvježava automatski. Pokušaj malo kasnije.</div>`;
        return;
    }
    if (events.length === 0) {
        $('events').innerHTML = `<div class="empty"><b>Nema utakmica</b>Promijeni ligu, dan ili pretragu.</div>`;
        return;
    }

    const leagueOrder = {};
    const leagueName = {};
    (state.offer.leagues || []).forEach((l) => { leagueOrder[l.key] = l.order; leagueName[l.key] = l.name; });

    const groups = new Map();
    events.forEach((e) => {
        if (!groups.has(e.key)) groups.set(e.key, []);
        groups.get(e.key).push(e);
    });
    const orderedKeys = [...groups.keys()].sort((a, b) => (leagueOrder[a] ?? 9999) - (leagueOrder[b] ?? 9999));

    const selected = new Map(state.slip.map((s) => [s.id, s]));
    const cols = state.sport === 'soccer' ? 'cols-soccer' : 'cols-basketball';
    const showDate = state.day === 'all';

    let html = '';
    orderedKeys.forEach((key) => {
        const list = groups.get(key);
        const heads = groupsFor(list[0]);
        html += `<div class="league-group">
            <div class="league-head ${cols}">
                <div class="name">${esc(leagueName[key] || key)}</div>
                ${heads.map((g) => `<div class="grp grp-${g.heads.length}"><span class="gt">${g.title}</span>${g.heads.map((h) => `<span>${h}</span>`).join('')}</div>`).join('')}
            </div>`;

        list.forEach((ev) => {
            const sel = selected.get(ev.id);
            const time = showDate
                ? `<b>${timeStr(ev.time)}</b>${dayLabel(dayKey(ev.time))}`
                : `<b>${timeStr(ev.time)}</b>`;
            html += `<div class="ev-row ${cols}">
                <div class="ev-info">
                    <div class="ev-time">${time}</div>
                    <div class="ev-teams"><div>${esc(ev.home)}</div><div>${esc(ev.away)}</div></div>
                </div>
                ${groupsFor(ev).map((g) => `<div class="grp grp-${g.cells.length}">${g.cells.map((c) => {
                    if (c.locked) return `<div class="odd locked">-</div>`;
                    const isSel = sel && sel.market === c.market && sel.pick === c.pick;
                    return `<button class="odd ${isSel ? 'sel' : ''}" data-id="${esc(ev.id)}" data-market="${c.market}" data-pick="${c.pick}">
                        ${c.small ? `<small>${esc(c.small)}</small>` : ''}${fmtOdd(c.odds)}</button>`;
                }).join('')}</div>`).join('')}
            </div>`;
        });
        html += '</div>';
    });
    $('events').innerHTML = html;
}

function renderOffer() {
    renderSports();
    renderLeagues();
    renderDays();
    renderEvents();
}

/* ---------------- Tiket (slip) ---------------- */

function findEvent(id) {
    return (state.offer?.events || []).find((e) => e.id === id);
}

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
    renderEvents();
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
    if (total > L.maxTotalOdds) return `Maksimalna ukupna kvota je ${L.maxTotalOdds}.`;
    return null;
}

function renderSlip(message, msgType) {
    $('slipCount').textContent = state.slip.length;
    if (state.slip.length === 0) {
        $('slipList').innerHTML = `<div class="slip-empty">Tiket je prazan.<br>Klikni na kvotu da dodaš par.</div>`;
    } else {
        $('slipList').innerHTML = state.slip.map((s, i) => `
            <div class="slip-item ${s.changed ? 'changed' : ''}">
                <button class="rm" data-rm="${i}">✕</button>
                <div class="teams">${esc(s.home)} - ${esc(s.away)}</div>
                <div class="meta">${dateTimeStr(s.time)} · ${marketName(s.sport, s.market)}</div>
                <div class="pick"><span>${esc(pickLabel(s.market, s.pick, s.point))}</span><b>${fmtOdd(s.odds)}</b></div>
            </div>`).join('');
    }

    const { total, win } = slipTotals();
    $('slipOdds').textContent = fmtOdd(total);
    $('slipWin').textContent = money(state.slip.length ? win : 0);

    const err = validateSlip();
    const msg = $('slipMsg');
    if (message) {
        msg.textContent = message;
        msg.className = `msg ${msgType || ''}`;
    } else {
        msg.textContent = state.slip.length && err ? err : '';
        msg.className = 'msg';
    }
    $('placeBtn').disabled = !!err || state.busy;
}

// Nakon osvježavanja ponude: ažuriraj kvote na tiketu, izbaci utakmice koje nisu više u ponudi
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

async function refreshOffer(silent) {
    const offer = await post('refresh');
    if (!offer) return;
    applyOffer(offer);
    const { changed, removed } = syncSlipWithOffer();
    if (!silent || changed || removed) {
        let text = '';
        if (changed) text += 'Neke kvote na tiketu su promijenjene. ';
        if (removed) text += `${removed} par(ova) više nije u ponudi i uklonjeno je.`;
        renderSlip(text || undefined, text ? '' : undefined);
    } else {
        renderSlip();
    }
    renderOffer();
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
        renderSlip(`Tiket ${res.code} uplaćen! Mogući dobitak ${money(res.potential)}.`, 'ok');
        renderEvents();
        toast(`Tiket ${res.code} je uplaćen`, 'ok');
        return;
    }

    if (res && res.reason === 'odds_changed') {
        await refreshOffer(true);
        renderSlip(res.message, 'err');
        return;
    }
    renderSlip(res ? res.message : 'Greška u komunikaciji.', 'err');
}

/* ---------------- Moji tiketi ---------------- */

function ticketStatus(t) {
    if (t.status === 'pending') return ['U igri', 'st-pending'];
    if (t.status === 'lost') return ['Gubitan', 'st-lost'];
    if (t.paid) return ['Isplaćen', 'st-paid'];
    if (t.status === 'won') return ['Dobitan', 'st-won'];
    if (t.status === 'void') return ['Storniran', 'st-void'];
    return [t.status, 'st-paid'];
}

const RESULT_ICON = { won: '✓', lost: '✕', void: '↺', pending: '•' };

function ticketCard(t, withActions) {
    const [label, cls] = ticketStatus(t);
    const winLabel = t.status === 'pending' ? 'Mogući dobitak' : 'Dobitak';
    const winValue = t.status === 'pending' ? t.potential_win : t.win_amount;

    const sels = (t.selections || []).map((s) => {
        const score = s.homeScore != null && s.awayScore != null ? `<span class="score">${s.homeScore}:${s.awayScore}</span>` : '';
        return `<div class="tsel">
            <div class="res ${s.result}">${RESULT_ICON[s.result] || '•'}</div>
            <div>
                <div class="t1">${esc(s.home)} - ${esc(s.away)}</div>
                <div class="t2">${s.time ? dateTimeStr(s.time) : ''} · ${esc(s.league)}${score}</div>
            </div>
            <div class="pk"><span>${esc(pickLabel(s.market, s.pick, s.point))}</span><b>${fmtOdd(s.odds)}</b></div>
        </div>`;
    }).join('');

    let actions = '';
    if (withActions) {
        if ((t.status === 'won' || t.status === 'void') && !t.paid) {
            actions = `<button class="primary small" data-payout="${esc(t.code)}">Isplati ${money(t.win_amount)}</button>`;
        } else if (t.status === 'lost') {
            actions = `<button class="ghost" data-discard="${esc(t.code)}">Baci tiket</button>`;
        }
    }

    return `<div class="tcard">
        <div class="tcard-head">
            <div><div class="code">${esc(t.code)}</div><div class="date">Uplaćen ${dateTimeStr(t.created_at)}</div></div>
            <span class="status ${cls}">${label}</span>
        </div>
        ${sels}
        <div class="tcard-foot">
            <div>Uplata<b>${money(t.stake)}</b></div>
            <div>Kvota<b>${fmtOdd(t.total_odds)}</b></div>
            <div class="w">${winLabel}<b>${money(winValue)}</b></div>
        </div>
        <div class="tcard-actions">${actions}</div>
    </div>`;
}

function renderTickets() {
    const payable = state.tickets.filter((t) => (t.status === 'won' || t.status === 'void') && !t.paid);
    $('payAllBtn').classList.toggle('hidden', payable.length < 2);
    if (state.tickets.length === 0) {
        $('tickets').innerHTML = `<div class="empty" style="grid-column: 1 / -1"><b>Nemaš tiketa kod sebe</b>Uplaćeni tiketi se nalaze u tvom inventaru.</div>`;
        return;
    }
    $('tickets').innerHTML = state.tickets.map((t) => ticketCard(t, true)).join('');
}

async function loadTickets() {
    $('tickets').innerHTML = `<div class="empty" style="grid-column: 1 / -1">Učitavanje...</div>`;
    state.tickets = arr(await post('getTickets'));
    state.tickets.forEach((t) => { t.selections = arr(t.selections); });
    renderTickets();
}

async function payout(code) {
    const res = await post('payout', { code });
    if (res && res.ok) {
        toast(`Isplaćeno ${money(res.amount)}`, 'ok');
    } else {
        toast(res ? res.message : 'Greška.', 'err');
    }
    return res && res.ok;
}

/* ---------------- Tabovi / otvaranje ---------------- */

function setTab(tab) {
    state.tab = tab;
    document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    $('offerView').classList.toggle('hidden', tab !== 'offer');
    $('ticketsView').classList.toggle('hidden', tab !== 'tickets');
    if (tab === 'tickets') loadTickets();
}

function applyOffer(offer) {
    // prazne Lua tabele mogu stići kao {} umjesto []
    offer.events = arr(offer.events);
    offer.leagues = arr(offer.leagues);
    offer.sports = arr(offer.sports);
    state.offer = offer;
    if (offer.limits) state.limits = { ...offer.limits, quickStakes: arr(offer.limits.quickStakes) };
    if (offer.currency) state.currency = offer.currency;
    const sports = offer.sports || [];
    if (!sports.find((s) => s.key === state.sport) && sports.length) state.sport = sports[0].key;
    if (state.league !== 'all' && !(offer.leagues || []).find((l) => l.key === state.league)) state.league = 'all';
}

function open(offer, tab) {
    applyOffer(offer);
    syncSlipWithOffer();
    $('stakeCur').textContent = state.currency;
    $('quick').innerHTML = (state.limits.quickStakes || []).map((v) => `<button data-quick="${v}">+${v.toLocaleString('de-DE')}</button>`).join('');
    $('app').classList.remove('hidden');
    renderOffer();
    renderSlip();
    setTab(tab || 'offer');

    clearInterval(state.refreshTimer);
    state.refreshTimer = setInterval(() => {
        if (!$('app').classList.contains('hidden') && state.tab === 'offer') refreshOffer(true);
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

/* ---------------- Eventi ---------------- */

window.addEventListener('message', (e) => {
    const d = e.data || {};
    if (d.action === 'open') open(d.offer, d.tab);
    else if (d.action === 'ticket') showTicketModal(d.ticket, d.currency);
    else if (d.action === 'close') close();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
});

$('closeBtn').addEventListener('click', close);
$('ticketModalClose').addEventListener('click', close);

document.querySelector('.tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (b) setTab(b.dataset.tab);
});

$('sports').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sport]');
    if (!b) return;
    state.sport = b.dataset.sport;
    state.league = 'all';
    state.day = 'all';
    renderOffer();
});

$('leagues').addEventListener('click', (e) => {
    const b = e.target.closest('[data-league]');
    if (!b) return;
    state.league = b.dataset.league;
    renderLeagues();
    renderDays();
    renderEvents();
    $('events').scrollTop = 0;
});

$('days').addEventListener('click', (e) => {
    const b = e.target.closest('[data-day]');
    if (!b) return;
    state.day = b.dataset.day;
    renderDays();
    renderEvents();
    $('events').scrollTop = 0;
});

$('search').addEventListener('input', (e) => {
    state.search = e.target.value;
    renderEvents();
});

$('events').addEventListener('click', (e) => {
    const b = e.target.closest('button.odd');
    if (b) toggleSelection(b.dataset.id, b.dataset.market, b.dataset.pick);
});

$('slipList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-rm]');
    if (!b) return;
    state.slip.splice(Number(b.dataset.rm), 1);
    renderSlip();
    renderEvents();
});

$('slipClear').addEventListener('click', () => {
    state.slip = [];
    renderSlip();
    renderEvents();
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
    const payable = state.tickets.filter((t) => (t.status === 'won' || t.status === 'void') && !t.paid);
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
