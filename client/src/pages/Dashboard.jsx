import { useEffect, useState, useCallback } from 'react';
import { api, users as usersApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import { StatsBar } from '../components/StatsBar';
import { TaskForm } from '../components/TaskForm';
import { TaskList } from '../components/TaskList';

export function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState(null);
  const [ownerFilter, setOwnerFilter] = useState('');
  const [query, setQuery] = useState('');
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async (q = query, owner = ownerFilter) => {
    try {
      setError(null);
      setTasks(await api.list(q, owner));
    } catch (err) {
      setError(err.message);
    }
  }, [query, ownerFilter]);

  useEffect(() => {
    load('', '');
    api.health().then(setHealth).catch(() => setHealth(null));
    if (isAdmin) usersApi.list().then(setEmployees).catch(() => setEmployees(null));
  }, []);

  useEffect(() => {
    const id = setTimeout(() => load(query, ownerFilter), 250);
    return () => clearTimeout(id);
  }, [query, ownerFilter, load]);

  async function handleCreate(task) {
    await api.create(task);
    await load();
  }

  async function handleStatusChange(id, status) {
    await api.update(id, { status });
    await load();
  }

  async function handleDelete(id) {
    await api.remove(id);
    await load();
  }

  async function handleUpload(id, file) {
    await api.uploadAttachment(id, file);
    await load();
  }

  return (
    <div className="app">
      <Navbar health={health} />

      <main>
        {isAdmin && employees && (
          <div className="owner-filter">
            <label>
              Viewing tasks for
              <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
                <option value="">Everyone at PluginHive</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}{e.id === user.id ? ' (you)' : ''}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        <StatsBar tasks={tasks} />

        <div className="panel">
          <TaskForm
            onCreate={handleCreate}
            employees={isAdmin ? employees : null}
            currentUserId={user?.id}
          />
        </div>

        <input
          className="search"
          placeholder="Search tasks (title, description, assignee)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {error && <p className="error">{error}</p>}

        <TaskList
          tasks={tasks}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
          onUpload={handleUpload}
          showOwner={isAdmin && !ownerFilter}
        />
      </main>
    </div>
  );
}
