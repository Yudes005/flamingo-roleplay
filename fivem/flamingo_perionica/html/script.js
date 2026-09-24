/* =========================================================
   flamingo_perionica — NUI logika
   ========================================================= */

const el = (id) => document.getElementById(id);

const root = el('root');
const locationName = el('locationName');
const moneyEl = el('money');
const plateEl = el('plate');
const modelEl = el('model');
const dirtLabel = el('dirtLabel');
const dirtValue = el('dirtValue');
const dirtFill = el('dirtFill');
const dirtTrack = dirtFill.parentElement;
const packagesEl = el('packages');
const washBtn = el('wash');
const washText = el('washText');
const ownerTag = el('ownerTag');
const bizBtn = el('bizBtn');
const bizPanel = el('bizPanel');
const washView = el('washView');

let biz = null;          // flamingo_biznisi: vlasnik, cena, udeo (null = bez sistema biznisa)
let bizArmed = false;
let bizArmTimer = null;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Nazivi koji se vide u meniju za ono sto paket stvarno radi u igri.
const FEATURES = {
    dirt:    'Skida prljavštinu',
    decals:  'Briše blato i tragove',
    windows: 'Vraća polomljena stakla',
    tyres:   'Krpi izduvane gume',
    wax:     'Zaštita, ostaje čisto duže',
};

const state = {
    open: false,
    money: 0,
    packages: [],
    selected: null,
};

