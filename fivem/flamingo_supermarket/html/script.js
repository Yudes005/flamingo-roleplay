const resource = (typeof GetParentResourceName === 'function') ? GetParentResourceName() : 'flamingo_supermarket';

/* ---- Market ---- */
const appEl           = document.getElementById('app');
const shopLabelEl     = document.getElementById('shopLabel');
const welcomeTitleEl  = document.getElementById('welcomeTitle');
const closeBtnEl      = document.getElementById('closeBtn');

const productListEl   = document.getElementById('productList');
const cartItemsEl      = document.getElementById('cartItems');
const cartEmptyEl      = document.getElementById('cartEmpty');
const totalAmountEl    = document.getElementById('totalAmount');
const totalLabelEl     = document.getElementById('totalLabel');
const cartLabelEl      = document.getElementById('cartLabel');
const emptyCartLabelEl = document.getElementById('emptyCartLabel');
const payCardBtn       = document.getElementById('payCardBtn');
const payCashBtn       = document.getElementById('payCashBtn');
const payCardTextEl    = document.getElementById('payCard');
const payCashTextEl    = document.getElementById('payCash');

let idBiz = null;
let cart = [];
let biz = null;          // flamingo_biznisi: vlasnik, cena, zalihe (null = market bez sistema biznisa)
let bizArmed = false;
let bizArmTimer = null;

