import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "money_planner_transactions";
const CURRENCY = "₱";

const NAV_ITEMS = [
  { key: "accounts", label: "Accounts Overview", ready: true },
  { key: "monthly", label: "Monthly Budget Progress", ready: true },
  { key: "savings", label: "Savings Goals Tracker", ready: true },
  { key: "calendar", label: "Upcoming Bills Calendar", ready: true },
];
const CURRENT_PAGE = "accounts";

const CATEGORIES = {
  income: ["Salary", "Freelance", "Other"],
  expense: ["Food", "Rent", "Utilities", "Entertainment", "Other"],
};

// Local date as YYYY-MM-DD (toISOString would shift the day for UTC+8)
function todayLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function loadTransactions() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
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

// Text starting with = + - @ gets a leading apostrophe so a spreadsheet never runs it as a formula
function csvText(v) {
  const s = String(v ?? "");
  return /^[=+\-@]/.test(s) ? `'${s}` : s;
}

// Wraps every cell for CSV so commas, quotes and line breaks never break the columns
function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Numbers are written as plain digits (no ₱ or commas) so Excel/Sheets can calculate with them
function csvNum(n) {
  return Number(n).toFixed(2);
}

export default function Accounts({ onNavigate }) {
  const [transactions, setTransactions] = useState(loadTransactions);
  const [form, setForm] = useState({
    description: "",
    amount: "",
    type: "income",
    category: "Salary",
    date: todayLocal(),
  });
  const [error, setError] = useState("");

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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    } catch {
      /* storage unavailable: keep working in memory */
    }
  }, [transactions]);

  const { totalIncome, totalExpenses } = useMemo(() => {
    let inc = 0;
    let exp = 0;
    transactions.forEach((t) => (t.type === "income" ? (inc += t.amount) : (exp += t.amount)));
    return { totalIncome: inc, totalExpenses: exp };
  }, [transactions]);

  const balance = totalIncome - totalExpenses;

  const sorted = useMemo(
    () => [...transactions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id)),
    [transactions]
  );

  function update(field, value) {
    setError("");
    setForm((f) => {
      const next = { ...f, [field]: value };
      if (field === "type") next.category = CATEGORIES[value][0];
      return next;
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!form.description.trim() || !(amount > 0) || !form.date) return;

    // Income comes first: an expense needs income in the same month
    if (form.type === "expense") {
      const month = form.date.slice(0, 7);
      const monthIncome = transactions
        .filter((t) => t.type === "income" && t.date.slice(0, 7) === month)
        .reduce((sum, t) => sum + t.amount, 0);
      if (monthIncome <= 0) {
        setError("Add income for this month before adding an expense.");
        return;
      }
    }

    setTransactions((list) => [
      ...list,
      {
        id: Date.now(),
        description: form.description.trim(),
        amount,
        type: form.type,
        category: form.category,
        date: form.date,
      },
    ]);
    setForm((f) => ({ ...f, description: "", amount: "" }));
    setError("");
  }

  function handleDelete(id) {
    setTransactions((list) => list.filter((t) => t.id !== id));
  }

  // Downloads ALL records as one .csv file (opens in Excel, Google Sheets, Numbers).
  // The file is split into labelled sections, with a "how to read this file" guide at the top.
  function downloadSpreadsheet() {
    if (transactions.length === 0) return;

    // Oldest to newest, so the running balance reads like a bank statement
    const chrono = [...transactions].sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id
    );

    let running = 0;
    const txRows = chrono.map((t, i) => {
      const effect = t.type === "income" ? t.amount : -t.amount;
      running += effect;
      return [
        i + 1,
        t.date,
        csvText(t.description),
        t.type === "income" ? "Income" : "Expense",
        csvText(t.category),
        csvNum(t.amount),
        csvNum(effect),
        csvNum(running),
      ];
    });

    // Totals by category (income and expense kept separate)
    const catMap = {};
    chrono.forEach((t) => {
      const key = `${t.type}|${t.category}`;
      if (!catMap[key]) catMap[key] = { type: t.type, category: t.category, count: 0, total: 0 };
      catMap[key].count += 1;
      catMap[key].total += t.amount;
    });
    const catRows = Object.values(catMap)
      .sort((a, b) => (a.type === b.type ? b.total - a.total : a.type === "income" ? -1 : 1))
      .map((c) => [
        c.type === "income" ? "Income" : "Expense",
        csvText(c.category),
        c.count,
        csvNum(c.total),
      ]);

    // Totals by month, with the balance carried forward
    const monthMap = {};
    chrono.forEach((t) => {
      const m = t.date.slice(0, 7);
      if (!monthMap[m]) monthMap[m] = { income: 0, expense: 0 };
      monthMap[m][t.type] += t.amount;
    });
    let carried = 0;
    const monthRows = Object.keys(monthMap)
      .sort()
      .map((m) => {
        const { income, expense } = monthMap[m];
        const net = income - expense;
        carried += net;
        return [m, csvNum(income), csvNum(expense), csvNum(net), csvNum(carried)];
      });

    const lines = [
      ["MONEY PLANNER - ACCOUNTS EXPORT"],
      ["Exported on", todayLocal()],
      [`All amounts are in ${CURRENCY}`],
      [],
      ["HOW TO READ THIS FILE"],
      ["Section", "What it shows"],
      ["1. Summary", "Your overall totals: all income, all expenses, and what is left (your balance)"],
      ["2. All transactions", "Every record you entered, oldest first, with your running balance after each one"],
      ["3. Totals by category", "How much came from / went to each category, and how many records it has"],
      ["4. Totals by month", "Income, expenses and the leftover for each month, plus the balance carried forward"],
      ["Tip", "Amount is always a positive number. Effect on balance is + for income and - for expenses."],
      [],
      ["1. SUMMARY"],
      ["Item", "Value"],
      ["Total income", csvNum(totalIncome)],
      ["Total expenses", csvNum(totalExpenses)],
      ["Current balance (income minus expenses)", csvNum(balance)],
      ["Number of transactions", transactions.length],
      [],
      ["2. ALL TRANSACTIONS (oldest to newest)"],
      ["No.", "Date (YYYY-MM-DD)", "Description", "Type", "Category", "Amount", "Effect on balance", "Running balance"],
      ...txRows,
      [],
      ["3. TOTALS BY CATEGORY"],
      ["Type", "Category", "Number of transactions", "Total"],
      ...catRows,
      [],
      ["4. TOTALS BY MONTH"],
      ["Month (YYYY-MM)", "Income", "Expenses", "Left over (income minus expenses)", "Balance carried forward"],
      ...monthRows,
    ];

    const csv = lines.map((row) => row.map(csvCell).join(",")).join("\r\n");
    // BOM keeps special characters (like ₱) correct when opened in Excel
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `money-planner-accounts-${todayLocal()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="ap">
      <style>{css}</style>

      <div className="ap-wrap">
        <header className="ap-head">
          <h1>Money Planner</h1>
          <nav aria-label="Money Planner sections">
            {NAV_ITEMS.map((item) => {
              const isCurrent = item.key === CURRENT_PAGE;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`ap-nav ${isCurrent ? "ap-nav-on" : item.ready ? "ap-nav-link" : "ap-nav-off"}`}
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

        <section className="ap-summary" aria-label="Financial summary">
          <div className="ap-glass ap-stat">
            <span className="ap-stat-label">Total income</span>
            <strong className="ap-in">{money(totalIncome)}</strong>
          </div>
          <div className="ap-glass ap-stat">
            <span className="ap-stat-label">Total expenses</span>
            <strong className="ap-out">{money(totalExpenses)}</strong>
          </div>
          <div className="ap-glass ap-stat ap-stat-main">
            <span className="ap-stat-label">Current balance</span>
            <strong className={balance < 0 ? "ap-out" : ""}>{money(balance)}</strong>
          </div>
        </section>

        <div className="ap-grid">
          <section className="ap-glass ap-card" aria-labelledby="add-title">
            <h2 id="add-title">Add transaction</h2>
            <form onSubmit={handleSubmit} noValidate={false}>
              <label>
                Description
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
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
                  onChange={(e) => update("amount", e.target.value)}
                  required
                />
              </label>

              <div className="ap-seg" role="group" aria-label="Transaction type">
                {["income", "expense"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={form.type === t ? `ap-seg-on ap-seg-${t}` : ""}
                    aria-pressed={form.type === t}
                    onClick={() => update("type", t)}
                  >
                    {t === "income" ? "Income" : "Expense"}
                  </button>
                ))}
              </div>

              <label>
                Category
                <select value={form.category} onChange={(e) => update("category", e.target.value)}>
                  {CATEGORIES[form.type].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Date
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => update("date", e.target.value)}
                  required
                />
              </label>

              {error && (
                <p className="ap-error" role="alert">
                  {error}
                </p>
              )}

              <button type="submit" className="ap-submit">
                Add transaction
              </button>
            </form>
          </section>

          <section className="ap-glass ap-card" aria-labelledby="history-title">
            <div className="ap-card-head">
              <h2 id="history-title">Transaction history</h2>
              <button
                type="button"
                className="ap-download"
                onClick={downloadSpreadsheet}
                disabled={transactions.length === 0}
                title={
                  transactions.length === 0
                    ? "Add a transaction first"
                    : "Download all your records, totals and monthly summary"
                }
              >
                Download spreadsheet
              </button>
            </div>
            {sorted.length === 0 ? (
              <p className="ap-empty">No transactions yet. Add your income first, then your expenses.</p>
            ) : (
              <div className="ap-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Category</th>
                      <th className="ap-num">Amount</th>
                      <th>
                        <span className="ap-sr">Action</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((t) => (
                      <tr key={t.id}>
                        <td>{t.date}</td>
                        <td>{t.description}</td>
                        <td>{t.category}</td>
                        <td className={`ap-num ${t.type === "income" ? "ap-in" : "ap-out"}`}>
                          {t.type === "income" ? "+" : "−"}
                          {money(t.amount)}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="ap-del"
                            onClick={() => handleDelete(t.id)}
                            aria-label={`Delete ${t.description}`}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

const css = `
.ap {
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
.ap *, .ap *::before, .ap *::after { box-sizing: border-box; }
.ap-wrap { max-width: 1080px; margin: 0 auto; padding: 32px 20px 56px; }

.ap-head h1 { margin: 0 0 16px; font-size: 1.9rem; font-weight: 700; letter-spacing: -0.01em; }
.ap-head nav { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 28px; }
.ap-nav { padding: 8px 14px; border-radius: 999px; font: inherit; font-size: 0.9rem; border: 1px solid transparent; background: transparent; color: var(--text); cursor: pointer; }
.ap-nav-link:hover { background: var(--glass); border-color: var(--glass-edge); }
.ap-nav:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.ap-nav-on { background: var(--glass); border-color: var(--glass-edge); color: var(--accent); font-weight: 600; }
.ap-nav-off { color: var(--muted); opacity: 0.55; cursor: not-allowed; }

.ap-glass {
  background: var(--glass);
  border: 1px solid var(--glass-edge);
  border-radius: 18px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 12px 40px rgba(0, 0, 0, 0.35);
}

.ap-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px; }
.ap-stat { padding: 20px 22px; display: flex; flex-direction: column; gap: 8px; }
.ap-stat-label { color: var(--muted); font-size: 0.9rem; }
.ap-stat strong { font-size: 1.6rem; font-variant-numeric: tabular-nums; }
.ap-stat-main { background: linear-gradient(160deg, rgba(138, 180, 255, 0.14), var(--glass)); }
.ap-stat-main strong { font-size: 2rem; color: var(--accent); }
.ap-stat-main strong.ap-out { color: var(--red); }
.ap-in { color: var(--accent); }
.ap-out { color: var(--red); }

.ap-grid { display: grid; grid-template-columns: 340px 1fr; gap: 20px; align-items: start; }
.ap-card { padding: 22px; }
.ap-card h2 { margin: 0 0 16px; font-size: 1.15rem; font-weight: 600; }
.ap-card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
.ap-card-head h2 { margin: 0; }

.ap-download {
  padding: 9px 14px;
  border-radius: 10px;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--accent);
  background: var(--glass);
  border: 1px solid var(--glass-edge);
  cursor: pointer;
}
.ap-download:hover:not(:disabled) { background: rgba(138, 180, 255, 0.14); }
.ap-download:disabled { color: var(--muted); opacity: 0.55; cursor: not-allowed; }

