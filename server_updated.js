// server.js - Jai Club Backend
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

const SECRET = 'jai-club-secret-key-2026';

// Fake database (असली में Firebase/MongoDB)
let users = [];
let nextId = 1;
let deposits = [];
let withdraws = [];
let nextDepId = 1;

// ===== AUTH =====

// Signup
app.post('/api/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.json({ error: 'Email और Password चाहिए' });
  if (users.find(u => u.email === email)) return res.json({ error: 'Email पहले से है' });
  
  const user = { id: nextId++, email, password, coins: 1000, role: 'user' };
  users.push(user);
  
  const token = jwt.sign({ id: user.id, email, role: 'user' }, SECRET);
  res.json({ success: true, token, user: { id: user.id, email, coins: 1000 } });
});

// Login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) return res.json({ error: 'गलत email या password' });
  
  const token = jwt.sign({ id: user.id, email, role: user.role }, SECRET);
  res.json({ success: true, token, user: { id: user.id, email: user.email, coins: user.coins, role: user.role } });
});

// Password Reset (Demo - no email)
app.post('/api/reset-password', (req, res) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword) return res.json({ error: 'Email and new password required' });
  if (newPassword.length < 6) return res.json({ error: 'Password must be 6+ characters' });
  
  const user = users.find(u => u.email === email);
  if (!user) return res.json({ error: 'Email not found' });
  
  user.password = newPassword;
  res.json({ success: true, message: 'Password reset successful' });
});

// Auth middleware
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.json({ error: 'Login करो' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch { res.json({ error: 'Invalid token' }); }
}

// Admin middleware
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.json({ error: 'Admin नहीं हो' });
  next();
}

// ===== WALLET =====

app.get('/api/balance', auth, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  res.json({ coins: user?.coins || 0 });
});

app.post('/api/deposit', auth, (req, res) => {
  const { amount, utr } = req.body;
  if (!amount || amount <= 0) return res.json({ error: 'सही amount डालो' });
  if (!utr) return res.json({ error: 'UTR number daalo' });
  
  const user = users.find(u => u.id === req.user.id);
  const dep = {
    id: nextDepId++,
    userId: user.id,
    email: user.email,
    amount: amount,
    utr: utr,
    time: new Date().toISOString(),
    status: 'pending'
  };
  deposits.push(dep);
  res.json({ success: true, message: 'Request submit ho gaya. Admin approve karega.', depositId: dep.id });
});

app.post('/api/withdraw', auth, (req, res) => {
  const { amount } = req.body;
  const user = users.find(u => u.id === req.user.id);
  if (!amount || amount <= 0) return res.json({ error: 'सही amount डालो' });
  if (user.coins < amount) return res.json({ error: 'कम balance' });
  
  const wit = {
    id: nextDepId++,
    userId: user.id,
    email: user.email,
    amount: amount,
    time: new Date().toISOString(),
    status: 'pending'
  };
  withdraws.push(wit);
  res.json({ success: true, message: 'Withdraw request submit ho gaya.' });
});

app.post('/api/withdraw', auth, (req, res) => {
  const { amount } = req.body;
  const user = users.find(u => u.id === req.user.id);
  if (user.coins < amount) return res.json({ error: 'कम balance' });
  
  user.coins -= amount;
  res.json({ success: true, coins: user.coins });
});

// ===== GAMES (Server-side results) =====

app.post('/api/game/color', auth, (req, res) => {
  const { bet, amount } = req.body;
  const user = users.find(u => u.id === req.user.id);
  if (user.coins < amount) return res.json({ error: 'कम balance' });
  
  user.coins -= amount;
  
  // Server decides result
  const num = Math.floor(Math.random() * 10);
  const color = num === 0 || num === 5 ? 'Violet' : [1,3,7,9].includes(num) ? 'Green' : 'Red';
  const size = num >= 5 ? 'Big' : 'Small';
  
  let win = false, winAmt = 0;
  if (bet === color) { win = true; winAmt = color === 'Violet' ? amount * 4.5 : amount * 2; }
  else if (bet === size) { win = true; winAmt = amount * 2; }
  else if (bet == num) { win = true; winAmt = amount * 9; }
  
  if (win) user.coins += winAmt;
  
  res.json({ result: { num, color, size }, win, winAmt, coins: user.coins });
});

