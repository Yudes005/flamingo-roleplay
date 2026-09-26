'use strict';

/* ==========================================================
   Flamingo RP - Animacije (NUI)
   Komunikacija sa client/main.lua je ista kao u originalu:
   poruke: menu, setData, resetQuicks, openInfoMenu, propTimeout, copyCode
   callback akcije: send_load, dataReady, close, closeAnimPos, playAnim,
                    saveFavAnims, saveQuickAnims, playSound,
                    disableMovement, enableMovement
   ========================================================== */

const QUICK_SLOTS = 7;
const BATCH = 48;
const NO_PREVIEW = ['placedemotes', 'syncedemotes'];
const CATEGORY_ICONS = ['all', 'favorites', 'general', 'dances', 'expressions', 'walks',
    'placedemotes', 'syncedemotes', 'propemotes', 'erpemotes', 'animalemotes'];

const state = {
    open: false,
    posOpen: false,
    animations: [],
    byId: new Map(),
    categories: [],
    favorites: [],
    quicks: [],              // index = slot (1..7)
    pKey: 'LSHIFT',
    category: 'all',
    query: '',
    layout: store('layout') || 'grid',
    view: [],
    rendered: 0,
    ctxAnim: null,
    dragAnim: null,
};

const $ = (sel) => document.querySelector(sel);
const el = {
    app: $('#app'),
    title: $('#menuTitle'),
    rail: $('#categoryRail'),
    catTitle: $('#categoryTitle'),
    count: $('#resultCount'),
    scroller: $('#scroller'),
    grid: $('#grid'),
    sentinel: $('#sentinel'),
    empty: $('#emptyState'),
    emptyTitle: $('#emptyTitle'),
    emptyText: $('#emptyText'),
    emptyAction: $('#emptyAction'),
    search: $('#searchInput'),
    searchWrap: document.querySelector('.search'),
    searchClear: $('#searchClear'),
    quickSlots: $('#quickSlots'),
    quickKey: $('#quickKey'),
    toast: $('#toast'),
    ctx: $('#ctx'),
    ctxLabel: $('#ctxLabel'),
    ctxCmd: $('#ctxCmd'),
    ctxFavText: $('#ctxFavText'),
    ctxSlots: $('#ctxSlots'),
    pos: $('#animPosInfoDiv'),
};

/* ---------------- helpers ---------------- */

function post(data) {
    if (typeof GetParentResourceName !== 'function') return;
    fetch(`https://${GetParentResourceName()}/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    }).catch(() => {});
}

function playSound(sound = 'CLICK_BACK', type = 'WEB_NAVIGATION_SOUNDS_PHONE') {
    post({ action: 'playSound', sound, type });
}

function store(key, value) {
    try {
        if (value === undefined) return localStorage.getItem('flamingo-anim-' + key);
        localStorage.setItem('flamingo-anim-' + key, value);
    } catch (e) { return null; }
}

function esc(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function normalize(str) {
    return String(str ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'dj');
}

function plural(n) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return `${n} animacija`;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} animacije`;
    return `${n} animacija`;
}

function iconFor(category) {
    return CATEGORY_ICONS.includes(category) ? category : 'default';
}

function svg(name) {
    return `<svg><use href="#i-${name}"/></svg>`;
}

function stillUrl(anim) {
    if (NO_PREVIEW.includes(anim.category)) return null;
    return de(getUrlImg(anim.category, anim.imgId));
}

function animatedUrl(anim) {
    if (NO_PREVIEW.includes(anim.category)) return null;
    return de(getUrl(anim.category, anim.imgId));
}

function pick(anim) {
    return { id: anim.id, name: anim.name, label: anim.label, category: anim.category, imgId: anim.imgId, animId: anim.animId };
}

let toastTimer = null;
function toast(text) {
    el.toast.textContent = text;
    el.toast.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('is-show'), 1800);
}

/* ---------------- data ---------------- */

function isFav(id) {
    return state.favorites.some((f) => Number(f.id) === Number(id));
}

function slotOf(id) {
    for (let i = 1; i <= QUICK_SLOTS; i++) {
        if (state.quicks[i] && Number(state.quicks[i].id) === Number(id)) return i;
    }
    return 0;
}

function categoryLabel(name) {
    const cat = state.categories.find((c) => c.name === name);
    return cat ? cat.label : name;
}

