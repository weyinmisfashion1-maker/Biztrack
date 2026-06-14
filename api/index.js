const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');

const app = express();
const DATABASE_URL = process.env.DATABASE_URL || null;
const LOCAL_DATA_DIR = path.join(process.cwd(), 'data');
const LOCAL_DB_FILE = path.join(LOCAL_DATA_DIR, 'db.json');
const INITIAL_DB = {
  sales: [],
  expenses: [],
  stock: [],
  profile: null,
};

let pool = null;
if (DATABASE_URL) {
  if (!global.__biztrack_pg_pool) {
    global.__biztrack_pg_pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
  }
  pool = global.__biztrack_pg_pool;
}

function validateSale(sale) {
  return sale && typeof sale.customerName === 'string' && sale.customerName.trim() &&
    typeof sale.contact === 'string' && sale.contact.trim() &&
    Array.isArray(sale.items) && sale.items.length > 0 &&
    typeof sale.total === 'number';
}

function validateExpense(expense) {
  return expense && typeof expense.type === 'string' && expense.type.trim() &&
    typeof expense.amount === 'number' && expense.amount >= 0;
}

function validateStock(stock) {
  return stock && typeof stock.name === 'string' && stock.name.trim() &&
    typeof stock.costPrice === 'number' && stock.costPrice >= 0 &&
    typeof stock.qty === 'number' && stock.qty >= 0;
}

function validateProfile(profile) {
  return profile && typeof profile.businessName === 'string' && profile.businessName.trim() &&
    typeof profile.location === 'string' && profile.location.trim() &&
    typeof profile.phoneNumber === 'string' && profile.phoneNumber.trim() &&
    typeof profile.accountNumber === 'string' && profile.accountNumber.trim() &&
    typeof profile.accountName === 'string' && profile.accountName.trim() &&
    typeof profile.bankName === 'string' && profile.bankName.trim();
}

async function ensureLocalDataFile() {
  try {
    await fs.mkdir(LOCAL_DATA_DIR, { recursive: true });
    await fs.access(LOCAL_DB_FILE);
  } catch (err) {
    await fs.writeFile(LOCAL_DB_FILE, JSON.stringify(INITIAL_DB, null, 2), 'utf8');
  }
}

