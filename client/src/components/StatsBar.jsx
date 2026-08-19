export function StatsBar({ tasks }) {
  const counts = {
    todo: tasks.filter((t) => t.status === 'todo').length,
    'in-progress': tasks.filter((t) => t.status === 'in-progress').length,
    done: tasks.filter((t) => t.status === 'done').length,
  };

  return (
    <div className="stats-bar">
      <div className="stat">
        <span className="stat-number">{tasks.length}</span>
        <span className="stat-label">Total</span>
      </div>
      <div className="stat todo">
        <span className="stat-number">{counts.todo}</span>
        <span className="stat-label">To do</span>
      </div>
      <div className="stat in-progress">
        <span className="stat-number">{counts['in-progress']}</span>
        <span className="stat-label">In progress</span>
      </div>
      <div className="stat done">
        <span className="stat-number">{counts.done}</span>
        <span className="stat-label">Done</span>
      </div>
    </div>
  );
}
