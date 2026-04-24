import { useEffect, useState } from "react";
import { api, formatTime, severityClass } from "../lib/api";

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    api
      .alerts(50)
      .then(setAlerts)
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, []);

  const critCount = alerts.filter(
    (a) => severityClass(a.severity) === "critical",
  ).length;
  const highCount = alerts.filter(
    (a) => severityClass(a.severity) === "high",
  ).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Alert Log</div>
          <div className="page-sub">Fault events recorded this session</div>
        </div>
        <button
          className="btn btn-ghost"
          onClick={refresh}
          style={{ fontSize: 10 }}
        >
          ↻ REFRESH
        </button>
      </div>

      <div className="page-body">
        <div
          className="stat-grid"
          style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
        >
          <div className="stat-cell">
            <div className="stat-label">Total Faults</div>
            <div className="stat-value amber">{alerts.length}</div>
          </div>
          <div className="stat-cell">
            <div className="stat-label">Critical</div>
            <div className="stat-value red">{critCount}</div>
          </div>
          <div className="stat-cell">
            <div className="stat-label">High</div>
            <div className="stat-value" style={{ color: "var(--amber)" }}>
              {highCount}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Fault Event Timeline</div>

          {loading && <div className="loading-text">LOADING ALERTS...</div>}

          {!loading && alerts.length === 0 && (
            <div className="empty-state">
              No fault alerts recorded.
              <br />
              Run a prediction from the Diagnose page to generate alerts.
            </div>
          )}

          {!loading && alerts.length > 0 && (
            <>
              {/* Table header */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "60px 80px 1fr 200px 100px 100px",
                  gap: 16,
                  padding: "8px 16px",
                  borderBottom: "1px solid var(--border)",
                  fontSize: 10,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: "var(--text-secondary)",
                }}
              >
                <span>#</span>
                <span>Time</span>
                <span>Root Cause Sensors</span>
                <span>Explanation</span>
                <span>Confidence</span>
                <span>Severity</span>
              </div>

              {[...alerts].reverse().map((a) => (
                <div
                  key={a.alert_id}
                  className={`alert-row ${severityClass(a.severity)}`}
                  style={{
                    gridTemplateColumns: "60px 80px 1fr 200px 100px 100px",
                    gap: 16,
                    display: "grid",
                    alignItems: "center",
                    padding: "12px 16px",
                    marginBottom: 4,
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 11,
                      color: "var(--text-secondary)",
                    }}
                  >
                    #{a.alert_id}
                  </div>
                  <div className="alert-time">{formatTime(a.timestamp)}</div>
                  <div className="alert-sensors">
                    {a.top_sensors?.map((s) => (
                      <span key={s.sensor} style={{ marginRight: 8 }}>
                        <span style={{ color: "var(--amber)" }}>
                          {s.sensor}
                        </span>
                        <span
                          style={{
                            color: "var(--text-secondary)",
                            fontSize: 10,
                          }}
                        >
                          {" "}
                          {s.direction?.split(" ")[0]}
                        </span>
                      </span>
                    )) || "—"}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-secondary)",
                      lineHeight: 1.5,
                    }}
                  >
                    {a.top_sensors?.[0]
                      ? `${a.top_sensors[0].sensor} ${a.top_sensors[0].direction}`
                      : "—"}
                  </div>
                  <div className="alert-confidence">
                    {(a.confidence * 100).toFixed(1)}%
                  </div>
                  <div>
                    <span className={`badge ${severityClass(a.severity)}`}>
                      {a.severity?.replace(/[🔴🟠🟡🟢✅]/gu, "").trim()}
                    </span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
