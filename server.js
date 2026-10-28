const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const bot = new TelegramBot(BOT_TOKEN, { polling: false });

app.use(express.json());
app.use(express.static('public'));

const DB_PATH = './db.json';
function loadDB() {
  if (!fs.existsSync(DB_PATH)) return { users: {}, cards: {}, quests: {}, pool: { total: 0, lastDistributed: Date.now() } };
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}
function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}
const db = loadDB();
if (!db.pool) db.pool = { total: 0, lastDistributed: Date.now() };

db.cards = {
  spark: { id: 'spark', name: 'Spark Node', price: 10, income: 0.2, color: '#ff7b00' },
  drop: { id: 'drop', name: 'Drop Node', price: 25, income: 0.5, color: '#00d2ff' },
  leaf: { id: 'leaf', name: 'Leaf Node', price: 50, income: 1.2, color: '#11998e' },
  ember: { id: 'ember', name: 'Ember Node', price: 75, income: 2.0, color: '#f12711' },
  coin: { id: 'coin', name: 'Coin Node', price: 100, income: 3.0, color: '#f5d76e' },
  vault: { id: 'vault', name: 'Vault Node', price: 150, income: 5.0, color: '#8e2de2' },
  crystal: { id: 'crystal', name: 'Crystal Node', price: 200, income: 7.5, color: '#00c6ff' },
  crown: { id: 'crown', name: 'Crown Node', price: 300, income: 12.0, color: '#ffd700' },
  shadow: { id: 'shadow', name: 'Shadow Node', price: 400, income: 18.0, color: '#3a1c71' },
  mint: { id: 'mint', name: 'Mint Node', price: 500, income: 25.0, color: '#00b4db' },
  ledger: { id: 'ledger', name: 'Ledger Node', price: 700, income: 40.0, color: '#606c88' },
  nova: { id: 'nova', name: 'Nova Node', price: 900, income: 55.0, color: '#ff512f' },
  forge: { id: 'forge', name: 'Forge Node', price: 1200, income: 80.0, color: '#e65c00' },
  ocean: { id: 'ocean', name: 'Ocean Node', price: 1500, income: 110.0, color: '#1a2980' },
  plasma: { id: 'plasma', name: 'Plasma Node', price: 1800, income: 140.0, color: '#fc00ff' },
  treasury: { id: 'treasury', name: 'Treasury Node', price: 2000, income: 170.0, color: '#a8ff78' },
  dynasty: { id: 'dynasty', name: 'Dynasty Node', price: 2500, income: 220.0, color: '#ff0099' },
  quantum: { id: 'quantum', name: 'Quantum Node', price: 3000, income: 280.0, color: '#00f2fe' },
  empire: { id: 'empire', name: 'Empire Node', price: 3500, income: 340.0, color: '#d31027' },
  void: { id: 'void', name: 'Void Node', price: 4000, income: 420.0, color: '#434343' },
  titan: { id: 'titan', name: 'Titan Node', price: 5000, income: 550.0, color: '#bdc3c7' },
  genesis: { id: 'genesis', name: 'Genesis Node', price: 7000, income: 800.0, color: '#f12711' },
  infinity: { id: 'infinity', name: 'Infinity Node', price: 9000, income: 1050.0, color: '#8e2de2' },
  celestial: { id: 'celestial', name: 'Celestial Node', price: 11000, income: 1300.0, color: '#00c6ff' },
  monarch: { id: 'monarch', name: 'Monarch Node', price: 14000, income: 1700.0, color: '#ffd700' },
  abyss: { id: 'abyss', name: 'Abyss Node', price: 17000, income: 2100.0, color: '#3a1c71' },
  sovereign: { id: 'sovereign', name: 'Sovereign Node', price: 20000, income: 2600.0, color: '#11998e' },
  kronos: { id: 'kronos', name: 'Kronos Node', price: 25000, income: 3500.0, color: '#f5d76e' }
};

