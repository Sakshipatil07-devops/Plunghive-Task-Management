import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/db.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { logger } from '../services/cloudwatch.js';

export const authRouter = Router();

authRouter.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = signToken(user);
  logger.info(`user "${user.username}" signed in`);
  res.json({
    token,
    user: { id: user.id, username: user.username, name: user.name, role: user.role },
  });
});

// Lets the client verify a stored token is still valid on page reload.
authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: { id: req.user.sub, username: req.user.username, name: req.user.name, role: req.user.role } });
});

// Self-service password change — anyone signed in can change their own
// password (requires the current one). For an admin resetting *someone
// else's* forgotten password, see PATCH /api/users/:id/password instead.
authRouter.patch('/password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'newPassword must be at least 6 characters' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.sub);
  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(newPassword, 10), user.id);
  logger.info(`user#${user.id} changed their own password`);
  res.status(204).end();
});
