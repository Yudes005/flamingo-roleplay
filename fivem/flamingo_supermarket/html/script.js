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
}

/* ===================== PRODUCTS ===================== */
function renderProducts(artikli) {
  productListEl.innerHTML = '';
  artikli.forEach(item => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <div class="product-img">
        <img src="${item.slika}" onerror="this.style.display='none'; this.parentElement.innerHTML='<i class=\\'fa-solid fa-basket-shopping\\'></i>'">
      </div>
      <div class="product-name">${item.ime}</div>
      <div class="product-price">$${item.cijena}</div>
      <button class="product-add"><i class="fa-solid fa-plus"></i> Dodaj</button>
    `;
    card.querySelector('.product-add').addEventListener('click', () => addToCart(item));
    productListEl.appendChild(card);
  });
}

/* ===================== OPEN / CLOSE MARKET ===================== */
function openShop(data) {
  idBiz = data.id;
  cart = [];

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