async function readLocalDb() {
  try {
    const raw = await fs.readFile(LOCAL_DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return { ...INITIAL_DB };
  }
}

async function writeLocalDb(data) {
  await fs.writeFile(LOCAL_DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

async function initPostgres() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      date TEXT,
      customer_name TEXT,
      contact TEXT,
      address TEXT,
      items JSONB,
      delivery_fee NUMERIC,
      discount NUMERIC,
      discount_amt NUMERIC,
      subtotal NUMERIC,
      total NUMERIC,
      delivery TEXT,
      status TEXT,
      feedback TEXT,
      created_at TEXT
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      date TEXT,
      type TEXT,
      desc TEXT,
      amount NUMERIC,
      created_at TEXT
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stock (
      id TEXT PRIMARY KEY,
      name TEXT,
      category TEXT,
      qty NUMERIC,
      unit TEXT,
      cost_price NUMERIC,
      selling_price NUMERIC,
      added TEXT
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY,
      business_name TEXT,
      location TEXT,
      phone_number TEXT,
      account_number TEXT,
      account_name TEXT,
      bank_name TEXT,
      created_at TEXT
    );
  `);
}

async function querySales() {
  const res = await pool.query('SELECT * FROM sales ORDER BY created_at DESC');
  return res.rows.map(row => ({
    id: row.id,
    date: row.date,
    customerName: row.customer_name,
    contact: row.contact,
    address: row.address,
    items: row.items || [],
    deliveryFee: Number(row.delivery_fee) || 0,
    discount: Number(row.discount) || 0,
    discountAmt: Number(row.discount_amt) || 0,
    subtotal: Number(row.subtotal) || 0,
    total: Number(row.total) || 0,
    delivery: row.delivery,
    status: row.status,
    feedback: row.feedback,
    createdAt: row.created_at,
  }));
}

async function queryExpenses() {
  const res = await pool.query('SELECT * FROM expenses ORDER BY created_at DESC');
  return res.rows.map(row => ({
    id: row.id,
    date: row.date,
    type: row.type,
    desc: row.desc,
    amount: Number(row.amount) || 0,
    createdAt: row.created_at,
  }));
}

async function queryStock() {
  const res = await pool.query('SELECT * FROM stock ORDER BY added DESC');
  return res.rows.map(row => ({
    id: row.id,
    name: row.name,
    category: row.category,
    qty: Number(row.qty) || 0,
    unit: row.unit,
    costPrice: Number(row.cost_price) || 0,
    sellingPrice: Number(row.selling_price) || 0,
    added: row.added,
  }));
}

async function queryProfile() {
  const res = await pool.query('SELECT * FROM profile WHERE id = 1 LIMIT 1');
  const row = res.rows[0];
  if (!row) return null;
  return {
    businessName: row.business_name,
    location: row.location,
    phoneNumber: row.phone_number,
    accountNumber: row.account_number,
    accountName: row.account_name,
    bankName: row.bank_name,
    createdAt: row.created_at,
  };
}

async function upsertProfile(profile) {
  await pool.query(`
    INSERT INTO profile(id, business_name, location, phone_number, account_number, account_name, bank_name, created_at)
    VALUES (1, $1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (id) DO UPDATE SET
      business_name = EXCLUDED.business_name,
      location = EXCLUDED.location,
      phone_number = EXCLUDED.phone_number,
      account_number = EXCLUDED.account_number,
      account_name = EXCLUDED.account_name,
      bank_name = EXCLUDED.bank_name,
      created_at = EXCLUDED.created_at;
  `, [
    profile.businessName,
    profile.location,
    profile.phoneNumber,
    profile.accountNumber,
    profile.accountName,
    profile.bankName,
    new Date().toISOString(),
  ]);
}

async function insertSale(sale) {
  await pool.query(`
    INSERT INTO sales(id, date, customer_name, contact, address, items, delivery_fee, discount, discount_amt, subtotal, total, delivery, status, feedback, created_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
  `, [
    sale.id,
    sale.date,
    sale.customerName,
    sale.contact,
    sale.address,
    JSON.stringify(sale.items),
    sale.deliveryFee,
    sale.discount,
    sale.discountAmt,
    sale.subtotal,
    sale.total,
    sale.delivery,
    sale.status,
    sale.feedback,
    sale.createdAt,
  ]);
}

async function insertExpense(expense) {
  await pool.query(`
    INSERT INTO expenses(id, date, type, desc, amount, created_at)
    VALUES($1,$2,$3,$4,$5,$6)
  `, [expense.id, expense.date, expense.type, expense.desc, expense.amount, expense.createdAt]);
}

async function insertStock(stock) {
  await pool.query(`
    INSERT INTO stock(id, name, category, qty, unit, cost_price, selling_price, added)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8)
  `, [stock.id, stock.name, stock.category, stock.qty, stock.unit, stock.costPrice, stock.sellingPrice, stock.added]);
}

async function ensureDataSource() {
  if (pool) {
    await initPostgres();
  } else {
    await ensureLocalDataFile();
  }
}

async function readDb() {
  if (pool) {
    return {
      sales: await querySales(),
      expenses: await queryExpenses(),
      stock: await queryStock(),
      profile: await queryProfile(),
    };
  }
  return await readLocalDb();
}

async function writeDb(data) {
  if (pool) {
    throw new Error('WriteDb is not supported for Postgres; use insert/update helpers.');
  }
  await writeLocalDb(data);
}

app.use(cors());
app.use(express.json());

app.get('/api/data', async (req, res) => {
  const data = await readDb();
  res.json(data);
});

app.get('/api/sales', async (req, res) => {
  const data = await readDb();
  res.json(data.sales || []);
});

app.get('/api/expenses', async (req, res) => {
  const data = await readDb();
  res.json(data.expenses || []);
});

app.get('/api/stock', async (req, res) => {
  const data = await readDb();
  res.json(data.stock || []);
});

app.post('/api/sales', async (req, res) => {
  const sale = req.body;
  if (!validateSale(sale)) {
    return res.status(400).json({ error: 'Invalid sale payload.' });
  }
  if (pool) {
    await insertSale(sale);
  } else {
    const data = await readDb();
    data.sales.unshift(sale);
    await writeDb(data);
  }
  res.status(201).json(sale);
});

app.post('/api/expenses', async (req, res) => {
  const expense = req.body;
  if (!validateExpense(expense)) {
    return res.status(400).json({ error: 'Invalid expense payload.' });
  }
  if (pool) {
    await insertExpense(expense);
  } else {
    const data = await readDb();
    data.expenses.unshift(expense);
    await writeDb(data);
  }
  res.status(201).json(expense);
});

app.post('/api/stock', async (req, res) => {
  const stock = req.body;
  if (!validateStock(stock)) {
    return res.status(400).json({ error: 'Invalid stock payload.' });
  }
  if (pool) {
    await insertStock(stock);
  } else {
    const data = await readDb();
    data.stock.unshift(stock);
    await writeDb(data);
  }
  res.status(201).json(stock);
});

app.get('/api/profile', async (req, res) => {
  const data = await readDb();
  res.json(data.profile || null);
});

app.post('/api/profile', async (req, res) => {
  const profile = req.body;
  if (!validateProfile(profile)) {
    return res.status(400).json({ error: 'Invalid profile payload.' });
  }
  const storedProfile = {
    businessName: profile.businessName,
    location: profile.location,
    phoneNumber: profile.phoneNumber,
    accountNumber: profile.accountNumber,
    accountName: profile.accountName,
    bankName: profile.bankName,
    createdAt: new Date().toISOString(),
  };
  if (pool) {
    await upsertProfile(storedProfile);
  } else {
    const data = await readDb();
    data.profile = storedProfile;
    await writeDb(data);
  }
  res.status(201).json(storedProfile);
});

app.post('/api/clear-demo', async (req, res) => {
  if (pool) {
    await pool.query('DELETE FROM sales');
    await pool.query('DELETE FROM expenses');
    await pool.query('DELETE FROM stock');
    await pool.query('DELETE FROM profile');
  } else {
    await writeLocalDb({ ...INITIAL_DB });
  }
  res.json({ cleared: true });
});

app.get('*', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

module.exports = async (req, res) => {
  await ensureDataSource();
  app(req, res);
};
