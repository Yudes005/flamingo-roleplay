// ============================================================
//  FLAMINGO RADIAL MENU - NUI
//  Dokumenti (licna karta, lekarsko, dozvole) se povlace iz
//  flamingo_documents. Ovde se samo crtaju.
// ============================================================

const ROOT_OPTIONS = [
    {
        key: 'dokumenti',
        label: 'Dokumenti',
        icon: 'fa-solid fa-folder-open',
        type: 'category',
        children: [
            { key: 'idcard',   label: 'Lična karta', icon: 'fa-solid fa-id-card',       type: 'document', view: 'idcard' },
            { key: 'medcert',  label: 'Lekarsko',    icon: 'fa-solid fa-notes-medical', type: 'document', view: 'medcert' },
            { key: 'licenses', label: 'Dozvole',     icon: 'fa-solid fa-id-card-clip',  type: 'document', view: 'licenses' }
        ]
    },
    {
        key: 'osnovne_akcije',
        label: 'Osnovne akcije',
        icon: 'fa-solid fa-people-arrows',
        type: 'category',
        children: [
            { key: 'basic_medkit_revive', label: 'Oživi drugara (MedKit)', icon: 'fa-solid fa-kit-medical', type: 'action' },
            { key: 'basic_introduce',     label: 'Upoznaj se',             icon: 'fa-solid fa-handshake',   type: 'action' }
        ]
    }
];

const HOSPITAL_CATEGORY = {
    key: 'bolnica',
    label: 'Bolnica',
    icon: 'fa-solid fa-truck-medical',
    type: 'category',
    children: [
        { key: 'hospital_revive',       label: 'Oživi igrača',     icon: 'fa-solid fa-kit-medical',       type: 'action' },
        { key: 'hospital_heal',         label: 'Izleči igrača',    icon: 'fa-solid fa-briefcase-medical', type: 'action' },
        { key: 'hospital_medkit',       label: 'Prodaj Medkit',    icon: 'fa-solid fa-suitcase-medical',  type: 'action' },
        { key: 'docs_issue_medcert',    label: 'Izdaj Lekarsko',   icon: 'fa-solid fa-notes-medical',     type: 'action' },
        { key: 'hospital_medkitstock',  label: 'Stanje MedKitova', icon: 'fa-solid fa-boxes-stacked',     type: 'action' }
    ]
};

const HOSPITAL_LEADER_CATEGORY = {
    key: 'bolnica_lider',
    label: 'Lider',
    icon: 'fa-solid fa-user-shield',
    type: 'category',
    children: [
        { key: 'hospital_invite',   label: 'Pozovi u organizaciju', icon: 'fa-solid fa-user-plus',  type: 'action' },
        { key: 'hospital_kick',     label: 'Izbaci',                icon: 'fa-solid fa-user-xmark', type: 'action' },
        { key: 'hospital_rankup',   label: 'Povećaj rank',          icon: 'fa-solid fa-arrow-up',   type: 'action' },
        { key: 'hospital_rankdown', label: 'Spusti rank',           icon: 'fa-solid fa-arrow-down', type: 'action' }
    ]
};

// Policija dobija proveru dokumenata najblizeg igraca
const POLICE_CATEGORY = {
    key: 'policija',
    label: 'Policija',
    icon: 'fa-solid fa-shield-halved',
    type: 'category',
    children: [
        { key: 'docs_check_nearby', label: 'Proveri dokumenta', icon: 'fa-solid fa-magnifying-glass', type: 'action' }
    ]
};

const POLICE_JOBS = ['police', 'sheriff'];

// Sef Lifeinvader-a (grade >= Config.BossGrade u flamingo_lifeinvader) -
// isti princip kao HOSPITAL_LEADER_CATEGORY.
const LIFEINVADER_LEADER_CATEGORY = {
    key: 'lifeinvader_sef',
    label: 'Lifeinvader - Šef',
    icon: 'fa-solid fa-user-shield',
    type: 'category',
    children: [
        { key: 'li_invite',   label: 'Primi u firmu',  icon: 'fa-solid fa-user-plus',  type: 'action' },
        { key: 'li_kick',     label: 'Izbaci',         icon: 'fa-solid fa-user-xmark', type: 'action' },
        { key: 'li_rankup',   label: 'Povećaj rank',   icon: 'fa-solid fa-arrow-up',   type: 'action' },
        { key: 'li_rankdown', label: 'Spusti rank',    icon: 'fa-solid fa-arrow-down', type: 'action' }
    ]
};