function sourceList(category) {
    if (category === 'all') return state.animations;
    if (category === 'favorites') return state.favorites.map((f) => state.byId.get(Number(f.id)) || f);
    return state.animations.filter((a) => a.category === category);
}

function computeView() {
    const list = sourceList(state.category);
    const q = normalize(state.query.trim());
    if (!q) return list;
    return list.filter((a) => normalize(a.label).includes(q) || normalize(a.name).includes(q));
}

/* ---------------- rail ---------------- */

function renderRail() {
    const counts = {};
    state.animations.forEach((a) => { counts[a.category] = (counts[a.category] || 0) + 1; });
    counts.all = state.animations.length;
    counts.favorites = state.favorites.length;

    let html = '';
    state.categories.forEach((cat) => {
        html += `
            <button class="tab${cat.name === state.category ? ' is-active' : ''}" data-cat="${esc(cat.name)}">
                ${esc(cat.label)}<span class="tab__count">${counts[cat.name] || 0}</span>
            </button>`;
    });
    el.rail.innerHTML = html;
}

el.rail.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    selectCategory(btn.dataset.cat);
    playSound('NAV_UP_DOWN', 'HUD_FRONTEND_DEFAULT_SOUNDSET');
});

function selectCategory(name) {
    if (!state.categories.some((c) => c.name === name)) name = 'all';
    state.category = name;
    store('category', name);
    el.rail.querySelectorAll('.tab').forEach((b) => b.classList.toggle('is-active', b.dataset.cat === name));
    el.catTitle.textContent = categoryLabel(name);
    renderView();
}

/* ---------------- grid ---------------- */

function renderView() {
    closeCtx();
    state.view = computeView();
    state.rendered = 0;
    el.grid.innerHTML = '';
    el.grid.classList.toggle('is-list', state.layout === 'list');
    el.scroller.scrollTop = 0;
    el.count.textContent = state.query.trim()
        ? `${plural(state.view.length)} · pretraga „${state.query.trim()}”`
        : plural(state.view.length);

    const empty = state.view.length === 0;
    el.empty.hidden = !empty;
    if (empty) {
        if (state.category === 'favorites' && !state.query.trim()) {
            el.emptyTitle.textContent = 'Još nemaš omiljene animacije';
            el.emptyText.textContent = 'Klikni na zvezdicu na bilo kojoj animaciji i ona će se pojaviti ovde.';
            el.emptyAction.hidden = true;
        } else {
            el.emptyTitle.textContent = 'Nema rezultata';
            el.emptyText.textContent = 'Probaj drugi naziv ili komandu.';
            el.emptyAction.hidden = state.category === 'all';
        }
    }
    appendBatch();
}

function appendBatch() {
    if (state.rendered >= state.view.length) return;
    const frag = document.createDocumentFragment();
    const next = state.view.slice(state.rendered, state.rendered + BATCH);
    next.forEach((anim) => frag.appendChild(createCard(anim)));
    state.rendered += next.length;
    el.grid.appendChild(frag);
    requestAnimationFrame(fillIfNeeded);
}

// Dodaje sledecu grupu kartica kada se priblizimo dnu liste
function fillIfNeeded() {
    const s = el.scroller;
    if (s.scrollTop + s.clientHeight >= s.scrollHeight - 600) appendBatch();
}
el.scroller.addEventListener('scroll', fillIfNeeded, { passive: true });

function createCard(anim) {
    const card = document.createElement('div');
    const slot = slotOf(anim.id);
    card.className = 'card' + (isFav(anim.id) ? ' is-fav' : '');
    card.dataset.id = anim.id;
    card.dataset.cat = anim.category;
    card.draggable = true;
    card.innerHTML = `
        ${slot ? `<span class="card__slot">${svg('bolt')}${slot}</span>` : ''}
        <button class="card__fav" data-act="fav" title="Omiljeni">${svg('favorites')}</button>
        <div class="card__media">
            <span class="card__ph">${svg(iconFor(anim.category))}</span>
        </div>
        <div class="card__body">
            <span class="card__label">${esc(anim.label)}</span>
            <span class="card__cmd"><b>/e</b> ${esc(anim.name)}</span>
        </div>`;

    const still = stillUrl(anim);
    if (still) {
        const media = card.querySelector('.card__media');
        const img = new Image();
        img.loading = 'lazy';
        img.decoding = 'async';
        img.alt = '';
        img.onload = () => media.classList.add('has-img');
        img.src = still;
        media.appendChild(img);

        // Na hover se pusta animirani pregled; ako ne postoji, ostaje staticna slika
        let moving = animatedUrl(anim);
        img.onerror = () => {
            if (moving && img.src === moving) { moving = null; img.src = still; return; }
            img.remove();
            media.classList.remove('has-img');
        };
        card.addEventListener('mouseenter', () => { if (moving && img.isConnected) img.src = moving; });
        card.addEventListener('mouseleave', () => { if (img.isConnected && img.src !== still) img.src = still; });
    }
    return card;
}

