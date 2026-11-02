import { useEffect, useRef, useState } from "react";

const CURRENCY = "₱";

const FEATURES = [
  {
    key: "accounts",
    title: "Accounts Overview",
    text: "Record every income and expense. Your balance updates instantly, and you can download everything as a spreadsheet.",
    icon: "💳",
  },
  {
    key: "monthly",
    title: "Monthly Budget Progress",
    text: "Set a budget per category and watch the bars fill. See a pie chart of where your money went this month.",
    icon: "📊",
  },
  {
    key: "savings",
    title: "Savings Goals Tracker",
    text: "Name a goal, set a target and a date. The app tells you how much to save each month to get there.",
    icon: "🎯",
  },
  {
    key: "calendar",
    title: "Upcoming Bills Calendar",
    text: "Put due dates on a calendar, tick bills off when paid, and spot overdue ones before they cost you.",
    icon: "🗓️",
  },
];

const REASONS = [
  {
    title: "See the full picture",
    text: "Money you cannot see is money you cannot manage. One place for income, spending and balance ends the guessing at the end of the month.",
  },
  {
    title: "Spend on purpose",
    text: "A budget turns “where did it all go?” into “I decided where it goes.” Small leaks like food and entertainment show up early.",
  },
  {
    title: "Reach goals sooner",
    text: "A goal with an amount and a date becomes a monthly habit. Saving a little on a schedule beats waiting for a big leftover.",
  },
  {
    title: "Never miss a due date",
    text: "Late fees and reconnection charges are avoidable. A calendar of bills means rent and utilities never sneak up on you.",
  },
];

const STEPS = [
  { title: "Add your income", text: "Start in Accounts Overview with your salary or any money coming in." },
  { title: "Record expenses and set budgets", text: "Log what you spend, then give each category a monthly limit." },
  { title: "Track goals and bills", text: "Save toward what matters and tick off bills as you pay them." },
];

const SAMPLE_TX = [
  { label: "Salary", amount: 25000, type: "in" },
  { label: "Groceries", amount: 1850, type: "out" },
  { label: "Electric bill", amount: 2300, type: "out" },
  { label: "Freelance work", amount: 4500, type: "in" },
  { label: "Coffee", amount: 140, type: "out" },
];

function money(n) {
  return `${CURRENCY}${Math.round(n).toLocaleString("en-PH")}`;
}

// Counts from 0 up to `target` once `active` becomes true
function useCountUp(target, active, duration = 1600) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setValue(target);
      return undefined;
    }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, duration]);
  return value;
}

