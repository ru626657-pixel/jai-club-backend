// server.js - Works with or without MongoDB
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

const SECRET = 'jai-club-secret-key-2026';

// In-memory storage (works immediately)
let users = [];
let deposits = [];
let nextId = 1;

app.post('/api/signup', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.json({ error: 'Email और Password चाहिए' });
  if (users.find(u => u.email === email)) return res.json({ error: 'Email पहले से है' });
  
  const user = { id: nextId++, email, password, coins: 0, role: 'user' };
  users.push(user);
  
  const token = jwt.sign({ id: user.id, email, role: 'user' }, SECRET);
  res.json({ success: true, token, user: { id: user.id, email, coins: 0 } });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) return res.json({ error: 'गलत email या password' });
  
  const token = jwt.sign({ id: user.id, email, role: user.role }, SECRET);
  res.json({ success: true, token, user: { id: user.id, email: user.email, coins: user.coins, role: user.role } });
});

app.post('/api/reset-password', (req, res) => {
  const { email, newPassword } = req.body;
  const user = users.find(u => u.email === email);
  if (!user) return res.json({ error: 'Email not found' });
  user.password = newPassword;
  res.json({ success: true, message: 'Password reset ho gaya' });
});

function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.json({ error: 'Login करो' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch { res.json({ error: 'Invalid token' }); }
}

app.get('/api/balance', auth, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  res.json({ coins: user?.coins || 0 });
});

app.post('/api/deposit', auth, (req, res) => {
  const { amount, utr } = req.body;
  if (!amount || amount < 100) return res.json({ error: 'Minimum ₹100' });
  if (!utr) return res.json({ error: 'UTR daalo' });
  
  deposits.push({
    id: Date.now(),
    userId: req.user.id,
    email: req.user.email,
    amount: parseInt(amount),
    utr,
    time: new Date().toISOString(),
    status: 'pending'
  });
  res.json({ success: true, message: 'Request submit ho gaya' });
});

app.post('/api/withdraw', auth, (req, res) => {
  const { amount } = req.body;
  const user = users.find(u => u.id === req.user.id);
  if (!amount || amount <= 0) return res.json({ error: 'Amount daalo' });
  if (user.coins < amount) return res.json({ error: 'कम balance' });
  
  deposits.push({
    id: Date.now(),
    userId: req.user.id,
    email: req.user.email,
    amount: parseInt(amount),
    type: 'withdraw',
    time: new Date().toISOString(),
    status: 'pending'
  });
  res.json({ success: true });
});

app.get('/api/admin/users', auth, (req, res) => {
  if (req.user.email !== 'palr50091@gmail.com') return res.json({ error: 'Not admin' });
  res.json({ users: users.map(u => ({ id: u.id, email: u.email, coins: u.coins })) });
});

app.get('/api/admin/deposits', auth, (req, res) => {
  if (req.user.email !== 'palr50091@gmail.com') return res.json({ error: 'Not admin' });
  res.json({ deposits: deposits.filter(d => d.status === 'pending' && !d.type) });
});

app.get('/api/admin/withdraws', auth, (req, res) => {
  if (req.user.email !== 'palr50091@gmail.com') return res.json({ error: 'Not admin' });
  res.json({ withdraws: deposits.filter(d => d.status === 'pending' && d.type === 'withdraw') });
});

app.post('/api/admin/approve-deposit', auth, (req, res) => {
  if (req.user.email !== 'palr50091@gmail.com') return res.json({ error: 'Not admin' });
  const { depositId } = req.body;
  const dep = deposits.find(d => d.id === depositId);
  if (!dep) return res.json({ error: 'Not found' });
  
  const user = users.find(u => u.id === dep.userId);
  if (user) user.coins += dep.amount;
  dep.status = 'approved';
  res.json({ success: true });
});

app.post('/api/admin/reject-deposit', auth, (req, res) => {
  if (req.user.email !== 'palr50091@gmail.com') return res.json({ error: 'Not admin' });
  const { depositId } = req.body;
  const dep = deposits.find(d => d.id === depositId);
  if (dep) dep.status = 'rejected';
  res.json({ success: true });
});

app.post('/api/admin/approve-withdraw', auth, (req, res) => {
  if (req.user.email !== 'palr50091@gmail.com') return res.json({ error: 'Not admin' });
  const { withdrawId } = req.body;
  const wit = deposits.find(d => d.id === withdrawId && d.type === 'withdraw');
  if (!wit) return res.json({ error: 'Not found' });
  
  const user = users.find(u => u.id === wit.userId);
  if (user && user.coins >= wit.amount) {
    user.coins -= wit.amount;
    wit.status = 'approved';
  }
  res.json({ success: true });
});

app.get('/', (req, res) => res.json({ status: 'Jai Club Backend Running', users: users.length }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server on port ' + PORT));
