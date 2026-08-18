import React from "react";
import { createRoot } from "react-dom/client";
import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";

const METRICS = [
  { key: "peso", label: "Peso", unit: "kg", color: "#60a5fa" },
  { key: "sumatoria_6p", label: "Sum. 6 Pliegues", unit: "mm", color: "#fb923c" },
  { key: "porcentaje_grasa", label: "% Grasa", unit: "%", color: "#f472b6" },
  { key: "kg_masa_muscular", label: "Masa Muscular", unit: "kg", color: "#a78bfa" },
];

function buildChartData(sorted, metricKey) {
  return sorted.map((a, i) => {
    const prev = i > 0 ? sorted[i - 1] : null;
    const val = a[metricKey];
    const prevVal = prev?.[metricKey];
    const diff = val != null && prevVal != null ? Number(val) - Number(prevVal) : null;
    return {
      label: a.fecha ? new Date(a.fecha + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) : "—",
      [metricKey]: val != null ? Number(val) : null,
      diff,
    };
  });
}

function ChartCanvas({ sorted, metric, seasonAvg }) {
  const data = buildChartData(sorted, metric.key);
  return (
    <ResponsiveContainer width={1} height={1}>
      <LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 10 }} />
        <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} width={36} />
        <Tooltip />
        {seasonAvg != null && (
          <ReferenceLine y={seasonAvg} stroke="#9ca3af" strokeDasharray="4 2" />
        )}
        <Line
          type="monotone"
          dataKey={metric.key}
          stroke={metric.color}
          strokeWidth={2.5}
          dot={{ r: 3, fill: metric.color, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function svgToPng(svg, width, height) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = width * 2;
    canvas.height = height * 2;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(2, 2);
    const xml = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));
  });
}

export async function renderChartsToPng(sorted, options = {}) {
  const { width = 520, height = 240 } = options;
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.width = `${width}px`;
  container.style.height = `${height}px`;
  container.style.background = "#ffffff";
  document.body.appendChild(container);

  const root = createRoot(container);
  const results = {};

  try {
    for (const metric of METRICS) {
      const vals = sorted.map((a) => a[metric.key]).filter((v) => v != null).map(Number);
      const seasonAvg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;

      await new Promise((resolve) => {
        root.render(<ChartCanvas sorted={sorted} metric={metric} seasonAvg={seasonAvg} />);
        setTimeout(resolve, 120);
      });

      const svg = container.querySelector("svg");
      if (svg) {
        try {
          results[metric.key] = await svgToPng(svg, width, height);
        } catch {
          results[metric.key] = null;
        }
      }
    }
  } finally {
    root.unmount();
    document.body.removeChild(container);
  }

  return results;
}

export { METRICS };