function post(name, data) {
    return fetch(`https://${GetParentResourceName()}/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(data || {}),
    }).then((r) => r.json()).catch(() => null);
}

function money(value) {
    return `$${Math.round(value).toLocaleString('sr-RS')}`;
}

function seconds(ms) {
    return Math.round((ms || 0) / 1000);
}

/* ---------------- Paketi ---------------- */

function renderPackages() {
    packagesEl.innerHTML = '';

    state.packages.forEach((pack) => {
        const card = document.createElement('button');
        const affordable = pack.price <= state.money;

        card.type = 'button';
        card.className = `pack${affordable ? '' : ' is-broke'}${state.selected === pack.id ? ' is-active' : ''}`;
        card.dataset.id = pack.id;

        // Prikazuju se sve stavke, a one koje paket nema su prigušene - lakše poređenje.
        const features = Object.keys(FEATURES)
            .map((key) => {
                const on = pack.features && pack.features[key];
                return `<li class="${on ? '' : 'is-off'}"><i class="fa-solid ${on ? 'fa-check' : 'fa-minus'}"></i>${FEATURES[key]}</li>`;
            })
            .join('');

        card.innerHTML = `
            <div class="pack__head">
                <span class="pack__radio"></span>
                <span class="pack__time"><i class="fa-regular fa-clock"></i>${seconds(pack.duration)} s</span>
            </div>
            <span class="pack__name">${pack.label}</span>
            <p class="pack__desc">${pack.desc || ''}</p>
            <span class="pack__price">${money(pack.price)}</span>
            <ul class="pack__list">${features}</ul>
        `;

        if (affordable) {
            card.addEventListener('click', () => {
                state.selected = pack.id;
                renderPackages();
                renderCta();
            });
        }

        packagesEl.appendChild(card);
    });
}

function renderCta() {
    const pack = state.packages.find((p) => p.id === state.selected);

    if (!pack) {
        washBtn.disabled = true;
        washText.textContent = 'Izaberi paket';
        return;
    }

    if (pack.price > state.money) {
        washBtn.disabled = true;
        washText.textContent = `Fali ti ${money(pack.price - state.money)}`;
        return;
    }

    washBtn.disabled = false;
    washText.textContent = `Operi za ${money(pack.price)}`;
}

washBtn.addEventListener('click', () => {
    if (!state.selected) return;
    post('wash', { id: state.selected });
    close();
});

/* ---------------- Biznis (flamingo_biznisi) ---------------- */

function renderBizHeader() {
    const show = !!biz;
    ownerTag.classList.toggle('hidden', !show);
    bizBtn.classList.toggle('hidden', !show);
    if (!show) return;
    ownerTag.classList.toggle('free', !biz.owned);
    ownerTag.innerHTML = `
        <span class="owner-ic"><i class="fa-solid ${biz.owned ? 'fa-crown' : 'fa-tag'}"></i></span>
        <span class="owner-t"><small>Vlasnik</small><strong>${biz.owned ? esc(biz.ownerName || 'Nepoznat') : 'Na prodaju'}</strong></span>`;
}

function renderBizPanel() {
    if (!biz) return;
    const share = biz.share || 35;
    const earn = state.packages.map((p) => `
        <div class="biz-row"><span>${esc(p.label)}</span><span>${money(p.price)}</span><b>+${money(Math.floor(p.price * share / 100))}</b></div>`).join('');

    let foot;
    if (biz.mine) {
        foot = `<div class="biz-note"><i class="fa-solid fa-tablet-screen-button"></i><span>Ovo je tvoja perionica. Kasom i zaradom upravljaš na <b>tabletu</b>, aplikacija <b>Moj biznis</b>.</span></div>`;
    } else if (biz.owned) {
        foot = `<div class="biz-note"><i class="fa-solid fa-lock"></i><span>Ova perionica već ima vlasnika. Biznisi se preprodaju na <b>aukciji</b>.</span></div>`;
    } else if (biz.canBuy) {
        const limit = biz.maxCount > 0 && biz.myCount >= biz.maxCount;
        const from = biz.buyFrom === 'money' ? biz.cash : (biz.buyFrom === 'bank' ? biz.bank : Math.max(biz.bank, biz.cash));
        const enough = from >= biz.price;
        foot = `
            <div class="biz-note test"><i class="fa-solid fa-flask"></i><span><b>TEST:</b> kupovina iz menija je privremena. Kasnije se biznisi kupuju na aukciji.</span></div>
            <button class="cta biz-buy ${bizArmed ? 'armed' : ''}" id="bizBuy" type="button" ${limit || !enough ? 'disabled' : ''}>
                <i class="fa-solid ${bizArmed ? 'fa-check' : 'fa-cart-shopping'}"></i><span>${bizArmed ? 'Klikni ponovo da potvrdiš' : `Kupi perionicu za ${money(biz.price)}`}</span>
            </button>
            <p class="biz-sub">${limit ? 'Već imaš biznis. Možeš imati samo jedan.' : `Plaća se sa računa${enough ? '.' : '. Nemaš dovoljno novca.'}`}</p>`;
    } else {
        foot = `<div class="biz-note"><i class="fa-solid fa-gavel"></i><span>Ova perionica je na prodaju, ali se kupuje isključivo na <b>aukciji</b>.</span></div>`;
    }

    bizPanel.innerHTML = `
        <div class="biz-head">
            <span class="bar__mark"><i class="fa-solid fa-briefcase"></i></span>
            <div class="biz-t">
                <small>Biznis · Perionica · ID #${biz.id}</small>
                <strong>${esc(biz.name)}</strong>
                <span class="biz-status ${biz.mine ? 'mine' : (biz.owned ? 'owned' : 'sale')}">${biz.mine ? 'Tvoj biznis' : (biz.owned ? 'Vlasnik: ' + esc(biz.ownerName || 'Nepoznat') : 'Na prodaju')}</span>
            </div>
            <div class="biz-price"><small>${biz.owned ? 'Vrednost perionice' : 'Cena perionice'}</small><b>${money(biz.price)}</b></div>
        </div>
        <div class="biz-earn">
            <div class="biz-earn-h"><span>Zarada vlasnika: <b>${share}%</b> od svakog pranja</span></div>
            <div class="biz-row head"><span>Paket</span><span>Cena</span><span>Vlasnik dobija</span></div>
            ${earn}
        </div>
        ${foot}
        <button class="biz-back" id="bizBack" type="button"><i class="fa-solid fa-arrow-left"></i> Nazad na pranje</button>`;
}

function toggleBiz(show) {
    bizArmed = false;
    bizPanel.classList.toggle('hidden', !show);
    washView.classList.toggle('hidden', show);
    bizBtn.classList.toggle('active', show);
    if (show) renderBizPanel();
}

bizBtn.addEventListener('click', () => toggleBiz(bizPanel.classList.contains('hidden')));

bizPanel.addEventListener('click', async (e) => {
    if (e.target.closest('#bizBack')) return toggleBiz(false);
    const buy = e.target.closest('#bizBuy');
    if (!buy || buy.disabled) return;
    if (!bizArmed) {
        bizArmed = true;
        clearTimeout(bizArmTimer);
        bizArmTimer = setTimeout(() => { bizArmed = false; renderBizPanel(); }, 3500);
        return renderBizPanel();
    }
    clearTimeout(bizArmTimer);
    bizArmed = false;
    buy.disabled = true;
    const info = await post('bizBuy', { id: biz.id });
    if (info && typeof info === 'object') {
        biz = info;
        renderBizHeader();
    }
    renderBizPanel();
});

/* ---------------- Otvaranje / zatvaranje ---------------- */

function close() {
    if (!state.open) return;
    state.open = false;
    root.classList.add('hidden');
    root.classList.remove('is-open');
    post('close');
}

el('close').addEventListener('click', close);

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
});

function open(data) {
    biz = data.biz || null;
    renderBizHeader();
    toggleBiz(false);
    state.money = data.money || 0;
    state.packages = data.packages || [];
    state.selected = null;

    locationName.textContent = data.location || 'Auto perionica';
    moneyEl.textContent = money(state.money);

    const vehicle = data.vehicle || {};
    const dirt = Math.max(0, Math.min(100, vehicle.dirt || 0));

    plateEl.textContent = vehicle.plate || 'Bez tablica';
    modelEl.textContent = vehicle.model || '';
    dirtValue.textContent = `${dirt}%`;
    dirtFill.style.width = `${Math.max(dirt, 2)}%`;

    if (dirt <= 10) {
        dirtLabel.textContent = 'Vozilo je čisto';
        dirtTrack.classList.add('is-clean');
    } else {
        dirtLabel.textContent = 'Prljavo';
        dirtTrack.classList.remove('is-clean');
    }

    renderPackages();
    renderCta();

    state.open = true;
    root.classList.remove('hidden');
    root.classList.add('is-open');
}

window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data) return;

    if (data.action === 'open') {
        open(data);
    } else if (data.action === 'close') {
        state.open = false;
        root.classList.add('hidden');
        root.classList.remove('is-open');
    }
});
