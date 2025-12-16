const API_BASE = '/api';

// DOM 元素
const productGrid = document.getElementById('product-grid');
const cartList = document.getElementById('cart-list');
const cartCount = document.getElementById('cart-count');
const cartTotal = document.getElementById('cart-total');
const navCartCount = document.getElementById('nav-cart-count');
const clearCartBtn = document.getElementById('clear-cart-btn');
const refreshBtn = document.getElementById('refresh-btn');
const orderForm = document.getElementById('order-form');
const toast = document.getElementById('toast');
const searchInput = document.getElementById('search-input');
const pagination = document.getElementById('pagination');
const orderSummaryItems = document.getElementById('order-summary-items');
const orderTotal = document.getElementById('order-total');

// 状态
let products = [];
let filteredProducts = [];
let cart = [];
let currentPage = 1;
const itemsPerPage = 8;

// 支付方式配置
const paymentConfig = {
  wechat: {
    name: '微信支付',
    qrcode: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=weixin://wxpay/bizpayurl?pr=DEMO',
    instruction: '请使用微信扫描下方二维码完成支付'
  },
  alipay: {
    name: '支付宝',
    qrcode: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://qr.alipay.com/demo',
    instruction: '请使用支付宝扫描下方二维码完成支付'
  },
  bank: {
    name: '银行转账',
    info: {
      bank: '中国工商银行',
      account: '6222 **** **** 8888',
      name: '屏幕仓科技有限公司'
    },
    instruction: '请转账至以下账户，转账时请备注订单号'
  },
  cod: {
    name: '货到付款',
    instruction: '收到货物后请当面支付给快递员'
  }
};

// Toast 提示
const showToast = (msg, type = 'info') => {
  toast.textContent = msg;
  toast.className = `toast show ${type}`;
  setTimeout(() => toast.classList.remove('show'), 2500);
};

// 加载产品
const loadProducts = async () => {
  refreshBtn.disabled = true;
  refreshBtn.innerHTML = '⏳ 加载中...';
  try {
    const res = await fetch(`${API_BASE}/products`);
    products = await res.json();
    filteredProducts = [...products];
    currentPage = 1;
    renderProducts();
    renderPagination();
  } catch (e) {
    showToast('获取产品列表失败', 'error');
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.innerHTML = '🔄 刷新';
  }
};

// 搜索产品
const searchProducts = (keyword) => {
  const kw = keyword.toLowerCase().trim();
  if (!kw) {
    filteredProducts = [...products];
  } else {
    filteredProducts = products.filter(p => 
      p.name.toLowerCase().includes(kw) || 
      (p.description && p.description.toLowerCase().includes(kw))
    );
  }
  currentPage = 1;
  renderProducts();
  renderPagination();
};

// 渲染产品列表（分页）
const renderProducts = () => {
  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const pageProducts = filteredProducts.slice(start, end);

  if (pageProducts.length === 0) {
    productGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📦</div>
        <p>暂无产品</p>
        <p class="empty-sub">请稍后再试或联系客服</p>
      </div>
    `;
    return;
  }

  productGrid.innerHTML = '';
  pageProducts.forEach((p) => {
    const inCart = cart.find(c => c.productId === p.id);
    const cartQty = inCart ? inCart.quantity : 0;
    const stockClass = p.stock < 5 ? 'low-stock' : (p.stock < 10 ? 'medium-stock' : '');
    
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-image">
        <img src="${p.image || 'https://via.placeholder.com/300x200'}" alt="${p.name}" loading="lazy" />
        ${p.stock < 5 ? '<span class="stock-badge">库存紧张</span>' : ''}
        ${cartQty > 0 ? `<span class="cart-qty-badge">${cartQty}</span>` : ''}
      </div>
      <div class="card-body">
        <p class="stock-info ${stockClass}">📦 库存 ${p.stock} 件</p>
        <h3>${p.name}</h3>
        <p class="desc">${p.description || ''}</p>
      </div>
      <div class="card-footer">
        <span class="price">¥${p.price.toFixed(2)}</span>
        <button class="btn ${p.stock === 0 ? 'disabled' : 'primary'}" ${p.stock === 0 ? 'disabled' : ''}>
          ${p.stock === 0 ? '已售罄' : '🛒 加入'}
        </button>
      </div>
    `;
    
    const btn = card.querySelector('button');
    if (p.stock > 0) {
      btn.addEventListener('click', () => addToCart(p.id));
    }
    productGrid.appendChild(card);
  });
};