// Lider vlade (grade == Config.BossGradeName u flamingo_vlada) -
// isti princip kao HOSPITAL_LEADER_CATEGORY.
const GOV_LEADER_CATEGORY = {
    key: 'vlada_lider',
    label: 'Vlada - Lider',
    icon: 'fa-solid fa-user-shield',
    type: 'category',
    children: [
        { key: 'gov_invite',   label: 'Pozovi u organizaciju', icon: 'fa-solid fa-user-plus',  type: 'action' },
        { key: 'gov_kick',     label: 'Izbaci',                icon: 'fa-solid fa-user-xmark', type: 'action' },
        { key: 'gov_rankup',   label: 'Povećaj rank',          icon: 'fa-solid fa-arrow-up',   type: 'action' },
        { key: 'gov_rankdown', label: 'Spusti rank',           icon: 'fa-solid fa-arrow-down', type: 'action' }
    ]
};

// Osnovne akcije vlade - vezivanje/odvezivanje, pretraga, (de)ubacivanje
// u vozilo. Vidi ovo SVAKI zaposleni u vladi (bez posebne permisije iz
// rankova) - server samo proveri da je meta blizu i da je vezana tamo
// gde je to bitno (pretraga, vozilo). Logika u flamingo_vlada.
const GOV_BASIC_CATEGORY = {
    key: 'vlada_osnovne',
    label: 'Vlada - Osnovne akcije',
    icon: 'fa-solid fa-gavel',
    type: 'category',
    children: [
        { key: 'gov_cuff',         label: 'Vezivanje',       icon: 'fa-solid fa-user-lock',                   type: 'action' },
        { key: 'gov_uncuff',       label: 'Odvezivanje',     icon: 'fa-solid fa-lock-open',                   type: 'action' },
        { key: 'gov_search',      label: 'Pretraga',        icon: 'fa-solid fa-magnifying-glass',            type: 'action' },
        { key: 'gov_vehicle_in',  label: 'Ubaci u vozilo',  icon: 'fa-solid fa-car-side',                     type: 'action' },
        { key: 'gov_vehicle_out', label: 'Izbaci iz vozila', icon: 'fa-solid fa-right-from-bracket',          type: 'action' }
    ]
};

// Svaki zaposleni u vladi vidi ovu kategoriju; da li sme da izdaje dozvole
// odlučuje server (permisija can_manage_documents u rankovima).
const GOV_CATEGORY = {
    key: 'vlada_org',
    label: 'Organizacija - Vlada',
    icon: 'fa-solid fa-landmark',
    type: 'category',
    children: [
        {
            key: 'vlada_izdavanje',
            label: 'Izdavanje',
            icon: 'fa-solid fa-file-circle-plus',
            type: 'category',
            children: [
                { key: 'gov_issue_idcard',  label: 'Izdaj ličnu kartu',        icon: 'fa-solid fa-id-card', type: 'action' },
                { key: 'gov_issue_weapon',  label: 'Izdaj dozvolu za oružje',  icon: 'fa-solid fa-gun',     type: 'action' },
                { key: 'gov_issue_fishing', label: 'Izdaj dozvolu za ribolov', icon: 'fa-solid fa-fish',    type: 'action' }
            ]
        },
        {
            key: 'vlada_obnova',
            label: 'Obnova',
            icon: 'fa-solid fa-arrows-rotate',
            type: 'category',
            children: [
                { key: 'gov_renew_idcard',  label: 'Obnovi ličnu kartu',        icon: 'fa-solid fa-id-card', type: 'action' },
                { key: 'gov_renew_weapon',  label: 'Obnovi dozvolu za oružje',  icon: 'fa-solid fa-gun',     type: 'action' },
                { key: 'gov_renew_fishing', label: 'Obnovi dozvolu za ribolov', icon: 'fa-solid fa-fish',    type: 'action' }
            ]
        }
    ]
};

// FLAMINGO_KUCE: vidi ga samo vlasnik kuće (hasHouse iz client.lua)
const HOUSE_SELL_OPTION = { key: 'house_sell', label: 'Prodaj kuću', icon: 'fa-solid fa-house-circle-check', type: 'action' };

// FLAMINGO_BIZNISI: vidi ga samo vlasnik biznisa (hasBusiness iz client.lua)
const BIZ_SELL_OPTION = { key: 'biz_sell', label: 'Prodaj biznis', icon: 'fa-solid fa-briefcase', type: 'action' };

function buildRootOptions(job, isHospitalBoss, isLifeinvaderBoss, isGovBoss, isGovMember, hasHouse, external, policeSystem, hasBusiness) {
    let options = ROOT_OPTIONS;

    if (hasHouse) options = [...options, HOUSE_SELL_OPTION];
    if (hasBusiness) options = [...options, BIZ_SELL_OPTION];

    if (job === 'ambulance') options = [HOSPITAL_CATEGORY, ...options];
    // Kad je flamingo_policija pokrenut, policijske opcije dolaze od njega (external)
    if (POLICE_JOBS.includes(job) && !policeSystem) options = [POLICE_CATEGORY, ...options];
    if (Array.isArray(external) && external.length) options = [...external, ...options];
    if (isGovMember) options = [GOV_BASIC_CATEGORY, GOV_CATEGORY, ...options];
    if (isHospitalBoss) options = [HOSPITAL_LEADER_CATEGORY, ...options];
    if (isLifeinvaderBoss) options = [LIFEINVADER_LEADER_CATEGORY, ...options];
    if (isGovBoss) options = [GOV_LEADER_CATEGORY, ...options];

    return options;
}

