# Jai Club Backend

## Setup

```bash
cd backend
npm install
node server.js
```

Server: http://localhost:3000

## API Endpoints

### Auth
- POST /api/signup - { email, password }
- POST /api/login - { email, password }

### Wallet (needs token)
- GET /api/balance
- POST /api/deposit - { amount }
- POST /api/withdraw - { amount }

### Games (needs token)
- POST /api/game/color - { bet, amount }
- POST /api/game/dice - { bet, amount }

### Admin (needs admin token)
- GET /api/admin/users
- POST /api/admin/add-coins - { userId, amount }

## Make Admin
POST /api/make-admin - { email: "your@email.com" }

## Deploy
Railway: railway.app
Render: render.com
