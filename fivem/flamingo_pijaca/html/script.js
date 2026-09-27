const resourceName = (typeof GetParentResourceName === 'function') ? GetParentResourceName() : 'flamingo_pijaca';

const panelEl = document.getElementById('panel');
const eyebrowEl = document.getElementById('panel-eyebrow');
const titleEl = document.getElementById('panel-title');
const subEl = document.getElementById('panel-sub');
const bodyEl = document.getElementById('panel-body');
const footerEl = document.getElementById('panel-footer');
const closeBtn = document.getElementById('btn-close');

let currentMode = null;
let currentStallId = null;

function post(name, data) {
    return fetch(`https://${resourceName}/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(data || {}),
    }).catch(() => {});
}

function closePanel() {
    panelEl.classList.add('hidden');
    bodyEl.innerHTML = '';
    footerEl.innerHTML = '';
    currentMode = null;
    currentStallId = null;
    post('close');
}

closeBtn.addEventListener('click', closePanel);

document.addEventListener('keyup', (e) => {
    if (e.key === 'Escape' && !panelEl.classList.contains('hidden')) {
        closePanel();
    }
});

function formatTime(seconds) {
    seconds = Math.max(0, seconds | 0);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}min preostalo`;
}

function renderManage(data) {
    eyebrowEl.textContent = 'Vasa tezga';
    titleEl.textContent = data.stallLabel;
    subEl.textContent = formatTime(data.remaining);

    bodyEl.innerHTML = '';

    if (!data.items || data.items.length === 0) {
        bodyEl.innerHTML = '<div class="empty-msg">Nemate robe na tezgi. Otvorite inventar tezge da dodate stvari.</div>';
    } else {
        for (const item of data.items) {
            const row = document.createElement('div');
            row.className = 'item-row';
            row.innerHTML = `
                <div class="item-info">
                    <div class="item-label">${escapeHtml(item.label || item.name)}</div>
                    <div class="item-count">Na stanju: ${item.count}</div>
                </div>
                <input class="item-input price-input" type="number" min="0" step="1" value="${item.price || 0}" data-item="${escapeHtml(item.name)}" />
            `;
            bodyEl.appendChild(row);
        }
    }

    footerEl.innerHTML = `
        <button class="action-btn neutral" id="btn-open-stash">Inventar tezge</button>
        <button class="action-btn primary" id="btn-save-prices">Sacuvaj cene</button>
        <button class="action-btn danger" id="btn-release" data-armed="0">Napusti tezgu</button>
    `;

    document.getElementById('btn-open-stash').addEventListener('click', () => {
        post('openStash', { stallId: currentStallId });
        closePanelSilent();
    });

    document.getElementById('btn-save-prices').addEventListener('click', () => {
        const prices = {};
        document.querySelectorAll('.price-input').forEach((input) => {
            const val = parseInt(input.value, 10);
            prices[input.dataset.item] = isNaN(val) ? 0 : val;
        });
        post('savePrices', { stallId: currentStallId, prices });
    });

    const releaseBtn = document.getElementById('btn-release');
    releaseBtn.addEventListener('click', () => {
        if (releaseBtn.dataset.armed === '1') {
            post('releaseStall', { stallId: currentStallId });
            closePanelSilent();
        } else {
            releaseBtn.dataset.armed = '1';
            releaseBtn.textContent = 'Sigurni ste? Klikni opet';
            setTimeout(() => {
                releaseBtn.dataset.armed = '0';
                releaseBtn.textContent = 'Napusti tezgu';
            }, 3000);
        }
    });
}

function renderShop(data) {
    eyebrowEl.textContent = 'Ponuda';
    titleEl.textContent = data.stallLabel;
    subEl.textContent = '';

    bodyEl.innerHTML = '';

    if (!data.items || data.items.length === 0) {
        bodyEl.innerHTML = '<div class="empty-msg">Trenutno nema robe na ovoj tezgi.</div>';
    } else {
        for (const item of data.items) {
            const row = document.createElement('div');
            row.className = 'item-row';
            row.innerHTML = `
                <div class="item-info">
                    <div class="item-label">${escapeHtml(item.label || item.name)}</div>
                    <div class="item-count">Na stanju: ${item.count}</div>
                </div>
                <div class="item-price-tag">$${item.price}</div>
                <input class="item-input qty-input" type="number" min="1" max="${item.count}" value="1" />
                <button class="buy-btn" data-item="${escapeHtml(item.name)}">Kupi</button>
            `;
            bodyEl.appendChild(row);
        }

        bodyEl.querySelectorAll('.buy-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const row = btn.closest('.item-row');
                const qtyInput = row.querySelector('.qty-input');
                let qty = parseInt(qtyInput.value, 10);
                const max = parseInt(qtyInput.max, 10);
                if (isNaN(qty) || qty < 1) qty = 1;
                if (qty > max) qty = max;

                btn.disabled = true;
                post('buyItem', { stallId: currentStallId, item: btn.dataset.item, count: qty }).then(() => {
                    setTimeout(() => { btn.disabled = false; }, 600);
                });
            });
        });
    }

    footerEl.innerHTML = `<button class="action-btn neutral" id="btn-shop-close">Zatvori</button>`;
    document.getElementById('btn-shop-close').addEventListener('click', closePanel);
}

// Zatvara panel bez slanja "close" callback-a - koristi se kad neka druga
// akcija (otvaranje inventara, napustanje tezge) vec preuzima NUI fokus/tok.
function closePanelSilent() {
    panelEl.classList.add('hidden');
    bodyEl.innerHTML = '';
    footerEl.innerHTML = '';
    currentMode = null;
    currentStallId = null;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || data.action !== 'open') return;

    currentMode = data.mode;
    currentStallId = data.stallId;
    panelEl.classList.remove('hidden');

    if (data.mode === 'manage') {
        renderManage(data);
    } else if (data.mode === 'shop') {
        renderShop(data);
    }
});