// 渲染分页
const renderPagination = () => {
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  
  if (totalPages <= 1) {
    pagination.innerHTML = '';
    return;
  }

  let html = '';
  
  // 上一页
  html += `<button class="page-btn ${currentPage === 1 ? 'disabled' : ''}" 
    ${currentPage === 1 ? 'disabled' : ''} data-page="prev">‹ 上一页</button>`;
  
  // 页码
  const maxVisible = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);
  
  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  if (startPage > 1) {
    html += `<button class="page-btn" data-page="1">1</button>`;
    if (startPage > 2) html += `<span class="page-ellipsis">...</span>`;
  }

  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) html += `<span class="page-ellipsis">...</span>`;
    html += `<button class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
  }

  // 下一页
  html += `<button class="page-btn ${currentPage === totalPages ? 'disabled' : ''}" 
    ${currentPage === totalPages ? 'disabled' : ''} data-page="next">下一页 ›</button>`;

  // 页码信息
  html += `<span class="page-info">共 ${filteredProducts.length} 件商品</span>`;

  pagination.innerHTML = html;

  // 绑定事件
  pagination.querySelectorAll('.page-btn:not(.disabled)').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.page;
      if (page === 'prev') currentPage--;
      else if (page === 'next') currentPage++;
      else currentPage = parseInt(page);
      
      renderProducts();
      renderPagination();
      
      // 滚动到产品区域顶部
      document.getElementById('products').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
};

// 购物车操作
const saveCart = () => localStorage.setItem('cart', JSON.stringify(cart));

const loadCart = () => {
  try {
    cart = JSON.parse(localStorage.getItem('cart') || '[]');
  } catch {
    cart = [];
  }
  renderCart();
  updateOrderSummary();
};

const addToCart = (productId) => {
  const product = products.find(p => p.id === productId);
  if (!product) return;
  
  const item = cart.find((c) => c.productId === productId);
  if (item) {
    if (item.quantity >= product.stock) {
      showToast('已达到库存上限', 'warning');
      return;
    }
    item.quantity += 1;
  } else {
    cart.push({ productId, quantity: 1 });
  }
  
  renderCart();
  renderProducts();
  saveCart();
  updateOrderSummary();
  showToast('✓ 已加入购物车', 'success');
};

const updateQuantity = (productId, delta) => {
  const item = cart.find((c) => c.productId === productId);
  if (!item) return;
  
  const product = products.find(p => p.id === productId);
  
  if (delta > 0 && product && item.quantity >= product.stock) {
    showToast('已达到库存上限', 'warning');
    return;
  }
  
  item.quantity += delta;
  if (item.quantity <= 0) {
    cart = cart.filter((c) => c.productId !== productId);
  }
  
  renderCart();
  renderProducts();
  saveCart();
  updateOrderSummary();
};

const renderCart = () => {
  if (cart.length === 0) {
    cartList.innerHTML = `
      <div class="empty-cart">
        <div class="empty-icon">🛒</div>
        <p>购物车是空的</p>
        <a href="#products" class="btn ghost">去选购 →</a>
      </div>
    `;
    cartCount.textContent = '0';
    cartTotal.textContent = '0.00';
    navCartCount.textContent = '0';
    navCartCount.style.display = 'none';
    return;
  }

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
      <div class="cart-item-info">
        <img src="${product.image || 'https://via.placeholder.com/60'}" alt="${product.name}" />
        <div>
          <div class="name">${product.name}</div>
          <div class="unit-price">¥${product.price.toFixed(2)} / 件</div>
        </div>
      </div>
      <div class="cart-item-actions">
        <div class="quantity-control">
          <button class="qty-btn minus">−</button>
          <span class="qty-value">${item.quantity}</span>
          <button class="qty-btn plus" ${item.quantity >= product.stock ? 'disabled' : ''}>+</button>
        </div>
        <div class="item-total">¥${(product.price * item.quantity).toFixed(2)}</div>
        <button class="remove-btn" title="删除">×</button>
      </div>
    `;
    
    row.querySelector('.minus').addEventListener('click', () => updateQuantity(item.productId, -1));
    row.querySelector('.plus').addEventListener('click', () => updateQuantity(item.productId, 1));
    row.querySelector('.remove-btn').addEventListener('click', () => {
      cart = cart.filter(c => c.productId !== item.productId);
      renderCart();
      renderProducts();
      saveCart();
      updateOrderSummary();
    });
    
    cartList.appendChild(row);
  });
  
  cartCount.textContent = count;
  cartTotal.textContent = total.toFixed(2);
  navCartCount.textContent = count > 99 ? '99+' : count;
  navCartCount.style.display = count > 0 ? 'inline-flex' : 'none';
};

