import PropTypes from "prop-types";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

const NAV = [
  { id: "dashboard", label: "Overview" },
  { id: "predict", label: "Diagnose" },
  { id: "alerts", label: "Alert Log" },
  { id: "classify", label: "Fault Type" },
];

export default function Sidebar({ current, onNav }) {
  const [alive, setAlive] = useState(false);

  useEffect(() => {
    api
      .health()
      .then(() => setAlive(true))
      .catch(() => setAlive(false));
    const t = setInterval(() => {
      api
        .health()
        .then(() => setAlive(true))
        .catch(() => setAlive(false));
    }, 10000);
    return () => clearInterval(t);
  }, []);

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">GridMind</div>
      </div>

      <nav className="sidebar-nav">
        {NAV.map((n) => (
          <button
            key={n.id}
            className={`nav-item ${current === n.id ? "active" : ""}`}
            onClick={() => onNav(n.id)}
          >
            <span style={{ fontSize: 14 }}>{n.icon}</span>
            {n.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-status">
        <div
          className="status-dot"
          style={{ color: alive ? "var(--green)" : "var(--red)" }}
          title={alive ? "API connected" : "API unreachable"}
        >
          {alive ? "API ONLINE" : "API OFFLINE"}
        </div>
      </div>
    </aside>
  );
}

Sidebar.propTypes = {
  current: PropTypes.string.isRequired,
  onNav: PropTypes.func.isRequired,
};
