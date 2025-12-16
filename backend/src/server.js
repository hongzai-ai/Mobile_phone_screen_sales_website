import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, initDb, queries } from './db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

const PORT = process.env.PORT || 3001;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'changeme-admin-token';

app.use(cors());
app.use(express.json());

// Serve frontend assets (built or static) if present
const staticDir = path.join(__dirname, '..', '..', 'frontend');
app.use(express.static(staticDir));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/products', async (_req, res) => {
  try {
    const products = await queries.allAsync('SELECT * FROM products ORDER BY id DESC');
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: '无法获取产品列表', error: err.message });
  }
});

const requireAdmin = (req, res, next) => {
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '');
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ message: '未授权' });
  }
  return next();
};

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
  const { customerName, phone, address, items } = req.body || {};
  if (!customerName || !phone || !address || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: '订单信息不完整' });
  }

  try {
    await queries.runAsync('BEGIN TRANSACTION');

    let total = 0;
    for (const item of items) {
      const product = await queries.getAsync('SELECT * FROM products WHERE id = ?', [item.productId]);
      if (!product) {
        throw new Error(`产品 ${item.productId} 不存在`);
      }
      if (product.stock < item.quantity) {
        throw new Error(`${product.name} 库存不足`);
      }
      total += product.price * item.quantity;
    }

    const orderResult = await queries.runAsync(
      'INSERT INTO orders (customer_name, phone, address, total) VALUES (?, ?, ?, ?)',
      [customerName, phone, address, total]
    );

    for (const item of items) {
      const product = await queries.getAsync('SELECT * FROM products WHERE id = ?', [item.productId]);
      await queries.runAsync(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
        [orderResult.lastID, product.id, item.quantity, product.price]
      );
      await queries.runAsync(
        'UPDATE products SET stock = stock - ? WHERE id = ?',
        [item.quantity, product.id]
      );
    }

    await queries.runAsync('COMMIT');
    res.status(201).json({ message: '下单成功', orderId: orderResult.lastID, total });
  } catch (err) {
    await queries.runAsync('ROLLBACK').catch(() => {});
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

// Fallback for SPA routing if needed
app.get('*', (_req, res) => {
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