db.quests = {
  tap1000: { id: 'tap1000', name: 'Сделай 1000 кликов', reward: 500, type: 'taps', target: 1000 },
  tap5000: { id: 'tap5000', name: 'Сделай 5000 кликов', reward: 2500, type: 'taps', target: 5000 },
  buy3: { id: 'buy3', name: 'Инвестируй в 3 актива', reward: 1000, type: 'cards', target: 3 },
  ref1: { id: 'ref1', name: 'Пригласи 1 партнёра', reward: 2000, type: 'refs', target: 1 },
  ref5: { id: 'ref5', name: 'Пригласи 5 партнёров', reward: 10000, type: 'refs', target: 5 }
};
saveDB(db);

function validateInitData(initData) {
  if (!BOT_TOKEN) return true;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return false;
  params.delete('hash');
  const str = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  return crypto.createHmac('sha256', secret).update(str).digest('hex') === hash;
}

function parseUser(initData) {
  try { return JSON.parse(new URLSearchParams(initData).get('user')); } 
  catch (e) { return { id: 999999 }; }
}

function calculateLevel(user) {
  const xpForNextLevel = user.level * 1000;
  if (user.xp >= xpForNextLevel) { user.level += 1; user.xp -= xpForNextLevel; }
}

function getUser(id, refId = null) {
  if (!db.users[id]) {
    db.users[id] = {
      id: id, nickname: 'Инвестор_' + id.toString().slice(-4), avatar: '', email: '', phone: '', isVerified: false, level: 1, xp: 0,
      balance: 0, energy: 1000, maxEnergy: 1000, tapPower: 1, mult: 1, cards: [],
      lastTap: Date.now(), lastIncome: Date.now(), lastBonus: 0, lastPoolClaim: 0, streak: 0, totalTaps: 0,
      refBy: refId, refCount: 0, refEarned: 0, questsDone: []
    };
    if (refId && db.users[refId]) db.users[refId].refCount++;
    saveDB(db);
  }
  return db.users[id];
}

function getPassiveIncome(user) {
  const baseIncome = user.cards.reduce((s, cid) => s + db.cards[cid].income, 0);
  const friendBoost = Math.min(user.refCount * 0.02, 1.0); 
  return baseIncome * user.mult * (1 + friendBoost);
}

function distributeRefBonus(user, amount) {
  let currentRefId = user.refBy;
  let level = 1;
  const percents = { 1: 0.10, 2: 0.05, 3: 0.02 };
  while (currentRefId && db.users[currentRefId] && level <= 3) {
    const bonus = Math.floor(amount * percents[level]);
    db.users[currentRefId].balance += bonus;
    db.users[currentRefId].refEarned += bonus;
    currentRefId = db.users[currentRefId].refBy;
    level++;
  }
}

app.post('/api/init', (req, res) => {
  const { initData, startParam } = req.body;
  if (!validateInitData(initData)) return res.status(401).json({ error: 'unauthorized' });
  const u = parseUser(initData);
  const user = getUser(u.id, startParam || null);
  
  const now = Date.now();
  const canClaimPool = (now - db.pool.lastDistributed) >= 24 * 3600 * 1000;
  const totalIncome = Object.values(db.users).reduce((s, usr) => s + getPassiveIncome(usr), 0);
  const userShare = getPassiveIncome(user) / Math.max(1, totalIncome);
  
  res.json({ user, cards: db.cards, quests: db.quests, pool: { total: Math.floor(db.pool.total), canClaim: canClaimPool, potentialReward: Math.floor(db.pool.total * userShare), friendsBoost: Math.min(user.refCount * 0.02, 1.0) } });
});

