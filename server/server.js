const express = require('express');
const path = require('path');
const { db, uid, hashPassword, verifyPassword } = require('./db');
const { createSession, destroySession, requireAuth, requireAdmin } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------- Helpers de validação ----------
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function validPhone(p) { return /^\d{10,11}$/.test(String(p).replace(/\D/g, '')); }
function todayISO() { return new Date().toISOString().slice(0, 10); }

function publicUser(u) { return u ? { id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role } : null; }

function serviceRow(s) { return { id: s.id, name: s.name, duration: s.duration_min, price: s.price, active: !!s.active }; }
function barberRow(b) { return { id: b.id, name: b.name, bio: b.bio, active: !!b.active }; }
function apptRow(a) { return { id: a.id, clientId: a.client_id, barberId: a.barber_id, serviceId: a.service_id, date: a.date, time: a.time, status: a.status, createdAt: a.created_at }; }

// Calcula horários livres para um barbeiro/data/serviço (mesma lógica usada na criação, evita corrida)
function computeSlots(barberId, dateStr, durationMin) {
  const day = new Date(dateStr + 'T00:00:00').getDay();
  if (day === 0) return []; // fechado aos domingos
  const OPEN = 9 * 60, CLOSE = 19 * 60, STEP = 30;
  let slots = [];
  for (let m = OPEN; m + durationMin <= CLOSE; m += STEP) {
    slots.push(String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'));
  }
  if (dateStr === todayISO()) {
    const now = Date.now();
    slots = slots.filter(s => {
      const [h, mi] = s.split(':').map(Number);
      const t = new Date(); t.setHours(h, mi, 0, 0);
      return t.getTime() > now + 15 * 60000;
    });
  }
  const busy = db.prepare(`SELECT a.time, s.duration_min FROM appointments a JOIN services s ON s.id = a.service_id
    WHERE a.barber_id = ? AND a.date = ? AND a.status != 'cancelado'`).all(barberId, dateStr);
  slots = slots.filter(s => {
    const [h, mi] = s.split(':').map(Number);
    const start = h * 60 + mi, end = start + durationMin;
    return !busy.some(b => {
      const [bh, bm] = b.time.split(':').map(Number);
      const bstart = bh * 60 + bm, bend = bstart + b.duration_min;
      return start < bend && bstart < end;
    });
  });
  return slots;
}

// =====================================================================
// AUTH
// =====================================================================
app.post('/api/auth/register', (req, res) => {
  const { name, email, phone, password } = req.body || {};
  if (!name || name.trim().length < 3) return res.status(400).json({ error: 'Informe seu nome completo.' });
  if (!email || !emailRe.test(email)) return res.status(400).json({ error: 'E-mail inválido.' });
  if (!phone || !validPhone(phone)) return res.status(400).json({ error: 'Telefone inválido (DDD + número).' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'A senha deve ter ao menos 6 caracteres.' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (existing) return res.status(409).json({ error: 'Este e-mail já está cadastrado.' });

  const { hash, salt } = hashPassword(password);
  const id = uid();
  db.prepare(`INSERT INTO users (id,name,email,phone,password_hash,password_salt,role,created_at) VALUES (?,?,?,?,?,?,?,?)`)
    .run(id, name.trim(), email.trim().toLowerCase(), phone.replace(/\D/g, ''), hash, salt, 'client', Date.now());

  const token = createSession(id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  res.status(201).json({ token, user: publicUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Informe e-mail e senha.' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).trim().toLowerCase());
  if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  }
  const token = createSession(user.id);
  res.json({ token, user: publicUser(user) });
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  destroySession(req.token);
  res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => res.json({ user: req.user }));

app.put('/api/me', requireAuth, (req, res) => {
  const { name, phone } = req.body || {};
  if (!name || name.trim().length < 3) return res.status(400).json({ error: 'Nome inválido.' });
  if (!phone || !validPhone(phone)) return res.status(400).json({ error: 'Telefone inválido.' });
  db.prepare('UPDATE users SET name = ?, phone = ? WHERE id = ?').run(name.trim(), phone.replace(/\D/g, ''), req.user.id);
  const user = db.prepare('SELECT id,name,email,phone,role FROM users WHERE id = ?').get(req.user.id);
  res.json({ user });
});

// =====================================================================
// BARBEIROS (público para leitura)
// =====================================================================
app.get('/api/barbers', (req, res) => {
  const rows = db.prepare('SELECT * FROM barbers WHERE active = 1').all();
  res.json({ barbers: rows.map(barberRow) });
});

// =====================================================================
// SERVIÇOS
// =====================================================================
app.get('/api/services', (req, res) => {
  const rows = db.prepare('SELECT * FROM services WHERE active = 1').all();
  res.json({ services: rows.map(serviceRow) });
});

app.post('/api/services', requireAdmin, (req, res) => {
  const { name, duration, price } = req.body || {};
  const dur = parseInt(duration), pr = parseFloat(price);
  if (!name || name.trim().length < 2) return res.status(400).json({ error: 'Informe o nome do serviço.' });
  if (!dur || dur < 5) return res.status(400).json({ error: 'Duração inválida (mínimo 5 minutos).' });
  if (isNaN(pr) || pr < 0) return res.status(400).json({ error: 'Preço inválido.' });
  const id = uid();
  db.prepare('INSERT INTO services (id,name,duration_min,price,active) VALUES (?,?,?,?,1)').run(id, name.trim(), dur, pr);
  res.status(201).json({ service: serviceRow(db.prepare('SELECT * FROM services WHERE id = ?').get(id)) });
});

app.put('/api/services/:id', requireAdmin, (req, res) => {
  const { name, duration, price } = req.body || {};
  const dur = parseInt(duration), pr = parseFloat(price);
  if (!name || name.trim().length < 2) return res.status(400).json({ error: 'Informe o nome do serviço.' });
  if (!dur || dur < 5) return res.status(400).json({ error: 'Duração inválida (mínimo 5 minutos).' });
  if (isNaN(pr) || pr < 0) return res.status(400).json({ error: 'Preço inválido.' });
  const existing = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Serviço não encontrado.' });
  db.prepare('UPDATE services SET name=?, duration_min=?, price=? WHERE id=?').run(name.trim(), dur, pr, req.params.id);
  res.json({ service: serviceRow(db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id)) });
});

app.delete('/api/services/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Serviço não encontrado.' });
  db.prepare('UPDATE services SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// =====================================================================
// DISPONIBILIDADE
// =====================================================================
app.get('/api/availability', (req, res) => {
  const { barberId, date, serviceId } = req.query;
  if (!barberId || !date || !serviceId) return res.status(400).json({ error: 'Parâmetros obrigatórios: barberId, date, serviceId.' });
  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId);
  if (!service) return res.status(404).json({ error: 'Serviço não encontrado.' });
  const slots = computeSlots(barberId, date, service.duration_min);
  res.json({ slots });
});

// =====================================================================
// AGENDAMENTOS
// =====================================================================
app.get('/api/appointments', requireAuth, (req, res) => {
  let rows;
  if (req.user.role === 'admin') {
    const { date, from, to, status, barberId, limit } = req.query;
    let sql = 'SELECT * FROM appointments WHERE 1=1';
    const params = [];
    if (date) { sql += ' AND date = ?'; params.push(date); }
    else {
      if (from) { sql += ' AND date >= ?'; params.push(from); }
      if (to) { sql += ' AND date <= ?'; params.push(to); }
    }
    if (status) { sql += ' AND status = ?'; params.push(status); }
    if (barberId) { sql += ' AND barber_id = ?'; params.push(barberId); }
    sql += ' ORDER BY date ASC, time ASC';
    if (limit) { sql += ' LIMIT ?'; params.push(parseInt(limit)); }
    rows = db.prepare(sql).all(...params);
  } else {
    rows = db.prepare('SELECT * FROM appointments WHERE client_id = ? ORDER BY date DESC, time ASC').all(req.user.id);
  }
  res.json({ appointments: rows.map(apptRow) });
});

app.post('/api/appointments', requireAuth, (req, res) => {
  const { barberId, serviceId, date, time } = req.body || {};
  if (!barberId || !serviceId || !date || !time) return res.status(400).json({ error: 'Preencha barbeiro, serviço, data e horário.' });
  if (date < todayISO()) return res.status(400).json({ error: 'Não é possível agendar em uma data passada.' });
  const service = db.prepare('SELECT * FROM services WHERE id = ? AND active = 1').get(serviceId);
  if (!service) return res.status(404).json({ error: 'Serviço não encontrado.' });
  const barber = db.prepare('SELECT * FROM barbers WHERE id = ? AND active = 1').get(barberId);
  if (!barber) return res.status(404).json({ error: 'Barbeiro não encontrado.' });

  const freeSlots = computeSlots(barberId, date, service.duration_min);
  if (!freeSlots.includes(time)) return res.status(409).json({ error: 'Esse horário não está mais disponível. Escolha outro.' });

  const id = uid();
  db.prepare(`INSERT INTO appointments (id,client_id,barber_id,service_id,date,time,status,created_at) VALUES (?,?,?,?,?,?,?,?)`)
    .run(id, req.user.id, barberId, serviceId, date, time, 'pendente', Date.now());
  res.status(201).json({ appointment: apptRow(db.prepare('SELECT * FROM appointments WHERE id = ?').get(id)) });
});

app.put('/api/appointments/:id/status', requireAuth, (req, res) => {
  const { status } = req.body || {};
  const valid = ['pendente', 'confirmado', 'concluido', 'cancelado'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Status inválido.' });
  const appt = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  if (!appt) return res.status(404).json({ error: 'Agendamento não encontrado.' });

  if (req.user.role !== 'admin') {
    if (appt.client_id !== req.user.id) return res.status(403).json({ error: 'Você só pode alterar seus próprios agendamentos.' });
    if (status !== 'cancelado') return res.status(403).json({ error: 'Você só pode cancelar seus agendamentos.' });
  }
  db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ appointment: apptRow(db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id)) });
});

// =====================================================================
// ADMIN: CLIENTES E ESTATÍSTICAS
// =====================================================================
app.get('/api/clients', requireAdmin, (req, res) => {
  const clients = db.prepare(`SELECT id,name,email,phone,created_at FROM users WHERE role = 'client' ORDER BY name ASC`).all();
  const result = clients.map(c => {
    const total = db.prepare('SELECT COUNT(*) c FROM appointments WHERE client_id = ?').get(c.id).c;
    const last = db.prepare(`SELECT date FROM appointments WHERE client_id = ? AND status = 'concluido' ORDER BY date DESC LIMIT 1`).get(c.id);
    return { id: c.id, name: c.name, email: c.email, phone: c.phone, totalAppointments: total, lastVisit: last ? last.date : null };
  });
  res.json({ clients: result });
});

app.get('/api/stats', requireAdmin, (req, res) => {
  const today = todayISO();
  const todayCount = db.prepare(`SELECT COUNT(*) c FROM appointments WHERE date = ? AND status != 'cancelado'`).get(today).c;
  const pending = db.prepare(`SELECT COUNT(*) c FROM appointments WHERE status = 'pendente'`).get().c;
  const ym = today.slice(0, 7);
  const revenue = db.prepare(`SELECT COALESCE(SUM(s.price),0) r FROM appointments a JOIN services s ON s.id=a.service_id
    WHERE a.status='concluido' AND a.date LIKE ?`).get(ym + '%').r;
  const clients = db.prepare(`SELECT COUNT(*) c FROM users WHERE role='client'`).get().c;
  res.json({ todayCount, pending, revenue, clients });
});

// SPA fallback simples para rotas desconhecidas de API
app.use('/api', (req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

app.listen(PORT, () => {
  console.log(`Barbearia Nobre rodando em http://localhost:${PORT}`);
});
