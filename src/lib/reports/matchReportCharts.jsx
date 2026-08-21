import React from "react";
import { createRoot } from "react-dom/client";
import {
  BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend, LineChart, Line, ReferenceLine, ResponsiveContainer,
} from "recharts";

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
    img.onload = () => { ctx.drawImage(img, 0, 0, width, height); resolve(canvas.toDataURL("image/png")); };
    img.onerror = reject;
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));
  });
}

async function renderChart(jsx, width, height) {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.width = `${width}px`;
  container.style.height = `${height}px`;
  container.style.background = "#ffffff";
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    await new Promise((resolve) => { root.render(jsx); setTimeout(resolve, 150); });
    const svg = container.querySelector("svg");
    if (!svg) return null;
    return await svgToPng(svg, width, height);
  } catch {
    return null;
  } finally {
    root.unmount();
    document.body.removeChild(container);
  }
}

export async function renderComparisonChartPng(data, width = 560, height = 260) {
  return renderChart(
    <ResponsiveContainer width={1} height={1}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 60, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
        <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 10 }} />
        <YAxis type="category" dataKey="metric" tick={{ fill: "#374151", fontSize: 11 }} width={120} />
        <Tooltip />
        <Legend />
        <Bar dataKey="Partido" fill="#00843D" radius={[0, 4, 4, 0]} />
        <Bar dataKey="Promedio personal" fill="#9ca3af" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>,
    width, height
  );
}

export async function renderEvolutionChartPng(data, metricKey, color, width = 560, height = 260) {
  return renderChart(
    <ResponsiveContainer width={1} height={1}>
      <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
        <XAxis dataKey="shortDate" tick={{ fill: "#6b7280", fontSize: 10 }} />
        <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} width={44} />
        <Tooltip />
        <ReferenceLine y={data[0]?.average} stroke="#9ca3af" strokeDasharray="5 5" label={{ value: "Promedio", fill: "#6b7280", fontSize: 9, position: "right" }} />
        <Line type="monotone" dataKey={metricKey} stroke={color} strokeWidth={2.5} dot={{ r: 4, fill: color, strokeWidth: 0 }} />
      </LineChart>
    </ResponsiveContainer>,
    width, height
  );
}