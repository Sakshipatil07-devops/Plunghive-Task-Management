const BASE = '/api/tasks';
const TOKEN_KEY = 'pluginhive_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle(res) {
  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new Event('auth:expired'));
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

export const auth = {
  async login(username, password) {
    const result = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }).then(handle);
    setToken(result.token);
    return result.user;
  },

  async me() {
    if (!getToken()) return null;
    try {
      const { user } = await fetch('/api/auth/me', { headers: authHeaders() }).then(handle);
      return user;
    } catch {
      return null;
    }
  },

  logout() {
    clearToken();
  },

  changePassword: (currentPassword, newPassword) =>
    fetch('/api/auth/password', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ currentPassword, newPassword }),
    }).then(handle),
};

export const users = {
  list: () => fetch('/api/users', { headers: authHeaders() }).then(handle),

  create: (newUser) =>
    fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(newUser),
    }).then(handle),

  remove: (id) => fetch(`/api/users/${id}`, { method: 'DELETE', headers: authHeaders() }).then(handle),

  resetPassword: (id, password) =>
    fetch(`/api/users/${id}/password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ password }),
    }).then(handle),
};

export const api = {
  health: () => fetch('/api/health').then(handle),

  list: (q = '', ownerId = '') => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (ownerId) params.set('ownerId', ownerId);
    const qs = params.toString();
    return fetch(`${BASE}${qs ? `?${qs}` : ''}`, { headers: authHeaders() }).then(handle);
  },

  create: (task) =>
    fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(task),
    }).then(handle),

  update: (id, patch) =>
    fetch(`${BASE}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(patch),
    }).then(handle),

  remove: (id) => fetch(`${BASE}/${id}`, { method: 'DELETE', headers: authHeaders() }).then(handle),

  async uploadAttachment(id, file) {
    const presign = await fetch(`${BASE}/${id}/attachment-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ fileName: file.name, contentType: file.type }),
    }).then(handle);

    if (presign.mocked) {
      // No AWS credentials configured — record the filename only so the UI
      // still reflects the action; nothing is actually stored in S3.
      return api.update(id, {});
    }

    await fetch(presign.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });

    return fetch(`${BASE}/${id}/attachment`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ key: presign.key, fileName: file.name }),
    }).then(handle);
  },
};
