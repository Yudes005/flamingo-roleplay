const resource = (typeof GetParentResourceName === 'function') ? GetParentResourceName() : 'flamingo_supermarket';
const IN_GAME = typeof GetParentResourceName === 'function';

/* ===================== IKONICE (ugrađene, bez CDN-a) ===================== */
const ICONS = {
  basket: '<path d="M5 10h14l-1.5 9a2 2 0 01-2 1.7H8.5a2 2 0 01-2-1.7z"/><path d="M9 10l3-6 3 6M3 10h18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3"/>',
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.6 12.4a2 2 0 002 1.6h8.2a2 2 0 002-1.6L21 8H6"/>',
  card: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6.5 15h4"/>',
  cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.8"/><path d="M6 9.5v5M18 9.5v5"/>',
  box: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/>',
};
const icon = (n) => `<svg class="ic" viewBox="0 0 24 24">${ICONS[n] || ''}</svg>`;
document.querySelectorAll('[data-ic]').forEach((el) => { el.innerHTML = icon(el.dataset.ic); });

/* ===================== ELEMENTI ===================== */
const $ = (id) => document.getElementById(id);
const appEl = $('app');
const productListEl = $('productList');
const cartItemsEl = $('cartItems');
const payCardBtn = $('payCardBtn');
const payCashBtn = $('payCashBtn');

