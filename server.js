// server.js - Jai Club Backend with MongoDB (with retry)
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient } = require('mongodb');

const app = express();
app.use(cors());
app.use(express.json());

const SECRET = 'jai-club-secret-key-2026';
const MONGO_URI = 'mongodb+srv://ru626657_db_user:eb6j1FadX5N6rqMY@jai-club.w06pe87.mongodb.net/jaiclub?retryWrites=true&w=majority';

let db = null;
let client = null;

async function connectDB() {
  try {
    client = new MongoClient(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });
    await client.connect();
    db = client.db('jaiclub');
    console.log('✅ MongoDB connected');
    return true;
  } catch (err) {
    console.log('❌ MongoDB connection failed:', err.message);
    db = null;
    return false;
  }
}

// Retry connection every 30 seconds if failed
setInterval(async () => {
  if (!db) {
    console.log('Retrying MongoDB connection...');
    await connectDB();
  }
}, 30000);

// ===== AUTH =====

app.post('/api/signup', async (req, res) => {
  if (!db) return res.json({ error: 'Database connecting... try again in 30 sec' });
  const { email, password } = req.body;
  if (!email || !password) return res.json({ error: 'Email और Password चाहिए' });
  
  try {
    const existing = await db.collection('users').findOne({ email });
    if (existing) return res.json({ error: 'Email पहले से है' });
    
    const user = { email, password, coins: 0, role: 'user', createdAt: new Date() };
    const result = await db.collection('users').insertOne(user);
    
    const token = jwt.sign({ id: result.insertedId.toString(), email, role: 'user' }, SECRET);
    res.json({ success: true, token, user: { id: result.insertedId, email, coins: 0 } });
  } catch (err) {
    res.json({ error: 'Database error' });
  }
});

app.post('/api/login', async (req, res) => {
  if (!db) return res.json({ error: 'Database connecting... try again in 30 sec' });
  const { email, password } = req.body;
  
  try {
    const user = await db.collection('users').findOne({ email, password });
    if (!user) return res.json({ error: 'गलत email या password' });
    
    const token = jwt.sign({ id: user._id.toString(), email, role: user.role }, SECRET);
    res.json({ success: true, token, user: { id: user._id, email: user.email, coins: user.coins, role: user.role } });
  } catch (err) {
    res.json({ error: 'Database error' });
  }
});

app.post('/api/reset-password', async (req, res) => {
  if (!db) return res.json({ error: 'Database connecting...' });
  const { email, newPassword } = req.body;
  
  try {
    const result = await db.collection('users').updateOne({ email }, { $set: { password: newPassword } });
    if (result.matchedCount === 0) return res.json({ error: 'Email not found' });
    res.json({ success: true });
  } catch (err) {
    res.json({ error: 'Database error' });
  }
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
  if (req.user.email !== 'palr50091@gmail.com') {
    return res.json({ error: 'Admin नहीं हो' });
  }
  next();
}

app.get('/api/balance', auth, async (req, res) => {
  if (!db) return res.json({ coins: 0 });
  try {
    const { ObjectId } = require('mongodb');
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.id) });
    res.json({ coins: user?.coins || 0 });
  } catch (err) {
    res.json({ coins: 0 });
  }
});

app.post('/api/deposit', auth, async (req, res) => {
  if (!db) return res.json({ error: 'Database connecting...' });
  const { amount, utr } = req.body;
  if (!amount || amount < 100) return res.json({ error: 'Minimum ₹100' });
  if (!utr) return res.json({ error: 'UTR daalo' });
  
  try {
    await db.collection('deposits').insertOne({
      userId: req.user.id,
      email: req.user.email,
      amount: parseInt(amount),
      utr,
      time: new Date(),
      status: 'pending'
    });
    res.json({ success: true });
  } catch (err) {
    res.json({ error: 'Database error' });
  }
});

app.get('/api/admin/users', auth, adminOnly, async (req, res) => {
  if (!db) return res.json({ users: [] });
  try {
    const users = await db.collection('users').find({}, { projection: { password: 0 } }).toArray();
    res.json({ users });
  } catch (err) {
    res.json({ users: [] });
  }
});

app.get('/api/admin/deposits', auth, adminOnly, async (req, res) => {
  if (!db) return res.json({ deposits: [] });
  try {
    const deposits = await db.collection('deposits').find({ status: 'pending' }).sort({ time: -1 }).toArray();
    res.json({ deposits });
  } catch (err) {
    res.json({ deposits: [] });
  }
});

app.post('/api/admin/approve-deposit', auth, adminOnly, async (req, res) => {
  if (!db) return res.json({ error: 'Database connecting...' });
  const { ObjectId } = require('mongodb');
  const { depositId } = req.body;
  
  try {
    const dep = await db.collection('deposits').findOne({ _id: new ObjectId(depositId) });
    if (!dep) return res.json({ error: 'Not found' });
    
    await db.collection('users').updateOne(
      { _id: new ObjectId(dep.userId) },
      { $inc: { coins: dep.amount } }
    );
    await db.collection('deposits').updateOne({ _id: dep._id }, { $set: { status: 'approved' } });
    res.json({ success: true });
  } catch (err) {
    res.json({ error: 'Database error' });
  }
});

app.post('/api/admin/reject-deposit', auth, adminOnly, async (req, res) => {
  if (!db) return res.json({ error: 'Database connecting...' });
  const { ObjectId } = require('mongodb');
  const { depositId } = req.body;
  
  try {
    await db.collection('deposits').updateOne(
      { _id: new ObjectId(depositId) },
      { $set: { status: 'rejected' } }
    );
    res.json({ success: true });
  } catch (err) {
    res.json({ error: 'Database error' });
  }
});

app.get('/', (req, res) => res.json({ 
  status: 'Jai Club Backend Running', 
  db: db ? 'connected' : 'disconnected' 
}));

const PORT = process.env.PORT || 3000;

// Start server first, then connect DB
app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
  connectDB();
});