app.post('/api/tap', (req, res) => {
  const { initData, taps } = req.body;
  if (!validateInitData(initData)) return res.status(401).json({ error: 'unauthorized' });
  const user = getUser(parseUser(initData).id);
  const now = Date.now();
  const regen = Math.floor((now - user.lastTap) / 3000);
  if (regen > 0) { user.energy = Math.min(user.maxEnergy, user.energy + regen); user.lastTap = now; }
  const useTaps = Math.min(taps || 1, user.energy);
  user.energy -= useTaps;
  const earn = useTaps * user.tapPower * user.mult;
  user.balance += earn;
  user.totalTaps += useTaps; user.xp += useTaps;
  calculateLevel(user);
  distributeRefBonus(user, earn);
  saveDB(db); res.json({ user });
});

app.post('/api/income', (req, res) => {
  const user = getUser(parseUser(req.body.initData).id);
  const perHour = getPassiveIncome(user);
  const now = Date.now();
  const earned = Math.floor(perHour * ((now - (user.lastIncome || now)) / 3600000));
  user.balance += earned;
  user.lastIncome = now;
  distributeRefBonus(user, earned);
  saveDB(db); res.json({ user });
});

app.post('/api/claim-pool', (req, res) => {
  const user = getUser(parseUser(req.body.initData).id);
  const now = Date.now();
  if ((now - db.pool.lastDistributed) < 24 * 3600 * 1000) return res.status(400).json({ error: 'not ready' });
  const totalIncome = Object.values(db.users).reduce((s, usr) => s + getPassiveIncome(usr), 0);
  const userShare = getPassiveIncome(user) / Math.max(1, totalIncome);
  const reward = Math.floor(db.pool.total * userShare);
  if (reward > 0) {
    user.balance += reward;
    db.pool.total -= reward;
    db.pool.lastDistributed = now;
    saveDB(db); res.json({ user, reward });
  } else { res.status(400).json({ error: 'empty' }); }
});

app.post('/api/upgrade', (req, res) => {
  const { initData, type } = req.body;
  const user = getUser(parseUser(initData).id);
  if (type === 'tap') {
    const cost = user.tapPower * 500;
    if (user.balance < cost) return res.status(400).json({ error: 'no' });
    user.balance -= cost; user.tapPower += 1;
  } else if (type === 'energy') {
    const cost = user.maxEnergy * 2;
    if (user.balance < cost) return res.status(400).json({ error: 'no' });
    user.balance -= cost; user.maxEnergy += 500; user.energy += 500;
  } else if (type === 'mult') {
    const cost = user.mult * 5000;
    if (user.balance < cost) return res.status(400).json({ error: 'no' });
    user.balance -= cost; user.mult += 0.5;
  }
  saveDB(db); res.json({ user });
});

app.post('/api/daily-bonus', (req, res) => {
  const user = getUser(parseUser(req.body.initData).id);
  const diff = (Date.now() - (user.lastBonus || 0)) / 3600000;
  if (diff < 24) return res.status(400).json({ error: 'claimed' });
  if (diff < 48) user.streak += 1; else user.streak = 1;
  const reward = 500 * user.streak;
  user.balance += reward; user.lastBonus = Date.now();
  saveDB(db); res.json({ user, reward });
});

app.post('/api/claim-quest', (req, res) => {
  const { initData, questId } = req.body;
  const user = getUser(parseUser(initData).id);
  const q = db.quests[questId];
  if (!q || user.questsDone.includes(questId)) return res.status(400).json({ error: 'no' });
  let cur = q.type === 'taps' ? user.totalTaps : (q.type === 'cards' ? user.cards.length : user.refCount);
  if (cur < q.target) return res.status(400).json({ error: 'no' });
  user.balance += q.reward; user.questsDone.push(questId);
  saveDB(db); res.json({ user });
});

app.post('/api/profile/update', (req, res) => {
  const { initData, nickname, avatar } = req.body;
  const user = getUser(parseUser(initData).id);
  if (nickname) user.nickname = nickname.slice(0, 20);
  if (avatar) user.avatar = avatar;
  saveDB(db); res.json({ user });
});

