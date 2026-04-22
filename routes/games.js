const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { isProfessor } = require('../middleware/auth');

router.use(isProfessor);

// Category overview
router.get('/categorias', (req, res) => {
  const matematica = db.prepare(
    "SELECT COUNT(*) as total FROM jogos WHERE categoria = 'matematica'"
  ).get();
  const leitura = db.prepare(
    "SELECT COUNT(*) as total FROM jogos WHERE categoria = 'leitura'"
  ).get();
  res.render('professor/categorias', {
    user: req.session.user,
    contagemMatematica: matematica.total,
    contagemLeitura: leitura.total
  });
});

// Game list by category
router.get('/lista/:categoria', (req, res) => {
  const { categoria } = req.params;
  const categoriasValidas = ['matematica', 'leitura'];
  if (!categoriasValidas.includes(categoria)) return res.redirect('/jogos/categorias');

  const jogos = db.prepare(
    'SELECT * FROM jogos WHERE categoria = ? ORDER BY nome ASC COLLATE NOCASE'
  ).all(categoria);

  const nomes = { matematica: 'Matemática', leitura: 'Leitura / Escrita' };
  res.render('professor/lista', {
    user: req.session.user,
    jogos,
    categoria,
    categoriaNome: nomes[categoria]
  });
});

module.exports = router;
