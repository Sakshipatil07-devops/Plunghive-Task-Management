import { Router } from 'express';
import { db } from '../db/db.js';
import { cache } from '../services/cache.js';
import { s3 } from '../services/s3.js';
import { sns } from '../services/sns.js';
import { logger } from '../services/cloudwatch.js';

export const tasksRouter = Router();

const LIST_CACHE_PREFIX = 'tasks:list:';

async function serialize(task) {
  return {
    ...task,
    attachmentUrl: task.attachment_key ? await s3.createDownloadUrl(task.attachment_key) : null,
  };
}

// Employees only ever see their own tasks. Admins (the PluginHive account
// managing everyone) can see and act on any employee's tasks — that's the
// one exception to the per-user scoping below.
function isAdmin(req) {
  return req.user.role === 'admin';
}

function findOwnedTask(req, id) {
  if (isAdmin(req)) {
    return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  }
  return db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(id, req.user.sub);
}

// GET /api/tasks?q=search+term&ownerId=3
// Employees: always their own tasks. Admins: everyone's tasks by default,
// or one employee's via ?ownerId= (used by the "viewing" filter in the UI).
tasksRouter.get('/', async (req, res) => {
  const q = (req.query.q ?? '').trim();
  const ownerId = isAdmin(req) ? (req.query.ownerId || null) : String(req.user.sub);
  const cacheKey = `${LIST_CACHE_PREFIX}${ownerId ?? 'all'}:${q}`;

  const cached = cache.get(cacheKey);
  if (cached) {
    res.set('X-Cache', 'HIT');
    return res.json(cached);
  }

  const ownerFilter = ownerId ? 'AND tasks.user_id = ?' : '';
  const ownerParams = ownerId ? [ownerId] : [];

  let rows;
  if (q) {
    rows = db.prepare(`
      SELECT tasks.*, users.name AS owner_name, users.username AS owner_username
      FROM tasks_fts
      JOIN tasks ON tasks.id = tasks_fts.rowid
      JOIN users ON users.id = tasks.user_id
      WHERE tasks_fts MATCH ? ${ownerFilter}
      ORDER BY tasks.created_at DESC
    `).all(`${q}*`, ...ownerParams);
  } else {
    rows = db.prepare(`
      SELECT tasks.*, users.name AS owner_name, users.username AS owner_username
      FROM tasks
      JOIN users ON users.id = tasks.user_id
      WHERE 1 = 1 ${ownerFilter}
      ORDER BY tasks.created_at DESC
    `).all(...ownerParams);
  }

  const result = await Promise.all(rows.map(serialize));
  cache.set(cacheKey, result);
  res.set('X-Cache', 'MISS');
  res.json(result);
});

tasksRouter.get('/:id', async (req, res) => {
  const task = findOwnedTask(req, req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(await serialize(task));
});

tasksRouter.post('/', async (req, res) => {
  const { title, description = '', status = 'todo', assignee = '', ownerId } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });

  // Admins can create a task directly on an employee's list; everyone else
  // can only create tasks for themselves.
  let taskOwnerId = req.user.sub;
  if (isAdmin(req) && ownerId) {
    const owner = db.prepare('SELECT id FROM users WHERE id = ?').get(ownerId);
    if (!owner) return res.status(400).json({ error: 'ownerId does not match a known user' });
    taskOwnerId = owner.id;
  }

  const info = db.prepare(`
    INSERT INTO tasks (title, description, status, assignee, user_id) VALUES (?, ?, ?, ?, ?)
  `).run(title.trim(), description, status, assignee, taskOwnerId);

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid);
  cache.delByPrefix(LIST_CACHE_PREFIX);
  await sns.publishTaskEvent('task.created', task);
  logger.info(`user#${req.user.sub} created task#${task.id} for user#${taskOwnerId} ("${task.title}")`);

  res.status(201).json(await serialize(task));
});

tasksRouter.put('/:id', async (req, res) => {
  const existing = findOwnedTask(req, req.params.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  const { title = null, description = null, status = null, assignee = null } = req.body;
  db.prepare(`
    UPDATE tasks SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      status = COALESCE(?, status),
      assignee = COALESCE(?, assignee),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(title, description, status, assignee, existing.id);

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(existing.id);
  cache.delByPrefix(LIST_CACHE_PREFIX);
  await sns.publishTaskEvent('task.updated', task);
  logger.info(`user#${req.user.sub} updated task#${task.id}`);

  res.json(await serialize(task));
});

tasksRouter.delete('/:id', async (req, res) => {
  const task = findOwnedTask(req, req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  if (task.attachment_key) await s3.deleteObject(task.attachment_key);
  db.prepare('DELETE FROM tasks WHERE id = ?').run(task.id);
  cache.delByPrefix(LIST_CACHE_PREFIX);
  await sns.publishTaskEvent('task.deleted', task);
  logger.info(`user#${req.user.sub} deleted task#${task.id}`);

  res.status(204).end();
});

// POST /api/tasks/:id/attachment-url  { fileName, contentType }
// Returns a presigned S3 PUT URL; the client uploads directly to S3, then
// calls PUT back on this API to record the key against the task.
tasksRouter.post('/:id/attachment-url', async (req, res) => {
  const task = findOwnedTask(req, req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const { fileName, contentType } = req.body;
  if (!fileName) return res.status(400).json({ error: 'fileName is required' });

  const key = `tasks/${task.id}/${Date.now()}-${fileName}`;
  const result = await s3.createUploadUrl(key, contentType);
  res.json({ ...result, fileName });
});

tasksRouter.put('/:id/attachment', async (req, res) => {
  const task = findOwnedTask(req, req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const { key, fileName } = req.body;
  db.prepare(`
    UPDATE tasks SET attachment_key = ?, attachment_name = ?, updated_at = datetime('now') WHERE id = ?
  `).run(key, fileName, task.id);

  cache.delByPrefix(LIST_CACHE_PREFIX);
  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id);
  res.json(await serialize(updated));
});