app.post('/api/profile/verify-request', async (req, res) => {
  const { initData, email, phone } = req.body;
  const uId = parseUser(initData).id;
  const user = getUser(uId);
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  user.verifyCode = code; user.pendingEmail = email; user.pendingPhone = phone; saveDB(db);
  try { 
    await bot.sendMessage(uId, `Код KYC верификации KRONA: ${code}\n\nВаша почта: ${email}\nВаш телефон: ${phone}`); 
    res.json({ success: true }); 
  }
  catch (e) { res.status(500).json({ error: 'Start bot first!' }); }
});

app.post('/api/profile/verify-confirm', (req, res) => {
  const user = getUser(parseUser(req.body.initData).id);
  if (user.verifyCode && user.verifyCode === req.body.code) {
    user.email = user.pendingEmail; user.phone = user.pendingPhone; user.isVerified = true;
    user.verifyCode = null; user.pendingEmail = null; user.pendingPhone = null;
    saveDB(db); res.json({ user, success: true });
  } else res.status(400).json({ error: 'wrong' });
});

app.post('/api/leaderboard/global', (req, res) => {
  const userId = parseUser(req.body.initData).id;
  const all = Object.values(db.users).sort((a, b) => b.balance - a.balance);
  const myPlace = all.findIndex(u => u.id === userId) + 1;
  const top = all.slice(0, 50).map((u, i) => ({ place: i + 1, id: u.id, name: u.nickname, avatar: u.avatar, balance: Math.floor(u.balance), isMe: u.id === userId }));
  res.json({ top, myPlace, myBalance: Math.floor(db.users[userId].balance) });
});

app.post('/api/leaderboard/friends', (req, res) => {
  const userId = parseUser(req.body.initData).id;
  const friends = Object.values(db.users).filter(u => u.refBy === userId);
  const list = [...friends, db.users[userId]].sort((a, b) => b.balance - a.balance);
  const myPlace = list.findIndex(u => u.id === userId) + 1;
  const top = list.map((u, i) => ({ place: i + 1, id: u.id, name: u.nickname, avatar: u.avatar, balance: Math.floor(u.balance), isMe: u.id === userId }));
  res.json({ top, myPlace, myBalance: Math.floor(db.users[userId].balance) });
});

app.post('/api/buy-card', async (req, res) => {
  const { initData, cardId } = req.body;
  const uId = parseUser(initData).id;
  const card = db.cards[cardId];
  if (!card || db.users[uId].cards.includes(cardId)) return res.status(400).json({ error: 'error' });
  const starsPrice = Math.round(card.price / 1.3);
  try {
    const invoice = await bot.createInvoiceLink({
      title: `Актив: ${card.name}`, description: `Доход: +${card.income} KRN/час.`,
      payload: JSON.stringify({ userId: uId, cardId }), provider_token: '', currency: 'XTR',
      prices: [{ label: card.name, amount: starsPrice }]
    });
    res.json({ invoiceUrl: invoice });
  } catch (e) { res.status(500).json({ error: 'error' }); }
});

app.post('/webhook/stars', async (req, res) => {
  const update = req.body;
  if (update.pre_checkout_query) await bot.answerPreCheckoutQuery(update.pre_checkout_query.id, true);
  else if (update.message && update.message.successful_payment) {
    const payload = JSON.parse(update.message.successful_payment.invoice_payload);
    const user = getUser(payload.userId);
    const card = db.cards[payload.cardId];
    if (user && card && !user.cards.includes(payload.cardId)) {
      user.cards.push(payload.cardId); user.xp += card.price * 10; calculateLevel(user);
      db.pool.total += card.price * 0.10; saveDB(db);
      bot.sendMessage(user.id, `✅ Успешно! Актив ${card.name} добавлен в портфель.`);
    }
  }
  res.sendStatus(200);
});

app.post('/setup-webhook', (req, res) => {
  bot.setWebHook(req.body.url + '/webhook/stars');
  res.json({ ok: true });
});

app.listen(process.env.PORT || 3000, () => console.log('KRONA running'));
