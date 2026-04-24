const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function call(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "API error");
  }
  return res.json();
}

export const api = {
  health: () => call("/health"),

  predict: (readings) =>
    call("/predict/", {
      method: "POST",
      body: JSON.stringify({ readings }),
    }),

  explain: (reading) =>
    call("/explain/", {
      method: "POST",
      body: JSON.stringify(reading),
    }),

  alerts: (limit = 20) => call(`/alerts/?limit=${limit}`),

  faultType: (reading) =>
    call("/fault-type/", {
      method: "POST",
      body: JSON.stringify(reading),
    }),
};

export function severityClass(severity) {
  if (!severity) return "normal";
  const s = severity.toLowerCase();
  if (s.includes("critical")) return "critical";
  if (s.includes("high")) return "high";
  if (s.includes("medium")) return "medium";
  if (s.includes("low")) return "low";
  return "normal";
}

export function formatTime(iso) {
  if (!iso) return "--:--:--";
  return new Date(iso).toLocaleTimeString("en-IN", { hour12: false });
}
