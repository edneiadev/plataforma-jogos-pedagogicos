const { Database: _Database } = require('node-sqlite3-wasm');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'plataforma.db');
const _db = new _Database(DB_PATH);

// Thin compatibility wrapper: node-sqlite3-wasm requires params as an array,
// while better-sqlite3 (the original dependency) accepts variadic arguments.
// This adapter normalises both call styles so no route files need to change.
function wrapStatement(stmt) {
  return {
    run:  (...args) => stmt.run(args.length === 1 && Array.isArray(args[0]) ? args[0] : args),
    get:  (...args) => stmt.get(args.length === 1 && Array.isArray(args[0]) ? args[0] : args),
    all:  (...args) => stmt.all(args.length === 1 && Array.isArray(args[0]) ? args[0] : args),
  };
}

const db = {
  exec:    (sql)  => _db.exec(sql),
  prepare: (sql)  => wrapStatement(_db.prepare(sql)),
  close:   ()     => _db.close(),
};

// Enable WAL mode for better concurrency
db.exec('PRAGMA journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    escola TEXT,
    tipo TEXT NOT NULL DEFAULT 'professor',
    status TEXT NOT NULL DEFAULT 'pendente',
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS jogos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    categoria TEXT NOT NULL,
    conteudos TEXT NOT NULL,
    ano TEXT NOT NULL,
    icone_url TEXT,
    link_jogo TEXT NOT NULL,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed default admin if not exists
const adminEmail = 'admin@plataforma.com';
const adminExists = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(adminEmail);
if (!adminExists) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare(
    'INSERT INTO usuarios (nome, email, senha, tipo, status) VALUES (?, ?, ?, ?, ?)'
  ).run('Administrador', adminEmail, hash, 'admin', 'aprovado');
  console.log('Admin padrão criado: admin@plataforma.com / admin123');
}

module.exports = db;
