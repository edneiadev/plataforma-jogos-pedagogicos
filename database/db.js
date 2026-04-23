const { Database: _Database } = require('node-sqlite3-wasm');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'plataforma.db');
const _db = new _Database(DB_PATH);

function looksLikeDatabaseLockError(error) {
  return error && /database is locked/i.test(error.message || '');
}

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

// Wait up to 5 s if another process holds the DB lock
try {
  db.exec('PRAGMA busy_timeout = 5000');
} catch (e) {
  if (!looksLikeDatabaseLockError(e)) throw e;
}

// Enable WAL mode for better concurrency
try {
  db.exec('PRAGMA journal_mode = WAL');
} catch (e) {
  console.warn('WAL mode not set (continuing with default journal mode):', e.message);
}

function tableExists(name) {
  return !!db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1"
  ).get(name);
}

try {
  const hasUsuarios = tableExists('usuarios');
  const hasJogos = tableExists('jogos');

  if (!hasUsuarios) {
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
    `);
  }

  if (!hasJogos) {
    db.exec(`
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
  }

  let transactionOpen = false;
  try {
    db.exec('BEGIN');
    transactionOpen = true;

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

    const jogosMatematicaIniciais = [
      {
        nome: 'aventura-em-marte',
        conteudos: 'Matemática',
        ano: 'Ensino Fundamental',
        link_jogo: 'https://www.escolagames.com.br/jogos/aventura-em-marte/'
      },
      {
        nome: 'o-dia-que-o-tempo-parou',
        conteudos: 'Matemática',
        ano: 'Ensino Fundamental',
        link_jogo: 'https://www.escolagames.com.br/jogos/o-dia-que-o-tempo-parou/'
      },
      {
        nome: 'a-casa-abandonada',
        conteudos: 'Matemática',
        ano: 'Ensino Fundamental',
        link_jogo: 'https://www.escolagames.com.br/jogos/a-casa-abandonada/'
      }
    ];

    const jogoExisteStmt = db.prepare('SELECT id FROM jogos WHERE nome = ? AND categoria = ?');
    const inserirJogoStmt = db.prepare(
      'INSERT INTO jogos (nome, categoria, conteudos, ano, icone_url, link_jogo) VALUES (?, ?, ?, ?, ?, ?)'
    );

    jogosMatematicaIniciais.forEach((jogo) => {
      const existe = jogoExisteStmt.get(jogo.nome, 'matematica');
      if (!existe) {
        inserirJogoStmt.run(
          jogo.nome,
          'matematica',
          jogo.conteudos,
          jogo.ano,
          null,
          jogo.link_jogo
        );
      }
    });

    db.exec('COMMIT');
    transactionOpen = false;
  } catch (seedError) {
    if (transactionOpen) {
      try {
        db.exec('ROLLBACK');
      } catch (rollbackError) {
        console.warn('Falha ao executar ROLLBACK durante inicialização:', rollbackError.message);
      }
    }
    throw seedError;
  }
} catch (error) {
  if (looksLikeDatabaseLockError(error)) {
    console.warn('Banco SQLite bloqueado na inicialização; etapas de schema/seed foram ignoradas nesta inicialização.');
  } else {
    throw error;
  }
}

module.exports = db;
