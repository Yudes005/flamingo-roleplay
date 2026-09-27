// ============================================================
//  FLAMINGO INPUT - NUI
// ============================================================

const overlay   = document.getElementById('fi-overlay');
const card      = document.getElementById('fi-card');
const titleEl   = document.getElementById('fi-title');
const descEl    = document.getElementById('fi-desc');
const iconEl    = document.getElementById('fi-icon');
const rowsEl    = document.getElementById('fi-rows');
const confirmEl = document.getElementById('fi-confirm');
const cancelEl  = document.getElementById('fi-cancel');
const closeEl   = document.getElementById('fi-close');

let currentId = null;
let fields = [];   // { row, get(), validate() }

const ICON_CLASS_RE = /^[a-z0-9-]+(\s[a-z0-9-]+)*$/i;

function post(endpoint, body = {}) {
    return fetch(`https://${GetParentResourceName()}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    }).catch(() => {});
}

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
}

// 5000000 -> "5.000.000"
function formatNumber(n) {
    const [int, dec] = String(n).split('.');
    const sign = int.startsWith('-') ? '-' : '';
    const grouped = int.replace('-', '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return sign + grouped + (dec ? ',' + dec : '');
}

// 1000 -> "1K", 2500000 -> "2.5M"
function formatShort(n) {
    const abs = Math.abs(n);
    if (abs >= 1e9) return +(n / 1e9).toFixed(1) + 'B';
    if (abs >= 1e6) return +(n / 1e6).toFixed(1) + 'M';
    if (abs >= 1e3) return +(n / 1e3).toFixed(1) + 'K';
    return String(n);
}

// ============================================================
//  POLJA
// ============================================================

function buildNumber(row, field, meta) {
    const allowNegative = typeof row.min === 'number' && row.min < 0;
    const prefix = row.prefix ? String(row.prefix) : '';

    if (prefix) field.appendChild(el('span', 'fi-prefix', prefix));

    const input = el('input');
    input.type = 'text';
    input.inputMode = 'numeric';
    input.placeholder = row.placeholder || '';
    if (row.default !== undefined && row.default !== null) input.value = String(row.default);
    if (row.disabled) input.disabled = true;
    field.appendChild(input);

    // Formatirana vrednost desno u polju (npr. $5.000.000) - lakse se cita veliki iznos.
    const hint = el('span', 'fi-hint');
    field.appendChild(hint);

    const range = el('span');
    const parts = [];
    if (typeof row.min === 'number') parts.push(`Min ${prefix}${formatNumber(row.min)}`);
    if (typeof row.max === 'number') parts.push(`Max ${prefix}${formatNumber(row.max)}`);
    range.textContent = parts.join('  ·  ');
    const error = el('span', 'fi-error');
    meta.append(error, range);

    const updateHint = () => {
        const n = Number(input.value);
        hint.textContent = input.value !== '' && Number.isFinite(n) && Math.abs(n) >= 1000
            ? prefix + formatNumber(n)
            : '';
    };

    input.addEventListener('input', () => {
        let v = input.value.replace(allowNegative ? /[^\d-]/g : /[^\d]/g, '');
        if (allowNegative) v = v.replace(/(?!^)-/g, '');
        v = v.replace(/^(-?)0+(?=\d)/, '$1');
        if (v.length > 15) v = v.slice(0, 15);
        input.value = v;
        updateHint();
        clearError();
    });

    updateHint();

    const clearError = () => {
        field.classList.remove('invalid');
        error.textContent = '';
    };

    const fail = (msg) => {
        field.classList.add('invalid');
        error.textContent = msg;
        return false;
    };

    const quick = Array.isArray(row.quick) ? row.quick.filter(q => Number.isFinite(Number(q))) : [];
    let quickEl = null;

    if (quick.length) {
        quickEl = el('div', 'fi-quick');
        quick.forEach(q => {
            const value = Number(q);
            const chip = el('button', 'fi-chip', prefix + formatShort(value));
            chip.type = 'button';
            chip.addEventListener('click', () => {
                let v = value;
                if (typeof row.max === 'number') v = Math.min(v, row.max);
                if (typeof row.min === 'number') v = Math.max(v, row.min);
                input.value = String(v);
                updateHint();
                clearError();
                input.focus();
            });
            quickEl.appendChild(chip);
        });
    }

    return {
        input,
        extra: quickEl,
        get: () => (input.value === '' || input.value === '-') ? null : Number(input.value),
        validate: () => {
            clearError();
            if (input.value === '' || input.value === '-') {
                return row.required ? fail('Unesite iznos.') : true;
            }
            const n = Number(input.value);
            if (!Number.isFinite(n)) return fail('Neispravan broj.');
            if (typeof row.min === 'number' && n < row.min) return fail(`Najmanje ${prefix}${formatNumber(row.min)}.`);
            if (typeof row.max === 'number' && n > row.max) return fail(`Najviše ${prefix}${formatNumber(row.max)}.`);
            return true;
        }
    };
}

function buildText(row, field, meta, multiline) {
    const input = el(multiline ? 'textarea' : 'input');
    if (!multiline) input.type = 'text';
    input.placeholder = row.placeholder || '';
    if (row.default !== undefined && row.default !== null) input.value = String(row.default);
    if (row.maxLength) input.maxLength = row.maxLength;
    if (row.disabled) input.disabled = true;
    field.appendChild(input);

    const error = el('span', 'fi-error');
    const counter = el('span');
    meta.append(error, counter);

    const updateCounter = () => {
        counter.textContent = row.maxLength ? `${input.value.length}/${row.maxLength}` : '';
    };

    input.addEventListener('input', () => {
        updateCounter();
        field.classList.remove('invalid');
        error.textContent = '';
    });

    updateCounter();

    return {
        input,
        get: () => input.value.trim() === '' ? null : input.value.trim(),
        validate: () => {
            field.classList.remove('invalid');
            error.textContent = '';
            if (row.required && input.value.trim() === '') {
                field.classList.add('invalid');
                error.textContent = 'Ovo polje je obavezno.';
                return false;
            }
            return true;
        }
    };
}

function buildSelect(row, field, meta) {
    const select = el('select');
    const options = Array.isArray(row.options) ? row.options : [];

    if (row.placeholder || !row.required) {
        const empty = el('option', null, row.placeholder || 'Izaberi...');
        empty.value = '';
        select.appendChild(empty);
    }

    options.forEach(opt => {
        const o = el('option', null, opt.label ?? String(opt.value));
        o.value = String(opt.value);
        select.appendChild(o);
    });

    if (row.default !== undefined && row.default !== null) select.value = String(row.default);
    if (row.disabled) select.disabled = true;

    field.appendChild(select);
    const caret = el('i', 'fa-solid fa-chevron-down fi-caret');
    field.appendChild(caret);

    const error = el('span', 'fi-error');
    meta.appendChild(error);

    select.addEventListener('change', () => {
        field.classList.remove('invalid');
        error.textContent = '';
    });

    return {
        input: select,
        get: () => select.value === '' ? null : select.value,
        validate: () => {
            if (row.required && select.value === '') {
                field.classList.add('invalid');
                error.textContent = 'Izaberite opciju.';
                return false;
            }
            return true;
        }
    };
}

function buildCheckbox(row, wrap) {
    const label = el('label', 'fi-check');
    const input = el('input');
    input.type = 'checkbox';
    input.checked = !!(row.checked || row.default);
    const box = el('span', 'box');
    box.appendChild(el('i', 'fa-solid fa-check'));
    label.append(input, box, el('span', null, row.label || ''));
    wrap.appendChild(label);

    return { input, get: () => input.checked, validate: () => true };
}

function buildRow(row) {
    const wrap = el('div', 'fi-row');

    if (row.type === 'checkbox') {
        return { wrap, ...buildCheckbox(row, wrap) };
    }

    if (row.label) {
        const label = el('div', 'fi-label', row.label);
        if (row.required) label.appendChild(el('span', 'req', '*'));
        wrap.appendChild(label);
    }

    if (row.description) wrap.appendChild(el('div', 'fi-rowdesc', row.description));

    const field = el('div', 'fi-field' + (row.type === 'textarea' ? ' textarea' : ''));
    const meta = el('div', 'fi-meta');
    wrap.appendChild(field);

    let built;
    if (row.type === 'number') built = buildNumber(row, field, meta);
    else if (row.type === 'select') built = buildSelect(row, field, meta);
    else built = buildText(row, field, meta, row.type === 'textarea');

    wrap.appendChild(meta);
    if (built.extra) wrap.appendChild(built.extra);

    return { wrap, ...built };
}

// ============================================================
//  OTVARANJE / ZATVARANJE
// ============================================================

function open(data) {
    currentId = data.id;

    titleEl.textContent = data.title || 'Unos';

    if (data.description) {
        descEl.textContent = data.description;
        descEl.classList.remove('hidden');
    } else {
        descEl.classList.add('hidden');
    }

    if (data.icon && ICON_CLASS_RE.test(data.icon)) {
        iconEl.firstElementChild.className = data.icon;
        iconEl.classList.remove('hidden');
    } else {
        iconEl.classList.add('hidden');
    }

    confirmEl.textContent = data.confirmLabel || 'Ok';
    cancelEl.textContent = data.cancelLabel || 'Otkaži';

    rowsEl.innerHTML = '';
    fields = (data.rows || []).map(row => {
        const built = buildRow(row);
        rowsEl.appendChild(built.wrap);
        return built;
    });

    overlay.classList.remove('hidden');

    // Restart animacije kad se otvori novi prozor preko starog.
    card.style.animation = 'none';
    void card.offsetWidth;
    card.style.animation = '';

    const first = fields.find(f => f.input && !f.input.disabled && f.input.type !== 'checkbox');
    if (first) {
        setTimeout(() => {
            first.input.focus();
            if (first.input.select) first.input.select();
        }, 30);
    }
}

function hide() {
    overlay.classList.add('hidden');
    rowsEl.innerHTML = '';
    fields = [];
    currentId = null;
}

function submit() {
    if (currentId === null) return;

    const ok = fields.map(f => f.validate()).every(Boolean);

    if (!ok) {
        card.classList.remove('shake');
        void card.offsetWidth;
        card.classList.add('shake');
        const bad = rowsEl.querySelector('.fi-field.invalid input, .fi-field.invalid textarea, .fi-field.invalid select');
        if (bad) bad.focus();
        return;
    }

    const id = currentId;
    const values = fields.map(f => f.get());
    hide();
    post('submit', { id, values });
}

function cancel() {
    if (currentId === null) return;

    const id = currentId;
    hide();
    post('cancel', { id });
}

card.addEventListener('submit', (e) => {
    e.preventDefault();
    submit();
});

card.addEventListener('animationend', () => card.classList.remove('shake'));

cancelEl.addEventListener('click', cancel);
closeEl.addEventListener('click', cancel);

document.addEventListener('keydown', (e) => {
    if (currentId === null) return;

    if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
    } else if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        submit();
    }
});

window.addEventListener('message', (event) => {
    const data = event.data || {};

    if (data.action === 'open') open(data);
    else if (data.action === 'close') hide();
});
