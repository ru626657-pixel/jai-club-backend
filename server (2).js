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
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.json({ error: 'सही amount डालो' });
  
  const user = users.find(u => u.id === req.user.id);
  user.coins += amount;
  res.json({ success: true, coins: user.coins });
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
