// server.js - Jai Club Backend with MongoDB
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient } = require('mongodb');

const app = express();
app.use(cors());
app.use(express.json());

const SECRET = 'jai-club-secret-key-2026';
const MONGO_URI = 'mongodb+srv://ru626657_db_user:eb6j1FadX5N6rqMY@jai-club.w06pe87.mongodb.net/jaiclub?retryWrites=true&w=majority';

let db;

async function connectDB() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db('jaiclub');
  console.log('MongoDB connected');
}

// ===== AUTH =====

app.post('/api/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.json({ error: 'Email और Password चाहिए' });
  
  const existing = await db.collection('users').findOne({ email });
  if (existing) return res.json({ error: 'Email पहले से है' });
  
  const user = { email, password, coins: 0, role: 'user', createdAt: new Date() };
  const result = await db.collection('users').insertOne(user);
  
  const token = jwt.sign({ id: result.insertedId.toString(), email, role: 'user' }, SECRET);
  res.json({ success: true, token, user: { id: result.insertedId, email, coins: 0 } });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await db.collection('users').findOne({ email, password });
  if (!user) return res.json({ error: 'गलत email या password' });
  
  const token = jwt.sign({ id: user._id.toString(), email, role: user.role }, SECRET);
  res.json({ success: true, token, user: { id: user._id, email: user.email, coins: user.coins, role: user.role } });
});

app.post('/api/reset-password', async (req, res) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword) return res.json({ error: 'Email and new password required' });
  if (newPassword.length < 6) return res.json({ error: 'Password must be 6+ characters' });
  
  const result = await db.collection('users').updateOne({ email }, { $set: { password: newPassword } });
  if (result.matchedCount === 0) return res.json({ error: 'Email not found' });
  res.json({ success: true, message: 'Password reset successful' });
});

function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.json({ error: 'Login करो' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch { res.json({ error: 'Invalid token' }); }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin' && req.user.email !== 'palr50091@gmail.com') {
    return res.json({ error: 'Admin नहीं हो' });
  }
  next();
}

// ===== WALLET =====

app.get('/api/balance', auth, async (req, res) => {
  const { ObjectId } = require('mongodb');
  const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.id) });
  res.json({ coins: user?.coins || 0 });
});

app.post('/api/deposit', auth, async (req, res) => {
  const { amount, utr } = req.body;
  if (!amount || amount < 100) return res.json({ error: 'Minimum ₹100' });
  if (!utr) return res.json({ error: 'UTR number daalo' });
  
  const dep = {
    userId: req.user.id,
    email: req.user.email,
    amount: parseInt(amount),
    utr,
    time: new Date(),
    status: 'pending'
  };
  await db.collection('deposits').insertOne(dep);
  res.json({ success: true, message: 'Request submit ho gaya' });
});

app.post('/api/withdraw', auth, async (req, res) => {
  const { amount } = req.body;
  const { ObjectId } = require('mongodb');
  const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.id) });
  
  if (!amount || amount <= 0) return res.json({ error: 'सही amount डालो' });
  if (user.coins < amount) return res.json({ error: 'कम balance' });
  
  const wit = {
    userId: req.user.id,
    email: req.user.email,
    amount: parseInt(amount),
    time: new Date(),
    status: 'pending'
  };
  await db.collection('withdraws').insertOne(wit);
  res.json({ success: true, message: 'Withdraw request submit ho gaya' });
});

// ===== ADMIN =====

app.get('/api/admin/users', auth, adminOnly, async (req, res) => {
  const users = await db.collection('users').find({}, { projection: { password: 0 } }).toArray();
  res.json({ users });
});

app.get('/api/admin/deposits', auth, adminOnly, async (req, res) => {
  const deposits = await db.collection('deposits').find({ status: 'pending' }).sort({ time: -1 }).toArray();
  res.json({ deposits });
});

app.get('/api/admin/withdraws', auth, adminOnly, async (req, res) => {
  const withdraws = await db.collection('withdraws').find({ status: 'pending' }).sort({ time: -1 }).toArray();
  res.json({ withdraws });
});

app.post('/api/admin/approve-deposit', auth, adminOnly, async (req, res) => {
  const { ObjectId } = require('mongodb');
  const { depositId } = req.body;
  
  const dep = await db.collection('deposits').findOne({ _id: new ObjectId(depositId), status: 'pending' });
  if (!dep) return res.json({ error: 'Deposit nahi mili' });
  
  await db.collection('users').updateOne(
    { _id: new ObjectId(dep.userId) },
    { $inc: { coins: dep.amount } }
  );
  await db.collection('deposits').updateOne({ _id: dep._id }, { $set: { status: 'approved' } });
  
  res.json({ success: true });
});

app.post('/api/admin/reject-deposit', auth, adminOnly, async (req, res) => {
  const { ObjectId } = require('mongodb');
  const { depositId } = req.body;
  await db.collection('deposits').updateOne(
    { _id: new ObjectId(depositId) },
    { $set: { status: 'rejected' } }
  );
  res.json({ success: true });
});

app.post('/api/admin/approve-withdraw', auth, adminOnly, async (req, res) => {
  const { ObjectId } = require('mongodb');
  const { withdrawId } = req.body;
  
  const wit = await db.collection('withdraws').findOne({ _id: new ObjectId(withdrawId), status: 'pending' });
  if (!wit) return res.json({ error: 'Withdraw nahi mili' });
  
  const user = await db.collection('users').findOne({ _id: new ObjectId(wit.userId) });
  if (user.coins < wit.amount) return res.json({ error: 'User ke paas itne coins nahi' });
  
  await db.collection('users').updateOne(
    { _id: new ObjectId(wit.userId) },
    { $inc: { coins: -wit.amount } }
  );
  await db.collection('withdraws').updateOne({ _id: wit._id }, { $set: { status: 'approved' } });
  
  res.json({ success: true });
});

app.post('/api/make-admin', async (req, res) => {
  const { email } = req.body;
  await db.collection('users').updateOne({ email }, { $set: { role: 'admin' } });
  res.json({ success: true });
});

app.get('/', (req, res) => res.json({ status: 'Jai Club Backend Running!', db: !!db }));

const PORT = process.env.PORT || 3000;
connectDB().then(() => {
  app.listen(PORT, () => console.log('Server running on port ' + PORT));
}).catch(err => {
  console.error('DB connection failed:', err);
  process.exit(1);
});
