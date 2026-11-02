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

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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

const pad = (n) => String(n).padStart(2, "0");
// Rounds to centavos so sums like 0.1 + 0.2 compare correctly
const r2 = (n) => Math.round(n * 100) / 100;

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

// "2026-11" moved forward or back by whole months
function shiftMonth(key, delta) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

// The saved transactions as raw text. Comparing text lets the page notice any change cheaply.
function readRaw() {
  try {
    return localStorage.getItem(TX_KEY) || "[]";
  } catch {
    return "[]";
  }
}

function parseTx(raw) {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// Budgets are stored per month: { "2026-11": { Food: 5000, Rent: 8000 } }.
// An older flat format ({ Food: 5000 }) is moved into the current month.
function loadBudgets() {
  try {
    const raw = JSON.parse(localStorage.getItem(BUDGET_KEY));
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out = {};
    const legacy = {};
    Object.entries(raw).forEach(([k, v]) => {
      if (/^\d{4}-\d{2}$/.test(k) && v && typeof v === "object") out[k] = v;
      else if (typeof v === "number" && v > 0) legacy[k] = v;
    });
    if (Object.keys(legacy).length) {
      const cm = currentMonth();
      out[cm] = { ...legacy, ...(out[cm] || {}) };
    }
    return out;
  } catch {
    return {};
  }
}

function money(n) {
  return `${n < 0 ? "−" : ""}${CURRENCY}${Math.abs(n).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function barState(pct) {
  if (pct > 100) return "over";
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
        <circle cx={c} cy={c} r={r} fill={slices[0].color} stroke="#0a0a0f" strokeWidth="2">
          <title>{`${slices[0].name}: ${money(slices[0].value)} (100%)`}</title>
        </circle>
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

// Lets you type freely (e.g. "0.5") without the field resetting on every keystroke.
// A valid amount is saved as you type; clearing the field removes the budget.
function BudgetInput({ value, onCommit, label }) {
  const [text, setText] = useState(value ? String(value) : "");

  // Keep the field in step when the budget changes from outside (e.g. "Copy last month")
  useEffect(() => {
    setText(value ? String(value) : "");
  }, [value]);

  function handleChange(e) {
    const t = e.target.value;
    setText(t);
    const n = parseFloat(t);
    if (t.trim() === "") onCommit(null);
    else if (n > 0) onCommit(r2(n));
  }

  function handleBlur() {
    const n = parseFloat(text);
    if (!(n > 0)) {
      setText("");
      onCommit(null);
    }
  }

  return (
    <input
      type="number"
      min="0"
      step="0.01"
      inputMode="decimal"
      value={text}
      placeholder="Not set"
      aria-label={label}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
}

export default function Monthly({ onNavigate }) {
  const [txRaw, setTxRaw] = useState(readRaw);
  const transactions = useMemo(() => parseTx(txRaw), [txRaw]);
  const [budgets, setBudgets] = useState(loadBudgets);
  const [month, setMonth] = useState(currentMonth);

  // Full-screen dark page: clears the margins/padding around the app; restored when you leave
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById("root");
    const els = [html, body, root];
    const saved = els.map((el) => (el ? el.style.cssText : ""));

    html.style.background = "#0a0a0f";
    body.style.cssText +=
      "margin:0;padding:0;background:#0a0a0f;display:block;min-width:0;";
    if (root) {
      root.style.cssText +=
        "max-width:none;width:100%;margin:0;padding:0;text-align:left;";
    }

    return () => {
      els.forEach((el, i) => {
        if (el) el.style.cssText = saved[i];
      });
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(BUDGET_KEY, JSON.stringify(budgets));
    } catch {
      /* storage unavailable: keep working in memory */
    }
  }, [budgets]);

  // Keep Income, Spent and Remaining live. New transactions are picked up when they are saved
  // in another tab, when you return to this tab, and by a quick check every second, so it
  // also works when Accounts and this page are open in the same tab.
  // (If the saved text has not changed, React skips the update, so this costs almost nothing.)
  useEffect(() => {
    const reload = () => setTxRaw(readRaw());
    window.addEventListener("storage", reload);
    window.addEventListener("focus", reload);
    window.addEventListener("money-planner-update", reload);
    const timer = setInterval(reload, 1000);
    return () => {
      window.removeEventListener("storage", reload);
      window.removeEventListener("focus", reload);
      window.removeEventListener("money-planner-update", reload);
      clearInterval(timer);
    };
  }, []);

  const monthBudgets = budgets[month] || {};

  const data = useMemo(() => {
    const inMonth = transactions.filter(
      (t) => t && t.date && t.date.slice(0, 7) === month && Number.isFinite(t.amount)
    );
    const income = r2(inMonth.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0));
    const spentBy = {};
    inMonth
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        spentBy[t.category] = (spentBy[t.category] || 0) + t.amount;
      });
    Object.keys(spentBy).forEach((k) => (spentBy[k] = r2(spentBy[k])));
    const spent = r2(Object.values(spentBy).reduce((s, n) => s + n, 0));
    return { income, spent, spentBy };
  }, [transactions, month]);

  // Standard categories first, then any custom ones that have spending or a budget
  const categories = [
    ...new Set([
      ...EXPENSE_CATEGORIES,
      ...Object.keys(data.spentBy).sort(),
      ...Object.keys(monthBudgets).sort(),
    ]),
  ];

  const remaining = r2(data.income - data.spent);
  const usedPct = data.income > 0 ? (data.spent / data.income) * 100 : data.spent > 0 ? 100 : 0;
  const budgetedTotal = r2(Object.values(monthBudgets).reduce((s, n) => s + n, 0));
  // Budget still waiting to be spent (a category already over budget reserves nothing)
  const stillReserved = r2(
    categories.reduce(
      (s, c) => s + Math.max(0, (monthBudgets[c] || 0) - (data.spentBy[c] || 0)),
      0
    )
  );
  // Money left after expenses AND after the budgets still waiting to be spent
  const unassigned = r2(remaining - stillReserved);
  const overBudget = categories.filter(
    (c) => monthBudgets[c] > 0 && (data.spentBy[c] || 0) > monthBudgets[c]
  );

  // Only categories with spending appear in the pie. Colours stay fixed per category.
  const slices = categories
    .map((name, i) => ({
      name,
      value: data.spentBy[name] || 0,
      color: PIE_COLORS[i % PIE_COLORS.length],
    }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);

  const prevMonth = shiftMonth(month, -1);
  const canCopy = Object.keys(monthBudgets).length === 0 && Object.keys(budgets[prevMonth] || {}).length > 0;

  function setBudget(cat, amount) {
    setBudgets((b) => {
      const cur = { ...(b[month] || {}) };
      if (amount > 0) cur[cat] = amount;
      else delete cur[cat];
      const next = { ...b };
      if (Object.keys(cur).length) next[month] = cur;
      else delete next[month];
      return next;
    });
  }

  function copyPrevious() {
    setBudgets((b) => ({ ...b, [month]: { ...(b[prevMonth] || {}) } }));
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
          <div className="mp-month-nav">
            <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
              ‹
            </button>
            <span aria-live="polite">{monthLabel(month)}</span>
            <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">
              ›
            </button>
            {month !== currentMonth() && (
              <button type="button" className="mp-today" onClick={() => setMonth(currentMonth())}>
                This month
              </button>
            )}
          </div>
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

        {overBudget.length > 0 && (
          <p className="mp-note mp-note-red mp-gap" role="status">
            Over budget this month: {overBudget.join(", ")}.
          </p>
        )}

        <section className="mp-glass mp-card" aria-labelledby="overall-title">
          <div className="mp-row">
            <h3 id="overall-title">Income used</h3>
            <span className="mp-muted">
              {data.income > 0
                ? `${Math.round(usedPct)}%`
                : data.spent > 0
                ? "No income recorded"
                : "No income this month"}
            </span>
          </div>
          <div
            className="mp-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, Math.round(usedPct))}
            aria-label="Share of income spent"
          >
            <div
              className={`mp-fill mp-${barState(usedPct)}`}
              style={{ width: `${Math.min(100, usedPct)}%` }}
            />
          </div>
          {data.income <= 0 && (
            <p className="mp-note">Add income for this month in Accounts Overview before adding expenses.</p>
          )}
          {data.income > 0 && data.spent > data.income && (
            <p className="mp-note mp-note-red">
              You spent {money(data.spent - data.income)} more than you earned this month.
            </p>
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
          <div className="mp-row">
            <h3 id="cat-title">Spending by category</h3>
            {canCopy && (
              <button type="button" className="mp-copy" onClick={copyPrevious}>
                Copy {monthLabel(prevMonth)} budgets
              </button>
            )}
          </div>
          <p className="mp-muted mp-hint">
            Set a budget for {MONTH_NAMES[Number(month.slice(5, 7)) - 1]} in any category to track it. Budgets are
            saved per month.
          </p>

          {budgetedTotal > 0 && (
            <p className={`mp-plan ${unassigned < 0 ? "mp-out" : "mp-muted"}`}>
              Budgeted {money(budgetedTotal)}
              {data.income > 0
                ? unassigned >= 0
                  ? ` · ${money(unassigned)} of ${money(remaining)} remaining not assigned yet`
                  : ` · ${money(-unassigned)} more than what's remaining`
                : " · no income recorded for this month"}
            </p>
          )}

          <ul className="mp-list">
            {categories.map((cat) => {
              const spent = data.spentBy[cat] || 0;
              const budget = monthBudgets[cat] || 0;
              const pct = budget > 0 ? (spent / budget) * 100 : 0;
              return (
                <li key={cat} className="mp-cat">
                  <div className="mp-row">
                    <span className="mp-cat-name">{cat}</span>
                    <label className="mp-budget">
                      <span className="mp-muted">Budget ({CURRENCY})</span>
                      <BudgetInput
                        key={`${month}-${cat}`}
                        value={budget}
                        label={`${cat} budget for ${monthLabel(month)}`}
                        onCommit={(n) => setBudget(cat, n)}
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
                            ? `${money(r2(spent - budget))} over`
                            : `${money(r2(budget - spent))} left`}
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
  min-height: 100dvh; /* fits mobile browsers with moving address bars */
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
.mp-wrap { max-width: 1440px; margin: 0 auto; padding: 32px 20px 56px; }

.mp-head h1 { margin: 0 0 16px; font-size: 1.9rem; font-weight: 700; letter-spacing: -0.01em; }
.mp-head nav { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 28px; }
.mp-nav { padding: 8px 14px; border-radius: 999px; font: inherit; font-size: 0.9rem; border: 1px solid transparent; background: transparent; color: var(--text); cursor: pointer; }
.mp-nav-link:hover { background: var(--glass); border-color: var(--glass-edge); }
.mp-nav-on { background: var(--glass); border-color: var(--glass-edge); color: var(--accent); font-weight: 600; }
.mp-nav-off { color: var(--muted); opacity: 0.55; cursor: not-allowed; }
.mp button:focus-visible, .mp input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.mp-title-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
.mp-title-row h2 { margin: 0; font-size: 1.3rem; font-weight: 600; }
.mp-month-nav { display: flex; align-items: center; gap: 12px; font-weight: 600; flex-wrap: wrap; }
.mp-month-nav span { min-width: 150px; text-align: center; }
.mp-month-nav button { width: 36px; height: 36px; border-radius: 10px; border: 1px solid var(--glass-edge); background: var(--glass); color: var(--text); font-size: 1.2rem; cursor: pointer; }
.mp-month-nav button:hover { background: rgba(138, 180, 255, 0.14); }
.mp-month-nav .mp-today { width: auto; padding: 0 12px; font-size: 0.85rem; font-weight: 600; color: var(--accent); }

.mp input {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--glass-edge);
  background: rgba(0, 0, 0, 0.35);
  color: var(--text);
  font: inherit;
  color-scheme: dark;
}

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
.mp-plan { margin: -6px 0 16px; font-size: 0.88rem; font-variant-numeric: tabular-nums; }
.mp-note { margin: 14px 0 0; padding: 10px 12px; border-radius: 10px; font-size: 0.88rem; color: var(--amber); background: rgba(255, 194, 107, 0.08); border: 1px solid rgba(255, 194, 107, 0.25); }
.mp-note-red { color: var(--red); background: rgba(255, 138, 138, 0.1); border-color: rgba(255, 138, 138, 0.3); }
.mp-gap { margin: 0 0 20px; }

.mp-copy { padding: 7px 12px; border-radius: 10px; border: 1px solid var(--glass-edge); background: var(--glass); color: var(--accent); font: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
.mp-copy:hover { background: rgba(138, 180, 255, 0.14); }

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