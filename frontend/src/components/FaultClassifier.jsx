import { useState } from "react";
import { api } from "../lib/api";

const SENSOR_COLS = ["Ia", "Ib", "Ic", "Va", "Vb", "Vc"];

// Keys now EXACTLY match your dataset strings
const FAULT_COLORS = {
  "No Fault": "#22c55e", // green
  "Phase A + Ground": "#f59e0b", // amber
  "Phase AB + Ground": "#ef4444", // red
  "Phase ABC Fault": "#8b5cf6", // purple
  "Phase BC Fault": "#3b82f6", // blue
  "Three Phase + Ground": "#ec4899", // pink
};

const SAMPLE_READINGS = [
  {
    label: "Normal",
    values: {
      Ia: 61.81,
      Ib: -22.86,
      Ic: 21.1,
      Va: 0.3663,
      Vb: -0.5672,
      Vc: 0.2009,
    },
  },
  {
    label: "Phase A + Ground",
    values: {
      Ia: -336.19,
      Ib: -76.28,
      Ic: 18.33,
      Va: 0.3127,
      Vb: -0.1236,
      Vc: -0.1891,
    },
  },
  {
    label: "Three Phase + Ground",
    values: {
      Ia: -342.24,
      Ib: 224.82,
      Ic: 119.15,
      Va: 0.0953,
      Vb: -0.0023,
      Vc: -0.093,
    },
  },
];

export default function FaultClassifier() {
  const [values, setValues] = useState(SAMPLE_READINGS[0].values);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleClassify = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.faultType(values);
      setResult(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Uses the exact string to grab the color, defaulting to gray if not found
  const faultColor = result
    ? FAULT_COLORS[result.fault_type] || "#9ca3af"
    : "#9ca3af";

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Fault Classifier</div>
          <div className="page-sub">
            Stage 2 — Identify fault type after anomaly detection
          </div>
        </div>
      </div>

      <div className="page-body">
        <div className="two-col">
          <div>
            <div className="card">
              <div className="card-title">Sensor Reading</div>

              {/* Quick samples */}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginBottom: 20,
                  flexWrap: "wrap",
                }}
              >
                {SAMPLE_READINGS.map((s) => (
                  <button
                    key={s.label}
                    className="btn btn-ghost"
                    style={{ fontSize: 10, padding: "5px 12px" }}
                    onClick={() => {
                      setValues(s.values);
                      setResult(null);
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="field-row">
                {SENSOR_COLS.map((col) => (
                  <div className="field-group" key={col}>
                    <label className="field-label">{col}</label>
                    <input
                      className="field-input"
                      type="number"
                      step="0.0001"
                      value={values[col]}
                      onChange={(e) =>
                        setValues((v) => ({
                          ...v,
                          [col]: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                ))}
              </div>

              <button
                className="btn btn-primary"
                onClick={handleClassify}
                disabled={loading}
                style={{ width: "100%", marginTop: 16 }}
              >
                {loading ? "CLASSIFYING..." : "IDENTIFY FAULT TYPE →"}
              </button>

              {error && (
                <div
                  style={{
                    marginTop: 12,
                    color: "var(--red)",
                    fontFamily: "var(--font-display)",
                    fontSize: 12,
                  }}
                >
                  {error.includes("not trained")
                    ? "⚠ Fault classifier not trained yet. Run train_fault_classifier.py first."
                    : `ERROR: ${error}`}
                </div>
              )}
            </div>

            {/* Fault type reference */}
            <div className="card">
              <div className="card-title">Fault Type Reference</div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                {Object.entries(FAULT_COLORS).map(([type, color]) => (
                  <div
                    key={type}
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        background: color,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{ fontSize: 11, color: "var(--text-secondary)" }}
                    >
                      {type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            {!result && !loading && (
              <div
                className="card"
                style={{
                  minHeight: 300,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div className="empty-state">
                  Run detection first to identify
                  <br />
                  the specific fault type
                </div>
              </div>
            )}

            {loading && (
              <div
                className="card"
                style={{
                  minHeight: 300,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div className="loading-text">CLASSIFYING FAULT...</div>
              </div>
            )}

            {result && (
              <>
                <div
                  className="result-panel"
                  style={{ borderColor: faultColor }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      letterSpacing: 2,
                      textTransform: "uppercase",
                      color: "var(--text-secondary)",
                      marginBottom: 8,
                    }}
                  >
                    Fault Type Identified
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 24,
                      color: faultColor,
                      marginBottom: 20,
                    }}
                  >
                    {result.fault_type}
                  </div>

                  <div style={{ display: "flex", gap: 24, marginBottom: 20 }}>
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
                        Classifier Confidence
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: 22,
                          color: faultColor,
                        }}
                      >
                        {(result.confidence * 100).toFixed(1)}%
                      </div>
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${result.confidence * 100}%`,
                            background: faultColor,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="divider" />

                  <div
                    style={{
                      fontSize: 10,
                      letterSpacing: 2,
                      textTransform: "uppercase",
                      color: "var(--text-secondary)",
                      marginBottom: 12,
                    }}
                  >
                    Input Sensor Values
                  </div>

                  <table className="sensor-table">
                    <tbody>
                      {SENSOR_COLS.map((col) => (
                        <tr key={col}>
                          <td className="sensor-name">{col}</td>
                          <td>
                            {result.sensor_readings?.[col]?.toFixed(4) ??
                              values[col]}
                          </td>
                          <td
                            style={{
                              color: "var(--text-secondary)",
                              fontSize: 11,
                            }}
                          >
                            {col.startsWith("I") ? "Amperes" : "per unit"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="card" style={{ marginTop: 0 }}>
                  <div className="card-title">What This Means</div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--text-secondary)",
                      lineHeight: 1.8,
                    }}
                  >
                    {/* Exact 1-to-1 matching for your 6 categories */}
                    {result.fault_type === "No Fault" &&
                      "All three phases are operating within normal parameters. No protective action required."}
                    {result.fault_type === "Phase A + Ground" &&
                      "A ground fault on Phase A indicates insulation breakdown or physical contact between conductor A and earth. Immediate inspection recommended."}
                    {result.fault_type === "Phase AB + Ground" &&
                      "A double line-to-ground fault involving Phases A and B. High severity, causes significant system unbalance."}
                    {result.fault_type === "Phase ABC Fault" &&
                      "A three-phase clear fault (no ground). All three conductors are shorted together. Requires emergency protective relay action."}
                    {result.fault_type === "Phase BC Fault" &&
                      "A line-to-line fault between Phases B and C. Check conductors for physical shorts or phase-to-phase insulation failure."}
                    {result.fault_type === "Three Phase + Ground" &&
                      "The most severe fault type — all three conductors are shorted to each other and to ground. Emergency breaker trip required."}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
