import PropTypes from "prop-types";
import { useState } from "react";
import { api, severityClass } from "../lib/api";

const SENSOR_COLS = ["Ia", "Ib", "Ic", "Va", "Vb", "Vc"];
const UNITS = { Ia: "A", Ib: "A", Ic: "A", Va: "p.u.", Vb: "p.u.", Vc: "p.u." };

const SAMPLE_NORMAL = {
  Ia: -170.4721,
  Ib: 9.2196,
  Ic: 161.2525,
  Va: -0.0544,
  Vb: -0.6599,
  Vc: 0.6054,
};

const SAMPLE_FAULT = {
  Ia: -151.29,
  Ib: -9.68,
  Ic: 85.8,
  Va: 0.4007,
  Vb: -0.1329,
  Vc: -0.2678,
};

function ShapBar({ sensor, impact, direction }) {
  const maxImpact = 1.0;
  const pct = Math.min(Math.abs(impact) / maxImpact, 1) * 100;
  const isNeg = impact < 0;

  return (
    <div className="shap-row">
      <div className="shap-label">{sensor}</div>
      <div className="shap-bar-bg">
        <div
          className={`shap-bar-fill ${isNeg ? "negative" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="shap-impact">
        <span style={{ color: isNeg ? "var(--blue)" : "var(--amber)" }}>
          {impact > 0 ? "+" : ""}
          {impact.toFixed(4)}
        </span>
      </div>
      <div
        style={{
          fontSize: 10,
          color: "var(--text-secondary)",
          letterSpacing: 1,
        }}
      >
        {direction}
      </div>
    </div>
  );
}

ShapBar.propTypes = {
  sensor: PropTypes.string.isRequired,
  impact: PropTypes.number.isRequired,
  direction: PropTypes.string.isRequired,
};

export default function Predict() {
  const [values, setValues] = useState(SAMPLE_NORMAL);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handlePredict = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const isFaultLike =
        Math.abs(values.Ia) > 250 || Math.abs(values.Va) > 0.35;
      const sampleRes = await fetch(
        `http://localhost:8000/sample-window/?fault=${isFaultLike}`,
      );
      const sampleData = await sampleRes.json();

      const readings = [...sampleData.readings.slice(0, 19), { ...values }];
      const res = await api.predict(readings);
      setResult(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadSample = (sample) => {
    setValues(sample);
    setResult(null);
    setError(null);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Fault Diagnosis</div>
          <div className="page-sub">
            Input sensor values · Run hybrid detection · Get SHAP explanation
          </div>
        </div>
      </div>

      <div className="page-body">
        <div className="two-col">
          {/* Input panel */}
          <div>
            <div className="card">
              <div className="card-title">Sensor Input</div>

              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                <button
                  className="btn btn-ghost"
                  onClick={() => loadSample(SAMPLE_NORMAL)}
                  style={{ fontSize: 10, padding: "6px 14px" }}
                >
                  Load Normal Sample
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => loadSample(SAMPLE_FAULT)}
                  style={{ fontSize: 10, padding: "6px 14px" }}
                >
                  Load Fault Sample
                </button>
              </div>

              <div className="field-row">
                {SENSOR_COLS.map((col) => (
                  <div className="field-group" key={col}>
                    <label className="field-label">
                      {col} ({UNITS[col]})
                    </label>
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

              <div
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  marginBottom: 16,
                }}
              >
                ↳ Reading will be repeated ×10 to satisfy LSTM window
                requirement
              </div>

              <button
                className="btn btn-primary"
                onClick={handlePredict}
                disabled={loading}
                style={{ width: "100%" }}
              >
                {loading ? "ANALYZING..." : "RUN HYBRID DETECTION →"}
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
                  ERROR: {error}
                </div>
              )}
            </div>

            {/* How it works */}
            <div className="card">
              <div className="card-title">Detection Pipeline</div>
              {[
                [
                  "01",
                  "Isolation Forest",
                  "Unsupervised outlier scoring on raw sensor values",
                ],
                [
                  "02",
                  "LSTM Autoencoder",
                  "Reconstruction error on 10-step sliding window",
                ],
                [
                  "03",
                  "Hybrid AND/OR Gate",
                  "Both models must agree to minimize false positives",
                ],
                [
                  "04",
                  "SHAP Explanation",
                  "TreeExplainer attributes which sensor drove the score",
                ],
              ].map(([num, title, desc]) => (
                <div
                  key={num}
                  style={{
                    display: "flex",
                    gap: 14,
                    marginBottom: 14,
                    alignItems: "flex-start",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 11,
                      color: "var(--amber)",
                      minWidth: 20,
                    }}
                  >
                    {num}
                  </div>
                  <div>
                    <div
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 12,
                        color: "var(--text-primary)",
                        marginBottom: 2,
                      }}
                    >
                      {title}
                    </div>
                    <div
                      style={{ fontSize: 11, color: "var(--text-secondary)" }}
                    >
                      {desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Result panel */}
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
                  Enter sensor values
                  <br />
                  and run detection
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
                <div className="loading-text">RUNNING HYBRID MODEL...</div>
              </div>
            )}

            {result && (
              <>
                <div className={`result-panel fault-${result.is_fault}`}>
                  <div className="result-heading">
                    {result.is_fault
                      ? "⬡ FAULT DETECTED"
                      : "◉ NORMAL OPERATION"}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 24,
                      marginBottom: 20,
                      flexWrap: "wrap",
                    }}
                  >
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
                        className={`badge ${severityClass(result.severity)}`}
                      >
                        {result.severity?.replace(/[🔴🟠🟡🟢✅]/gu, "").trim()}
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
                        Confidence
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: 20,
                          color: "var(--amber)",
                        }}
                      >
                        {(result.confidence * 100).toFixed(1)}%
                      </div>
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
                        LSTM Error
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: 14,
                          color: "var(--text-mono)",
                        }}
                      >
                        {result.lstm_error?.toFixed(6)}
                      </div>
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
                        Threshold
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: 14,
                          color: "var(--text-secondary)",
                        }}
                      >
                        {result.threshold?.toFixed(6)}
                      </div>
                    </div>
                  </div>

                  <div className="divider" />

                  <div
                    style={{
                      marginBottom: 12,
                      fontSize: 10,
                      letterSpacing: 2,
                      textTransform: "uppercase",
                      color: "var(--text-secondary)",
                    }}
                  >
                    SHAP Root Cause Analysis
                  </div>

                  {result.top_sensors?.map((s) => (
                    <ShapBar key={s.sensor} {...s} />
                  ))}

                  <div className="divider" />

                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-secondary)",
                      lineHeight: 1.8,
                    }}
                  >
                    {result.top_sensors?.[0] && (
                      <>
                        <span
                          style={{
                            color: "var(--amber)",
                            fontFamily: "var(--font-display)",
                          }}
                        >
                          {result.top_sensors[0].sensor}
                        </span>{" "}
                        is the primary anomaly driver —{" "}
                        {result.top_sensors[0].direction} with impact score{" "}
                        {Math.abs(result.top_sensors[0].impact).toFixed(4)}.
                        {result.top_sensors[1] && (
                          <>
                            {" "}
                            Secondary contributor:{" "}
                            <span
                              style={{
                                color: "var(--blue)",
                                fontFamily: "var(--font-display)",
                              }}
                            >
                              {result.top_sensors[1].sensor}
                            </span>{" "}
                            {result.top_sensors[1].direction}.
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Progress bar for confidence */}
                <div className="card" style={{ marginTop: 0 }}>
                  <div className="card-title">Confidence Score</div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${result.confidence * 100}%` }}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: 8,
                      fontSize: 11,
                      fontFamily: "var(--font-display)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <span>0%</span>
                    <span style={{ color: "var(--amber)" }}>
                      {(result.confidence * 100).toFixed(1)}%
                    </span>
                    <span>100%</span>
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
