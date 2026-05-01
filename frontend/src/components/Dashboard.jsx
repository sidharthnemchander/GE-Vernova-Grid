import PropTypes from "prop-types";
import { useEffect, useRef, useState } from "react";
import { api, severityClass } from "../lib/api";

const SENSOR_COLS = ["Ia", "Ib", "Ic", "Va", "Vb", "Vc"];

function useRealSensors() {
  const [history, setHistory] = useState([]);
  const [latest, setLatest] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [pollError, setPollError] = useState(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const isFault = Math.random() < 0.4;
        const base = import.meta.env.VITE_API_URL || "http://localhost:8000";
        const sampleRes = await fetch(
          `${base}/sample-window/?fault=${isFault}`,
        );
        const sampleData = await sampleRes.json();

        if (sampleData.error) throw new Error(sampleData.error);

        const readings = sampleData.readings;

        const result = await api.predict(readings);

        const snap = readings[readings.length - 1];
        setLatest(snap);
        setLastResult(result);
        setHistory((prev) => [...prev.slice(-49), snap]);
        setPollError(null);
      } catch (e) {
        setPollError(e.message);
      }
    };

    poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, []);

  return { history, latest, lastResult, pollError };
}

function MiniChart({ data, color = "var(--amber)" }) {
  const canvasRef = useRef();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();
    data.forEach((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [data, color]);

  return (
    <canvas
      ref={canvasRef}
      width={180}
      height={50}
      style={{ display: "block", width: "100%", height: 50 }}
    />
  );
}

MiniChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.number).isRequired,
  color: PropTypes.string,
};