// ============================================================
//  DOM
// ============================================================

const radialMenu     = document.getElementById('radial-menu');
const radialWrapper  = document.getElementById('radial-wrapper');
const radialCenter   = document.getElementById('radial-center');
const radialRing     = document.getElementById('radial-ring');
const radialSweep    = document.getElementById('radial-sweep');
const hubPhoto       = document.getElementById('hub-photo');
const hubTitle       = document.getElementById('hub-title');
const hubSub         = document.getElementById('hub-sub');
const hubBack        = document.getElementById('hub-back');

const WRAPPERS = {
    idcard:   document.getElementById('idcard-wrapper'),
    medcert:  document.getElementById('medcert-wrapper'),
    licenses: document.getElementById('license-wrapper')
};

let currentPlayer  = null;
let currentDocs    = null;   // poslednji payload iz flamingo_documents
let currentPhoto   = null;   // nui-img URL fotografije igraca
let currentOptions = ROOT_OPTIONS;
let menuStack      = [];

// ============================================================
//  RADIAL
// ============================================================

// ============================================================
//  KRUG - stavke su raspoređene oko centra, #1 je gore pa u krug
//  u smeru kazaljke na satu. Centar pokazuje sliku lika (ili ikonicu
//  kategorije), naziv trenutnog menija i stavku na koju pokazuješ.
// ============================================================
let titleStack   = [];
let currentTitle = null;   // { label, icon } trenutne kategorije, null = glavni meni
let currentItems = [];     // [{ opt, el, angle }]

function renderHub(hoverOpt) {
    if (currentTitle) {
        // podmeni: ikonica i naziv kategorije, ispod stavka na koju pokazuješ
        hubPhoto.classList.remove('hidden');
        hubPhoto.innerHTML = `<i class="${currentTitle.icon}"></i>`;
        hubTitle.textContent = currentTitle.label;
        hubSub.textContent = hoverOpt ? hoverOpt.label : 'Izaberi opciju';
        hubSub.classList.remove('hidden');
    } else {
        // glavni meni: bez slike lika i bez naslova, samo stavka na koju pokazuješ
        hubPhoto.classList.add('hidden');
        hubTitle.textContent = hoverOpt ? hoverOpt.label : 'Izaberi opciju';
        hubSub.classList.add('hidden');
    }

    hubBack.innerHTML = menuStack.length > 0
        ? '<i class="fa-solid fa-arrow-left"></i><span>Nazad</span>'
        : '<i class="fa-solid fa-xmark"></i><span>Zatvori</span>';
}

// zadržano ime zbog ostatka skripte
function renderCenterIcon() { renderHub(null); }

function setHover(index) {
    currentItems.forEach((it, i) => it.el.classList.toggle('hover', i === index));
    const it = currentItems[index];
    if (it) {
        radialSweep.style.setProperty('--sweep-angle', `${it.angle + 90}deg`);
        radialSweep.classList.add('on');
        renderHub(it.opt);
    } else {
        radialSweep.classList.remove('on');
        renderHub(null);
    }
}

function buildRadial(options) {
    radialRing.innerHTML = '';
    currentItems = [];

    const n = options.length;
    const radius = Math.max(170, Math.min(250, 120 + n * 16));
    const menu = document.getElementById('radial-menu');
    menu.style.setProperty('--r', `${radius}px`);
    radialSweep.style.setProperty('--sweep-size', `${Math.min(90, 360 / Math.max(n, 1))}deg`);
    radialSweep.classList.remove('on');

    options.forEach((opt, i) => {
        const angle = -90 + (360 / n) * i;
        const rad = angle * Math.PI / 180;
        const el = document.createElement('div');
        el.className = 'radial-item';
        el.style.setProperty('--x', `${(Math.cos(rad) * radius).toFixed(1)}px`);
        el.style.setProperty('--y', `${(Math.sin(rad) * radius).toFixed(1)}px`);
        el.style.setProperty('--delay', `${i * 0.025}s`);
        el.innerHTML = `
            <div class="radial-tile">
                <i class="${opt.icon}"></i>
                ${i < 9 ? `<span class="radial-num">${i + 1}</span>` : ''}
                ${opt.type === 'category' ? '<span class="radial-more"><i></i><i></i><i></i></span>' : ''}
            </div>
            <div class="radial-label">${opt.label}</div>`;

        const tile = el.querySelector('.radial-tile');
        tile.addEventListener('mouseenter', () => setHover(i));
        tile.addEventListener('mouseleave', () => setHover(-1));
        tile.addEventListener('click', () => onOptionClick(opt));

        radialRing.appendChild(el);
        currentItems.push({ opt, el, angle });
    });

    renderHub(null);
}

