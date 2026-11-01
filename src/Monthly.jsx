import { useEffect, useMemo, useState } from "react";

const TX_KEY = "money_planner_transactions";
const BUDGET_KEY = "money_planner_budgets";
const CURRENCY = "₱";

const NAV_ITEMS = [
  { key: "accounts", label: "Accounts Overview", ready: true },
  { key: "monthly", label: "Monthly Budget Progress", ready: true },
  { key: "savings", label: "Savings Goals Tracker", ready: true },
  { key: "calendar", label: "Upcoming Bills Calendar", ready: true },
];
const CURRENT_PAGE = "monthly";

const EXPENSE_CATEGORIES = ["Food", "Rent", "Utilities", "Entertainment", "Other"];

// Soft palette that fits the dark glass theme
const PIE_COLORS = [
  "#8ab4ff",
  "#ffc26b",
  "#ff8a8a",
  "#a8e6cf",
  "#c3a6ff",
  "#7fd6e8",
  "#f4a6d7",
  "#d4e08a",
];

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function load(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function money(n) {
  return `${n < 0 ? "−" : ""}${CURRENCY}${Math.abs(n).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function barState(pct) {
  if (pct >= 100) return "over";
  if (pct >= 80) return "warn";
  return "ok";
}

// Builds the SVG path for one pie slice (angles in radians, 0 = top, clockwise)
function slicePath(cx, cy, r, start, end) {
  const x1 = cx + r * Math.sin(start);
  const y1 = cy - r * Math.cos(start);
  const x2 = cx + r * Math.sin(end);
  const y2 = cy - r * Math.cos(end);
  const largeArc = end - start > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

function PieChart({ slices, total }) {
  const size = 220;
  const c = size / 2;
  const r = 100;
  let angle = 0;

  return (
    <svg
      className="mp-pie"
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Pie chart of spending by category"
    >
      {slices.length === 1 ? (
        <circle cx={c} cy={c} r={r} fill={slices[0].color} stroke="#0a0a0f" strokeWidth="2" />
      ) : (
        slices.map((s) => {
          const start = angle;
          const end = angle + (s.value / total) * Math.PI * 2;
          angle = end;
          return (
            <path
              key={s.name}
              d={slicePath(c, c, r, start, end)}
              fill={s.color}
              stroke="#0a0a0f"
              strokeWidth="2"
              strokeLinejoin="round"
            >
              <title>{`${s.name}: ${money(s.value)} (${Math.round((s.value / total) * 100)}%)`}</title>
            </path>
          );
        })
      )}
    </svg>
  );
}

export default function Monthly({ onNavigate }) {
  const [transactions] = useState(() => {
    const t = load(TX_KEY, []);
    return Array.isArray(t) ? t : [];
  });
  const [budgets, setBudgets] = useState(() => load(BUDGET_KEY, {}));
  const [month, setMonth] = useState(currentMonth);

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
      localStorage.setItem(BUDGET_KEY, JSON.stringify(budgets));
    } catch {
      /* storage unavailable: keep working in memory */
    }
  }, [budgets]);

  const data = useMemo(() => {
    const inMonth = transactions.filter((t) => t.date && t.date.slice(0, 7) === month);
    const income = inMonth.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const spentBy = {};
    inMonth
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        spentBy[t.category] = (spentBy[t.category] || 0) + t.amount;
      });
    const spent = Object.values(spentBy).reduce((s, n) => s + n, 0);
    const categories = [...new Set([...EXPENSE_CATEGORIES, ...Object.keys(spentBy)])];
    return { income, spent, spentBy, categories };
  }, [transactions, month]);

  const remaining = data.income - data.spent;
  const usedPct = data.income > 0 ? (data.spent / data.income) * 100 : 0;

  // Only categories with spending appear in the pie
  const slices = useMemo(
    () =>
      data.categories
        .map((name, i) => ({
          name,
          value: data.spentBy[name] || 0,
          color: PIE_COLORS[i % PIE_COLORS.length],
        }))
        .filter((s) => s.value > 0),
    [data]
  );

  function setBudget(cat, value) {
    const n = parseFloat(value);
    setBudgets((b) => {
      const next = { ...b };
      if (value === "" || !(n > 0)) delete next[cat];
      else next[cat] = n;
      return next;
    });
  }

  return (
    <div className="mp">
      <style>{css}</style>

      <div className="mp-wrap">
        <header className="mp-head">
          <h1>Money Planner</h1>
          <nav aria-label="Money Planner sections">
            {NAV_ITEMS.map((item) => {
              const isCurrent = item.key === CURRENT_PAGE;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`mp-nav ${isCurrent ? "mp-nav-on" : item.ready ? "mp-nav-link" : "mp-nav-off"}`}
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

        <div className="mp-title-row">
          <h2>Monthly budget progress</h2>
          <label className="mp-month">
            Month
            <input
              type="month"
              value={month}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
            />
          </label>
        </div>

        <section className="mp-summary" aria-label="Month summary">
          <div className="mp-glass mp-stat">
            <span className="mp-stat-label">Income</span>
            <strong className="mp-in">{money(data.income)}</strong>
          </div>
          <div className="mp-glass mp-stat">
            <span className="mp-stat-label">Spent</span>
            <strong className="mp-out">{money(data.spent)}</strong>
          </div>
          <div className="mp-glass mp-stat mp-stat-main">
            <span className="mp-stat-label">Remaining</span>
            <strong className={remaining < 0 ? "mp-out" : ""}>{money(remaining)}</strong>
          </div>
        </section>

        <section className="mp-glass mp-card" aria-labelledby="overall-title">
          <div className="mp-row">
            <h3 id="overall-title">Income used</h3>
            <span className="mp-muted">
              {data.income > 0 ? `${Math.round(usedPct)}%` : "No income this month"}
            </span>
          </div>
          <div className="mp-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(usedPct))} aria-label="Share of income spent">
            <div
              className={`mp-fill mp-${barState(usedPct)}`}
              style={{ width: `${Math.min(100, usedPct)}%` }}
            />
          </div>
          {data.income <= 0 && (
            <p className="mp-note">Add income for this month in Accounts Overview before adding expenses.</p>
          )}
        </section>

        <section className="mp-glass mp-card" aria-labelledby="pie-title">
          <h3 id="pie-title">Spending breakdown</h3>
          <p className="mp-muted mp-hint">Share of this month's total spending by category.</p>

          {slices.length > 0 ? (
            <div className="mp-pie-wrap">
              <PieChart slices={slices} total={data.spent} />
              <ul className="mp-legend">
                {slices.map((s) => (
                  <li key={s.name}>
                    <span className="mp-dot" style={{ background: s.color }} aria-hidden="true" />
                    <span className="mp-legend-name">{s.name}</span>
                    <span className="mp-legend-val">
                      {money(s.value)} · {Math.round((s.value / data.spent) * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mp-muted">No spending recorded for this month yet.</p>
          )}
        </section>

        <section className="mp-glass mp-card" aria-labelledby="cat-title">
          <h3 id="cat-title">Spending by category</h3>
          <p className="mp-muted mp-hint">Set a monthly budget for any category to track it.</p>

          <ul className="mp-list">
            {data.categories.map((cat) => {
              const spent = data.spentBy[cat] || 0;
              const budget = budgets[cat] || 0;
              const pct = budget > 0 ? (spent / budget) * 100 : 0;
              return (
                <li key={cat} className="mp-cat">
                  <div className="mp-row">
                    <span className="mp-cat-name">{cat}</span>
                    <label className="mp-budget">
                      <span className="mp-muted">Budget ({CURRENCY})</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={budget || ""}
                        placeholder="Not set"
                        onChange={(e) => setBudget(cat, e.target.value)}
                      />
                    </label>
                  </div>

                  {budget > 0 ? (
                    <>
                      <div
                        className="mp-track"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.min(100, Math.round(pct))}
                        aria-label={`${cat} budget used`}
                      >
                        <div
                          className={`mp-fill mp-${barState(pct)}`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <div className="mp-row mp-small">
                        <span>
                          {money(spent)} of {money(budget)} ({Math.round(pct)}%)
                        </span>
                        <span className={spent > budget ? "mp-out" : "mp-muted"}>
                          {spent > budget
                            ? `${money(spent - budget)} over`
                            : `${money(budget - spent)} left`}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="mp-small mp-muted">{money(spent)} spent</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}

const css = `
.mp {
  --bg: #0a0a0f;
  --glass: rgba(255, 255, 255, 0.05);
  --glass-edge: rgba(255, 255, 255, 0.12);
  --text: #ececf1;
  --muted: #9a9aa8;
  --accent: #8ab4ff;
  --amber: #ffc26b;
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
.mp *, .mp *::before, .mp *::after { box-sizing: border-box; }
.mp-wrap { max-width: 860px; margin: 0 auto; padding: 32px 20px 56px; }

.mp-head h1 { margin: 0 0 16px; font-size: 1.9rem; font-weight: 700; letter-spacing: -0.01em; }
.mp-head nav { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 28px; }
.mp-nav { padding: 8px 14px; border-radius: 999px; font: inherit; font-size: 0.9rem; border: 1px solid transparent; background: transparent; color: var(--text); cursor: pointer; }
.mp-nav-link:hover { background: var(--glass); border-color: var(--glass-edge); }
.mp-nav:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.mp-nav-on { background: var(--glass); border-color: var(--glass-edge); color: var(--accent); font-weight: 600; }
.mp-nav-off { color: var(--muted); opacity: 0.55; cursor: not-allowed; }

.mp-title-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
.mp-title-row h2 { margin: 0; font-size: 1.3rem; font-weight: 600; }
.mp-month { display: flex; flex-direction: column; gap: 6px; font-size: 0.85rem; color: var(--muted); }


.mp input {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--glass-edge);
  background: rgba(0, 0, 0, 0.35);
  color: var(--text);
  font: inherit;
  color-scheme: dark;
}
.mp input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.mp-glass {
  background: var(--glass);
  border: 1px solid var(--glass-edge);
  border-radius: 18px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 12px 40px rgba(0, 0, 0, 0.35);
}

.mp-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px; }
.mp-stat { padding: 20px 22px; display: flex; flex-direction: column; gap: 8px; }
.mp-stat-label { color: var(--muted); font-size: 0.9rem; }
.mp-stat strong { font-size: 1.5rem; font-variant-numeric: tabular-nums; }
.mp-stat-main { background: linear-gradient(160deg, rgba(138, 180, 255, 0.14), var(--glass)); }
.mp-stat-main strong { font-size: 1.9rem; color: var(--accent); }
.mp-stat-main strong.mp-out { color: var(--red); }
.mp-in { color: var(--accent); }
.mp-out { color: var(--red); }
.mp-muted { color: var(--muted); }

.mp-card { padding: 22px; margin-bottom: 20px; }
.mp-card h3 { margin: 0; font-size: 1.1rem; font-weight: 600; }
.mp-hint { margin: 6px 0 18px; font-size: 0.88rem; }
.mp-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.mp-small { font-size: 0.85rem; margin-top: 8px; font-variant-numeric: tabular-nums; }
.mp-note { margin: 14px 0 0; padding: 10px 12px; border-radius: 10px; font-size: 0.88rem; color: var(--amber); background: rgba(255, 194, 107, 0.08); border: 1px solid rgba(255, 194, 107, 0.25); }

.mp-track { height: 10px; margin-top: 14px; border-radius: 999px; background: rgba(255, 255, 255, 0.08); overflow: hidden; }
.mp-fill { height: 100%; border-radius: 999px; transition: width 0.3s ease; }
.mp-ok { background: linear-gradient(90deg, #a9c8ff, #7aa5f5); }
.mp-warn { background: linear-gradient(90deg, #ffd89a, #ffc26b); }
.mp-over { background: linear-gradient(90deg, #ffb0b0, #ff8a8a); }

.mp-pie-wrap { display: flex; align-items: center; gap: 32px; flex-wrap: wrap; }
.mp-pie { width: 220px; height: 220px; flex-shrink: 0; filter: drop-shadow(0 8px 24px rgba(0, 0, 0, 0.4)); }
.mp-legend { list-style: none; margin: 0; padding: 0; flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 12px; }
.mp-legend li { display: flex; align-items: center; gap: 10px; font-size: 0.92rem; }
.mp-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
.mp-legend-name { font-weight: 600; }
.mp-legend-val { margin-left: auto; color: var(--muted); font-variant-numeric: tabular-nums; }

.mp-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.mp-cat { padding: 16px 0; border-top: 1px solid rgba(255, 255, 255, 0.07); }
.mp-cat:first-child { border-top: 0; padding-top: 0; }
.mp-cat-name { font-weight: 600; }
.mp-budget { display: flex; align-items: center; gap: 10px; font-size: 0.85rem; }
.mp-budget input { width: 130px; padding: 8px 10px; }

@media (max-width: 700px) {
  .mp-summary { grid-template-columns: 1fr; }
  .mp-pie-wrap { justify-content: center; }
}
`;