el.grid.addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    const anim = findAnim(card.dataset.id);
    if (!anim) return;
    if (e.target.closest('[data-act="fav"]')) {
        toggleFavorite(anim);
        return;
    }
    playAnim(anim, card);
});

el.grid.addEventListener('contextmenu', (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    e.preventDefault();
    const anim = findAnim(card.dataset.id);
    if (anim) openCtx(anim, e.clientX, e.clientY);
});

el.grid.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    state.dragAnim = findAnim(card.dataset.id);
    card.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', card.dataset.id);
});

el.grid.addEventListener('dragend', (e) => {
    const card = e.target.closest('.card');
    if (card) card.classList.remove('is-dragging');
    state.dragAnim = null;
});

el.emptyAction.addEventListener('click', () => selectCategory('all'));

function findAnim(id) {
    id = Number(id);
    return state.byId.get(id) || state.favorites.find((f) => Number(f.id) === id) || null;
}

function refreshCard(id) {
    el.grid.querySelectorAll(`.card[data-id="${Number(id)}"]`).forEach((card) => {
        const anim = findAnim(id);
        if (anim) card.replaceWith(createCard(anim));
    });
}

/* ---------------- actions ---------------- */

function playAnim(anim, card) {
    playSound();
    post({ action: 'playAnim', id: Number(anim.animId), category: anim.category });
    if (card) {
        card.classList.remove('is-played');
        void card.offsetWidth;
        card.classList.add('is-played');
    }
}

function toggleFavorite(anim) {
    const id = Number(anim.id);
    if (isFav(id)) {
        state.favorites = state.favorites.filter((f) => Number(f.id) !== id);
        toast(`Uklonjeno iz omiljenih: ${anim.label}`);
    } else {
        state.favorites.push(pick(anim));
        toast(`Dodato u omiljene: ${anim.label}`);
    }
    playSound();
    post({ action: 'saveFavAnims', favoriteAnimations: state.favorites });

    const countEl = el.rail.querySelector('.tab[data-cat="favorites"] .tab__count');
    if (countEl) countEl.textContent = state.favorites.length;

    if (state.category === 'favorites') renderView();
    else refreshCard(id);
}

function copyCommand(anim) {
    copyText(`/e ${anim.name}`);
    toast(`Kopirano: /e ${anim.name}`);
}

function copyText(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    ta.remove();
}

/* ---------------- quick slots ---------------- */

function renderQuickSlots() {
    el.quickKey.textContent = state.pKey;
    let html = '';
    for (let i = 1; i <= QUICK_SLOTS; i++) {
        const q = state.quicks[i];
        if (q) {
            const still = stillUrl(q);
            html += `
                <div class="slot is-filled" data-slot="${i}" title="${esc(q.label)} · desni klik za uklanjanje">
                    <span class="slot__num">${i}</span>
                    <span class="slot__ph">${svg(iconFor(q.category))}</span>
                    ${still ? `<img src="${esc(still)}" alt="" onerror="this.remove()">` : ''}
                    <span class="slot__name">${esc(q.label)}</span>
                </div>`;
        } else {
            html += `<div class="slot" data-slot="${i}" title="Prevuci animaciju ovde">${i}</div>`;
        }
    }
    el.quickSlots.innerHTML = html;
}

