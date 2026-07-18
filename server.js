const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

const INITIAL_DB = {
  sales: [],
  expenses: [],
  stock: [],
  profile: null
};

async function ensureDataFile() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.access(DB_FILE);
  } catch (err) {
    await fs.writeFile(DB_FILE, JSON.stringify(INITIAL_DB, null, 2), 'utf8');
  }
}

async function readDb() {
  try {
    const raw = await fs.readFile(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return { ...INITIAL_DB };
  }
}

async function writeDb(data) {
  await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function hashPassword(password, salt = null) {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, actualSalt, 310000, 32, 'sha256').toString('hex');
  return { salt: actualSalt, hash };
}

function verifyPassword(password, salt, hash) {
  if (!password || !salt || !hash) return false;
  const candidate = crypto.pbkdf2Sync(password, salt, 310000, 32, 'sha256').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(hash, 'hex'));
}

function validateSale(sale) {
  return sale && typeof sale.customerName === 'string' && sale.customerName.trim() &&
    typeof sale.contact === 'string' && sale.contact.trim() &&
    Array.isArray(sale.items) && sale.items.length > 0 &&
    typeof sale.total === 'number' &&
    (!sale.paymentStatus || ['Paid', 'Pending'].includes(sale.paymentStatus));
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

app.use(cors());
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

app.get('/api/data', async (req, res) => {
  const data = await readDb();
  res.json(data);
});

app.get('/api/sales', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = (req.query.search || '').toLowerCase();
  const status = req.query.status || 'All';

  const data = await readDb();
  let sales = (data.sales || []).filter(s => !s.is_deleted);

  if (search) {
    sales = sales.filter(s =>
      (s.customerName && s.customerName.toLowerCase().includes(search)) ||
      (s.customer_name && s.customer_name.toLowerCase().includes(search)) ||
      (s.items && s.items.some(i => i.name && i.name.toLowerCase().includes(search)))
    );
  }

  if (status !== 'All') {
    sales = sales.filter(s => (s.paymentStatus || s.payment_status || 'Paid') === status);
  }

  const total = sales.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const start = (page - 1) * limit;
  const paginatedSales = sales.slice(start, start + limit);

  res.json({
    data: paginatedSales,
    total,
    page,
    totalPages,
    limit
  });
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
  
  if (!sale.id) sale.id = crypto.randomUUID();
  if (!sale.paymentStatus) sale.paymentStatus = 'Paid';
  
  const data = await readDb();
  data.sales.unshift(sale);
  await writeDb(data);
  res.status(201).json(sale);
});

app.put('/api/sales/:id/pay', async (req, res) => {
  const { id } = req.params;
  const data = await readDb();
  const sale = data.sales.find(s => s.id === id);
  if (!sale) {
    return res.status(404).json({ error: 'Sale not found.' });
  }
  sale.paymentStatus = 'Paid';
  await writeDb(data);
  res.json(sale);
});

app.post('/api/expenses', async (req, res) => {
  const expense = req.body;
  if (!validateExpense(expense)) {
    return res.status(400).json({ error: 'Invalid expense payload.' });
  }
  const data = await readDb();
  data.expenses.unshift(expense);
  await writeDb(data);
  res.status(201).json(expense);
});

app.post('/api/stock', async (req, res) => {
  const stock = req.body;
  if (!validateStock(stock)) {
    return res.status(400).json({ error: 'Invalid stock payload.' });
  }
  const data = await readDb();
  data.stock.unshift(stock);
  await writeDb(data);
  res.status(201).json(stock);
});

app.get('/api/profile', async (req, res) => {
  const data = await readDb();
  if (!data.profile) return res.json(null);
  const safeProfile = { ...data.profile };
  delete safeProfile.passwordHash;
  delete safeProfile.passwordSalt;
  res.json(safeProfile);
});

app.post('/api/profile', async (req, res) => {
  const profile = req.body;
  if (!validateProfile(profile)) {
    return res.status(400).json({ error: 'Invalid profile payload.' });
  }
  const data = await readDb();
  data.profile = {
    businessName: profile.businessName,
    location: profile.location,
    phoneNumber: profile.phoneNumber,
    accountNumber: profile.accountNumber,
    accountName: profile.accountName,
    bankName: profile.bankName,
  };
  await writeDb(data);
  res.status(201).json(data.profile);
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  const data = await readDb();
  const profile = data.profile;
  if (!profile || profile.email !== email || !verifyPassword(password, profile.passwordSalt, profile.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  const safeProfile = { ...profile };
  delete safeProfile.passwordHash;
  delete safeProfile.passwordSalt;
  res.json(safeProfile);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

ensureDataFile().then(() => {
  app.listen(PORT, () => {
    console.log(`BizTrack backend running at http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
