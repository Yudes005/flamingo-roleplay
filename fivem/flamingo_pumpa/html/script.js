/* =========================================================
   flamingo_pumpa — NUI logika
   NUI ugovor (poruke i callback-ovi) je identican staroj verziji,
   tako da client/main.lua i server/main.lua ostaju nepromenjeni.
   ========================================================= */

const el = (id) => document.getElementById(id);

const root = el('root');
const lcdLiters = el('lcdLiters');
const lcdPrice = el('lcdPrice');
const lcdPlate = el('lcdPlate');
const lcdRate = el('lcdRate');
const lcdVeil = el('lcdVeil');
const barSub = el('barSub');
const mark = el('mark');
const moneyEl = el('money');

const tankBars = el('tankBars');
const tankFill = el('tankFill');
const tankAdd = el('tankAdd');
const tankNow = el('tankNow');
const tankMax = el('tankMax');

const controls = el('controls');
const slider = el('slider');
const presets = document.querySelectorAll('.preset');
const refuelBtn = el('refuel');
const refuelText = el('refuelText');

const canisterItem = el('canisterItem');
const canisterSub = el('canisterSub');
const canisterPrice = el('canisterPrice');
const canisterStepper = el('canisterStepper');
const canisterQty = el('canisterQty');
const canisterMinus = el('canisterMinus');
const canisterPlus = el('canisterPlus');
const canisterBuy = el('canisterBuy');
const canisterBuyText = el('canisterBuyText');

const repairItem = el('repairItem');
const repairPrice = el('repairPrice');
const repairQty = el('repairQty');
const repairMinus = el('repairMinus');
const repairPlus = el('repairPlus');
const repairBuy = el('repairBuy');
const repairBuyText = el('repairBuyText');

const state = {
    open: false,
    netId: null,
    pricePerLiter: 20,
    money: 0,
    currentLiters: 0,
    maxLiters: 0,

    canisterMode: null, // 'buy' | 'refill' | null
    canisterBuyPrice: 1000,
    canisterRefillPrice: 800,
    canisterMaxQty: 5,
    canisterQtyValue: 1,

    repairPriceValue: 1500,
    repairMaxQty: 10,
    repairQtyValue: 1,
};

/* ---------------- Pomocne ---------------- */

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

// Brojevi na displeju se prebrojavaju do nove vrednosti umesto da skoce.
let lcdFrom = { liters: 0, price: 0 };
let lcdRaf = null;

function setLcd(liters, price) {
    lcdLiters.innerHTML = `${Math.round(liters)}<i>L</i>`;
    lcdPrice.textContent = money(price);
}

function animateLcd(liters, price, instant) {
    if (lcdRaf) cancelAnimationFrame(lcdRaf);

    if (instant) {
        lcdFrom = { liters, price };
        setLcd(liters, price);
        return;
    }

    const start = performance.now();
    const from = { ...lcdFrom };
    const duration = 240;

    const step = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const ease = 1 - Math.pow(1 - t, 3);

        setLcd(
            from.liters + (liters - from.liters) * ease,
            from.price + (price - from.price) * ease,
        );

        if (t < 1) {
            lcdRaf = requestAnimationFrame(step);
        } else {
            lcdFrom = { liters, price };
            lcdRaf = null;
        }
    };

    lcdRaf = requestAnimationFrame(step);
}

/* ---------------- Prikaz goriva ---------------- */

function paintTank(current, added) {
    const max = state.maxLiters || 1;
    const nowPct = Math.min(100, (current / max) * 100);
    const addPct = Math.min(100, ((current + added) / max) * 100);

    tankBars.classList.toggle('tank--low', state.maxLiters > 0 && nowPct <= 15 && added === 0);
    tankFill.style.width = `${state.maxLiters > 0 ? nowPct : 0}%`;
    tankAdd.style.width = `${state.maxLiters > 0 ? addPct : 0}%`;
}

function render(instant) {
    const liters = parseInt(slider.value, 10) || 0;
    const max = parseInt(slider.max, 10) || 0;
    const price = Math.ceil(liters * state.pricePerLiter);

    slider.style.setProperty('--val', `${max > 0 ? (liters / max) * 100 : 0}%`);

    animateLcd(liters, price, instant === true);
    tankNow.textContent = state.currentLiters + liters;

    paintTank(state.currentLiters, liters);

    const canAfford = price <= state.money;
    refuelBtn.disabled = liters <= 0 || !canAfford;

    if (liters > 0 && !canAfford) {
        refuelText.textContent = `Fali ti ${money(price - state.money)}`;
    } else if (!state.netId) {
        refuelText.textContent = 'Nema vozila u blizini';
    } else if (max <= 0) {
        refuelText.textContent = 'Rezervoar je pun';
    } else {
        refuelText.textContent = 'Sipaj gorivo';
    }
}

/* ---------------- Gorivo: interakcija ---------------- */

slider.addEventListener('input', render);

presets.forEach((btn) => {
    btn.addEventListener('click', () => {
        const max = parseInt(slider.max, 10) || 0;
        const step = btn.dataset.add === 'max' ? max : parseInt(btn.dataset.add, 10);
        slider.value = Math.min(max, step);
        render();
    });
});

refuelBtn.addEventListener('click', () => {
    const liters = parseInt(slider.value, 10) || 0;
    if (liters <= 0 || !state.netId) return;

    post('refuel', { liters, netId: state.netId });
    close();
});

/* ---------------- Kanister ---------------- */

