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
    }).catch(() => {});
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
