// In-memory cache with the same shape as an ioredis client (get/set/del),
// so swapping to real ElastiCache Redis later is a one-file change:
// replace this module's body with `new Redis(process.env.REDIS_URL)` and
// the call sites in routes/tasks.js don't change.

const store = new Map();
const DEFAULT_TTL_MS = 30_000;

function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

function set(key, value, ttlMs = DEFAULT_TTL_MS) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function del(key) {
  store.delete(key);
}

function delByPrefix(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export const cache = { get, set, del, delByPrefix };
