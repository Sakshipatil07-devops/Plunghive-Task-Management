import { useEffect, useState } from 'react';
import { users as usersApi, api } from '../api';
import { Navbar } from '../components/Navbar';
import { useAuth } from '../context/AuthContext';

const emptyForm = { username: '', password: '', name: '', role: 'employee', employeeCode: '', designation: '' };

export function Employees() {
  const { user: currentUser } = useAuth();
  const [list, setList] = useState([]);
  const [health, setHealth] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [resetTargetId, setResetTargetId] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState(null);

  async function load() {
    setList(await usersApi.list());
  }

  useEffect(() => {
    load();
    api.health().then(setHealth).catch(() => setHealth(null));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      await usersApi.create(form);
      setSuccess(`Account created for "${form.username}" — they can sign in with the password you set.`);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(id) {
    if (!confirm('Remove this account? They will no longer be able to sign in.')) return;
    await usersApi.remove(id);
    await load();
  }

  function startReset(id) {
    setResetTargetId(id);
    setResetPassword('');
    setResetError(null);
  }

  async function submitReset(id) {
    if (resetPassword.length < 6) {
      setResetError('Password must be at least 6 characters');
      return;
    }
    try {
      await usersApi.resetPassword(id, resetPassword);
      setResetTargetId(null);
      setSuccess('Password reset — let the employee know their new password.');
    } catch (err) {
      setResetError(err.message);
    }
  }

  return (
    <div className="app">
      <Navbar health={health} />

      <main>
        <h2 className="page-title">Employees</h2>
        <p className="page-subtitle">
          Every account gets its own login and its own private task list — nobody can see a
          coworker's tasks, admins included.
        </p>

        <div className="panel">
          <form className="employee-form" onSubmit={handleSubmit}>
            <input
              placeholder="Full name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <input
              placeholder="Username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
            <input
              type="password"
              placeholder="Password (min 6 chars)"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
            <input
              placeholder="Employee code (e.g. PH-0012)"
              value={form.employeeCode}
              onChange={(e) => setForm({ ...form, employeeCode: e.target.value })}
            />
            <input
              placeholder="Designation (e.g. Software Engineer)"
              value={form.designation}
              onChange={(e) => setForm({ ...form, designation: e.target.value })}
            />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="employee">Employee</option>
              <option value="admin">Admin</option>
            </select>
            <button type="submit" disabled={submitting}>
              {submitting ? 'Adding…' : 'Add employee'}
            </button>
          </form>

          {error && <p className="error">{error}</p>}
          {success && <p className="success">{success}</p>}
        </div>

        <ul className="employee-list">
          {list.map((u) => (
            <li key={u.id} className="employee-card">
              <div className="employee-info">
                <div className="employee-headline">
                  <strong>{u.name}</strong>
                  <span className="pill role">{u.role}</span>
                  {u.employee_code && <span className="pill muted">{u.employee_code}</span>}
                </div>
                <div className="employee-username">
                  @{u.username}{u.designation ? ` · ${u.designation}` : ''}
                </div>

                {resetTargetId === u.id ? (
                  <div className="reset-form">
                    <input
                      type="password"
                      placeholder="New password (min 6 chars)"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      autoFocus
                    />
                    <button type="button" onClick={() => submitReset(u.id)}>Save</button>
                    <button type="button" className="ghost" onClick={() => setResetTargetId(null)}>Cancel</button>
                    {resetError && <p className="error">{resetError}</p>}
                  </div>
                ) : (
                  <button type="button" className="link-btn" onClick={() => startReset(u.id)}>
                    Reset password
                  </button>
                )}
              </div>

              {u.id !== currentUser.id && (
                <button className="delete-btn" onClick={() => handleRemove(u.id)} aria-label="Remove account">
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
