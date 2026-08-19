const STATUSES = ['todo', 'in-progress', 'done'];

export function TaskList({ tasks, onStatusChange, onDelete, onUpload, showOwner }) {
  if (tasks.length === 0) {
    return <p className="empty">No tasks yet — add one above.</p>;
  }

  return (
    <ul className="task-list">
      {tasks.map((task) => (
        <li key={task.id} className={`task-card status-${task.status}`}>
          <div className="task-main">
            <h3>{task.title}</h3>
            {task.description && <p>{task.description}</p>}
            <div className="task-meta">
              {showOwner && task.owner_name && <span className="pill owner">{task.owner_name}</span>}
              {task.assignee && <span className="pill">{task.assignee}</span>}
              <select value={task.status} onChange={(e) => onStatusChange(task.id, e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="task-attachment">
              {task.attachmentUrl ? (
                <a href={task.attachmentUrl} target="_blank" rel="noreferrer">
                  📎 {task.attachment_name}
                </a>
              ) : task.attachment_name ? (
                <span className="pill muted">📎 {task.attachment_name} (local mode — no S3 configured)</span>
              ) : (
                <label className="upload-label">
                  📎 Attach file
                  <input
                    type="file"
                    hidden
                    onChange={(e) => e.target.files[0] && onUpload(task.id, e.target.files[0])}
                  />
                </label>
              )}
            </div>
          </div>
          <button className="delete-btn" onClick={() => onDelete(task.id)} aria-label="Delete task">
            ✕
          </button>
        </li>
      ))}
    </ul>
  );
}
