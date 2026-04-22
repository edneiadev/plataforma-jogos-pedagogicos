const express = require('express');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const path = require('path');

const app = express();

// ── Rate limiters ──────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Muitas tentativas. Tente novamente em 15 minutos.'
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Muitas tentativas de cadastro. Tente novamente em 1 hora.'
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
});

// ── View engine ────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── Static files ───────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Body parsing ───────────────────────────────────────────────
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ── Session ────────────────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'plataforma-jogos-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000 // 8 hours
  }
}));

// ── CSRF token middleware ──────────────────────────────────────
// For multipart/form-data forms, _csrf is passed as a query parameter
// because the body is not yet parsed by express.urlencoded at this stage.
app.use((req, res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const token =
      req.body._csrf ||          // urlencoded / json forms
      req.query._csrf ||          // multipart forms (token in query string)
      req.headers['x-csrf-token'];
    if (!token || token !== req.session.csrfToken) {
      return res.status(403).render('403', { user: req.session.user || null });
    }
  }
  next();
});

// ── Routes ─────────────────────────────────────────────────────
app.use('/cadastro', registerLimiter);
app.use('/login', authLimiter);
app.use('/', require('./routes/auth'));
app.use('/admin', generalLimiter, require('./routes/admin'));
app.use('/jogos', generalLimiter, require('./routes/games'));

// ── 404 ────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).render('404', { user: req.session.user || null });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