function renderCanister() {
    canisterQty.textContent = state.canisterQtyValue;
    canisterMinus.disabled = state.canisterQtyValue <= 1;
    canisterPlus.disabled = state.canisterQtyValue >= state.canisterMaxQty;

    if (state.canisterMode === 'buy') {
        canisterPrice.textContent = money(state.canisterBuyPrice * state.canisterQtyValue);
        canisterBuyText.textContent = state.canisterQtyValue > 1 ? `Kupi ${state.canisterQtyValue}x` : 'Kupi';
    }
}

canisterMinus.addEventListener('click', () => {
    if (state.canisterQtyValue > 1) {
        state.canisterQtyValue -= 1;
        renderCanister();
    }
});

canisterPlus.addEventListener('click', () => {
    if (state.canisterQtyValue < state.canisterMaxQty) {
        state.canisterQtyValue += 1;
        renderCanister();
    }
});

canisterBuy.addEventListener('click', () => {
    if (!state.canisterMode) return;
    post('buyCanister', { mode: state.canisterMode, qty: state.canisterQtyValue });
    close();
});

/* ---------------- Repair kit ---------------- */

function renderRepair() {
    repairQty.textContent = state.repairQtyValue;
    repairMinus.disabled = state.repairQtyValue <= 1;
    repairPlus.disabled = state.repairQtyValue >= state.repairMaxQty;
    repairPrice.textContent = money(state.repairPriceValue * state.repairQtyValue);
    repairBuyText.textContent = state.repairQtyValue > 1 ? `Kupi ${state.repairQtyValue}x` : 'Kupi';
}

repairMinus.addEventListener('click', () => {
    if (state.repairQtyValue > 1) {
        state.repairQtyValue -= 1;
        renderRepair();
    }
});

repairPlus.addEventListener('click', () => {
    if (state.repairQtyValue < state.repairMaxQty) {
        state.repairQtyValue += 1;
        renderRepair();
    }
});

repairBuy.addEventListener('click', () => {
    post('buyRepairKit', { qty: state.repairQtyValue });
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
    state.pricePerLiter = data.pricePerLiter || 20;
    state.money = data.money || 0;

    moneyEl.textContent = money(state.money);
    lcdRate.textContent = `${money(state.pricePerLiter)} / litar`;

    if (data.vehicle) {
        state.netId = data.vehicle.netId;
        state.currentLiters = data.vehicle.currentLiters;
        state.maxLiters = data.vehicle.maxLiters;

        const remaining = Math.max(0, data.vehicle.maxLiters - data.vehicle.currentLiters);

        lcdVeil.classList.add('hidden');
        mark.classList.add('is-live');
        controls.classList.toggle('is-off', remaining <= 0);
        lcdPlate.textContent = data.vehicle.plate || 'Bez tablica';
        barSub.textContent = `Vozilo spremno · ${Math.round(data.vehicle.fuelPercent)}% u rezervoaru`;

        tankMax.textContent = data.vehicle.maxLiters;
        slider.max = remaining;
        slider.value = 0;
        slider.disabled = remaining <= 0;
        presets.forEach((btn) => { btn.disabled = remaining <= 0; });
    } else {
        state.netId = null;
        state.currentLiters = 0;
        state.maxLiters = 0;

        lcdVeil.classList.remove('hidden');
        mark.classList.remove('is-live');
        controls.classList.add('is-off');
        lcdPlate.textContent = 'Nema vozila';
        barSub.textContent = 'Samoposlužni terminal';

        tankMax.textContent = '0';
        slider.max = 0;
        slider.value = 0;
    }

    render(true);

    /* Kanister */
    const canister = data.canister || { hasCanister: false, ammo: 0 };
    const canisterCfg = data.canisterConfig || { buyPrice: 1000, refillPrice: 800, maxBuyQty: 5 };

    state.canisterBuyPrice = canisterCfg.buyPrice;
    state.canisterRefillPrice = canisterCfg.refillPrice;
    state.canisterMaxQty = canisterCfg.maxBuyQty || 5;
    state.canisterQtyValue = 1;

    if (!canister.hasCanister) {
        state.canisterMode = 'buy';
        canisterSub.textContent = 'Rezerva goriva u gepeku';
        canisterStepper.classList.remove('hidden');
        canisterBuy.disabled = false;
        renderCanister();
    } else if (canister.ammo < 100) {
        state.canisterMode = 'refill';
        canisterSub.textContent = `U ruci ti je, napunjen ${Math.floor(canister.ammo)}%`;
        canisterStepper.classList.add('hidden');
        canisterPrice.textContent = money(state.canisterRefillPrice);
        canisterBuyText.textContent = 'Napuni';
        canisterBuy.disabled = false;
    } else {
        state.canisterMode = null;
        canisterSub.textContent = 'Onaj u ruci ti je pun';
        canisterStepper.classList.add('hidden');
        canisterPrice.textContent = '—';
        canisterBuyText.textContent = 'Pun';
        canisterBuy.disabled = true;
    }

    /* Repair kit */
    const repairCfg = data.repairKitConfig || { price: 1500, maxBuyQty: 10 };

    if (data.repairKitAvailable) {
        repairItem.classList.remove('hidden');
        state.repairPriceValue = repairCfg.price;
        state.repairMaxQty = repairCfg.maxBuyQty || 10;
        state.repairQtyValue = 1;
        renderRepair();
    } else {
        repairItem.classList.add('hidden');
    }

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

