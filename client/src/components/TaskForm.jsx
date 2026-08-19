import { useState } from 'react';

export function TaskForm({ onCreate, employees, currentUserId }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignee, setAssignee] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await onCreate({ title, description, assignee, ownerId: ownerId || undefined });
      setTitle('');
      setDescription('');
      setAssignee('');
      setOwnerId('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <input
        placeholder="Task title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <input
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <input
        placeholder="Assignee"
        value={assignee}
        onChange={(e) => setAssignee(e.target.value)}
      />
      {employees && (
        <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
          <option value="">For: myself</option>
          {employees.filter((e) => e.id !== currentUserId).map((e) => (
            <option key={e.id} value={e.id}>For: {e.name}</option>
          ))}
        </select>
      )}
      <button type="submit" disabled={submitting}>
        {submitting ? 'Adding…' : 'Add task'}
      </button>
    </form>
  );
}
