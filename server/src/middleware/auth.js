import jwt from 'jsonwebtoken';

// Dev-only fallback so the app runs out of the box; set a real JWT_SECRET
// via server/.env for anything beyond a local demo.
const secret = process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me';

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, name: user.name, role: user.role },
    secret,
    { expiresIn: '8h' }
  );
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not signed in' });

  try {
    req.user = jwt.verify(token, secret);
    next();
  } catch {
    res.status(401).json({ error: 'Session expired, please sign in again' });
  }
}

// Must run after requireAuth — only lets admins through (e.g. creating
// new employee accounts). Everyone else gets a 403.
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}
