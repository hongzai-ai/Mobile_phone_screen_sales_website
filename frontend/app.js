const API_BASE = '/api';

const productGrid = document.getElementById('product-grid');
const cartList = document.getElementById('cart-list');
const cartCount = document.getElementById('cart-count');
const cartTotal = document.getElementById('cart-total');
const clearCartBtn = document.getElementById('clear-cart-btn');
const refreshBtn = document.getElementById('refresh-btn');
const orderForm = document.getElementById('order-form');
const toast = document.getElementById('toast');

let products = [];
let cart = [];

const showToast = (msg) => {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
};

const loadProducts = async () => {
  refreshBtn.disabled = true;
  try {
    const res = await fetch(`${API_BASE}/products`);
    products = await res.json();
    renderProducts();
  } catch (e) {
    showToast('获取产品列表失败');
  } finally {
    refreshBtn.disabled = false;
  }
};

const renderProducts = () => {
  productGrid.innerHTML = '';
  products.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <img src="${p.image || 'https://via.placeholder.com/300x200'}" alt="${p.name}" />
      <div>
        <p class="eyebrow">库存 ${p.stock}</p>
        <h3>${p.name}</h3>
        <p>${p.description || ''}</p>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span class="price">¥${p.price}</span>
        <button class="btn ghost" ${p.stock === 0 ? 'disabled' : ''}>加入</button>
      </div>
    `;
    card.querySelector('button').addEventListener('click', () => addToCart(p.id));
    productGrid.appendChild(card);
  });
};

const saveCart = () => localStorage.setItem('cart', JSON.stringify(cart));
const loadCart = () => {
  try {
    cart = JSON.parse(localStorage.getItem('cart') || '[]');
  } catch {
    cart = [];
  }
  renderCart();
};

const addToCart = (productId) => {
  const item = cart.find((c) => c.productId === productId);
  if (item) item.quantity += 1;
  else cart.push({ productId, quantity: 1 });
  renderCart();
  saveCart();
  showToast('已加入购物车');
};

const updateQuantity = (productId, delta) => {
  const item = cart.find((c) => c.productId === productId);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) cart = cart.filter((c) => c.productId !== productId);
  renderCart();
  saveCart();
};

const renderCart = () => {
  cartList.innerHTML = '';
  let total = 0;
  let count = 0;
  cart.forEach((item) => {
    const product = products.find((p) => p.id === item.productId);
    if (!product) return;
    total += product.price * item.quantity;
    count += item.quantity;
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <div>
        <div class="name">${product.name}</div>
        <div style="color:#9ca3af;font-size:13px;">¥${product.price} / 件</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <button class="btn ghost" style="padding:6px 10px;">-</button>
        <span>${item.quantity}</span>
        <button class="btn ghost" style="padding:6px 10px;">+</button>
      </div>
    `;
    const [minusBtn, plusBtn] = row.querySelectorAll('button');
    minusBtn.addEventListener('click', () => updateQuantity(item.productId, -1));
    plusBtn.addEventListener('click', () => updateQuantity(item.productId, 1));
    cartList.appendChild(row);
  });
  cartCount.textContent = count;
  cartTotal.textContent = total.toFixed(2);
};

clearCartBtn.addEventListener('click', () => {
  cart = [];
  renderCart();
  saveCart();
});

refreshBtn.addEventListener('click', loadProducts);

orderForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!cart.length) {
    showToast('请先添加商品');
    return;
  }
  const formData = new FormData(orderForm);
  const payload = {
    customerName: formData.get('customerName'),
    phone: formData.get('phone'),
    address: formData.get('address'),
    items: cart.map((c) => ({ productId: c.productId, quantity: c.quantity }))
  };
  const submitBtn = document.getElementById('submit-order-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = '提交中...';
  try {
    const res = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || '提交失败');
    cart = [];
    saveCart();
    renderCart();
    orderForm.reset();
    showToast(`下单成功，金额 ¥${data.total}`);
    await loadProducts();
  } catch (err) {
    showToast(err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '提交订单';
  }
});

loadProducts();
loadCart();

