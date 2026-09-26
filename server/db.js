// Camada de banco de dados - SQLite real via módulo nativo `node:sqlite` (Node >= 22.5)
// O arquivo do banco é criado automaticamente em /data/barbearia.db na primeira execução.
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'barbearia.db');

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'client',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS barbers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  bio TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  duration_min INTEGER NOT NULL,
  price REAL NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  barber_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (client_id) REFERENCES users(id),
  FOREIGN KEY (barber_id) REFERENCES barbers(id),
  FOREIGN KEY (service_id) REFERENCES services(id)
);
`);

function uid() {
  return crypto.randomBytes(9).toString('hex');
}

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, salt, hash) {
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(check, 'hex'), Buffer.from(hash, 'hex'));
}

// ---------- Seed inicial (apenas se o banco estiver vazio) ----------
const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
if (userCount === 0) {
  const { hash, salt } = hashPassword('admin123');
  db.prepare(`INSERT INTO users (id,name,email,phone,password_hash,password_salt,role,created_at) VALUES (?,?,?,?,?,?,?,?)`)
    .run(uid(), 'Administrador', 'admin@barbearia.com', '11999990000', hash, salt, 'admin', Date.now());

  const barbers = [
    ['Marcos Silva', 'Especialista em cortes clássicos e degradê.'],
    ['Rafael Costa', 'Referência em barba e navalha.'],
    ['Diego Alves', 'Cortes modernos e coloração masculina.']
  ];
  const insB = db.prepare('INSERT INTO barbers (id,name,bio,active) VALUES (?,?,?,1)');
  for (const [name, bio] of barbers) insB.run(uid(), name, bio);

  const services = [
    ['Corte de Cabelo', 30, 45],
    ['Barba Completa', 25, 35],
    ['Corte + Barba', 50, 70],
    ['Sobrancelha', 15, 20],
    ['Pigmentação', 40, 55],
    ['Corte Infantil', 30, 38]
  ];
  const insS = db.prepare('INSERT INTO services (id,name,duration_min,price,active) VALUES (?,?,?,?,1)');
  for (const [name, dur, price] of services) insS.run(uid(), name, dur, price);

  console.log('Banco de dados criado e populado com dados iniciais (SQLite em data/barbearia.db).');
}

module.exports = { db, uid, hashPassword, verifyPassword };