.ap form { display: flex; flex-direction: column; gap: 14px; }
.ap label { display: flex; flex-direction: column; gap: 6px; font-size: 0.88rem; color: var(--muted); }
.ap input, .ap select {
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--glass-edge);
  background: rgba(0, 0, 0, 0.35);
  color: var(--text);
  font: inherit;
  color-scheme: dark;
}
.ap input:focus-visible, .ap select:focus-visible, .ap button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.ap-seg { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 4px; border-radius: 12px; background: rgba(0, 0, 0, 0.35); border: 1px solid var(--glass-edge); }
.ap-seg button { padding: 9px; border: 0; border-radius: 9px; background: transparent; color: var(--muted); font: inherit; cursor: pointer; }
.ap-seg .ap-seg-income { background: rgba(138, 180, 255, 0.2); color: var(--accent); font-weight: 600; }
.ap-seg .ap-seg-expense { background: rgba(255, 138, 138, 0.18); color: var(--red); font-weight: 600; }

.ap-error { margin: 0; padding: 10px 12px; border-radius: 10px; font-size: 0.88rem; color: var(--red); background: rgba(255, 138, 138, 0.1); border: 1px solid rgba(255, 138, 138, 0.3); }

.ap-submit { padding: 12px; border: 0; border-radius: 12px; font: inherit; font-weight: 600; cursor: pointer; color: #071226; background: linear-gradient(180deg, #a9c8ff, #7aa5f5); }
.ap-submit:hover { filter: brightness(1.08); }

.ap-scroll { overflow-x: auto; }
.ap table { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
.ap th { text-align: left; font-weight: 500; color: var(--muted); padding: 8px 10px; border-bottom: 1px solid var(--glass-edge); white-space: nowrap; }
.ap td { padding: 12px 10px; border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
.ap tbody tr:hover { background: rgba(255, 255, 255, 0.04); }
.ap .ap-num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.ap-del { padding: 6px 10px; border-radius: 8px; border: 1px solid rgba(255, 138, 138, 0.35); background: transparent; color: var(--red); font: inherit; font-size: 0.82rem; cursor: pointer; }
.ap-del:hover { background: rgba(255, 138, 138, 0.12); }
.ap-empty { margin: 0; color: var(--muted); }
.ap-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

@media (max-width: 860px) {
  .ap-grid { grid-template-columns: 1fr; }
  .ap-summary { grid-template-columns: 1fr; }
}
`;