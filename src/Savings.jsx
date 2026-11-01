import { useEffect, useMemo, useState } from "react";

const SAVINGS_KEY = "money_planner_savings";
const CURRENCY = "₱";

const NAV_ITEMS = [
  { key: "accounts", label: "Accounts Overview", ready: true },
  { key: "monthly", label: "Monthly Budget Progress", ready: true },
  { key: "savings", label: "Savings Goals Tracker", ready: true },
  { key: "calendar", label: "Upcoming Bills Calendar", ready: true },
];
const CURRENT_PAGE = "savings";

function loadGoals() {
  try {
    const v = JSON.parse(localStorage.getItem(SAVINGS_KEY));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function money(n) {
  return `${CURRENCY}${n.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Whole months from today until the deadline (at least 1 while it is still ahead)
function monthsLeft(deadline) {
  if (!deadline) return null;
  const [y, m, d] = deadline.split("-").map(Number);
  const now = new Date();
  const end = new Date(y, m - 1, d);
  if (end < new Date(now.getFullYear(), now.getMonth(), now.getDate())) return 0;
  const months = (y - now.getFullYear()) * 12 + (m - 1 - now.getMonth());
  return Math.max(1, months);
}

export default function Savings({ onNavigate }) {
  const [goals, setGoals] = useState(loadGoals);
  const [form, setForm] = useState({ name: "", target: "", saved: "", deadline: "" });
  const [adding, setAdding] = useState({}); // goal id -> amount being added

  // Dark background for this page only; restored when you leave it
  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = "#0a0a0f";
    document.body.style.margin = "0";
    return () => {
      document.body.style.background = prev;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SAVINGS_KEY, JSON.stringify(goals));
    } catch {
      /* storage unavailable: keep working in memory */
    }
  }, [goals]);

  const totals = useMemo(() => {
    const saved = goals.reduce((s, g) => s + g.saved, 0);
    const target = goals.reduce((s, g) => s + g.target, 0);
    const done = goals.filter((g) => g.saved >= g.target).length;
    return { saved, target, done };
  }, [goals]);

  function handleAddGoal(e) {
    e.preventDefault();
    const target = parseFloat(form.target);
    const saved = parseFloat(form.saved) || 0;
    if (!form.name.trim() || !(target > 0) || saved < 0) return;
    setGoals((list) => [
      ...list,
      {
        id: Date.now(),
        name: form.name.trim(),
        target,
        saved,
        deadline: form.deadline || "",
      },
    ]);
    setForm({ name: "", target: "", saved: "", deadline: "" });
  }

  function handleContribute(id) {
    const amount = parseFloat(adding[id]);
    if (!(amount > 0)) return;
    setGoals((list) => list.map((g) => (g.id === id ? { ...g, saved: g.saved + amount } : g)));
    setAdding((a) => ({ ...a, [id]: "" }));
  }

  function handleDelete(id) {
    setGoals((list) => list.filter((g) => g.id !== id));
  }

  return (
    <div className="sg">
      <style>{css}</style>

      <div className="sg-wrap">
        <header className="sg-head">
          <h1>Money Planner</h1>
          <nav aria-label="Money Planner sections">
            {NAV_ITEMS.map((item) => {
              const isCurrent = item.key === CURRENT_PAGE;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`sg-nav ${isCurrent ? "sg-nav-on" : item.ready ? "sg-nav-link" : "sg-nav-off"}`}
                  aria-current={isCurrent ? "page" : undefined}
                  disabled={!item.ready}
                  title={item.ready ? undefined : "Coming soon"}
                  onClick={() => onNavigate && onNavigate(item.key)}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </header>

        <h2 className="sg-title">Savings goals tracker</h2>

        <section className="sg-summary" aria-label="Savings summary">
          <div className="sg-glass sg-stat">
            <span className="sg-stat-label">Total saved</span>
            <strong className="sg-in">{money(totals.saved)}</strong>
          </div>
          <div className="sg-glass sg-stat">
            <span className="sg-stat-label">Total of all targets</span>
            <strong>{money(totals.target)}</strong>
          </div>
          <div className="sg-glass sg-stat sg-stat-main">
            <span className="sg-stat-label">Goals reached</span>
            <strong>
              {totals.done} of {goals.length}
            </strong>
          </div>
        </section>

        <div className="sg-grid">
          <section className="sg-glass sg-card" aria-labelledby="new-goal-title">
            <h3 id="new-goal-title">New goal</h3>
            <form onSubmit={handleAddGoal}>
              <label>
                Goal name
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </label>
              <label>
                Target amount ({CURRENCY})
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.target}
                  onChange={(e) => setForm({ ...form, target: e.target.value })}
                  required
                />
              </label>
              <label>
                Already saved ({CURRENCY}), optional
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.saved}
                  onChange={(e) => setForm({ ...form, saved: e.target.value })}
                />
              </label>
              <label>
                Target date, optional
                <input
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                />
              </label>
              <button type="submit" className="sg-submit">
                Add goal
              </button>
            </form>
          </section>

          <section aria-label="Your goals">
            {goals.length === 0 ? (
              <div className="sg-glass sg-card">
                <p className="sg-muted sg-empty">No goals yet. Add your first one to start tracking.</p>
              </div>
            ) : (
              <ul className="sg-list">
                {goals.map((g) => {
                  const pct = Math.min(100, (g.saved / g.target) * 100);
                  const reached = g.saved >= g.target;
                  const left = Math.max(0, g.target - g.saved);
                  const months = monthsLeft(g.deadline);
                  let hint = "";
                  if (reached) hint = "Goal reached";
                  else if (months === 0) hint = "Target date has passed";
                  else if (months) hint = `Save about ${money(left / months)} per month to reach it by ${g.deadline}`;

                  return (
                    <li key={g.id} className="sg-glass sg-card sg-goal">
                      <div className="sg-row">
                        <h3>{g.name}</h3>
                        <button
                          type="button"
                          className="sg-del"
                          onClick={() => handleDelete(g.id)}
                          aria-label={`Delete goal ${g.name}`}
                        >
                          Delete
                        </button>
                      </div>

                      <div
                        className="sg-track"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(pct)}
                        aria-label={`${g.name} progress`}
                      >
                        <div className={`sg-fill ${reached ? "sg-done" : ""}`} style={{ width: `${pct}%` }} />
                      </div>

                      <div className="sg-row sg-small">
                        <span>
                          {money(g.saved)} of {money(g.target)} ({Math.round(pct)}%)
                        </span>
                        <span className="sg-muted">{reached ? "Complete" : `${money(left)} to go`}</span>
                      </div>
                      {hint && <p className={`sg-hint ${reached ? "sg-in" : "sg-muted"}`}>{hint}</p>}

                      <div className="sg-add">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="Amount to add"
                          aria-label={`Amount to add to ${g.name}`}
                          value={adding[g.id] || ""}
                          onChange={(e) => setAdding({ ...adding, [g.id]: e.target.value })}
                          onKeyDown={(e) => e.key === "Enter" && handleContribute(g.id)}
                        />
                        <button type="button" className="sg-add-btn" onClick={() => handleContribute(g.id)}>
                          Add savings
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

const css = `
.sg {
  --bg: #0a0a0f;
  --glass: rgba(255, 255, 255, 0.05);
  --glass-edge: rgba(255, 255, 255, 0.12);
  --text: #ececf1;
  --muted: #9a9aa8;
  --accent: #8ab4ff;
  --red: #ff8a8a;

  min-height: 100vh;
  width: 100%;
  box-sizing: border-box;
  color: var(--text);
  font-family: "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif;
  background:
    radial-gradient(900px 500px at 15% -10%, rgba(255, 255, 255, 0.06), transparent 60%),
    radial-gradient(700px 480px at 100% 10%, rgba(138, 180, 255, 0.08), transparent 60%),
    var(--bg);
  text-align: left;
}
.sg *, .sg *::before, .sg *::after { box-sizing: border-box; }
.sg-wrap { max-width: 1080px; margin: 0 auto; padding: 32px 20px 56px; }

.sg-head h1 { margin: 0 0 16px; font-size: 1.9rem; font-weight: 700; letter-spacing: -0.01em; }
.sg-head nav { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 28px; }
.sg-nav { padding: 8px 14px; border-radius: 999px; font: inherit; font-size: 0.9rem; border: 1px solid transparent; background: transparent; color: var(--text); cursor: pointer; }
.sg-nav-link:hover { background: var(--glass); border-color: var(--glass-edge); }
.sg-nav:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.sg-nav-on { background: var(--glass); border-color: var(--glass-edge); color: var(--accent); font-weight: 600; }
.sg-nav-off { color: var(--muted); opacity: 0.55; cursor: not-allowed; }

.sg-title { margin: 0 0 16px; font-size: 1.3rem; font-weight: 600; }

.sg-glass {
  background: var(--glass);
  border: 1px solid var(--glass-edge);
  border-radius: 18px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 12px 40px rgba(0, 0, 0, 0.35);
}

.sg-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px; }
.sg-stat { padding: 20px 22px; display: flex; flex-direction: column; gap: 8px; }
.sg-stat-label { color: var(--muted); font-size: 0.9rem; }
.sg-stat strong { font-size: 1.5rem; font-variant-numeric: tabular-nums; }
.sg-stat-main { background: linear-gradient(160deg, rgba(138, 180, 255, 0.14), var(--glass)); }
.sg-stat-main strong { font-size: 1.9rem; color: var(--accent); }
.sg-in { color: var(--accent); }
.sg-muted { color: var(--muted); }

.sg-grid { display: grid; grid-template-columns: 340px 1fr; gap: 20px; align-items: start; }
.sg-card { padding: 22px; }
.sg-card h3 { margin: 0; font-size: 1.1rem; font-weight: 600; }
.sg-empty { margin: 0; }

.sg form { display: flex; flex-direction: column; gap: 14px; margin-top: 16px; }
.sg label { display: flex; flex-direction: column; gap: 6px; font-size: 0.88rem; color: var(--muted); }
.sg input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--glass-edge);
  background: rgba(0, 0, 0, 0.35);
  color: var(--text);
  font: inherit;
  color-scheme: dark;
}
.sg input:focus-visible, .sg button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.sg-submit { padding: 12px; border: 0; border-radius: 12px; font: inherit; font-weight: 600; cursor: pointer; color: #071226; background: linear-gradient(180deg, #a9c8ff, #7aa5f5); }
.sg-submit:hover { filter: brightness(1.08); }

.sg-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 16px; }
.sg-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.sg-small { font-size: 0.85rem; margin-top: 10px; font-variant-numeric: tabular-nums; }
.sg-hint { margin: 8px 0 0; font-size: 0.85rem; }

.sg-track { height: 10px; margin-top: 14px; border-radius: 999px; background: rgba(255, 255, 255, 0.08); overflow: hidden; }
.sg-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #a9c8ff, #7aa5f5); transition: width 0.3s ease; }
.sg-done { background: linear-gradient(90deg, #d6e4ff, #a9c8ff); }

.sg-add { display: flex; gap: 8px; margin-top: 16px; }
.sg-add input { flex: 1; }
.sg-add-btn { padding: 0 16px; border-radius: 10px; border: 1px solid var(--glass-edge); background: var(--glass); color: var(--accent); font: inherit; font-weight: 600; cursor: pointer; white-space: nowrap; }
.sg-add-btn:hover { background: rgba(138, 180, 255, 0.14); }

.sg-del { padding: 6px 10px; border-radius: 8px; border: 1px solid rgba(255, 138, 138, 0.35); background: transparent; color: var(--red); font: inherit; font-size: 0.82rem; cursor: pointer; }
.sg-del:hover { background: rgba(255, 138, 138, 0.12); }

@media (max-width: 860px) {
  .sg-grid { grid-template-columns: 1fr; }
  .sg-summary { grid-template-columns: 1fr; }
}
`;