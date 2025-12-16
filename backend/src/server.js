import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { db, initDb, queries } from './db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

const PORT = process.env.PORT || 3001;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'changeme-admin-token';

// 确保上传目录存在
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 配置 multer 文件上传
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'product-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 最大 5MB
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只支持 JPG, PNG, GIF, WebP 格式的图片'));
    }
  }
});

app.use(cors());
app.use(express.json());

// Serve frontend assets (built or static) if present
const staticDir = path.join(__dirname, '..', '..', 'frontend');

// 明确设置静态文件处理，确保 admin.html 可访问
app.use(express.static(staticDir, {
  extensions: ['html'],
  index: 'index.html'
}));

// 提供上传图片的静态访问
app.use('/uploads', express.static(uploadsDir));

// 专门处理 admin.html 路由
app.get('/admin.html', (_req, res) => {
  res.sendFile(path.join(staticDir, 'admin.html'));
});

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(staticDir, 'admin.html'));
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// 管理员认证中间件
const requireAdmin = (req, res, next) => {
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '');
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ message: '未授权' });
  }
  return next();
};

// 图片上传接口
app.post('/api/upload', requireAdmin, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '请选择要上传的图片' });
    }
    // 返回可访问的 URL
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ 
      success: true, 
      url: imageUrl,
      filename: req.file.filename,
      size: req.file.size
    });
  } catch (err) {
    res.status(500).json({ message: '上传失败', error: err.message });
  }
});

// 删除图片接口
app.delete('/api/upload/:filename', requireAdmin, (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(uploadsDir, filename);
    
    // 安全检查：确保文件在 uploads 目录内
    if (!filePath.startsWith(uploadsDir)) {
      return res.status(403).json({ message: '无权访问' });
    }
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true, message: '图片已删除' });
    } else {
      res.status(404).json({ message: '图片不存在' });
    }
  } catch (err) {
    res.status(500).json({ message: '删除失败', error: err.message });
  }
});

app.get('/api/products', async (_req, res) => {
  try {
    const products = await queries.allAsync('SELECT * FROM products ORDER BY id DESC');
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: '无法获取产品列表', error: err.message });
  }
});

app.post('/api/products', requireAdmin, async (req, res) => {
  const { name, description = '', price, stock = 0, image = '' } = req.body || {};
  if (!name || price === undefined) {
    return res.status(400).json({ message: '名称和价格为必填项' });
  }
  try {
    const result = await queries.runAsync(
      'INSERT INTO products (name, description, price, stock, image) VALUES (?, ?, ?, ?, ?)',
      [name, description, price, stock, image]
    );
    const product = await queries.getAsync('SELECT * FROM products WHERE id = ?', [result.lastID]);
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ message: '创建产品失败', error: err.message });
  }
});

app.put('/api/products/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, description, price, stock, image } = req.body || {};
  try {
    const existing = await queries.getAsync('SELECT * FROM products WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ message: '产品不存在' });

    await queries.runAsync(
      `UPDATE products
       SET name = ?, description = ?, price = ?, stock = ?, image = ?
       WHERE id = ?`,
      [
        name ?? existing.name,
        description ?? existing.description,
        price ?? existing.price,
        stock ?? existing.stock,
        image ?? existing.image,
        id
      ]
    );
    const updated = await queries.getAsync('SELECT * FROM products WHERE id = ?', [id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: '更新产品失败', error: err.message });
  }
});

app.delete('/api/products/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await queries.getAsync('SELECT * FROM products WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ message: '产品不存在' });
    await queries.runAsync('DELETE FROM products WHERE id = ?', [id]);
    res.json({ message: '已删除' });
  } catch (err) {
    res.status(500).json({ message: '删除产品失败', error: err.message });
  }
});

