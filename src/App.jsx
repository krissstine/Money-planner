import { useState } from "react";
import Home from "./Home";
import Accounts from "./Accounts";
import Monthly from "./Monthly";
import Savings from "./Savings";
import Calendar from "./Calendar";

export default function App() {
  const [page, setPage] = useState("home");

  if (page === "accounts") return <Accounts onNavigate={setPage} />;
  if (page === "monthly") return <Monthly onNavigate={setPage} />;
  if (page === "savings") return <Savings onNavigate={setPage} />;
  if (page === "calendar") return <Calendar onNavigate={setPage} />;
  return <Home onNavigate={setPage} />;
}