function setQuick(anim, slot) {
    // Jedna animacija moze biti samo na jednom slotu
    const prev = slotOf(anim.id);
    if (prev) state.quicks[prev] = null;
    const replaced = state.quicks[slot];
    state.quicks[slot] = { ...pick(anim), slot };
    saveQuicks();
    renderQuickSlots();
    [anim.id, replaced && replaced.id].forEach((id) => id && refreshCard(id));
    toast(`Slot ${slot}: ${anim.label}`);
    playSound();
}

function clearQuick(slot) {
    const q = state.quicks[slot];
    if (!q) return;
    state.quicks[slot] = null;
    saveQuicks();
    renderQuickSlots();
    refreshCard(q.id);
    toast(`Slot ${slot} je ispražnjen`);
    playSound();
}

function saveQuicks() {
    const list = [];
    for (let i = 1; i <= QUICK_SLOTS; i++) if (state.quicks[i]) list.push(state.quicks[i]);
    post({ action: 'saveQuickAnims', quickAnimations: list });
}

el.quickSlots.addEventListener('click', (e) => {
    const slot = e.target.closest('.slot');
    if (!slot) return;
    const q = state.quicks[Number(slot.dataset.slot)];
    if (q) playAnim(q);
});

el.quickSlots.addEventListener('contextmenu', (e) => {
    const slot = e.target.closest('.slot');
    if (!slot) return;
    e.preventDefault();
    clearQuick(Number(slot.dataset.slot));
});

el.quickSlots.addEventListener('dragover', (e) => {
    const slot = e.target.closest('.slot');
    if (!slot || !state.dragAnim) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    el.quickSlots.querySelectorAll('.slot.is-over').forEach((s) => s !== slot && s.classList.remove('is-over'));
    slot.classList.add('is-over');
});

el.quickSlots.addEventListener('dragleave', (e) => {
    const slot = e.target.closest('.slot');
    if (slot && !slot.contains(e.relatedTarget)) slot.classList.remove('is-over');
});

el.quickSlots.addEventListener('drop', (e) => {
    const slot = e.target.closest('.slot');
    if (!slot || !state.dragAnim) return;
    e.preventDefault();
    slot.classList.remove('is-over');
    setQuick(state.dragAnim, Number(slot.dataset.slot));
    state.dragAnim = null;
});

/* ---------------- context menu ---------------- */

function openCtx(anim, x, y) {
    state.ctxAnim = anim;
    el.ctxLabel.textContent = anim.label;
    el.ctxCmd.textContent = `/e ${anim.name}`;
    el.ctxFavText.textContent = isFav(anim.id) ? 'Ukloni iz omiljenih' : 'Dodaj u omiljene';

    const current = slotOf(anim.id);
    let html = '';
    for (let i = 1; i <= QUICK_SLOTS; i++) {
        const cls = i === current ? ' is-current' : (state.quicks[i] ? ' is-used' : '');
        const title = state.quicks[i] ? `Zameni: ${state.quicks[i].label}` : 'Prazan slot';
        html += `<button class="ctx__slot${cls}" data-slot="${i}" title="${esc(title)}">${i}</button>`;
    }
    el.ctxSlots.innerHTML = html;

    el.ctx.hidden = false;
    const r = el.ctx.getBoundingClientRect();
    el.ctx.style.left = Math.min(x, window.innerWidth - r.width - 8) + 'px';
    el.ctx.style.top = Math.min(y, window.innerHeight - r.height - 8) + 'px';
}

function closeCtx() {
    el.ctx.hidden = true;
    state.ctxAnim = null;
}

el.ctx.addEventListener('click', (e) => {
    const anim = state.ctxAnim;
    if (!anim) return;
    const item = e.target.closest('[data-ctx]');
    const slot = e.target.closest('[data-slot]');
    if (item) {
        const act = item.dataset.ctx;
        if (act === 'play') playAnim(anim, el.grid.querySelector(`.card[data-id="${anim.id}"]`));
        if (act === 'fav') toggleFavorite(anim);
        if (act === 'copy') copyCommand(anim);
    } else if (slot) {
        const n = Number(slot.dataset.slot);
        if (slotOf(anim.id) === n) clearQuick(n);
        else setQuick(anim, n);
    } else {
        return;
    }
    closeCtx();
});

document.addEventListener('mousedown', (e) => {
    if (!el.ctx.hidden && !el.ctx.contains(e.target)) closeCtx();
});
el.scroller.addEventListener('wheel', () => { if (!el.ctx.hidden) closeCtx(); }, { passive: true });
document.addEventListener('contextmenu', (e) => e.preventDefault());