app.post('/api/game/dice', auth, (req, res) => {
  const { bet, amount } = req.body;
  const user = users.find(u => u.id === req.user.id);
  if (user.coins < amount) return res.json({ error: 'कम balance' });
  
  user.coins -= amount;
  const dice = Math.floor(Math.random() * 6) + 1;
  const result = dice >= 4 ? 'High' : 'Low';
  const win = bet === result;
  if (win) user.coins += amount * 2;
  
  res.json({ dice, result, win, coins: user.coins });
});

// ===== ADMIN =====

app.get('/api/admin/users', auth, adminOnly, (req, res) => {
  res.json({ users: users.map(u => ({ id: u.id, email: u.email, coins: u.coins, role: u.role })) });
});

app.post('/api/admin/add-coins', auth, adminOnly, (req, res) => {
  const { userId, amount } = req.body;
  const user = users.find(u => u.id === userId);
  if (!user) return res.json({ error: 'User नहीं मिला' });
  user.coins += amount;
  res.json({ success: true, coins: user.coins });
});


// ===== ADMIN DEPOSITS & WITHDRAWS =====

app.get('/api/admin/deposits', auth, adminOnly, (req, res) => {
  const pending = deposits.filter(d => d.status === 'pending');
  res.json({ deposits: pending });
});

app.get('/api/admin/withdraws', auth, adminOnly, (req, res) => {
  const pending = withdraws.filter(w => w.status === 'pending');
  res.json({ withdraws: pending });
});

app.post('/api/admin/approve-deposit', auth, adminOnly, (req, res) => {
  const { depositId } = req.body;
  const dep = deposits.find(d => d.id === depositId && d.status === 'pending');
  if (!dep) return res.json({ error: 'Deposit request nahi mili' });
  
  const user = users.find(u => u.id === dep.userId);
  if (!user) return res.json({ error: 'User nahi mila' });
  
  user.coins += dep.amount;
  dep.status = 'approved';
  res.json({ success: true, message: 'Approved', coins: user.coins });
});

app.post('/api/admin/reject-deposit', auth, adminOnly, (req, res) => {
  const { depositId } = req.body;
  const dep = deposits.find(d => d.id === depositId && d.status === 'pending');
  if (!dep) return res.json({ error: 'Deposit request nahi mili' });
  dep.status = 'rejected';
  res.json({ success: true });
});

app.post('/api/admin/approve-withdraw', auth, adminOnly, (req, res) => {
  const { withdrawId } = req.body;
  const wit = withdraws.find(w => w.id === withdrawId && w.status === 'pending');
  if (!wit) return res.json({ error: 'Withdraw request nahi mili' });
  
  const user = users.find(u => u.id === wit.userId);
  if (!user) return res.json({ error: 'User nahi mila' });
  if (user.coins < wit.amount) return res.json({ error: 'User ke paas itne coins nahi' });
  
  user.coins -= wit.amount;
  wit.status = 'approved';
  res.json({ success: true, coins: user.coins });
});

app.post('/api/admin/reject-withdraw', auth, adminOnly, (req, res) => {
  const { withdrawId } = req.body;
  const wit = withdraws.find(w => w.id === withdrawId && w.status === 'pending');
  if (!wit) return res.json({ error: 'Withdraw request nahi mili' });
  wit.status = 'rejected';
  res.json({ success: true });
});


// Make first user admin (for testing)
app.post('/api/make-admin', (req, res) => {
  const { email } = req.body;
  const user = users.find(u => u.email === email);
  if (user) { user.role = 'admin'; res.json({ success: true }); }
  else res.json({ error: 'User नहीं मिला' });
});

// Home
app.get('/', (req, res) => res.json({ status: 'Jai Club Backend Running!', users: users.length }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port ' + PORT));