// brzi izbor brojevima 1-9
document.addEventListener('keydown', (e) => {
    if (document.getElementById('radial-wrapper').classList.contains('hidden')) return;
    const num = parseInt(e.key, 10);
    if (num >= 1 && num <= 9 && currentItems[num - 1]) {
        onOptionClick(currentItems[num - 1].opt);
    } else if (e.key === 'Backspace') {
        goBack();
    }
});

function post(endpoint, body = {}) {
    return fetch(`https://${GetParentResourceName()}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
}

function onOptionClick(opt) {
    if (opt.type === 'category') {
        menuStack.push(currentOptions);
        titleStack.push(currentTitle);
        currentTitle = { label: opt.label, icon: opt.icon };
        currentOptions = opt.children;
        buildRadial(opt.children);
        return;
    }

    if (opt.type === 'document') {
        post('openDocument', { view: opt.view });
        return;
    }

    post('selectOption', { option: opt.key });
    closeAll();
}

function goBack() {
    if (menuStack.length === 0) return closeAll();

    currentOptions = menuStack.pop();
    currentTitle = titleStack.pop() || null;
    buildRadial(currentOptions);
}

radialCenter.addEventListener('click', goBack);

// ============================================================
//  POMOCNE
// ============================================================

const STATUS = {
    valid:      { cls: 'ok',   icon: 'fa-solid fa-circle-check',  text: 'VAŽI' },
    expired:    { cls: 'bad',  icon: 'fa-solid fa-circle-xmark',  text: 'ISTEKLO' },
    suspended:  { cls: 'bad',  icon: 'fa-solid fa-ban',           text: 'SUSPENDOVANO' },
    revoked:    { cls: 'bad',  icon: 'fa-solid fa-ban',           text: 'ODUZETO' },
    no_medical: { cls: 'warn', icon: 'fa-solid fa-triangle-exclamation', text: 'BEZ LEKARSKOG' },
    missing:    { cls: 'dim',  icon: 'fa-solid fa-minus',         text: 'NEMA' }
};

function statusOf(key) {
    return STATUS[key] || STATUS.missing;
}

function pill(key) {
    const s = statusOf(key);
    return `<i class="${s.icon}"></i> ${s.text}`;
}

function esc(value) {
    if (value === null || value === undefined || value === '') return '-';
    return String(value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function field(label, value, extraClass = '') {
    return `
        <div class="doc-field">
            <span class="doc-label">${label}</span>
            <span class="doc-value ${extraClass}">${esc(value)}</span>
        </div>`;
}

// Fotografija se hvata u pozadini i moze da stigne POSLE nego sto je
// kartica vec nacrtana. Zato svaki okvir za sliku nosi data-photo-slot,
// pa se sadrzaj samo zameni na licu mesta - bez ponovnog crtanja kartice.
function photoInner(url) {
    return url
        ? `<img src="${url}" alt="">`
        : `<i class="fa-solid fa-user"></i>`;
}

function photoBox(cls = 'doc-photo') {
    return `<div class="${cls}" data-photo-slot>${photoInner(currentPhoto)}</div>`;
}

function fillPhotoSlots(url, selector = '[data-photo-slot]') {
    document.querySelectorAll(selector).forEach(el => {
        el.innerHTML = photoInner(url);
    });
}

function fullName(holder) {
    return `${holder.firstname || ''} ${holder.lastname || ''}`.trim() || 'Nepoznato';
}

function sexLabel(sex) {
    const v = String(sex || '').trim().toLowerCase();
    if (['m', 'muski', 'muško', 'male'].includes(v)) return 'Muško';
    if (['f', 'z', 'zenski', 'žensko', 'female'].includes(v)) return 'Žensko';
    return sex || '-';
}

function sexCode(sex) {
    const v = String(sex || '').trim().toLowerCase();
    if (['m', 'muski', 'muško', 'male'].includes(v)) return 'M';
    if (['f', 'z', 'zenski', 'žensko', 'female'].includes(v)) return 'F';
    return '<';
}

// dd/mm/yyyy ili yyyy-mm-dd -> YYMMDD (za MRZ)
function mrzDate(value) {
    if (!value) return '<<<<<<';

    const s = String(value);
    let d, m, y;

    let match = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (match) { [, d, m, y] = match; }

    if (!d) {
        match = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
        if (match) { [, y, m, d] = match; }
    }

    if (!d) return '<<<<<<';

    return String(y).slice(-2) + String(m).padStart(2, '0') + String(d).padStart(2, '0');
}

function pad(str, len) {
    return String(str || '').toUpperCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z0-9<]/g, '<')
        .slice(0, len)
        .padEnd(len, '<');
}

// Mašinski čitljiva zona - isti oblik kao na pravim ličnim kartama
function buildMrz(payload) {
    const h = payload.holder;
    const card = payload.idcard;
    if (!card) return '';

    const line1 = 'I<SAN' + pad(`${h.lastname}<<${h.firstname}`, 31);

    const line2 =
        pad((card.number || '').replace(/\s/g, ''), 10) +
        'SAN' +
        mrzDate(h.dob) +
        sexCode(h.sex) +
        mrzDate(card.expiresAt ? card.expiresAt.split('.').reverse().join('-').replace(/^-/, '') : null) +
        pad(card.nationalId, 13);

    return `${line1}<br>${pad(line2, 36)}`;
}

// ============================================================
//  LIČNA KARTA
// ============================================================

function renderIdCard(payload) {
    const card = payload.idcard;
    const h = payload.holder;

    document.getElementById('ic-country').textContent = payload.country || 'Republika San Andreas';

    const statusEl = document.getElementById('ic-status');
    const body = document.getElementById('ic-body');
    const mrz = document.getElementById('ic-mrz');

    if (!card) {
        statusEl.className = 'doc-status dim';
        statusEl.innerHTML = pill('missing');
        mrz.innerHTML = '';
        body.innerHTML = `
            <div class="doc-empty">
                <i class="fa-solid fa-id-card"></i>
                <h4>Nemaš ličnu kartu</h4>
                <p>Javi se u zgradu Vlade da ti izdaju novu ili obnove staru. Lična važi 120 dana.</p>
            </div>`;
        return;
    }

    statusEl.className = `doc-status ${statusOf(card.status).cls}`;
    statusEl.innerHTML = pill(card.status);

    const expiryClass = card.status === 'expired' ? 'bad' : (card.daysLeft !== null && card.daysLeft < 30 ? 'warn' : '');

    // Ko je karticu izdao: službenik (npr. iz vlade) ili "Automatski" ako ju je
    // sistem izdao pri prvom ulasku (tada je issuedBy isto što i ustanova).
    const issuedAuto = !card.issuedBy || card.issuedBy === card.authority;
    const officerRow = `
            <div class="doc-field span-all">
                <span class="doc-label">Izdao/la</span>
                <span class="doc-value">${esc(issuedAuto ? 'Automatski (sistem)' : card.issuedBy)}</span>
            </div>`;

    body.innerHTML = `
        <div class="doc-top">
            ${photoBox()}
            <div class="doc-identity">
                <span class="doc-name">${esc(fullName(h))}</span>
                <div class="doc-grid">
                    ${field('Matični broj', card.nationalId, 'mono')}
                    ${field('Datum rođenja', h.dob)}
                    ${field('Pol', sexLabel(h.sex))}
                    ${field('Državljanstvo', payload.citizenship || 'San Andreas')}
                    ${field('Visina', h.height ? `${h.height} cm` : null)}
                    ${field('Krvna grupa', card.bloodType)}
                </div>
            </div>
        </div>

        <div class="doc-issue">
            ${field('Broj dokumenta', card.number, 'mono')}
            ${field('Izdato', card.issuedAt)}
            ${field('Važi do', card.expiresAt, expiryClass)}
            ${field('Izdaje', card.authority || card.issuedBy)}
            ${field('Mesto izdavanja', card.place)}
            ${field('Starost', h.age !== null ? `${h.age} god.` : null)}
            ${officerRow}
        </div>`;

    mrz.innerHTML = buildMrz(payload);
}

// ============================================================
//  LEKARSKO UVERENJE
// ============================================================

function renderMedcert(payload) {
    const cert = payload.medcert;
    const h = payload.holder;

    document.getElementById('mc-hospital').textContent = payload.hospital || 'Opšta bolnica San Andreas';

    const statusEl = document.getElementById('mc-status');
    const body = document.getElementById('mc-body');

    if (!cert) {
        statusEl.className = 'doc-status dim';
        statusEl.innerHTML = pill('missing');
        body.innerHTML = `
            <div class="doc-empty">
                <i class="fa-solid fa-notes-medical"></i>
                <h4>Nemaš lekarsko uverenje</h4>
                <p>Uverenje ti izdaje doktor u bolnici. Bez njega tvoje vozačke dozvole ne važe.</p>
            </div>`;
        return;
    }

    statusEl.className = `doc-status ${statusOf(cert.status).cls}`;
    statusEl.innerHTML = pill(cert.status);

    const left = cert.daysLeft ?? 0;
    const total = 30;
    const percent = Math.max(0, Math.min(100, (left / total) * 100));
    const barClass = left <= 0 ? 'bad' : (left <= 7 ? 'warn' : '');

    body.innerHTML = `
        <div class="doc-top">
            ${photoBox()}
            <div class="doc-identity">
                <span class="doc-name">${esc(fullName(h))}</span>
                <div class="doc-grid">
                    ${field('Broj uverenja', cert.number, 'mono')}
                    ${field('Krvna grupa', cert.bloodType)}
                    ${field('Datum pregleda', cert.issuedAt)}
                    ${field('Važi do', cert.expiresAt, barClass)}
                </div>
            </div>
        </div>

        <div class="mc-validity">
            <div class="mc-validity-head">
                <span>Preostalo važenje</span>
                <span>${left > 0 ? `${left} dana` : 'Isteklo'}</span>
            </div>
            <div class="mc-bar"><div class="mc-bar-fill ${barClass}" style="width:${percent}%"></div></div>
        </div>

        <div class="mc-findings">
            <strong>Nalaz i mišljenje</strong>
            ${esc(cert.findings)}
        </div>

        <div class="doc-issue">
            ${field('Izdao', cert.issuedBy)}
            ${field('Ustanova', cert.hospital)}
            ${field('Status', statusOf(cert.status).text)}
        </div>`;
}

// ============================================================
//  DOZVOLE
// ============================================================

function licenseNote(lic) {
    if (lic.status === 'valid')      return `<span class="lic-row-note ok">Važi do ${esc(lic.expiresAt)}</span>`;
    if (lic.status === 'expired')    return `<span class="lic-row-note bad">Istekla ${esc(lic.expiresAt)}</span>`;
    if (lic.status === 'suspended')  return `<span class="lic-row-note bad">Suspendovana do ${esc(lic.suspendedUntil)}</span>`;
    if (lic.status === 'revoked')    return `<span class="lic-row-note bad">Trajno oduzeta</span>`;
    if (lic.status === 'no_medical') return `<span class="lic-row-note warn">Ne važi — isteklo lekarsko</span>`;
    return '';
}

function tileClass(status) {
    if (status === 'valid') return 'active';
    if (status === 'missing') return '';
    if (status === 'no_medical') return 'pending';
    return 'flagged';
}

function renderLicenses(payload) {
    const h = payload.holder;
    const licenses = payload.licenses || [];
    const owned = licenses.filter(l => l.owned);

    document.getElementById('lic-country').textContent = payload.country || 'Republika San Andreas';

    const statusEl = document.getElementById('lic-status');
    const validCount = owned.filter(l => l.status === 'valid').length;

    if (owned.length === 0) {
        statusEl.className = 'doc-status dim';
        statusEl.innerHTML = pill('missing');
    } else if (validCount === owned.length) {
        statusEl.className = 'doc-status ok';
        statusEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${validCount} VAŽEĆIH`;
    } else {
        statusEl.className = 'doc-status warn';
        statusEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${validCount}/${owned.length} VAŽI`;
    }

    const tiles = licenses.map(lic => {
        const mark = lic.status === 'valid'
            ? '<i class="fa-solid fa-check lic-mark ok"></i>'
            : (lic.owned ? `<i class="fa-solid fa-exclamation lic-mark ${lic.status === 'no_medical' ? 'warn' : 'bad'}"></i>` : '');

        return `
            <div class="lic-tile ${tileClass(lic.owned ? lic.status : 'missing')}">
                ${mark}
                <span class="lic-code">${esc(lic.label)}</span>
                <span class="lic-name">${esc(lic.name)}</span>
            </div>`;
    }).join('');

    const details = owned.length === 0
        ? `<div class="doc-empty">
               <i class="fa-solid fa-id-card-clip"></i>
               <h4>Nemaš nijednu dozvolu</h4>
               <p>Vozačke se polažu u auto školi, a dozvole za oružje i ribolov se vade kod nadležne službe.</p>
           </div>`
        : owned.map(lic => {
            const pct = lic.maxPoints > 0 ? Math.min(100, (lic.points / lic.maxPoints) * 100) : 0;
            const high = lic.maxPoints > 0 && lic.points >= lic.maxPoints * 0.66;

            const points = lic.maxPoints > 0 ? `
                <div class="lic-points">
                    <span>${lic.points}/${lic.maxPoints} poena</span>
                    <div class="lic-points-bar"><div class="lic-points-fill ${high ? 'high' : ''}" style="width:${pct}%"></div></div>
                </div>` : '';

            return `
                <div class="lic-row">
                    <div class="lic-row-icon"><i class="${lic.icon}"></i></div>
                    <div class="lic-row-main">
                        <span class="lic-row-title">${esc(lic.label)} — ${esc(lic.name)}</span>
                        <span class="lic-row-meta">${esc(lic.number)} · izdato ${esc(lic.issuedAt)}</span>
                        ${licenseNote(lic)}
                    </div>
                    ${points}
                </div>`;
        }).join('');

    document.getElementById('lic-body').innerHTML = `
        <div class="doc-top">
            ${photoBox()}
            <div class="doc-identity">
                <span class="doc-name">${esc(fullName(h))}</span>
                <div class="doc-grid">
                    ${field('Datum rođenja', h.dob)}
                    ${field('Matični broj', payload.idcard ? payload.idcard.nationalId : null, 'mono')}
                </div>
            </div>
        </div>

        <div class="lic-grid">${tiles}</div>
        <div class="lic-details">${details}</div>`;
}

// ============================================================
//  OTVARANJE / ZATVARANJE KARTICA
// ============================================================

function openDocument(view, payload) {
    if (!WRAPPERS[view]) return;

    currentDocs = payload;

    Object.values(WRAPPERS).forEach(w => w.classList.add('hidden'));
    radialWrapper.classList.add('hidden');

    if (view === 'idcard')   renderIdCard(payload);
    if (view === 'medcert')  renderMedcert(payload);
    if (view === 'licenses') renderLicenses(payload);

    WRAPPERS[view].classList.remove('hidden');
}

// Bez ove brave, ESC + klik na X u istom trenutku salju dva 'close'
// zahteva, pa se drugi izvrsi nad vec zatvorenim menijem.
let closing = false;

function closeAll() {
    if (closing) return;
    closing = true;
    setTimeout(() => { closing = false; }, 150);

    menuStack = [];
    titleStack = [];
    currentTitle = null;
    radialWrapper.classList.add('hidden');
    Object.values(WRAPPERS).forEach(w => w.classList.add('hidden'));
    post('close');
}

document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
        WRAPPERS[btn.dataset.close].classList.add('hidden');
        closeAll();
    });
});

document.querySelectorAll('[data-show]').forEach(btn => {
    btn.addEventListener('click', () => {
        if (!currentDocs) return;

        // Payload se namerno NE salje - server sam ponovo cita dokument iz
        // baze, pa izmena podataka u NUI-u ne moze da proizvede lazan dokument.
        post('showToNearby', { view: btn.dataset.show });

        WRAPPERS[btn.dataset.show].classList.add('hidden');
        closeAll();
    });
});

// ============================================================
//  DOKUMENT KOJI TI JE NEKO POKAZAO / POLICIJSKA PROVERA
// ============================================================

const receivedWrapper = document.getElementById('received-wrapper');
const receivedTimer   = document.getElementById('rc-timer');
let receivedTimeout   = null;
const RECEIVED_DURATION = 12000;

const VIEW_TITLES = {
    idcard:   { title: 'Lična karta',        icon: 'fa-solid fa-id-card' },
    medcert:  { title: 'Lekarsko uverenje',  icon: 'fa-solid fa-staff-snake' },
    licenses: { title: 'Dozvole',            icon: 'fa-solid fa-id-card-clip' },
    all:      { title: 'Provera dokumenata', icon: 'fa-solid fa-magnifying-glass' }
};

function receivedPhoto(url) {
    return `<div class="rc-photo" data-rc-photo-slot>${photoInner(url)}</div>`;
}

function showReceived(view, payload, photoUrl) {
    const meta = VIEW_TITLES[view] || VIEW_TITLES.idcard;
    const h = payload.holder || {};

    document.getElementById('rc-crest').innerHTML = `<i class="${meta.icon}"></i>`;
    document.getElementById('rc-title').textContent = payload.country || 'Republika San Andreas';
    document.getElementById('rc-sub').textContent = meta.title;

    const statusEl = document.getElementById('rc-status');
    let bodyHtml = '';

    if (view === 'idcard' || view === 'all') {
        const card = payload.idcard;
        statusEl.className = `doc-status ${statusOf(card ? card.status : 'missing').cls}`;
        statusEl.innerHTML = pill(card ? card.status : 'missing');

        bodyHtml = `
            <div class="rc-top">
                ${receivedPhoto(photoUrl)}
                <div class="doc-identity">
                    <span class="doc-name">${esc(fullName(h))}</span>
                    <div class="doc-grid">
                        ${field('Matični broj', card ? card.nationalId : null, 'mono')}
                        ${field('Datum rođenja', h.dob)}
                        ${field('Pol', sexLabel(h.sex))}
                        ${field('Važi do', card ? card.expiresAt : null)}
                    </div>
                </div>
            </div>`;
    }

    if (view === 'medcert') {
        const cert = payload.medcert;
        statusEl.className = `doc-status ${statusOf(cert ? cert.status : 'missing').cls}`;
        statusEl.innerHTML = pill(cert ? cert.status : 'missing');

        bodyHtml = `
            <div class="rc-top">
                ${receivedPhoto(photoUrl)}
                <div class="doc-identity">
                    <span class="doc-name">${esc(fullName(h))}</span>
                    <div class="doc-grid">
                        ${field('Broj uverenja', cert ? cert.number : null, 'mono')}
                        ${field('Važi do', cert ? cert.expiresAt : null)}
                        ${field('Izdao', cert ? cert.issuedBy : null)}
                        ${field('Krvna grupa', cert ? cert.bloodType : null)}
                    </div>
                </div>
            </div>`;
    }

    if (view === 'licenses' || view === 'all') {
        const owned = (payload.licenses || []).filter(l => l.owned);
        const validCount = owned.filter(l => l.status === 'valid').length;

        if (view === 'licenses') {
            statusEl.className = `doc-status ${owned.length && validCount === owned.length ? 'ok' : (owned.length ? 'warn' : 'dim')}`;
            statusEl.innerHTML = owned.length
                ? `<i class="fa-solid fa-circle-check"></i> ${validCount}/${owned.length}`
                : pill('missing');

            // Ranije se pri pokazivanju dozvola video samo spisak, bez slike
            // i imena - covek kome pokazes nije imao cime da te poveze sa
            // dokumentom. Sada i dozvole imaju isto zaglavlje kao ostale kartice.
            bodyHtml += `
                <div class="rc-top">
                    ${receivedPhoto(photoUrl)}
                    <div class="doc-identity">
                        <span class="doc-name">${esc(fullName(h))}</span>
                        <div class="doc-grid">
                            ${field('Datum rođenja', h.dob)}
                            ${field('Matični broj', payload.idcard ? payload.idcard.nationalId : null, 'mono')}
                        </div>
                    </div>
                </div>`;
        }

        const rows = owned.length === 0
            ? `<span class="lic-row-note bad">Nema nijednu dozvolu</span>`
            : owned.map(lic => `
                <div class="lic-row">
                    <div class="lic-row-icon"><i class="${lic.icon}"></i></div>
                    <div class="lic-row-main">
                        <span class="lic-row-title">${esc(lic.label)} — ${esc(lic.name)}</span>
                        ${licenseNote(lic)}
                    </div>
                </div>`).join('');

        bodyHtml += `<div class="lic-details">${rows}</div>`;
    }

    document.getElementById('rc-body').innerHTML = bodyHtml;

    clearTimeout(receivedTimeout);
    receivedWrapper.classList.remove('hidden');

    receivedTimer.style.transition = 'none';
    receivedTimer.style.width = '100%';
    void receivedTimer.offsetWidth;
    receivedTimer.style.transition = `width ${RECEIVED_DURATION}ms linear`;
    receivedTimer.style.width = '0%';

    receivedTimeout = setTimeout(() => receivedWrapper.classList.add('hidden'), RECEIVED_DURATION);
}

// ============================================================
//  UPOZNAJ SE
// ============================================================

const introduceWrapper = document.getElementById('introduce-wrapper');
const introduceText = document.getElementById('introduce-text');
let pendingRequester = null;

function showIntroduceRequest(data) {
    pendingRequester = data.requesterSrc;
    introduceText.textContent = `${data.requesterName} (ID ${data.requesterSrc}) želi da se upozna sa tobom. Prihvataš?`;

    radialWrapper.classList.add('hidden');
    introduceWrapper.classList.remove('hidden');
}

function respondIntroduce(accepted) {
    if (pendingRequester === null) return;

    post('introduceResponse', { requesterSrc: pendingRequester, accepted });
    pendingRequester = null;

    introduceWrapper.classList.add('hidden');
    post('introduceHandled');
}

document.getElementById('introduce-yes').addEventListener('click', () => respondIntroduce(true));
document.getElementById('introduce-no').addEventListener('click', () => respondIntroduce(false));

// ============================================================
//  PORUKE IZ KLIJENTA
// ============================================================

window.addEventListener('message', (event) => {
    const data = event.data;

    if (data.action === 'open') {
        currentPlayer = data.player;
        currentPhoto = data.player.photo || null;
        currentOptions = buildRootOptions(data.player.job, data.player.isHospitalBoss, data.player.isLifeinvaderBoss, data.player.isGovBoss, data.player.isGovMember, data.player.hasHouse, data.player.external, data.player.policeSystem, data.player.hasBusiness);
        menuStack = [];
        titleStack = [];
        currentTitle = null;

        Object.values(WRAPPERS).forEach(w => w.classList.add('hidden'));
        radialWrapper.classList.remove('hidden');
        buildRadial(currentOptions);
    }

    if (data.action === 'close') {
        radialWrapper.classList.add('hidden');
        Object.values(WRAPPERS).forEach(w => w.classList.add('hidden'));
    }

    if (data.action === 'documents') {
        if (data.photo) currentPhoto = data.photo;
        openDocument(data.view, data.payload);
    }

    // Fotografija je stigla naknadno - samo je ubaci u vec nacrtanu karticu.
    if (data.action === 'photo') {
        currentPhoto = data.url || null;
        fillPhotoSlots(currentPhoto);
    }

    if (data.action === 'showReceived') {
        showReceived(data.view, data.payload, data.photo);
    }

    if (data.action === 'receivedPhoto') {
        fillPhotoSlots(data.url || null, '[data-rc-photo-slot]');
    }

    if (data.action === 'introduceIncoming') {
        showIntroduceRequest(data.data);
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') closeAll();
});

buildRadial(currentOptions);