// Adds `hm-in` to the element when it scrolls into view
function Reveal({ children, className = "", delay = 0, as: Tag = "div" }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (!("IntersectionObserver" in window)) {
      setShown(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`hm-reveal ${shown ? "hm-in" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}

// The animated sample dashboard in the hero
function PreviewCard() {
  const [ready, setReady] = useState(false);
  const [idx, setIdx] = useState(0);
  const balance = useCountUp(18710, ready);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % SAMPLE_TX.length), 2400);
    return () => clearInterval(id);
  }, []);

  const tx = SAMPLE_TX[idx];
  const bars = [
    { name: "Food", pct: 62 },
    { name: "Utilities", pct: 88 },
    { name: "Fun", pct: 35 },
  ];

  return (
    <div className="hm-glass hm-preview" aria-hidden="true">
      <span className="hm-preview-label">Current balance</span>
      <strong className="hm-preview-balance">{money(balance)}</strong>

      <div className="hm-bars">
        {bars.map((b, i) => (
          <div key={b.name} className="hm-bar">
            <div className="hm-bar-top">
              <span>{b.name}</span>
              <span>{b.pct}%</span>
            </div>
            <div className="hm-bar-track">
              <div
                className={`hm-bar-fill ${b.pct >= 80 ? "hm-warn" : ""}`}
                style={{
                  width: ready ? `${b.pct}%` : "0%",
                  transitionDelay: `${700 + i * 250}ms`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="hm-ticker">
        <span className="hm-ticker-title">Latest</span>
        <div key={idx} className="hm-ticker-row">
          <span>{tx.label}</span>
          <span className={tx.type === "in" ? "hm-in-c" : "hm-out-c"}>
            {tx.type === "in" ? "+" : "−"}
            {money(tx.amount)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Home({ onNavigate }) {
  const go = (key) => onNavigate && onNavigate(key);

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

  return (
    <div className="hm">
      <style>{css}</style>

      {/* Drifting background glow and falling pesos */}
      <div className="hm-bg" aria-hidden="true">
        <span className="hm-orb hm-orb-a" />
        <span className="hm-orb hm-orb-b" />
        {Array.from({ length: 10 }).map((_, i) => (
          <span
            key={i}
            className="hm-coin"
            style={{
              left: `${6 + i * 9.5}%`,
              animationDuration: `${14 + (i % 4) * 4}s`,
              animationDelay: `${-i * 2.3}s`,
              fontSize: `${1 + (i % 3) * 0.45}rem`,
            }}
          >
            {CURRENCY}
          </span>
        ))}
      </div>

      <div className="hm-wrap">
        <header className="hm-top">
          <span className="hm-brand">Money Planner</span>
        </header>

        {/* HERO */}
        <section className="hm-hero" aria-labelledby="hero-title">
          <div className="hm-hero-text">
            <h1 id="hero-title">
              <span className="hm-line">Know where</span>
              <span className="hm-line">every peso</span>
              <span className="hm-line">goes.</span>
            </h1>
            <p className="hm-lead">
              Money Planner brings your income, budgets, savings goals and bills into one calm place, so you
              decide what your money does before the month decides for you.
            </p>
            <a
              className="hm-scroll"
              href="#why"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("why")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Why it matters
              <span className="hm-chevron" aria-hidden="true">
                ⌄
              </span>
            </a>
          </div>
          <PreviewCard />
        </section>

        {/* WHY IT MATTERS */}
        <section id="why" className="hm-section" aria-labelledby="why-title">
          <Reveal as="div" className="hm-sec-head">
            <h2 id="why-title">Why managing money matters</h2>
            <p className="hm-muted">
              Most money trouble is not about earning too little. It comes from not seeing what is happening.
              Tracking fixes that.
            </p>
          </Reveal>
          <div className="hm-reasons">
            {REASONS.map((r, i) => (
              <Reveal key={r.title} className="hm-glass hm-reason" delay={i * 110}>
                <h3>{r.title}</h3>
                <p className="hm-muted">{r.text}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* FEATURES */}
        <section className="hm-section" aria-labelledby="feat-title">
          <Reveal className="hm-sec-head">
            <h2 id="feat-title">Everything in one place</h2>
            <p className="hm-muted">Four tools that work together. Tap any of them to jump straight in.</p>
          </Reveal>
          <div className="hm-features">
            {FEATURES.map((f, i) => (
              <Reveal key={f.key} delay={i * 110}>
                <button type="button" className="hm-glass hm-feature" onClick={() => go(f.key)}>
                  <span className="hm-icon" aria-hidden="true">
                    {f.icon}
                  </span>
                  <span className="hm-feature-title">{f.title}</span>
                  <span className="hm-muted hm-feature-text">{f.text}</span>
                </button>
              </Reveal>
            ))}
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="hm-section" aria-labelledby="how-title">
          <Reveal className="hm-sec-head">
            <h2 id="how-title">Get going in three steps</h2>
          </Reveal>
          <ol className="hm-steps">
            {STEPS.map((s, i) => (
              <Reveal as="li" key={s.title} className="hm-glass hm-step" delay={i * 160}>
                <span className="hm-step-num">{i + 1}</span>
                <div>
                  <h3>{s.title}</h3>
                  <p className="hm-muted">{s.text}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </section>

        {/* START */}
        <Reveal as="section" className="hm-cta" aria-labelledby="cta-title">
          <h2 id="cta-title">Ready to take control?</h2>
          <p className="hm-muted">Your data stays on this device. No sign-up needed.</p>
          <button type="button" className="hm-start" onClick={() => go("accounts")}>
            Start using Money Planner
          </button>
        </Reveal>
      </div>
    </div>
  );
}

const css = `
.hm {
  --bg: #0a0a0f;
  --glass: rgba(255, 255, 255, 0.05);
  --glass-edge: rgba(255, 255, 255, 0.12);
  --text: #ececf1;
  --muted: #9a9aa8;
  --accent: #8ab4ff;
  --amber: #ffc26b;
  --red: #ff8a8a;

  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
  width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;
  color: var(--text);
  font-family: "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif;
  background:
    radial-gradient(900px 500px at 15% -10%, rgba(255, 255, 255, 0.06), transparent 60%),
    radial-gradient(700px 480px at 100% 10%, rgba(138, 180, 255, 0.08), transparent 60%),
    var(--bg);
  text-align: left;
}
.hm *, .hm *::before, .hm *::after { box-sizing: border-box; }
.hm h1, .hm h2, .hm h3, .hm p { margin: 0; }
.hm-wrap { position: relative; z-index: 1; max-width: 1200px; margin: 0 auto; padding: 28px 20px 72px; }
.hm-muted { color: var(--muted); line-height: 1.6; }
.hm button:focus-visible, .hm a:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }

/* Background */
.hm-bg { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
.hm-orb { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.5; }
.hm-orb-a { width: 420px; height: 420px; left: -120px; top: 10%; background: rgba(138, 180, 255, 0.22); animation: hm-drift-a 18s ease-in-out infinite alternate; }
.hm-orb-b { width: 360px; height: 360px; right: -100px; bottom: 5%; background: rgba(195, 166, 255, 0.16); animation: hm-drift-b 22s ease-in-out infinite alternate; }
.hm-coin { position: absolute; top: -40px; color: var(--accent); opacity: 0; font-weight: 700; animation-name: hm-fall; animation-timing-function: linear; animation-iteration-count: infinite; }
@keyframes hm-drift-a { to { transform: translate(120px, 80px) scale(1.15); } }
@keyframes hm-drift-b { to { transform: translate(-140px, -90px) scale(1.2); } }
@keyframes hm-fall {
  0% { transform: translateY(-40px) rotate(0deg); opacity: 0; }
  10% { opacity: 0.22; }
  90% { opacity: 0.22; }
  100% { transform: translateY(105vh) rotate(360deg); opacity: 0; }
}

.hm-top { margin-bottom: 40px; }
.hm-brand { font-size: 1.2rem; font-weight: 700; letter-spacing: -0.01em; }

/* Hero */
.hm-hero { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 48px; align-items: center; min-height: 66vh; padding-bottom: 48px; }
.hm-hero h1 { font-size: clamp(2.8rem, 7vw, 5rem); line-height: 1.02; letter-spacing: -0.03em; font-weight: 800; }
.hm-line { display: block; opacity: 0; transform: translateY(40px); animation: hm-rise 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
.hm-line:nth-child(2) { animation-delay: 0.18s; }
.hm-line:nth-child(3) { animation-delay: 0.36s; background: linear-gradient(90deg, #a9c8ff, #c3a6ff, #a9c8ff); background-size: 200% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; animation: hm-rise 0.9s 0.36s cubic-bezier(0.2, 0.8, 0.2, 1) forwards, hm-shimmer 5s linear 1.3s infinite; }
@keyframes hm-rise { to { opacity: 1; transform: none; } }
@keyframes hm-shimmer { to { background-position: -200% 0; } }
.hm-lead { margin-top: 24px; max-width: 520px; font-size: 1.1rem; line-height: 1.65; color: var(--muted); opacity: 0; animation: hm-rise 0.9s 0.7s ease forwards; }
.hm-scroll { display: inline-flex; flex-direction: column; align-items: flex-start; margin-top: 28px; color: var(--accent); text-decoration: none; font-weight: 600; opacity: 0; animation: hm-rise 0.9s 0.95s ease forwards; }
.hm-chevron { font-size: 1.6rem; line-height: 0.8; animation: hm-bounce 1.6s ease-in-out infinite; }
@keyframes hm-bounce { 50% { transform: translateY(6px); } }

/* Glass */
.hm-glass { background: var(--glass); border: 1px solid var(--glass-edge); border-radius: 18px; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 12px 40px rgba(0, 0, 0, 0.35); }

/* Preview card */
.hm-preview { padding: 26px; display: flex; flex-direction: column; gap: 20px; opacity: 0; animation: hm-rise 1s 0.5s ease forwards, hm-float 6s ease-in-out 1.5s infinite; background: linear-gradient(160deg, rgba(138, 180, 255, 0.14), var(--glass)); }
@keyframes hm-float { 50% { transform: translateY(-12px); } }
.hm-preview-label { color: var(--muted); font-size: 0.9rem; }
.hm-preview-balance { font-size: 2.4rem; color: var(--accent); font-variant-numeric: tabular-nums; margin-top: -12px; }
.hm-bars { display: flex; flex-direction: column; gap: 14px; }
.hm-bar-top { display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--muted); margin-bottom: 6px; }
.hm-bar-track { height: 10px; border-radius: 999px; background: rgba(255, 255, 255, 0.08); overflow: hidden; }
.hm-bar-fill { height: 100%; width: 0; border-radius: 999px; background: linear-gradient(90deg, #a9c8ff, #7aa5f5); transition: width 1.2s cubic-bezier(0.2, 0.8, 0.2, 1); }
.hm-bar-fill.hm-warn { background: linear-gradient(90deg, #ffd89a, #ffc26b); }
.hm-ticker { border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 14px; overflow: hidden; }
.hm-ticker-title { display: block; color: var(--muted); font-size: 0.8rem; margin-bottom: 8px; }
.hm-ticker-row { display: flex; justify-content: space-between; font-variant-numeric: tabular-nums; animation: hm-slide 0.5s ease; }
@keyframes hm-slide { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
.hm-in-c { color: var(--accent); }
.hm-out-c { color: var(--red); }

/* Scroll reveal */
.hm-reveal { opacity: 0; transform: translateY(28px); transition: opacity 0.7s ease, transform 0.7s cubic-bezier(0.2, 0.8, 0.2, 1); }
.hm-reveal.hm-in { opacity: 1; transform: none; }

/* Sections */
.hm-section { padding: 56px 0 8px; }
.hm-sec-head { max-width: 640px; margin-bottom: 28px; }
.hm-sec-head h2, .hm-cta h2 { font-size: clamp(1.6rem, 3.5vw, 2.3rem); letter-spacing: -0.02em; margin-bottom: 10px; }

.hm-reasons { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
.hm-reason { padding: 24px; transition: transform 0.25s ease, border-color 0.25s ease; }
.hm-reason.hm-in:hover { transform: translateY(-4px); border-color: rgba(138, 180, 255, 0.45); }
.hm-reason h3 { font-size: 1.15rem; margin-bottom: 8px; }

.hm-features { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.hm-features > .hm-reveal { display: flex; }
.hm-feature { width: 100%; padding: 22px; display: flex; flex-direction: column; gap: 10px; align-items: flex-start; text-align: left; font: inherit; color: var(--text); cursor: pointer; transition: transform 0.25s ease, border-color 0.25s ease, background 0.25s ease; }
.hm-feature:hover { transform: translateY(-6px); border-color: rgba(138, 180, 255, 0.5); background: rgba(138, 180, 255, 0.09); }
.hm-icon { font-size: 1.8rem; display: inline-block; transition: transform 0.35s ease; }
.hm-feature:hover .hm-icon { transform: scale(1.2) rotate(-8deg); }
.hm-feature-title { font-weight: 700; font-size: 1.02rem; }
.hm-feature-text { font-size: 0.9rem; }

.hm-steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; max-width: 760px; }
.hm-step { display: flex; align-items: flex-start; gap: 18px; padding: 20px 22px; }
.hm-step h3 { font-size: 1.08rem; margin-bottom: 4px; }
.hm-step-num { flex-shrink: 0; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; font-weight: 700; color: #071226; background: linear-gradient(180deg, #a9c8ff, #7aa5f5); }

/* Start button */
.hm-cta { margin-top: 72px; padding: 56px 24px; text-align: center; border-radius: 24px; border: 1px solid var(--glass-edge); background: linear-gradient(160deg, rgba(138, 180, 255, 0.16), var(--glass)); }
.hm-cta .hm-muted { margin-bottom: 28px; }
.hm-start { position: relative; padding: 16px 36px; border: 0; border-radius: 999px; font: inherit; font-size: 1.1rem; font-weight: 700; cursor: pointer; color: #071226; background: linear-gradient(180deg, #a9c8ff, #7aa5f5); animation: hm-pulse 2.4s ease-in-out infinite; transition: transform 0.2s ease; }
.hm-start:hover { transform: scale(1.06); }
.hm-start:active { transform: scale(0.98); }
@keyframes hm-pulse {
  0% { box-shadow: 0 0 0 0 rgba(138, 180, 255, 0.55); }
  70% { box-shadow: 0 0 0 22px rgba(138, 180, 255, 0); }
  100% { box-shadow: 0 0 0 0 rgba(138, 180, 255, 0); }
}

@media (max-width: 960px) {
  .hm-features { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 860px) {
  .hm-hero { grid-template-columns: 1fr; min-height: 0; gap: 36px; }
  .hm-reasons { grid-template-columns: 1fr; }
}
@media (max-width: 520px) {
  .hm-features { grid-template-columns: 1fr; }
}

/* Respect people who turn motion off */
@media (prefers-reduced-motion: reduce) {
  .hm *, .hm *::before, .hm *::after { animation: none !important; transition: none !important; }
  .hm-line, .hm-lead, .hm-scroll, .hm-preview, .hm-reveal { opacity: 1 !important; transform: none !important; }
  .hm-coin { display: none; }
  .hm-bar-fill { transition: none !important; }
}
`;