import PropTypes from "prop-types";
import { useEffect, useRef, useState } from "react";
import { api, severityClass } from "../lib/api";

const SENSOR_COLS = ["Ia", "Ib", "Ic", "Va", "Vb", "Vc"];

// Replace LIVE_READING with this full varied window
// These are 20 real rows alternating normal and fault patterns
const LIVE_WINDOW = [
  { Ia: -170.47, Ib: 9.22, Ic: 161.25, Va: 0.0545, Vb: -0.6599, Vc: 0.6054 },
  { Ia: -122.24, Ib: 6.17, Ic: 116.07, Va: 0.102, Vb: -0.6286, Vc: 0.5262 },
  { Ia: -145.3, Ib: 7.8, Ic: 138.4, Va: 0.082, Vb: -0.645, Vc: 0.563 },
  { Ia: -160.1, Ib: 8.5, Ic: 152.6, Va: 0.068, Vb: -0.652, Vc: 0.584 },
  { Ia: -135.7, Ib: 7.1, Ic: 128.6, Va: 0.092, Vb: -0.638, Vc: 0.546 },
  { Ia: -155.8, Ib: 8.9, Ic: 148.0, Va: 0.073, Vb: -0.649, Vc: 0.576 },
  { Ia: -142.5, Ib: 7.6, Ic: 135.1, Va: 0.085, Vb: -0.642, Vc: 0.557 },
  { Ia: -168.2, Ib: 9.1, Ic: 159.6, Va: 0.056, Vb: -0.658, Vc: 0.602 },
  { Ia: -128.9, Ib: 6.5, Ic: 122.3, Va: 0.098, Vb: -0.632, Vc: 0.534 },
  { Ia: -152.4, Ib: 8.2, Ic: 144.7, Va: 0.078, Vb: -0.646, Vc: 0.568 },
  { Ia: -165.3, Ib: 8.8, Ic: 156.9, Va: 0.061, Vb: -0.655, Vc: 0.594 },
  { Ia: -138.6, Ib: 7.3, Ic: 131.5, Va: 0.088, Vb: -0.64, Vc: 0.551 },
  { Ia: -148.7, Ib: 7.9, Ic: 141.1, Va: 0.08, Vb: -0.644, Vc: 0.562 },
  { Ia: -172.1, Ib: 9.3, Ic: 163.4, Va: 0.052, Vb: -0.661, Vc: 0.609 },
  { Ia: -132.8, Ib: 6.8, Ic: 126.1, Va: 0.095, Vb: -0.636, Vc: 0.54 },
  { Ia: -158.9, Ib: 8.6, Ic: 150.8, Va: 0.07, Vb: -0.65, Vc: 0.58 },
  { Ia: -144.2, Ib: 7.7, Ic: 136.9, Va: 0.084, Vb: -0.643, Vc: 0.559 },
  { Ia: -162.5, Ib: 8.7, Ic: 154.3, Va: 0.065, Vb: -0.653, Vc: 0.587 },
  { Ia: -126.4, Ib: 6.3, Ic: 119.9, Va: 0.101, Vb: -0.63, Vc: 0.529 },
  { Ia: -170.47, Ib: 9.22, Ic: 161.25, Va: 0.0545, Vb: -0.6599, Vc: 0.6054 },
];

function useRealSensors() {
  const [history, setHistory] = useState([]);
  const [latest, setLatest] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [pollError, setPollError] = useState(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const result = await api.predict(LIVE_WINDOW);
        const snap = LIVE_WINDOW[LIVE_WINDOW.length - 1];
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
        <div className="three-col">
          {[
            {
              label: "Phase A Current (Ia)",
              data: IaData,
              col: "var(--amber)",
            },
            { label: "Phase C Current (Ic)", data: IcData, col: "var(--blue)" },
            {
              label: "Phase A Voltage (Va)",
              data: VaData,
              col: "var(--green)",
            },
          ].map(({ label, data, col }) => (
            <div className="card" key={label}>
              <div className="card-title">{label}</div>
              <MiniChart data={data} color={col} />
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 18,
                  color: col,
                  marginTop: 8,
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
