const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../database/db');

// ── Rate limiters applied directly to handlers ─────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Muitas tentativas de login. Tente novamente em 15 minutos.'
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Muitas tentativas de cadastro. Tente novamente em 1 hora.'
});

// ── Landing / redirect ─────────────────────────────────────────
router.get('/', (req, res) => {
  if (req.session.user) {
    if (req.session.user.tipo === 'admin') return res.redirect('/admin/painel');
    return res.redirect('/jogos/categorias');
  }
  res.render('index', { erro: null });
});

// ── Login ──────────────────────────────────────────────────────
router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('index', { erro: null });
});

router.post('/login', loginLimiter, (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.render('index', { erro: 'Preencha e-mail e senha.' });
  }

  const user = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email.trim().toLowerCase());

  if (!user || !bcrypt.compareSync(senha, user.senha)) {
    return res.render('index', { erro: 'E-mail ou senha incorretos.' });
  }

  if (user.tipo !== 'admin' && user.status !== 'aprovado') {
    const msgs = {
      pendente: 'Seu cadastro ainda está aguardando aprovação do administrador.',
      rejeitado: 'Seu cadastro foi rejeitado. Entre em contato com o administrador.'
    };
    return res.render('index', { erro: msgs[user.status] || 'Acesso não autorizado.' });
  }

  req.session.user = {
    id: user.id,
    nome: user.nome,
    email: user.email,
    tipo: user.tipo,
    status: user.status
  };

  if (user.tipo === 'admin') return res.redirect('/admin/painel');
  res.redirect('/jogos/categorias');
});

// ── Registration ───────────────────────────────────────────────
router.get('/cadastro', (req, res) => {
  res.render('cadastro', { erro: null, sucesso: null });
});

router.post('/cadastro', registerLimiter, (req, res) => {
  const { nome, email, senha, escola } = req.body;

  if (!nome || !email || !senha) {
    return res.render('cadastro', { erro: 'Preencha todos os campos obrigatórios.', sucesso: null });
  }

  if (senha.length < 6) {
    return res.render('cadastro', { erro: 'A senha deve ter pelo menos 6 caracteres.', sucesso: null });
  }

  const emailNorm = email.trim().toLowerCase();
  const exists = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(emailNorm);
  if (exists) {
    return res.render('cadastro', { erro: 'E-mail já cadastrado.', sucesso: null });
  }

  const hash = bcrypt.hashSync(senha, 10);
  db.prepare(
    'INSERT INTO usuarios (nome, email, senha, escola, tipo, status) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(nome.trim(), emailNorm, hash, escola ? escola.trim() : null, 'professor', 'pendente');

  res.render('cadastro', {
    erro: null,
    sucesso: 'Cadastro realizado com sucesso! Aguarde a aprovação do administrador.'
  });
});

// ── Logout ─────────────────────────────────────────────────────
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