// 更新订单摘要
const updateOrderSummary = () => {
  if (cart.length === 0) {
    orderSummaryItems.innerHTML = '<p class="empty-summary">购物车为空</p>';
    orderTotal.textContent = '0.00';
    return;
  }

  let html = '';
  let total = 0;
  
  cart.forEach(item => {
    const product = products.find(p => p.id === item.productId);
    if (!product) return;
    const subtotal = product.price * item.quantity;
    total += subtotal;
    html += `
      <div class="summary-item">
        <span>${product.name} × ${item.quantity}</span>
        <span>¥${subtotal.toFixed(2)}</span>
      </div>
    `;
  });
  
  orderSummaryItems.innerHTML = html;
  orderTotal.textContent = total.toFixed(2);
};

// 支付方式选择
document.querySelectorAll('.payment-option').forEach(option => {
  option.addEventListener('click', () => {
    document.querySelectorAll('.payment-option').forEach(o => o.classList.remove('selected'));
    option.classList.add('selected');
    option.querySelector('input').checked = true;
  });
});

// 关闭支付弹窗
window.closePaymentModal = () => {
  document.getElementById('payment-modal').style.display = 'none';
};

// 显示支付弹窗
const showPaymentModal = (orderId, total, method) => {
  const config = paymentConfig[method];
  const modal = document.getElementById('payment-modal');
  const title = document.getElementById('payment-modal-title');
  const content = document.getElementById('payment-modal-content');

  title.textContent = `${config.name} - 订单 #${orderId}`;

  let html = `<p class="payment-instruction">${config.instruction}</p>`;
  
  if (method === 'wechat' || method === 'alipay') {
    html += `
      <div class="qrcode-container">
        <img src="${config.qrcode}" alt="支付二维码" class="qrcode" />
        <p class="qrcode-amount">支付金额：<strong>¥${total.toFixed(2)}</strong></p>
        <p class="qrcode-tip">扫码后请等待支付结果</p>
      </div>
    `;
  } else if (method === 'bank') {
    html += `
      <div class="bank-info">
        <div class="bank-row"><span>开户银行</span><strong>${config.info.bank}</strong></div>
        <div class="bank-row"><span>账号</span><strong>${config.info.account}</strong></div>
        <div class="bank-row"><span>户名</span><strong>${config.info.name}</strong></div>
        <div class="bank-row"><span>转账金额</span><strong class="amount">¥${total.toFixed(2)}</strong></div>
        <div class="bank-row"><span>备注</span><strong>订单号 ${orderId}</strong></div>
      </div>
    `;
  } else if (method === 'cod') {
    html += `
      <div class="cod-info">
        <div class="cod-icon">🚚</div>
        <p>您选择了货到付款</p>
        <p>应付金额：<strong>¥${total.toFixed(2)}</strong></p>
        <p class="cod-tip">请在收货时将款项支付给快递员</p>
      </div>
    `;
  }

  content.innerHTML = html;
  modal.style.display = 'flex';
};

// 清空购物车
clearCartBtn.addEventListener('click', () => {
  if (cart.length === 0) return;
  if (confirm('确定要清空购物车吗？')) {
    cart = [];
    renderCart();
    renderProducts();
    saveCart();
    updateOrderSummary();
    showToast('购物车已清空');
  }
});

// 刷新产品
refreshBtn.addEventListener('click', loadProducts);

// 搜索
let searchTimeout;
searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    searchProducts(e.target.value);
  }, 300);
});

// 提交订单
orderForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (!cart.length) {
    showToast('请先添加商品', 'warning');
    return;
  }
  
  const formData = new FormData(orderForm);
  const paymentMethod = formData.get('paymentMethod');
  
  const payload = {
    customerName: formData.get('customerName'),
    phone: formData.get('phone'),
    address: formData.get('address'),
    remark: formData.get('remark') || '',
    paymentMethod: paymentMethod,
    items: cart.map((c) => ({ productId: c.productId, quantity: c.quantity }))
  };
  
  const submitBtn = document.getElementById('submit-order-btn');
  const btnText = submitBtn.querySelector('.btn-text');
  const btnLoading = submitBtn.querySelector('.btn-loading');
  
  submitBtn.disabled = true;
  btnText.style.display = 'none';
  btnLoading.style.display = 'inline';
  
  try {
    const res = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || '提交失败');
    
    // 清空购物车
    cart = [];
    saveCart();
    renderCart();
    renderProducts();
    updateOrderSummary();
    orderForm.reset();
    
    // 重置支付方式选择
    document.querySelectorAll('.payment-option').forEach(o => o.classList.remove('selected'));
    document.querySelector('.payment-option[data-method="wechat"]').classList.add('selected');
    document.querySelector('input[value="wechat"]').checked = true;
    
    showToast(`🎉 下单成功！订单号 #${data.orderId}`, 'success');
    
    // 显示支付弹窗
    setTimeout(() => {
      showPaymentModal(data.orderId, data.total, paymentMethod);
    }, 500);
    
    await loadProducts();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    btnText.style.display = 'inline';
    btnLoading.style.display = 'none';
  }
});