export default function Dashboard() {
  const { history, latest, lastResult, pollError } = useRealSensors();
  const [alerts, setAlerts] = useState([]);
  const [health, setHealth] = useState(null);
  const [now, setNow] = useState(new Date());

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Health + alerts polling
  useEffect(() => {
    api
      .health()
      .then(setHealth)
      .catch(() => {});
    api
      .alerts(5)
      .then(setAlerts)
      .catch(() => {});
    const t = setInterval(() => {
      api
        .health()
        .then(setHealth)
        .catch(() => {});
      api
        .alerts(5)
        .then(setAlerts)
        .catch(() => {});
    }, 8000);
    return () => clearInterval(t);
  }, []);

  const IaData = history.map((r) => r.Ia);
  const IcData = history.map((r) => r.Ic);
  const VaData = history.map((r) => r.Va);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">System Overview</div>
          <div className="page-sub">
            Polling /predict/ every 5s · {history.length} windows captured
            {pollError && (
              <span style={{ color: "var(--red)", marginLeft: 12 }}>
                ⚠ {pollError}
              </span>
            )}
          </div>
        </div>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 12,
            color: "var(--text-secondary)",
          }}
        >
          {now.toLocaleString("en-IN", { hour12: false })}
        </div>
      </div>

      <div className="page-body">
        {/* Stat strip */}
        <div className="stat-grid">
          <div className="stat-cell">
            <div className="stat-label">Model Threshold</div>
            <div className="stat-value amber mono">
              {health ? health.threshold.toFixed(5) : "—"}
            </div>
            <div className="stat-hint">LSTM reconstruction limit</div>
          </div>

          <div className="stat-cell">
            <div className="stat-label">Last LSTM Error</div>
            <div
              className="stat-value mono"
              style={{
                color: lastResult
                  ? lastResult.lstm_error > (health?.threshold || 0.007)
                    ? "var(--red)"
                    : "var(--green)"
                  : "var(--text-secondary)",
              }}
            >
              {lastResult ? lastResult.lstm_error.toFixed(5) : "—"}
            </div>
            <div className="stat-hint">vs threshold above</div>
          </div>

          <div className="stat-cell">
            <div className="stat-label">Last Prediction</div>
            <div
              className="stat-value"
              style={{
                fontSize: 15,
                paddingTop: 6,
                color: lastResult
                  ? lastResult.is_fault
                    ? "var(--red)"
                    : "var(--green)"
                  : "var(--text-secondary)",
              }}
            >
              {lastResult
                ? lastResult.is_fault
                  ? "FAULT"
                  : "NORMAL"
                : "WAITING..."}
            </div>
            <div className="stat-hint">
              {lastResult
                ? `${(lastResult.confidence * 100).toFixed(1)}% confidence`
                : "polling API"}
            </div>
          </div>

          <div className="stat-cell">
            <div className="stat-label">Logged Alerts</div>
            <div className="stat-value red">{alerts.length}</div>
            <div className="stat-hint">From /alerts/ endpoint</div>
          </div>
        </div>

        {/* Live waveforms — fed from real /predict/ poll history */}
        {/* Live values — waveforms removed for cleaner UI */}
        <div className="three-col">
          {[
            {
              label: "Phase A Current (Ia)",
              data: IaData,
              col: "#FFBF00",
            },
            {
              label: "Phase C Current (Ic)",
              data: IcData,
              col: "#2196F3",
            },
            {
              label: "Phase A Voltage (Va)",
              data: VaData,
              col: "#4CAF50",
            },
          ].map(({ label, data, col }) => (
            <div className="card" key={label}>
              <div className="card-title">{label}</div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 36,
                  fontWeight: "bold",
                  textAlign: "center",
                  color: col,
                  marginTop: 24,
                  marginBottom: 16,
                }}
              >
                {data.length ? data[data.length - 1].toFixed(3) : "—"}
              </div>
            </div>
          ))}
        </div>

        <div className="two-col">
          {/* Latest snapshot from real predict call */}
          <div className="card">
            <div className="card-title">Latest Sensor Snapshot</div>
            {latest ? (
              <table className="sensor-table">
                <thead>
                  <tr>
                    <th>Sensor</th>
                    <th>Value</th>
                    <th>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {SENSOR_COLS.map((col) => (
                    <tr key={col}>
                      <td className="sensor-name">{col}</td>
                      <td>{latest[col]?.toFixed(4)}</td>
                      <td
                        style={{ color: "var(--text-secondary)", fontSize: 11 }}
                      >
                        {col.startsWith("I") ? "A" : "p.u."}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="loading-text">AWAITING FIRST POLL...</div>
            )}

            {/* Last predict result summary below table */}
            {lastResult && (
              <>
                <div className="divider" />
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--text-secondary)",
                        letterSpacing: 2,
                        textTransform: "uppercase",
                        marginBottom: 4,
                      }}
                    >
                      Status
                    </div>
                    <span
                      className={`badge ${lastResult.is_fault ? "critical" : "normal"}`}
                    >
                      {lastResult.is_fault ? "FAULT" : "NORMAL"}
                    </span>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--text-secondary)",
                        letterSpacing: 2,
                        textTransform: "uppercase",
                        marginBottom: 4,
                      }}
                    >
                      Severity
                    </div>
                    <span
                      className={`badge ${severityClass(lastResult.severity)}`}
                    >
                      {lastResult.severity
                        ?.replace(/[🔴🟠🟡🟢✅]/gu, "")
                        .trim()}
                    </span>
                  </div>
                  {lastResult.top_sensors?.[0] && (
                    <div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--text-secondary)",
                          letterSpacing: 2,
                          textTransform: "uppercase",
                          marginBottom: 4,
                        }}
                      >
                        Primary Driver
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: 13,
                          color: "var(--amber)",
                        }}
                      >
                        {lastResult.top_sensors[0].sensor} ·{" "}
                        {lastResult.top_sensors[0].direction}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Recent alerts from /alerts/ */}
          <div className="card">
            <div className="card-title">Recent Fault Alerts</div>
            {alerts.length === 0 ? (
              <div className="empty-state">
                No alerts recorded yet.
                <br />
                Run a prediction from Diagnose page.
              </div>
            ) : (
              <div className="alert-feed">
                {alerts.map((a) => (
                  <div
                    key={a.alert_id}
                    className={`alert-row ${severityClass(a.severity)}`}
                  >
                    <div className="alert-time">#{a.alert_id}</div>
                    <div className="alert-sensors">
                      {a.top_sensors?.map((s) => s.sensor).join(" · ") || "—"}
                    </div>
                    <div className="alert-confidence">
                      {(a.confidence * 100).toFixed(1)}% conf
                    </div>
                    <div>
                      <span className={`badge ${severityClass(a.severity)}`}>
                        {a.severity?.replace(/[🔴🟠🟡🟢✅]/gu, "").trim()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
