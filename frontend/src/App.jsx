import { useState } from "react";
import Alerts from "./components/Alerts";
import Dashboard from "./components/Dashboard";
import FaultClassifier from "./components/FaultClassifier";
import Predict from "./components/Predict";
import Sidebar from "./components/Sidebar";
import "./index.css";

export default function App() {
  const [page, setPage] = useState("dashboard");

  const pages = {
    dashboard: <Dashboard />,
    predict: <Predict />,
    alerts: <Alerts />,
    classify: <FaultClassifier />,
  };

  return (
    <div className="app-shell">
      <Sidebar current={page} onNav={setPage} />
      <main className="main-content">{pages[page]}</main>
    </div>
  );
}