const ownerTagEl = document.getElementById('ownerTag');
const bizBtnEl   = document.getElementById('bizBtn');
const bizPanelEl = document.getElementById('bizPanel');
const marketBodyEl = document.getElementById('marketBody');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => Math.floor(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '$';

// Koliko komada artikla ima na stanju (null = neograniceno, market bez vlasnika)
function stockOf(id) {
  if (!biz || !biz.stock) return null;
  const n = biz.stock[id];
  return typeof n === 'number' ? n : 0;
}

/* ===================== NUI FETCH ===================== */
function nuiCallback(name, data = {}) {
  return fetch(`https://${resource}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(data)
  }).then(r => r.json ? r.json().catch(() => null) : null);
}

/* ===================== CART ===================== */
function findCartItem(id) {
  return cart.find(i => i.id === id) || null;
}

function addToCart(item) {
  const existing = findCartItem(item.id);
  const stock = stockOf(item.id);
  if (stock !== null && (existing ? existing.kolicina : 0) >= stock) return;
  if (existing) {
    existing.kolicina += 1;
  } else {
    cart.push({ ...item, kolicina: 1 });
  }
  renderCart();
}

function decreaseFromCart(id) {
  const existing = findCartItem(id);
  if (!existing) return;
  if (existing.kolicina > 1) {
    existing.kolicina -= 1;
  } else {
    cart = cart.filter(i => i.id !== id);
  }
  renderCart();
}

function renderCart() {
  cartItemsEl.innerHTML = '';
  let total = 0;

  if (cart.length === 0) {
    cartEmptyEl.classList.remove('hidden');
    cartItemsEl.classList.add('hidden');
  } else {
    cartEmptyEl.classList.add('hidden');
    cartItemsEl.classList.remove('hidden');

    cart.forEach(item => {
      total += item.cijena * item.kolicina;

      const li = document.createElement('li');
      li.className = 'cart-item';
      li.innerHTML = `
        <div class="cart-item-img"><img src="${item.slika}" onerror="this.style.display='none'"></div>
        <div class="cart-item-info">
          <div class="cart-item-name">${item.ime}</div>
          <div class="cart-item-sub">$${item.cijena} x${item.kolicina}</div>
        </div>
        <div class="cart-item-remove" data-id="${item.id}"><i class="fa-solid fa-minus"></i></div>
      `;
      li.querySelector('.cart-item-remove').addEventListener('click', () => decreaseFromCart(item.id));
      cartItemsEl.appendChild(li);
    });
  }

  totalAmountEl.textContent = '$' + total.toLocaleString('en-US');

  const hasItems = cart.length > 0;
  payCardBtn.disabled = !hasItems;
  payCashBtn.disabled = !hasItems;
  updateStockLabels();
}

// "Na stanju" ispod svakog artikla + dugme Dodaj se gasi kad nestane
function updateStockLabels() {
  document.querySelectorAll('.product-card[data-id]').forEach((card) => {
    const id = card.dataset.id;
    const stock = stockOf(id);
    const el = card.querySelector('.product-stock');
    const btn = card.querySelector('.product-add');
    if (stock === null) { el.classList.add('hidden'); btn.disabled = false; return; }
    const inCart = (findCartItem(id) || { kolicina: 0 }).kolicina;
    const left = Math.max(0, stock - inCart);
    el.classList.remove('hidden');
    el.classList.toggle('out', stock <= 0);
    el.textContent = stock <= 0 ? 'Nema na stanju' : `Na stanju: ${left}`;
    btn.disabled = left <= 0;
  });
}

/* ===================== PRODUCTS ===================== */
function renderProducts(artikli) {
  productListEl.innerHTML = '';
  artikli.forEach(item => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.dataset.id = item.id;
    card.innerHTML = `
      <div class="product-img">
        <img src="${item.slika}" onerror="this.style.display='none'; this.parentElement.innerHTML='<i class=\\'fa-solid fa-basket-shopping\\'></i>'">
      </div>
      <div class="product-name">${item.ime}</div>
      <div class="product-price">$${item.cijena}</div>
      <div class="product-stock hidden"></div>
      <button class="product-add"><i class="fa-solid fa-plus"></i> Dodaj</button>
    `;
    card.querySelector('.product-add').addEventListener('click', () => addToCart(item));
    productListEl.appendChild(card);
  });
}

/* ===================== OPEN / CLOSE MARKET ===================== */
/* ===================== BIZNIS (flamingo_biznisi) ===================== */
function renderBizHeader() {
  const show = !!biz;
  ownerTagEl.classList.toggle('hidden', !show);
  bizBtnEl.classList.toggle('hidden', !show);
  if (!show) return;
  ownerTagEl.classList.toggle('free', !biz.owned);
  ownerTagEl.innerHTML = `
    <span class="owner-ic"><i class="fa-solid ${biz.owned ? 'fa-crown' : 'fa-tag'}"></i></span>
    <span class="owner-t"><small>Vlasnik</small><strong>${biz.owned ? esc(biz.ownerName || 'Nepoznat') : 'Na prodaju'}</strong></span>`;
}

function renderBizPanel() {
  if (!biz) return;
  let foot;
  if (biz.mine) {
    foot = `<div class="biz-note"><i class="fa-solid fa-tablet-screen-button"></i><span>Ovo je tvoj market. Kasom i narudžbinom robe upravljaš na <b>tabletu</b>, aplikacija <b>Moj biznis</b>.</span></div>`;
  } else if (biz.owned) {
    foot = `<div class="biz-note"><i class="fa-solid fa-lock"></i><span>Ovaj market već ima vlasnika. Biznisi se preprodaju na <b>aukciji</b>.</span></div>`;
  } else if (biz.canBuy) {
    const limit = biz.maxCount > 0 && biz.myCount >= biz.maxCount;
    const from = biz.buyFrom === 'money' ? biz.cash : (biz.buyFrom === 'bank' ? biz.bank : Math.max(biz.bank, biz.cash));
    const enough = from >= biz.price;
    foot = `
      <div class="biz-note test"><i class="fa-solid fa-flask"></i><span><b>TEST:</b> kupovina iz menija je privremena. Kasnije se biznisi kupuju na aukciji.</span></div>
      <button class="biz-buy ${bizArmed ? 'armed' : ''}" id="bizBuy" ${limit || !enough ? 'disabled' : ''}>
        <i class="fa-solid ${bizArmed ? 'fa-check' : 'fa-cart-shopping'}"></i> ${bizArmed ? 'Klikni ponovo da potvrdiš' : `Kupi market za ${money(biz.price)}`}
      </button>
      <div class="biz-sub">${limit ? 'Već imaš biznis. Možeš imati samo jedan.' : `Plaća se sa računa${enough ? '.' : '. Nemaš dovoljno novca.'}`}</div>`;
  } else {
    foot = `<div class="biz-note"><i class="fa-solid fa-gavel"></i><span>Ovaj market je na prodaju, ali se kupuje isključivo na <b>aukciji</b>.</span></div>`;
  }

  bizPanelEl.innerHTML = `
    <div class="biz-card">
      <div class="biz-head">
        <div class="biz-ic"><i class="fa-solid fa-store"></i></div>
        <div class="biz-t">
          <span class="biz-eyebrow">Biznis · Market · ID #${biz.id}</span>
          <strong>${esc(biz.name)}</strong>
          <span class="biz-status ${biz.mine ? 'mine' : (biz.owned ? 'owned' : 'sale')}">${biz.mine ? 'Tvoj biznis' : (biz.owned ? 'Vlasnik: ' + esc(biz.ownerName || 'Nepoznat') : 'Na prodaju')}</span>
        </div>
        <div class="biz-price"><span>${biz.owned ? 'Vrednost marketa' : 'Cena marketa'}</span><b>${money(biz.price)}</b></div>
      </div>
      <div class="biz-info">
        <div><i class="fa-solid fa-coins"></i><span>Sav novac od prodaje ide u <b>kasu biznisa</b>.</span></div>
        <div><i class="fa-solid fa-boxes-stacked"></i><span>Svaki artikal ima do <b>${biz.maxStock || 100} kom.</b> u magacinu. Kad nestane, vlasnik naručuje robu na tabletu za <b>pola cene</b>.</span></div>
      </div>
      ${foot}
      <button class="biz-back" id="bizBack"><i class="fa-solid fa-arrow-left"></i> Nazad na kupovinu</button>
    </div>`;
}

function toggleBizPanel(show) {
  bizArmed = false;
  bizPanelEl.classList.toggle('hidden', !show);
  marketBodyEl.classList.toggle('hidden', show);
  bizBtnEl.classList.toggle('active', show);
  if (show) renderBizPanel();
}

bizBtnEl.addEventListener('click', () => toggleBizPanel(bizPanelEl.classList.contains('hidden')));

bizPanelEl.addEventListener('click', async (e) => {
  if (e.target.closest('#bizBack')) return toggleBizPanel(false);
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
  const info = await nuiCallback('bizBuy', { id: biz.id });
  if (info && typeof info === 'object') {
    biz = info;
    renderBizHeader();
    updateStockLabels();
  }
  renderBizPanel();
});

function openShop(data) {
  idBiz = data.id;
  cart = [];
  biz = data.biz || null;
  renderBizHeader();
  toggleBizPanel(false);

  if (data.Tablica?.ime) shopLabelEl.textContent = data.Tablica.ime;
  if (data.welcomeTitle) welcomeTitleEl.textContent = data.welcomeTitle;
  if (data.totalLabel) totalLabelEl.textContent = data.totalLabel;
  if (data.cartLabel) cartLabelEl.textContent = data.cartLabel;
  if (data.emptyCartLabel) emptyCartLabelEl.textContent = data.emptyCartLabel;
  if (data.payCard) payCardTextEl.textContent = data.payCard;
  if (data.payCash) payCashTextEl.textContent = data.payCash;

  renderProducts(data.Tablica?.javno?.artikli || []);
  renderCart();

  appEl.classList.remove('hidden');
}

function closeShop() {
  appEl.classList.add('hidden');
  cart = [];
  idBiz = null;
  nuiCallback('zatvori_menu');
}

/* ===================== PAY ===================== */
function pay(vrsta) {
  if (cart.length === 0) return;
  nuiCallback('plati', { itemi: cart, id: idBiz, vrsta });
}

payCardBtn.addEventListener('click', () => pay(1));
payCashBtn.addEventListener('click', () => pay(2));
closeBtnEl.addEventListener('click', () => closeShop());

/* ===================== NUI MESSAGES ===================== */
window.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || !data.action) return;

  switch (data.action) {
    case 'openShop':
      openShop(data);
      break;

    case 'closeAll':
      appEl.classList.add('hidden');
      cart = [];
      idBiz = null;
      break;
  }
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!appEl.classList.contains('hidden')) {
      closeShop();
    }
  }
});
