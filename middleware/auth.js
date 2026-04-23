function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) return next();
  res.redirect('/login');
}

function isAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.tipo === 'admin') return next();
  res.status(403).render('403', { user: req.session.user || null });
}

function isProfessor(req, res, next) {
  if (req.session && req.session.user) {
    const { tipo, status } = req.session.user;
    if (tipo === 'admin') return next();
    if (tipo === 'professor' && status === 'aprovado') return next();
  }
  res.redirect('/login');
}

module.exports = { isAuthenticated, isAdmin, isProfessor };
