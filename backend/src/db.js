import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

sqlite3.verbose();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '..', 'data.sqlite');

// 使用序列化模式确保并发安全
export const db = new sqlite3.Database(dbPath);

// 设置 WAL 模式提高并发性能
db.run('PRAGMA journal_mode = WAL;');
db.run('PRAGMA busy_timeout = 5000;');

// 请求队列，确保事务顺序执行
let transactionQueue = Promise.resolve();

const runAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve(this);
    });
  });

const getAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });

const allAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });

// 串行化事务执行，防止并发冲突
const runTransaction = async (fn) => {
  return new Promise((resolve, reject) => {
    transactionQueue = transactionQueue.then(async () => {
      try {
        await runAsync('BEGIN IMMEDIATE TRANSACTION');
        const result = await fn();
        await runAsync('COMMIT');
        resolve(result);
      } catch (err) {
        await runAsync('ROLLBACK').catch(() => {});
        reject(err);
      }
    });
  });
};

export const initDb = async () => {
  await runAsync('PRAGMA foreign_keys = ON;');
  await runAsync(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      image TEXT
    )
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      total REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      remark TEXT DEFAULT '',
      payment_method TEXT DEFAULT 'wechat',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES products(id)
    )
  `);

  const existing = await getAsync('SELECT COUNT(*) as count FROM products');
  if ((existing?.count ?? 0) === 0) {
    const sampleProducts = [
      {
        name: 'iPhone 15 Pro Max 屏幕组件',
        description: '原装品质，支持高刷新率与原彩显示。',
        price: 1399,
        stock: 15,
        image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80'
      },
      {
        name: 'Huawei Mate 60 Pro 屏幕组件',
        description: '适配鸿蒙，抗摔耐刮，含中框预装。',
        price: 1199,
        stock: 18,
        image: 'https://images.unsplash.com/photo-1512499617640-c2f999098c02?auto=format&fit=crop&w=800&q=80'
      },
      {
        name: 'Xiaomi 14 屏幕组件',
        description: '1.5K OLED 高亮屏，含贴合胶与工具包。',
        price: 899,
        stock: 25,
        image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80'
      },
      {
        name: 'Samsung Galaxy S23 屏幕组件',
        description: '原厂 AMOLED，支持指纹，带听筒网。',
        price: 1299,
        stock: 10,
        image: 'https://images.unsplash.com/photo-1510554310700-81649f459667?auto=format&fit=crop&w=800&q=80'
      }
    ];

    for (const p of sampleProducts) {
      await runAsync(
        'INSERT INTO products (name, description, price, stock, image) VALUES (?, ?, ?, ?, ?)',
        [p.name, p.description, p.price, p.stock, p.image]
      );
    }
  }

  // 迁移：为现有表添加新字段（如果不存在）
  try {
    await runAsync('ALTER TABLE orders ADD COLUMN remark TEXT DEFAULT ""');
  } catch (e) {
    // 字段已存在，忽略
  }
  try {
    await runAsync('ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT "wechat"');
  } catch (e) {
    // 字段已存在，忽略
  }
};

export const queries = { runAsync, getAsync, allAsync, runTransaction };