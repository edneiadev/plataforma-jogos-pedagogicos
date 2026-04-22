const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database/db');
const { isAdmin } = require('../middleware/auth');

// Multer setup for icon uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../public/uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `jogo-${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Somente imagens são permitidas (jpg, png, gif, svg, webp).'));
    }
  },
  limits: { fileSize: 2 * 1024 * 1024 } // 2 MB
});

router.use(isAdmin);

// Helper to load panel data
function getPainelData() {
  return {
    pendentes: db.prepare(
      "SELECT * FROM usuarios WHERE tipo = 'professor' AND status = 'pendente' ORDER BY criado_em DESC"
    ).all(),
    aprovados: db.prepare(
      "SELECT * FROM usuarios WHERE tipo = 'professor' AND status != 'pendente' ORDER BY criado_em DESC"
    ).all(),
    jogos: db.prepare('SELECT * FROM jogos ORDER BY nome ASC').all()
  };
}

// Admin panel
router.get('/painel', (req, res) => {
  const { pendentes, aprovados, jogos } = getPainelData();
  const aba = req.query.aba || 'usuarios';
  const sucesso = req.query.sucesso ? 'Operação realizada com sucesso!' : null;
  res.render('admin/painel', { user: req.session.user, pendentes, aprovados, jogos, erro: null, sucesso, aba });
});

// Approve / reject user
router.post('/usuario/:id/status', (req, res) => {
  const { status } = req.body;
  const { id } = req.params;
  if (!['aprovado', 'rejeitado'].includes(status)) return res.redirect('/admin/painel');
  db.prepare("UPDATE usuarios SET status = ? WHERE id = ? AND tipo = 'professor'").run(status, id);
  res.redirect('/admin/painel?aba=usuarios&sucesso=1');
});

// Create game
router.post('/jogo/novo', (req, res) => {
  upload.single('icone')(req, res, (err) => {
    const { nome, categoria, conteudos, ano, link_jogo, icone_url_manual } = req.body;
    const { pendentes, aprovados, jogos } = getPainelData();

    if (err) {
      return res.render('admin/painel', {
        user: req.session.user, pendentes, aprovados, jogos,
        erro: err.message, sucesso: null, aba: 'jogos'
      });
    }

    if (!nome || !categoria || !conteudos || !ano || !link_jogo) {
      return res.render('admin/painel', {
        user: req.session.user, pendentes, aprovados, jogos,
        erro: 'Preencha todos os campos obrigatórios do jogo.', sucesso: null, aba: 'jogos'
      });
    }

    const icone_url = req.file
      ? `/uploads/${req.file.filename}`
      : (icone_url_manual ? icone_url_manual.trim() : null);

    db.prepare(
      'INSERT INTO jogos (nome, categoria, conteudos, ano, icone_url, link_jogo) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(nome.trim(), categoria, conteudos.trim(), ano.trim(), icone_url, link_jogo.trim());

    res.redirect('/admin/painel?aba=jogos&sucesso=1');
  });
});

// Edit game – form
router.get('/jogo/:id/editar', (req, res) => {
  const jogo = db.prepare('SELECT * FROM jogos WHERE id = ?').get(req.params.id);
  if (!jogo) return res.redirect('/admin/painel?aba=jogos');
  res.render('admin/editar-jogo', { user: req.session.user, jogo, erro: null });
});

// Edit game – submit
router.post('/jogo/:id/editar', (req, res) => {
  upload.single('icone')(req, res, (err) => {
    const jogo = db.prepare('SELECT * FROM jogos WHERE id = ?').get(req.params.id);
    if (!jogo) return res.redirect('/admin/painel?aba=jogos');

    if (err) {
      return res.render('admin/editar-jogo', { user: req.session.user, jogo, erro: err.message });
    }

    const { nome, categoria, conteudos, ano, link_jogo, icone_url_manual } = req.body;

    if (!nome || !categoria || !conteudos || !ano || !link_jogo) {
      return res.render('admin/editar-jogo', {
        user: req.session.user, jogo,
        erro: 'Preencha todos os campos obrigatórios.'
      });
    }

    const icone_url = req.file
      ? `/uploads/${req.file.filename}`
      : (icone_url_manual ? icone_url_manual.trim() : jogo.icone_url);

    db.prepare(
      'UPDATE jogos SET nome = ?, categoria = ?, conteudos = ?, ano = ?, icone_url = ?, link_jogo = ? WHERE id = ?'
    ).run(nome.trim(), categoria, conteudos.trim(), ano.trim(), icone_url, link_jogo.trim(), req.params.id);

    res.redirect('/admin/painel?aba=jogos&sucesso=1');
  });
});

// Delete game
router.post('/jogo/:id/excluir', (req, res) => {
  const jogo = db.prepare('SELECT id, icone_url FROM jogos WHERE id = ?').get(req.params.id);
  if (!jogo) return res.redirect('/admin/painel?aba=jogos');

  db.prepare('DELETE FROM jogos WHERE id = ?').run(req.params.id);

  // Remove uploaded icon file to prevent orphaned files
  if (jogo.icone_url && jogo.icone_url.startsWith('/uploads/')) {
    const filePath = path.join(__dirname, '../public', jogo.icone_url);
    fs.unlink(filePath, () => {}); // Ignore errors (file may not exist)
  }

  res.redirect('/admin/painel?aba=jogos&sucesso=1');
});

module.exports = router;
