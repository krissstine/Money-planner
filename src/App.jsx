import { useState } from "react";
import Accounts from "./Accounts";
import Monthly from "./Monthly";
import Savings from "./Savings";
import Calendar from "./Calendar";

export default function App() {
  const [page, setPage] = useState("accounts");

  if (page === "monthly") return <Monthly onNavigate={setPage} />;
  if (page === "savings") return <Savings onNavigate={setPage} />;
  if (page === "calendar") return <Calendar onNavigate={setPage} />;
  return <Accounts onNavigate={setPage} />;
}