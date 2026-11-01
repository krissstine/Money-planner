import { useEffect, useMemo, useState } from "react";

const BILLS_KEY = "money_planner_bills";
const CURRENCY = "₱";

const NAV_ITEMS = [
  { key: "accounts", label: "Accounts Overview", ready: true },
  { key: "monthly", label: "Monthly Budget Progress", ready: true },
  { key: "savings", label: "Savings Goals Tracker", ready: true },
  { key: "calendar", label: "Upcoming Bills Calendar", ready: true },
];
const CURRENT_PAGE = "calendar";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const pad = (n) => String(n).padStart(2, "0");
const monthKey = (y, m) => `${y}-${pad(m + 1)}`;
const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function loadBills() {
  try {
    const v = JSON.parse(localStorage.getItem(BILLS_KEY));
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

export default function Calendar({ onNavigate }) {
  const now = new Date();
  const [bills, setBills] = useState(loadBills);
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [form, setForm] = useState({ name: "", amount: "", date: todayLocal(), repeats: false });

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
      localStorage.setItem(BILLS_KEY, JSON.stringify(bills));
    } catch {
      /* storage unavailable: keep working in memory */
    }
  }, [bills]);

  const key = monthKey(view.y, view.m);
  const dim = daysInMonth(view.y, view.m);
  const today = todayLocal();

  // Every bill that falls in the month being viewed
  const items = useMemo(() => {
    const out = [];
    bills.forEach((b) => {
      const startMonth = b.date.slice(0, 7);
      const startDay = Number(b.date.slice(8, 10));
      let day = null;
      if (!b.repeats && startMonth === key) day = startDay;
      if (b.repeats && key >= startMonth) day = Math.min(startDay, dim);
      if (day) {
        out.push({
          bill: b,
          day,
          date: `${key}-${pad(day)}`,
          paid: Boolean(b.paid && b.paid[key]),
        });
      }
    });
    return out.sort((a, b) => a.day - b.day);
  }, [bills, key, dim]);

  const totals = useMemo(() => {
    const due = items.reduce((s, i) => s + i.bill.amount, 0);
    const paid = items.filter((i) => i.paid).reduce((s, i) => s + i.bill.amount, 0);
    return { due, paid, unpaid: due - paid };
  }, [items]);

  const byDay = useMemo(() => {
    const map = {};
    items.forEach((i) => (map[i.day] = [...(map[i.day] || []), i]));
    return map;
  }, [items]);

  const leading = new Date(view.y, view.m, 1).getDay();
  const cells = [...Array(leading).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)];

  function shiftMonth(delta) {
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  function handleAdd(e) {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!form.name.trim() || !(amount > 0) || !form.date) return;
    setBills((list) => [
      ...list,
      {
        id: Date.now(),
        name: form.name.trim(),
        amount,
        date: form.date,
        repeats: form.repeats,
        paid: {},
      },
    ]);
    // Jump to the month of the bill just added
    setView({ y: Number(form.date.slice(0, 4)), m: Number(form.date.slice(5, 7)) - 1 });
    setForm({ name: "", amount: "", date: form.date, repeats: false });
  }

  function togglePaid(id) {
    setBills((list) =>
      list.map((b) => (b.id === id ? { ...b, paid: { ...b.paid, [key]: !(b.paid && b.paid[key]) } } : b))
    );
  }

  function handleDelete(id) {
    setBills((list) => list.filter((b) => b.id !== id));
  }

  return (
    <div className="cl">
      <style>{css}</style>

      <div className="cl-wrap">
        <header className="cl-head">
          <h1>Money Planner</h1>
          <nav aria-label="Money Planner sections">
            {NAV_ITEMS.map((item) => {
              const isCurrent = item.key === CURRENT_PAGE;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`cl-nav ${isCurrent ? "cl-nav-on" : item.ready ? "cl-nav-link" : "cl-nav-off"}`}
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

        <div className="cl-title-row">
          <h2>Upcoming bills calendar</h2>
          <div className="cl-month-nav">
            <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month">
              ‹
            </button>
            <span aria-live="polite">
              {MONTH_NAMES[view.m]} {view.y}
            </span>
            <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month">
              ›
            </button>
          </div>
        </div>

        <section className="cl-summary" aria-label="Bills summary">
          <div className="cl-glass cl-stat">
            <span className="cl-stat-label">Due this month</span>
            <strong>{money(totals.due)}</strong>
          </div>
          <div className="cl-glass cl-stat">
            <span className="cl-stat-label">Paid</span>
            <strong className="cl-in">{money(totals.paid)}</strong>
          </div>
          <div className="cl-glass cl-stat cl-stat-main">
            <span className="cl-stat-label">Still to pay</span>
            <strong>{money(totals.unpaid)}</strong>
          </div>
        </section>

        <section className="cl-glass cl-card" aria-label="Calendar">
          <div className="cl-cal">
            {WEEKDAYS.map((d) => (
              <div key={d} className="cl-wd">
                {d}
              </div>
            ))}
            {cells.map((day, i) => {
              if (!day) return <div key={`b${i}`} className="cl-cell cl-blank" />;
              const date = `${key}-${pad(day)}`;
              const list = byDay[day] || [];
              return (
                <div key={day} className={`cl-cell ${date === today ? "cl-today" : ""}`}>
                  <span className="cl-day">{day}</span>
                  {list.map((i) => (
                    <span
                      key={i.bill.id}
                      className={`cl-chip ${i.paid ? "cl-chip-paid" : i.date < today ? "cl-chip-late" : ""}`}
                      title={`${i.bill.name} ${money(i.bill.amount)}`}
                    >
                      {i.bill.name}
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
        </section>

        <div className="cl-grid">
          <section className="cl-glass cl-card" aria-labelledby="new-bill-title">
            <h3 id="new-bill-title">Add a bill</h3>
            <form onSubmit={handleAdd}>
              <label>
                Bill name
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </label>
              <label>
                Amount ({CURRENCY})
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  required
                />
              </label>
              <label>
                Due date
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
              </label>
              <label className="cl-check">
                <input
                  type="checkbox"
                  checked={form.repeats}
                  onChange={(e) => setForm({ ...form, repeats: e.target.checked })}
                />
                Repeats every month
              </label>
              <button type="submit" className="cl-submit">
                Add bill
              </button>
            </form>
          </section>

          <section className="cl-glass cl-card" aria-labelledby="list-title">
            <h3 id="list-title">
              Bills in {MONTH_NAMES[view.m]}
            </h3>
            {items.length === 0 ? (
              <p className="cl-muted cl-empty">No bills this month.</p>
            ) : (
              <ul className="cl-list">
                {items.map((i) => {
                  const late = !i.paid && i.date < today;
                  return (
                    <li key={i.bill.id} className="cl-item">
                      <input
                        type="checkbox"
                        checked={i.paid}
                        onChange={() => togglePaid(i.bill.id)}
                        aria-label={`Mark ${i.bill.name} as paid`}
                      />
                      <div className="cl-item-main">
                        <span className={i.paid ? "cl-struck" : ""}>{i.bill.name}</span>
                        <span className={`cl-small ${late ? "cl-out" : "cl-muted"}`}>
                          {MONTH_NAMES[view.m].slice(0, 3)} {i.day}
                          {i.bill.repeats ? " · monthly" : ""}
                          {late ? " · overdue" : ""}
                          {i.paid ? " · paid" : ""}
                        </span>
                      </div>
                      <strong className="cl-amt">{money(i.bill.amount)}</strong>
                      <button
                        type="button"
                        className="cl-del"
                        onClick={() => handleDelete(i.bill.id)}
                        aria-label={`Delete ${i.bill.name}`}
                      >
                        Delete
                      </button>
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
.cl {
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
.cl *, .cl *::before, .cl *::after { box-sizing: border-box; }
.cl-wrap { max-width: 1080px; margin: 0 auto; padding: 32px 20px 56px; }

.cl-head h1 { margin: 0 0 16px; font-size: 1.9rem; font-weight: 700; letter-spacing: -0.01em; }
.cl-head nav { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 28px; }
.cl-nav { padding: 8px 14px; border-radius: 999px; font: inherit; font-size: 0.9rem; border: 1px solid transparent; background: transparent; color: var(--text); cursor: pointer; }
.cl-nav-link:hover { background: var(--glass); border-color: var(--glass-edge); }
.cl-nav:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.cl-nav-on { background: var(--glass); border-color: var(--glass-edge); color: var(--accent); font-weight: 600; }
.cl-nav-off { color: var(--muted); opacity: 0.55; cursor: not-allowed; }

.cl-title-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
.cl-title-row h2 { margin: 0; font-size: 1.3rem; font-weight: 600; }
.cl-month-nav { display: flex; align-items: center; gap: 12px; font-weight: 600; }
.cl-month-nav span { min-width: 150px; text-align: center; }
.cl-month-nav button { width: 36px; height: 36px; border-radius: 10px; border: 1px solid var(--glass-edge); background: var(--glass); color: var(--text); font-size: 1.2rem; cursor: pointer; }
.cl-month-nav button:hover { background: rgba(138, 180, 255, 0.14); }

.cl-glass {
  background: var(--glass);
  border: 1px solid var(--glass-edge);
  border-radius: 18px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 12px 40px rgba(0, 0, 0, 0.35);
}

.cl-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px; }
.cl-stat { padding: 20px 22px; display: flex; flex-direction: column; gap: 8px; }
.cl-stat-label { color: var(--muted); font-size: 0.9rem; }
.cl-stat strong { font-size: 1.5rem; font-variant-numeric: tabular-nums; }
.cl-stat-main { background: linear-gradient(160deg, rgba(138, 180, 255, 0.14), var(--glass)); }
.cl-stat-main strong { font-size: 1.9rem; color: var(--accent); }
.cl-in { color: var(--accent); }
.cl-out { color: var(--red); }
.cl-muted { color: var(--muted); }

.cl-card { padding: 22px; margin-bottom: 20px; }
.cl-card h3 { margin: 0 0 16px; font-size: 1.1rem; font-weight: 600; }
.cl-empty { margin: 0; }

.cl-cal { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
.cl-wd { text-align: center; color: var(--muted); font-size: 0.82rem; padding-bottom: 4px; }
.cl-cell { min-height: 84px; padding: 6px; border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.07); background: rgba(0, 0, 0, 0.25); display: flex; flex-direction: column; gap: 4px; overflow: hidden; }
.cl-blank { background: transparent; border-color: transparent; }
.cl-today { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent) inset; }
.cl-day { font-size: 0.8rem; color: var(--muted); }
.cl-today .cl-day { color: var(--accent); font-weight: 700; }
.cl-chip { font-size: 0.72rem; padding: 2px 6px; border-radius: 6px; background: rgba(138, 180, 255, 0.18); color: var(--accent); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cl-chip-paid { background: rgba(255, 255, 255, 0.08); color: var(--muted); text-decoration: line-through; }
.cl-chip-late { background: rgba(255, 138, 138, 0.18); color: var(--red); }

.cl-grid { display: grid; grid-template-columns: 340px 1fr; gap: 20px; align-items: start; }
.cl-grid .cl-card { margin-bottom: 0; }

.cl form { display: flex; flex-direction: column; gap: 14px; }
.cl label { display: flex; flex-direction: column; gap: 6px; font-size: 0.88rem; color: var(--muted); }
.cl input[type="text"], .cl input[type="number"], .cl input[type="date"] {
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--glass-edge);
  background: rgba(0, 0, 0, 0.35);
  color: var(--text);
  font: inherit;
  color-scheme: dark;
}
.cl .cl-check { flex-direction: row; align-items: center; gap: 10px; }
.cl input[type="checkbox"] { width: 18px; height: 18px; accent-color: #8ab4ff; cursor: pointer; flex-shrink: 0; }
.cl input:focus-visible, .cl button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.cl-submit { padding: 12px; border: 0; border-radius: 12px; font: inherit; font-weight: 600; cursor: pointer; color: #071226; background: linear-gradient(180deg, #a9c8ff, #7aa5f5); }
.cl-submit:hover { filter: brightness(1.08); }

.cl-list { list-style: none; margin: 0; padding: 0; }
.cl-item { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-top: 1px solid rgba(255, 255, 255, 0.07); }
.cl-item:first-child { border-top: 0; padding-top: 0; }
.cl-item-main { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.cl-small { font-size: 0.8rem; }
.cl-struck { text-decoration: line-through; color: var(--muted); }
.cl-amt { font-variant-numeric: tabular-nums; white-space: nowrap; }

.cl-del { padding: 6px 10px; border-radius: 8px; border: 1px solid rgba(255, 138, 138, 0.35); background: transparent; color: var(--red); font: inherit; font-size: 0.82rem; cursor: pointer; }
.cl-del:hover { background: rgba(255, 138, 138, 0.12); }

@media (max-width: 860px) {
  .cl-grid { grid-template-columns: 1fr; }
  .cl-summary { grid-template-columns: 1fr; }
  .cl-cell { min-height: 64px; padding: 4px; }
  .cl-chip { font-size: 0.65rem; padding: 1px 4px; }
}
`;