let idBiz = null;
let products = [];
let cart = [];
let category = 'all';
let query = '';
let busy = false;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// 1500 -> "1.500$" (isto kao ostale Flamingo skripte)
const money = (n) => Math.floor(Math.abs(Number(n) || 0)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '$';

/* ===================== NUI FETCH ===================== */
function nuiCallback(name, data = {}) {
  if (!IN_GAME) return Promise.resolve(true);
  return fetch(`https://${resource}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(data)
  }).then(r => r.json ? r.json().catch(() => null) : null).catch(() => null);
}

/* ===================== SLIKA ARTIKLA ===================== */
function imgHTML(item, cls) {
  const letter = esc((item.ime || '?').trim().charAt(0).toUpperCase());
  if (!item.slika) return `<div class="${cls} noimg"><span>${letter}</span></div>`;
  return `<div class="${cls}"><img src="${esc(item.slika)}" alt="" onerror="this.parentElement.classList.add('noimg');this.parentElement.innerHTML='<span>${letter}</span>'"></div>`;
}

/* ===================== KORPA ===================== */
const findCartItem = (id) => cart.find(i => i.id === id) || null;
const qtyOf = (id) => (findCartItem(id) || {}).kolicina || 0;

function changeQty(item, delta) {
  const existing = findCartItem(item.id);
  if (existing) {
    existing.kolicina = Math.max(0, Math.min(100, existing.kolicina + delta));
    if (!existing.kolicina) cart = cart.filter(i => i.id !== item.id);
  } else if (delta > 0) {
    cart.push({ ...item, kolicina: 1 });
  }
  renderCart();
  updateProductControls(item.id);
}

function renderCart() {
  let total = 0, count = 0;
  cart.forEach(i => { total += i.cijena * i.kolicina; count += i.kolicina; });

  const has = cart.length > 0;
  $('cartEmpty').classList.toggle('hidden', has);
  cartItemsEl.classList.toggle('hidden', !has);
  $('clearCart').classList.toggle('hidden', !has);
  $('cartCount').classList.toggle('hidden', !has);
  $('cartCount').textContent = count;

  cartItemsEl.innerHTML = cart.map(item => `
    <li class="cart-item" data-id="${esc(item.id)}">
      ${imgHTML(item, 'cart-item-img')}
      <div class="cart-item-info">
        <div class="cart-item-name">${esc(item.ime)}</div>
        <div class="cart-item-sub">${money(item.cijena)} / kom.</div>
      </div>
      <div class="cart-item-right">
        <div class="cart-item-total">${money(item.cijena * item.kolicina)}</div>
        <div class="stepper sm">
          <button data-step="-1">${item.kolicina === 1 ? icon('trash') : icon('minus')}</button>
          <span>${item.kolicina}</span>
          <button data-step="1">${icon('plus')}</button>
        </div>
      </div>
    </li>`).join('');

  cartItemsEl.querySelectorAll('.cart-item').forEach(li => {
    const item = findCartItem(li.dataset.id);
    li.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => changeQty(item, Number(b.dataset.step))));
  });

  $('itemsCount').textContent = count;
  $('totalAmount').textContent = money(total);
  payCardBtn.disabled = !has || busy;
  payCashBtn.disabled = !has || busy;
}

/* ===================== ARTIKLI ===================== */
function categories() {
  const set = [];
  products.forEach(p => { const c = p.kategorija || 'artikli'; if (!set.includes(c)) set.push(c); });
  return set;
}

function renderChips() {
  const cats = categories();
  const chipsEl = $('chips');
  if (cats.length < 2) { chipsEl.innerHTML = ''; return; }
  const label = (c) => c.charAt(0).toUpperCase() + c.slice(1);
  chipsEl.innerHTML = [['all', 'Sve'], ...cats.map(c => [c, label(c)])]
    .map(([id, l]) => `<button class="chip ${category === id ? 'active' : ''}" data-cat="${esc(id)}">${esc(l)}</button>`).join('');
  chipsEl.querySelectorAll('[data-cat]').forEach(b => b.addEventListener('click', () => { category = b.dataset.cat; renderChips(); renderProducts(); }));
}

function controlsHTML(item) {
  const q = qtyOf(item.id);
  return q
    ? `<div class="stepper"><button data-step="-1">${q === 1 ? icon('trash') : icon('minus')}</button><span>${q}</span><button data-step="1">${icon('plus')}</button></div>`
    : `<button class="add-btn" data-step="1">${icon('plus')}<span>Dodaj</span></button>`;
}

function bindControls(el, item) {
  el.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); changeQty(item, Number(b.dataset.step)); }));
}

function updateProductControls(id) {
  const card = productListEl.querySelector(`.product-card[data-id="${CSS.escape(id)}"]`);
  if (!card) return;
  const item = products.find(p => p.id === id);
  const box = card.querySelector('.product-controls');
  box.innerHTML = controlsHTML(item);
  card.classList.toggle('in-cart', qtyOf(id) > 0);
  bindControls(box, item);
}

function renderProducts() {
  const q = query.trim().toLowerCase();
  const list = products.filter(p => (category === 'all' || (p.kategorija || 'artikli') === category) && (!q || String(p.ime).toLowerCase().includes(q)));
  const n = list.length, m10 = n % 10, m100 = n % 100;
  $('productsCount').textContent = `${n} ${m10 === 1 && m100 !== 11 ? 'artikal' : (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 'artikla' : 'artikala')}`;
  $('productsEmpty').classList.toggle('hidden', list.length > 0);

  productListEl.innerHTML = list.map(item => `
    <div class="product-card ${qtyOf(item.id) ? 'in-cart' : ''}" data-id="${esc(item.id)}">
      ${imgHTML(item, 'product-img')}
      <div class="product-name">${esc(item.ime)}</div>
      <div class="product-bottom">
        <div class="product-price">${money(item.cijena)}</div>
        <div class="product-controls">${controlsHTML(item)}</div>
      </div>
    </div>`).join('');

  productListEl.querySelectorAll('.product-card').forEach(card => {
    const item = products.find(p => p.id === card.dataset.id);
    bindControls(card, item);
    card.querySelector('.product-img').addEventListener('click', () => changeQty(item, 1));
  });
}

$('search').addEventListener('input', (e) => { query = e.target.value; renderProducts(); });
$('clearCart').addEventListener('click', () => { cart = []; renderCart(); renderProducts(); });

/* ===================== SKALIRANJE ===================== */
function fit() {
  const s = Math.min(1, (window.innerWidth * 0.94) / 1180, (window.innerHeight * 0.92) / 740);
  $('market').style.transform = `scale(${s.toFixed(3)})`;
}
window.addEventListener('resize', fit);
fit();

/* ===================== OTVARANJE / ZATVARANJE ===================== */
function openShop(data) {
  idBiz = data.id;
  cart = [];
  busy = false;
  category = 'all';
  query = '';
  $('search').value = '';

  if (data.Tablica?.ime) $('shopLabel').textContent = data.Tablica.ime;
  if (data.welcomeTitle) $('welcomeTitle').textContent = data.welcomeTitle;
  if (data.totalLabel) $('totalLabel').textContent = data.totalLabel;
  if (data.cartLabel) $('cartLabel').textContent = data.cartLabel;
  if (data.emptyCartLabel) $('emptyCartLabel').textContent = data.emptyCartLabel;
  if (data.payCard) $('payCard').textContent = data.payCard;
  if (data.payCash) $('payCash').textContent = data.payCash;

  products = data.Tablica?.javno?.artikli || [];
  renderChips();
  renderProducts();
  renderCart();

  appEl.classList.remove('hidden', 'closing');
  fit();
}

function hideShop() {
  appEl.classList.add('closing');
  setTimeout(() => { appEl.classList.add('hidden'); appEl.classList.remove('closing'); }, 180);
  cart = [];
  idBiz = null;
}

function closeShop() {
  hideShop();
  nuiCallback('zatvori_menu');
}

/* ===================== PLAĆANJE ===================== */
async function pay(vrsta) {
  if (cart.length === 0 || busy) return;
  busy = true;
  const btn = vrsta === 1 ? payCardBtn : payCashBtn;
  btn.classList.add('loading');
  renderCart();
  await nuiCallback('plati', { itemi: cart, id: idBiz, vrsta });
  // uspeh: client zatvara market (closeAll); neuspeh: ostaje otvoren sa korpom
  busy = false;
  btn.classList.remove('loading');
  if (!appEl.classList.contains('hidden')) renderCart();
}

payCardBtn.addEventListener('click', () => pay(1));
payCashBtn.addEventListener('click', () => pay(2));
$('closeBtn').addEventListener('click', () => closeShop());

/* ===================== NUI PORUKE ===================== */
window.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || !data.action) return;

  switch (data.action) {
    case 'openShop':
      openShop(data);
      break;
    case 'closeAll':
      hideShop();
      break;
  }
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !appEl.classList.contains('hidden')) closeShop();
});

/* ===================== DEMO (samo u browseru) ===================== */
if (!IN_GAME) {
  openShop({
    id: 'flamingo_market', Tablica: { ime: 'Flamingo Market', javno: { artikli: [
      { ime: 'Sim Kartica', id: 'simcard', cijena: 100, kategorija: 'elektronika' },
      { ime: 'Voda', id: 'water', cijena: 15, kategorija: 'piće' },
      { ime: 'Kola', id: 'cola', cijena: 25, kategorija: 'piće' },
      { ime: 'Sendvič', id: 'sandwich', cijena: 40, kategorija: 'hrana' },
      { ime: 'Čips', id: 'chips', cijena: 20, kategorija: 'hrana' },
      { ime: 'Telefon', id: 'phone', cijena: 1500, kategorija: 'elektronika' },
      { ime: 'Zavoj', id: 'bandage', cijena: 60, kategorija: 'ostalo' },
      { ime: 'Upaljač', id: 'lighter', cijena: 10, kategorija: 'ostalo' },
    ] } }
  });
}