// ESC 关闭弹窗
document.addEventListener('keyup', (e) => {
  if (e.key === 'Escape') closePaymentModal();
});

// 点击遮罩关闭弹窗
document.getElementById('payment-modal').addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) closePaymentModal();
});

// 初始化
loadProducts();
loadCart();

// ========== 鼠标踏雪无痕特效 ==========
(function initSnowTrail() {
  const canvas = document.getElementById('snow-canvas');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  let particles = [];
  let mouseX = 0, mouseY = 0;
  let lastMouseX = 0, lastMouseY = 0;
  let isMoving = false;
  let moveTimeout;
  
  // 设置画布尺寸
  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  resize();
  window.addEventListener('resize', resize);
  
  // 粒子类
  class Particle {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.size = Math.random() * 4 + 2;
      this.speedX = (Math.random() - 0.5) * 2;
      this.speedY = (Math.random() - 0.5) * 2 + 1;
      this.life = 1;
      this.decay = Math.random() * 0.015 + 0.01;
      this.color = this.getColor();
      this.rotation = Math.random() * Math.PI * 2;
      this.rotationSpeed = (Math.random() - 0.5) * 0.1;
    }
    
    getColor() {
      const colors = [
        'rgba(255, 255, 255,',
        'rgba(147, 197, 253,',
        'rgba(196, 181, 253,',
        'rgba(165, 243, 252,',
        'rgba(253, 224, 71,'
      ];
      return colors[Math.floor(Math.random() * colors.length)];
    }
    
    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      this.speedY += 0.02; // 重力
      this.speedX *= 0.99;
      this.life -= this.decay;
      this.rotation += this.rotationSpeed;
      this.size *= 0.99;
    }
    
    draw() {
      if (this.life <= 0) return;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.globalAlpha = this.life;
      
      // 雪花/星星形状
      ctx.beginPath();
      const spikes = 6;
      const outerRadius = this.size;
      const innerRadius = this.size * 0.4;
      
      for (let i = 0; i < spikes * 2; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = (i * Math.PI) / spikes;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      
      ctx.fillStyle = this.color + this.life + ')';
      ctx.shadowColor = this.color + '0.5)';
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.restore();
    }
  }
  
  // 创建粒子
  const createParticles = (x, y, count = 3) => {
    for (let i = 0; i < count; i++) {
      particles.push(new Particle(
        x + (Math.random() - 0.5) * 20,
        y + (Math.random() - 0.5) * 20
      ));
    }
  };
  
  // 鼠标移动监听
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    isMoving = true;
    
    // 计算移动速度
    const dx = mouseX - lastMouseX;
    const dy = mouseY - lastMouseY;
    const speed = Math.sqrt(dx * dx + dy * dy);
    
    // 根据速度创建粒子
    if (speed > 3) {
      const particleCount = Math.min(Math.floor(speed / 5), 5);
      createParticles(mouseX, mouseY, particleCount);
    }
    
    lastMouseX = mouseX;
    lastMouseY = mouseY;
    
    clearTimeout(moveTimeout);
    moveTimeout = setTimeout(() => { isMoving = false; }, 100);
  });
  
  // 点击创建爆炸效果
  document.addEventListener('click', (e) => {
    if (e.target.closest('button, a, input, select, textarea')) {
      for (let i = 0; i < 15; i++) {
        const p = new Particle(e.clientX, e.clientY);
        p.speedX = (Math.random() - 0.5) * 8;
        p.speedY = (Math.random() - 0.5) * 8 - 2;
        p.size = Math.random() * 6 + 3;
        particles.push(p);
      }
    }
  });
  
  // 动画循环
  const animate = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 更新和绘制粒子
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
      p.update();
      p.draw();
    });
    
    // 限制粒子数量
    if (particles.length > 200) {
      particles = particles.slice(-200);
    }
    
    requestAnimationFrame(animate);
  };
  
  animate();
  
  // 触摸设备支持
  document.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    if (touch) {
      createParticles(touch.clientX, touch.clientY, 2);
    }
  }, { passive: true });
  
  document.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    if (touch) {
      for (let i = 0; i < 10; i++) {
        const p = new Particle(touch.clientX, touch.clientY);
        p.speedX = (Math.random() - 0.5) * 6;
        p.speedY = (Math.random() - 0.5) * 6;
        particles.push(p);
      }
    }
  }, { passive: true });
})();

// ========== 滚动显示动画 ==========
(function initScrollReveal() {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
      }
    });
  }, observerOptions);
  
  // 观察所有 panel
  document.querySelectorAll('.panel, .footer').forEach(el => {
    el.classList.add('scroll-reveal');
    observer.observe(el);
  });
})();

// ========== 平滑滚动增强 ==========
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});
