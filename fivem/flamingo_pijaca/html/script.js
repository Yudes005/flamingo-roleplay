const resourceName = (typeof GetParentResourceName === 'function') ? GetParentResourceName() : 'flamingo_pijaca';

const el = (id) => document.getElementById(id);

const panelEl = el('panel');
const eyebrowEl = el('panel-eyebrow');
const titleEl = el('panel-title');
const itemCardEl = el('item-card');
const itemImgEl = el('item-img');
const itemLabelEl = el('item-label');
const itemSubEl = el('item-sub');
const qtyLabelEl = el('qty-label');
const qtyInput = el('qty-input');
const qtyHintEl = el('qty-hint');
const priceFieldEl = el('price-field');
const priceInput = el('price-input');
const priceHintEl = el('price-hint');
const summaryLabelEl = el('summary-label');
const summaryValueEl = el('summary-value');
const errorEl = el('error-msg');
const confirmBtn = el('btn-confirm');

let state = null; // { mode, data, min, max }

function post(name, data) {
    return fetch(`https://${resourceName}/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(data || {}),
    }).catch(() => {});
}

function money(n) {
    return '$' + Math.floor(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function toInt(value) {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : null;
}

function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
}

function hide() {
    panelEl.classList.add('hidden');
    state = null;
}

function cancel() {
    if (!state) return;
    hide();
    post('close');
}

function getQty() {
    const n = toInt(qtyInput.value);
    return n === null ? null : n;
}

function update() {
    if (!state) return;
    const { mode, data } = state;
    const qty = getQty();
    let total = 0;
    let error = '';

    if (qty === null || qty < state.min || qty > state.max) {
        error = mode === 'rent'
            ? `Upiši broj sati od ${state.min} do ${state.max}.`
            : `Količina mora biti od ${state.min} do ${state.max}.`;
    }

    if (mode === 'rent') {
        total = (qty || 0) * data.pricePerHour;
    } else if (mode === 'price') {
        const price = toInt(priceInput.value);
        if (!error && (price === null || price < data.minPrice || price > data.maxPrice)) {
            error = priceInput.value === '' ? 'Upiši cenu po komadu.' : `Cena mora biti od ${money(data.minPrice)} do ${money(data.maxPrice)}.`;
        }
        total = (qty || 0) * (price || 0);
    } else if (mode === 'buy') {
        total = (qty || 0) * data.price;
    }

    summaryValueEl.textContent = money(total);
    errorEl.textContent = error;
    confirmBtn.disabled = error !== '';
    return error === '';
}

function confirm() {
    if (!state || !update()) return;
    const { mode, data } = state;
    const qty = getQty();
    hide();

    if (mode === 'rent') {
        post('confirmRent', { stallId: data.stallId, hours: qty });
    } else if (mode === 'price') {
        post('confirmPrice', { stallId: data.stallId, slot: data.slot, name: data.name, count: qty, price: toInt(priceInput.value) });
    } else if (mode === 'buy') {
        post('confirmBuy', { stallId: data.stallId, slot: data.slot, name: data.name, count: qty, price: data.price });
    }
}

function setItem(data) {
    itemCardEl.classList.remove('hidden');
    itemImgEl.style.visibility = 'visible';
    itemImgEl.onerror = () => { itemImgEl.style.visibility = 'hidden'; };
    itemImgEl.src = `nui://ox_inventory/web/images/${data.name}.png`;
    itemLabelEl.textContent = data.label || data.name;
}

function open(data) {
    const mode = data.mode;
    state = { mode, data, min: 1, max: 1 };

    itemCardEl.classList.add('hidden');
    priceFieldEl.classList.add('hidden');
    priceInput.value = '';
    priceHintEl.textContent = '';

    if (mode === 'rent') {
        state.min = data.minHours;
        state.max = data.maxHours;
        eyebrowEl.textContent = 'Iznajmljivanje';
        titleEl.textContent = data.stallLabel;
        qtyLabelEl.textContent = 'Broj sati';
        qtyInput.value = data.minHours;
        qtyHintEl.textContent = `${money(data.pricePerHour)} po satu · od ${data.minHours} do ${data.maxHours}h`;
        summaryLabelEl.textContent = 'Ukupno za najam';
        confirmBtn.textContent = 'Iznajmi';
    } else if (mode === 'price') {
        state.max = data.max;
        eyebrowEl.textContent = 'Stavi na tezgu';
        titleEl.textContent = 'Postavi cenu';
        setItem(data);
        itemSubEl.textContent = `U inventaru: ${data.max}`;
        qtyLabelEl.textContent = 'Količina za prodaju';
        qtyInput.value = clamp(data.count, 1, data.max);
        qtyHintEl.textContent = '';
        priceFieldEl.classList.remove('hidden');
        priceHintEl.textContent = 'Kupac će videti ovu cenu na itemu na tezgi.';
        summaryLabelEl.textContent = 'Ukupna vrednost';
        confirmBtn.textContent = 'Stavi na tezgu';
    } else if (mode === 'buy') {
        state.max = data.max;
        eyebrowEl.textContent = data.seller ? `Prodavac: ${data.seller}` : 'Kupovina';
        titleEl.textContent = 'Kupi sa tezge';
        setItem(data);
        itemSubEl.textContent = `${money(data.price)} po komadu · Na stanju: ${data.max}`;
        qtyLabelEl.textContent = 'Količina';
        qtyInput.value = clamp(data.count, 1, data.max);
        qtyHintEl.textContent = '';
        summaryLabelEl.textContent = 'Ukupno za plaćanje';
        confirmBtn.textContent = 'Kupi';
    } else {
        state = null;
        return;
    }

    qtyInput.min = state.min;
    qtyInput.max = state.max;

    panelEl.classList.remove('hidden');
    update();

    const focusEl = mode === 'price' ? priceInput : qtyInput;
    setTimeout(() => { focusEl.focus(); focusEl.select(); }, 50);
}

function step(delta) {
    if (!state) return;
    const current = getQty() ?? state.min;
    qtyInput.value = clamp(current + delta, state.min, state.max);
    update();
}

el('qty-minus').addEventListener('click', () => step(-1));
el('qty-plus').addEventListener('click', () => step(1));
qtyInput.addEventListener('input', update);
priceInput.addEventListener('input', update);
el('btn-close').addEventListener('click', cancel);
el('btn-cancel').addEventListener('click', cancel);
confirmBtn.addEventListener('click', confirm);

document.addEventListener('keydown', (e) => {
    if (!state) return;
    if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
    } else if (e.key === 'Enter') {
        e.preventDefault();
        confirm();
    }
});

window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data) return;

    if (data.action === 'open') {
        open(data);
    } else if (data.action === 'close') {
        hide();
    }
});