/* ---------------- search ---------------- */

let searchTimer = null;
el.search.addEventListener('input', () => {
    state.query = el.search.value;
    el.searchWrap.classList.toggle('has-value', state.query.length > 0);
    clearTimeout(searchTimer);
    searchTimer = setTimeout(renderView, 110);
});

el.search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && state.view.length) {
        e.preventDefault();
        playAnim(state.view[0], el.grid.querySelector('.card'));
    }
});

el.search.addEventListener('focus', () => post({ action: 'disableMovement' }));
el.search.addEventListener('blur', () => post({ action: 'enableMovement' }));

el.searchClear.addEventListener('click', () => {
    el.search.value = '';
    state.query = '';
    el.searchWrap.classList.remove('has-value');
    renderView();
    el.search.focus();
});

/* ---------------- layout ---------------- */

function setLayout(layout) {
    state.layout = layout === 'list' ? 'list' : 'grid';
    store('layout', state.layout);
    document.querySelectorAll('.seg__btn').forEach((b) => b.classList.toggle('is-active', b.dataset.layout === state.layout));
    el.grid.classList.toggle('is-list', state.layout === 'list');
}

document.querySelectorAll('.seg__btn').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.layout === state.layout) return;
    setLayout(b.dataset.layout);
    playSound('NAV_UP_DOWN', 'HUD_FRONTEND_DEFAULT_SOUNDSET');
}));

/* ---------------- open / close ---------------- */

function showMenu(show) {
    state.open = show;
    el.app.classList.toggle('is-open', show);
    el.app.setAttribute('aria-hidden', String(!show));
    if (!show) {
        closeCtx();
        el.search.blur();
    }
}

function closeMenu() {
    showMenu(false);
    post({ action: 'close' });
}

$('#closeBtn').addEventListener('click', closeMenu);

function showPositioning(show) {
    state.posOpen = show;
    el.pos.classList.toggle('is-show', show);
}

document.addEventListener('keydown', (e) => {
    if (!state.open) return;
    if ((e.ctrlKey && e.key.toLowerCase() === 'f') || (e.key === '/' && document.activeElement !== el.search)) {
        e.preventDefault();
        el.search.focus();
        el.search.select();
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key !== 'Escape') return;
    if (!el.ctx.hidden) { closeCtx(); return; }
    if (state.open) {
        closeMenu();
    } else if (state.posOpen) {
        showPositioning(false);
        post({ action: 'closeAnimPos' });
    }
});

/* ---------------- NUI poruke ---------------- */

window.addEventListener('message', (event) => {
    const ed = event.data || {};

    switch (ed.action) {
        case 'menu':
            if (ed.state) {
                const t = ed.translations || {};
                if (t.title) el.title.textContent = t.title;
                showMenu(true);
                if (ed.menu) selectCategory(ed.menu);
            } else {
                showMenu(false);
            }
            break;

        case 'setData':
            state.animations = ed.animations || [];
            state.byId = new Map(state.animations.map((a) => [Number(a.id), a]));
            state.categories = ed.categories || [];
            state.favorites = Array.isArray(ed.favs) ? ed.favs : [];
            state.pKey = ed.pKey || 'LSHIFT';
            state.quicks = [];
            (ed.quicks || []).forEach((q) => {
                const slot = Number(q && q.slot);
                if (slot >= 1 && slot <= QUICK_SLOTS) state.quicks[slot] = q;
            });
            renderRail();
            renderQuickSlots();
            setLayout(state.layout);
            selectCategory(store('category') || 'all');
            if (ed.sender === '0resmon') post({ action: 'dataReady' });
            break;

        case 'resetQuicks':
            state.quicks = [];
            renderQuickSlots();
            if (state.open) renderView();
            break;

        case 'openInfoMenu':
            showPositioning(!!ed.state);
            break;

        case 'propTimeout':
            el.app.classList.toggle('prop-cooldown', !!ed.state);
            break;

        case 'copyCode':
            if (ed.code) {
                copyText(String(ed.code));
                toast('Kod je kopiran');
            }
            break;
    }
});

document.addEventListener('DOMContentLoaded', () => post({ action: 'send_load' }));
