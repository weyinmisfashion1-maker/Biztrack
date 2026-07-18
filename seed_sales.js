const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const CUSTOMERS = [
  "Amaka Okonkwo", "Chioma Adebayo", "Tunde Bakare", "Emeka Nwosu", "Bisi Alabi",
  "Kemi Fowler", "Damilola Ojo", "Nkechi Eze", "Ibrahim Musa", "Yinka Shonibare",
  "Funke Akindele", "Gabriel Afolayan", "Blessing Okagbare", "Uche Jombo", "Olamide Adedeji",
  "Genevieve Nnaji", "Davido Adeleke", "Wizkid Balogun", "Tiwa Savage", "Burnaboy Ogulu",
  "Falz The Bahd Guy", "Don Jazzy", "Rema Ikubor", "Asake Ololade", "Fireboy DML",
  "Simi Kosoko", "Adekunle Gold", "Tems Openiyi", "Ayra Starr", "Chike Osebuka",
  "Joeboy Akinfenwa", "Victony Anthony", "Omah Lay", "Zlatan Ibile", "Seyi Vibez"
];

const SAMPLE_ITEMS = [
  { name: 'Ankara Fabric (Yards)', price: 4500 },
  { name: 'Swiss Lace Material', price: 18000 },
  { name: 'Italian Leather Shoes', price: 35000 },
  { name: 'Gold-Plated Wristwatch', price: 28000 },
  { name: 'Designer Handbag', price: 22000 },
  { name: 'Men Corporate Suit', price: 42000 },
  { name: 'Traditional Agbada Set', price: 65000 },
  { name: 'Luxury Perfume Spray', price: 15000 },
  { name: 'UV Sunglasses', price: 8500 },
  { name: 'Leather Belt', price: 6000 }
];

async function seed() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  let existingDb = { sales: [], expenses: [], stock: [], profile: null };
  try {
    const raw = await fs.readFile(DB_FILE, 'utf8');
    existingDb = JSON.parse(raw);
  } catch (err) {}

  const sales = CUSTOMERS.map((cust, idx) => {
    const id = crypto.randomUUID();
    const item1 = SAMPLE_ITEMS[idx % SAMPLE_ITEMS.length];
    const item2 = SAMPLE_ITEMS[(idx + 3) % SAMPLE_ITEMS.length];
    const qty1 = (idx % 3) + 1;
    const qty2 = (idx % 2) + 1;
    const items = [
      { name: item1.name, qty: qty1, price: item1.price },
      { name: item2.name, qty: qty2, price: item2.price }
    ];
    const subtotal = (qty1 * item1.price) + (qty2 * item2.price);
    const delivery_fee = (idx % 4) * 1000;
    const discount = (idx % 5) * 2; // %
    const discountAmt = (subtotal + delivery_fee) * (discount / 100);
    const total = (subtotal + delivery_fee) - discountAmt;
    const paymentStatus = idx % 3 === 0 ? 'Pending' : 'Paid';
    const status = idx % 4 === 0 ? 'Pending' : idx % 7 === 0 ? 'Failed' : 'Delivered';
    const day = String((idx % 17) + 1).padStart(2, '0');
    const date = `2026-07-${day}`;
    const phone = `+234 80${idx % 10}${idx % 9}${idx % 8} 00${idx % 7}${idx % 6}`;

    return {
      id,
      date,
      customerName: cust,
      customer_name: cust,
      contact: phone,
      address: `Block ${idx + 1}, Allen Avenue, Ikeja, Lagos`,
      items,
      delivery_fee,
      discount,
      total,
      status,
      paymentStatus,
      payment_status: paymentStatus,
      is_deleted: false
    };
  });

  existingDb.sales = sales;
  await fs.writeFile(DB_FILE, JSON.stringify(existingDb, null, 2), 'utf8');
  console.log(`Successfully seeded ${sales.length} sample sales into data/db.json!`);
}

seed().catch(console.error);
