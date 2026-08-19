import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/db.js';
import { logger } from '../services/cloudwatch.js';

export const usersRouter = Router();

const PUBLIC_FIELDS = 'id, username, name, role, employee_code, designation, created_at';

// Admin-only (see requireAdmin in index.js). Lets an admin see and add
// employee accounts — each new account gets its own username/password and,
// once they sign in, their own private task list (enforced in routes/tasks.js
// by scoping every query to req.user.sub).

usersRouter.get('/', (req, res) => {
  const users = db.prepare(`SELECT ${PUBLIC_FIELDS} FROM users ORDER BY created_at`).all();
  res.json(users);
});

usersRouter.post('/', (req, res) => {
  const { username, password, name, role = 'employee', employeeCode = '', designation = '' } = req.body;

  if (!username?.trim() || !password || !name?.trim()) {
    return res.status(400).json({ error: 'username, password, and name are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'password must be at least 6 characters' });
  }
  if (!['employee', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'role must be "employee" or "admin"' });
  }

  const existing = db.prepare('SELECT 1 FROM users WHERE username = ?').get(username.trim());
  if (existing) return res.status(409).json({ error: 'That username is already taken' });

  const info = db.prepare(`
    INSERT INTO users (username, password_hash, name, role, employee_code, designation)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(username.trim(), bcrypt.hashSync(password, 10), name.trim(), role, employeeCode.trim(), designation.trim());

  logger.info(`admin#${req.user.sub} created user#${info.lastInsertRowid} ("${username}")`);

  const user = db.prepare(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ?`).get(info.lastInsertRowid);
  res.status(201).json(user);
});

// PATCH /api/users/:id/password  { password }
// Admin-triggered reset for a specific employee id — e.g. after a forgotten
// password. The employee isn't notified automatically; the admin is
// expected to hand the new password to them directly.
usersRouter.patch('/:id/password', (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'password must be at least 6 characters' });
  }

  const info = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .run(bcrypt.hashSync(password, 10), req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'User not found' });

  logger.info(`admin#${req.user.sub} reset password for user#${req.params.id}`);
  res.status(204).end();
});

usersRouter.delete('/:id', (req, res) => {
  if (Number(req.params.id) === req.user.sub) {
    return res.status(400).json({ error: "You can't remove your own account" });
  }

  const info = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'User not found' });

  logger.info(`admin#${req.user.sub} removed user#${req.params.id}`);
  res.status(204).end();
});