app.post('/api/orders', async (req, res) => {
  const { customerName, phone, address, items, remark = '', paymentMethod = 'wechat' } = req.body || {};
  if (!customerName || !phone || !address || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: '订单信息不完整' });
  }

  // 验证支付方式
  const validPaymentMethods = ['wechat', 'alipay', 'bank', 'cod'];
  if (!validPaymentMethods.includes(paymentMethod)) {
    return res.status(400).json({ message: '无效的支付方式' });
  }

  try {
    // 使用事务队列确保并发安全
    const result = await queries.runTransaction(async () => {
      let total = 0;
      const orderItems = [];

      // 验证库存并锁定价格
      for (const item of items) {
        const product = await queries.getAsync('SELECT * FROM products WHERE id = ?', [item.productId]);
        if (!product) {
          throw new Error(`产品 ${item.productId} 不存在`);
        }
        if (product.stock < item.quantity) {
          throw new Error(`${product.name} 库存不足（剩余 ${product.stock}）`);
        }
        total += product.price * item.quantity;
        orderItems.push({ product, quantity: item.quantity });
      }

      // 创建订单
      const orderResult = await queries.runAsync(
        'INSERT INTO orders (customer_name, phone, address, total, status, remark, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [customerName, phone, address, total, 'pending', remark, paymentMethod]
      );

      // 创建订单项并扣减库存
      for (const { product, quantity } of orderItems) {
        await queries.runAsync(
          'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
          [orderResult.lastID, product.id, quantity, product.price]
        );
        await queries.runAsync(
          'UPDATE products SET stock = stock - ? WHERE id = ?',
          [quantity, product.id]
        );
      }

      return { orderId: orderResult.lastID, total };
    });

    res.status(201).json({ message: '下单成功', orderId: result.orderId, total: result.total });
  } catch (err) {
    res.status(400).json({ message: err.message || '创建订单失败' });
  }
});

app.get('/api/orders', requireAdmin, async (_req, res) => {
  try {
    const orders = await queries.allAsync('SELECT * FROM orders ORDER BY created_at DESC');
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: '获取订单失败', error: err.message });
  }
});

// 获取单个订单详情（包含订单项）
app.get('/api/orders/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const order = await queries.getAsync('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) return res.status(404).json({ message: '订单不存在' });
    
    const items = await queries.allAsync(`
      SELECT oi.*, p.name as product_name 
      FROM order_items oi 
      LEFT JOIN products p ON oi.product_id = p.id 
      WHERE oi.order_id = ?
    `, [id]);
    
    res.json({ ...order, items });
  } catch (err) {
    res.status(500).json({ message: '获取订单详情失败', error: err.message });
  }
});

// 更新订单状态
app.put('/api/orders/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status, customerName, phone, address, paymentMethod } = req.body || {};
  try {
    const existing = await queries.getAsync('SELECT * FROM orders WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ message: '订单不存在' });

    await queries.runAsync(
      `UPDATE orders SET status = ?, customer_name = ?, phone = ?, address = ?, payment_method = ? WHERE id = ?`,
      [
        status ?? existing.status,
        customerName ?? existing.customer_name,
        phone ?? existing.phone,
        address ?? existing.address,
        paymentMethod ?? existing.payment_method,
        id
      ]
    );
    const updated = await queries.getAsync('SELECT * FROM orders WHERE id = ?', [id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: '更新订单失败', error: err.message });
  }
});

// 删除订单
app.delete('/api/orders/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await queries.getAsync('SELECT * FROM orders WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ message: '订单不存在' });

    // 恢复库存
    if (existing.status !== 'cancelled') {
      const items = await queries.allAsync('SELECT * FROM order_items WHERE order_id = ?', [id]);
      for (const item of items) {
        await queries.runAsync(
          'UPDATE products SET stock = stock + ? WHERE id = ?',
          [item.quantity, item.product_id]
        );
      }
    }

    await queries.runAsync('DELETE FROM order_items WHERE order_id = ?', [id]);
    await queries.runAsync('DELETE FROM orders WHERE id = ?', [id]);
    res.json({ message: '订单已删除' });
  } catch (err) {
    res.status(500).json({ message: '删除订单失败', error: err.message });
  }
});

// 静态文件会由 express.static 处理，包括 admin.html
// 仅对非文件请求进行 SPA fallback
app.get('*', (req, res, next) => {
  // 如果请求路径包含文件扩展名，跳过 fallback
  if (req.path.includes('.')) {
    return next();
  }
  res.sendFile(path.join(staticDir, 'index.html'));
});

const start = async () => {
  try {
    await initDb();
    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`API server ready at http://localhost:${PORT}`);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to start server', err);
    process.exit(1);
  }
};

start();

process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});

