import moment from "moment";
import "moment/locale/es.js";
import { jsPDF } from "jspdf";

moment.locale("es");

function fmt(value, unit = "") {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const number = Number(value);
  const shown = unit === "km/h" || unit === "u/min" || unit === "%" || number < 100
    ? number.toFixed(1)
    : Math.round(number).toLocaleString("es-AR");
  return `${shown} ${unit}`.trim();
}

const CLUB_LOGO_URL = "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/36f6c4008_defensa.png";
const PAGE = { w: 297, h: 210, m: 12, contentBottom: 193 };
const imageCache = new Map();

function dataUrlFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

function circularizeImage(dataUrl) {
  if (!dataUrl || typeof document === "undefined") return Promise.resolve(dataUrl);
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        const size = 256;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
        const width = image.naturalWidth * scale;
        const height = image.naturalHeight * scale;
        const x = (size - width) / 2;
        const y = (size - height) / 2;
        ctx.clearRect(0, 0, size, size);
        ctx.save();
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(image, x, y, width, height);
        ctx.restore();
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(dataUrl);
      }
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

export async function imageToDataUrl(url, { circle = false } = {}) {
  if (!url) return null;
  const cacheKey = `${circle ? "circle" : "plain"}:${url}`;
  if (!imageCache.has(cacheKey)) {
    imageCache.set(cacheKey, (async () => {
      try {
        const response = await fetch(url, { mode: "cors" });
        if (!response.ok) return null;
        const dataUrl = await dataUrlFromBlob(await response.blob());
        return circle ? circularizeImage(dataUrl) : dataUrl;
      } catch {
        return null;
      }
    })());
  }
  return imageCache.get(cacheKey);
}

function setText(doc, color = [40, 40, 40], size = 9, style = "normal") {
  doc.setTextColor(...color);
  doc.setFontSize(size);
  doc.setFont("helvetica", style);
}

function addImage(doc, dataUrl, x, y, w, h) {
  if (!dataUrl) return false;
  try {
    doc.addImage(dataUrl, dataUrl.includes("image/png") ? "PNG" : "JPEG", x, y, w, h);
    return true;
  } catch {
    return false;
  }
}

function hexToRgb(hex) {
  const clean = String(hex || "#22c55e").replace("#", "");
  const normalized = clean.length === 3 ? clean.split("").map((char) => char + char).join("") : clean;
  const number = parseInt(normalized, 16);
  return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
}

function chunks(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

function initials(name) {
  return String(name || "Jugador")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "J";
}

function drawPlayerAvatar(doc, photo, x, y, size, name) {
  if (addImage(doc, photo, x, y, size, size)) return;
  doc.setFillColor(227, 236, 230);
  doc.circle(x + size / 2, y + size / 2, size / 2, "F");
  setText(doc, [0, 94, 49], Math.max(4.8, size * 0.42), "bold");
  doc.text(initials(name), x + size / 2, y + size / 2 + size * 0.14, { align: "center" });
}

function header(doc, logo, meta) {
  doc.setFillColor(248, 250, 248);
  doc.rect(0, 0, PAGE.w, PAGE.h, "F");
  doc.setFillColor(0, 114, 54);
  doc.rect(0, 0, PAGE.w, 10, "F");
  doc.setFillColor(250, 204, 21);
  doc.rect(0, 10, PAGE.w, 2.5, "F");
  addImage(doc, logo, 12, 16, 18, 18);
  setText(doc, [0, 80, 42], 14, "bold");
  doc.text("PerformancePitch", 36, 22);
  setText(doc, [35, 35, 35], 10, "bold");
  doc.text("Informe profesional de rendimiento · Carga del Microciclo", 36, 29);
  setText(doc, [90, 90, 90], 7.5);
  doc.text(`Plantel: ${meta.squadName || "—"} · Temporada: ${meta.season || "—"}`, 36, 35);
}

function footer(doc, page, total, meta) {
  doc.setDrawColor(220, 225, 220);
  doc.line(PAGE.m, 198, PAGE.w - PAGE.m, 198);
  setText(doc, page === 1 && meta.coverIncluded ? [205, 220, 211] : [95, 95, 95], 7);
  doc.text(`Página ${page} de ${total}`, PAGE.m, 203);
  doc.text(`Generado ${moment().format("DD/MM/YYYY HH:mm")} · ${meta.squadName || "Plantel"}`, 102, 203);
  doc.text("PerformancePitch", 260, 203);
}

function addPage(doc, logo, meta) {
  if (doc.__started) doc.addPage("a4", "landscape");
  doc.__started = true;
  header(doc, logo, meta);
}

function drawFallbackShield(doc, x, y, w, h, text) {
  doc.setFillColor(235, 238, 235);
  doc.roundedRect(x, y, w, h, 4, 4, "F");
  setText(doc, [0, 80, 42], 14, "bold");
  doc.text(initials(text), x + w / 2, y + h / 2 + 4, { align: "center" });
}

function drawTeamCard(doc, { x, logo, name, label }) {
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, 66, 82, 78, 6, 6, "F");
  if (!addImage(doc, logo, x + 24, 76, 34, 34)) drawFallbackShield(doc, x + 24, 76, 34, 34, name);
  setText(doc, [20, 45, 32], 8.5, "bold");
  const nameLines = doc.splitTextToSize(name || "Equipo", 68).slice(0, 2);
  doc.text(nameLines, x + 41, 119, { align: "center" });
  setText(doc, [100, 110, 104], 6.5, "bold");
  doc.text(label || "", x + 41, 137, { align: "center" });
}

function drawCover(doc, logo, rivalLogo, meta) {
  doc.setFillColor(0, 45, 28);
  doc.rect(0, 0, PAGE.w, PAGE.h, "F");
  doc.setFillColor(250, 204, 21);
  doc.rect(0, 0, PAGE.w, 5, "F");
  setText(doc, [255, 255, 255], 22, "bold");
  doc.text("Informe de Carga del Microciclo", 18, 32);
  setText(doc, [190, 210, 200], 11);
  doc.text(`${meta.squadName || "Plantel"} · Temporada ${meta.season || "—"} · ${meta.start} - ${meta.end}`, 18, 42);

  if (!meta.hasMatch) {
    drawTeamCard(doc, { x: 107.5, logo, name: meta.clubName || "Defensa y Justicia", label: meta.squadName || "Reserva" });
    setText(doc, [255, 255, 255], 16, "bold");
    doc.text("Próximo partido no cargado en el Tablero del club", 148.5, 165, { align: "center" });
    setText(doc, [205, 220, 211], 9);
    doc.text("El informe se genera igualmente con los datos deportivos disponibles.", 148.5, 177, { align: "center" });
    doc.__started = true;
    return;
  }

  const club = { logo, name: meta.clubName || "Defensa y Justicia" };
  const rival = { logo: rivalLogo, name: meta.rival };
  const left = meta.isHome ? club : rival;
  const right = meta.isHome ? rival : club;
  drawTeamCard(doc, { x: 42, ...left, label: "Local" });
  drawTeamCard(doc, { x: 173, ...right, label: "Visitante" });

  const matchTitle = meta.isHome
    ? `${meta.squadName || "Reserva"} vs. ${meta.rival}`
    : `${meta.rival} vs. ${meta.squadName || "Reserva"}`;
  setText(doc, [255, 255, 255], 18, "bold");
  doc.text(matchTitle, 148.5, 158, { align: "center", maxWidth: 260 });

  const detailLine = [meta.matchDate, meta.time, meta.competition, meta.round, meta.homeAway].filter(Boolean).join(" · ");
  setText(doc, [210, 225, 215], 9.5);
  doc.text(doc.splitTextToSize(detailLine, 250), 148.5, 169, { align: "center" });
  doc.__started = true;
}

function drawCycleDays(doc, logo, meta, days = []) {
  addPage(doc, logo, meta);
  setText(doc, [20, 20, 20], 12, "bold");
  doc.text("Cargas del microciclo", 12, 48);
  let y = 58;

  days.forEach((day, index) => {
    if (y + 12 > PAGE.contentBottom) {
      addPage(doc, logo, meta);
      setText(doc, [20, 20, 20], 12, "bold");
      doc.text("Cargas del microciclo · continuación", 12, 48);
      y = 58;
    }
    doc.setFillColor(index % 2 ? 248 : 238, index % 2 ? 250 : 244, index % 2 ? 248 : 240);
    doc.roundedRect(12, y, PAGE.w - 24, 12, 2, 2, "F");
    const cells = [
      day.md || "—",
      moment(day.date).format("dddd DD/MM"),
      day.objetivo || day.objective || "—",
      `${day.sessions?.length || 0} cargas`,
      day.rival ? `Partido vs. ${day.rival}` : "",
      day.gpsPlayers ? `GPS ${day.gpsPlayers}` : "",
    ];
    const widths = [18, 42, 56, 34, 78, 40];
    let x = 14;
    cells.forEach((cell, cellIndex) => {
      setText(doc, [35, 35, 35], 7.2, cellIndex === 0 ? "bold" : "normal");
      doc.text(String(cell), x, y + 8, { maxWidth: widths[cellIndex] - 2 });
      x += widths[cellIndex];
    });
    y += 14;
  });
}

function drawChart(doc, metric, data, x, y, w, h, type = "bar") {
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, w, h, 3, 3, "F");
  doc.setDrawColor(220, 226, 220);
  doc.roundedRect(x, y, w, h, 3, 3, "S");
  setText(doc, [20, 20, 20], 10, "bold");
  doc.text(metric.label, x + 5, y + 8);
  setText(doc, [95, 95, 95], 6.5);
  doc.text(`${metric.group || "Métrica"} · ${metric.unit || "sin unidad"}`, x + 5, y + 14);

  const plot = { x: x + 12, y: y + 24, w: w - 20, h: h - 42 };
  const values = data.map((day) => Number(day[metric.key])).filter(Number.isFinite);
  const max = Math.max(...values, 1) * 1.18;
  const gap = 3;
  const barW = Math.max(5, (plot.w - gap * (data.length + 1)) / Math.max(data.length, 1));
  const points = data.map((day, index) => {
    const value = Number(day[metric.key]) || 0;
    const px = plot.x + gap + index * (barW + gap) + barW / 2;
    const py = plot.y + plot.h - (value / max) * plot.h;
    return { x: px, y: py, value, label: day.md || "—" };
  });

  if (type === "line" || type === "area") {
    doc.setDrawColor(...hexToRgb(metric.color));
    doc.setLineWidth(1.2);
    points.slice(1).forEach((point, index) => doc.line(points[index].x, points[index].y, point.x, point.y));
    points.forEach((point) => {
      doc.setFillColor(...hexToRgb(metric.color));
      doc.circle(point.x, point.y, 1.8, "F");
    });
  } else {
    data.forEach((day, index) => {
      const value = Number(day[metric.key]) || 0;
      const barHeight = Math.max(1.5, (value / max) * plot.h);
      const barX = plot.x + gap + index * (barW + gap);
      const barY = plot.y + plot.h - barHeight;
      doc.setFillColor(...hexToRgb(metric.color));
      doc.roundedRect(barX, barY, barW, barHeight, 1.5, 1.5, "F");
    });
  }

  points.forEach((point) => {
    setText(doc, [40, 40, 40], 6.5, "bold");
    doc.text(fmt(point.value, metric.unit), point.x, Math.max(plot.y - 2, point.y - 2), { align: "center" });
    setText(doc, [90, 90, 90], 6);
    doc.text(String(point.label), point.x, plot.y + plot.h + 5, { align: "center" });
  });
}

function drawCharts(doc, logo, meta, metrics, dailySummaries, chartConfig = {}) {
  const jobs = metrics.flatMap((metric) =>
    chunks(dailySummaries, 8).map((data) => ({
      metric,
      data,
      type: chartConfig.chartTypes?.[metric.key] || "bar",
    }))
  );
  chunks(jobs, 2).forEach((pair) => {
    addPage(doc, logo, meta);
    pair.forEach((job, index) =>
      drawChart(doc, job.metric, job.data, index === 0 ? 12 : 153.5, 46, 131.5, 132, job.type)
    );
  });
}

function rowDuration(row) {
  const direct = Number(row.duration_minutes || row.minutes || row.duration || 0);
  if (direct) return direct;
  const distance = Number(row.total_distance || 0);
  const mMin = Number(row.m_min || 0);
  return distance && mMin ? distance / mMin : 0;
}

function aggregatePlayerRows(rows, metrics, playerMap = {}) {
  const byPlayer = {};
  rows.forEach((row) => {
    const id = row.player_id;
    if (!id) return;
    const player = row.player || playerMap[id] || {};
    const current = byPlayer[id] || {
      id,
      name: row.player_name || player.full_name || "Jugador",
      position: row.position || player.position || "",
      photoUrl: player.photo_url || row.photo_url || "",
      values: {},
      distanceDuration: 0,
      loadDuration: 0,
      total_distance: 0,
      player_load: 0,
      sessions: new Set(),
    };

    metrics.forEach((metric) => {
      const value = Number(row[metric.key]);
      if (metric.rankMode === "weightedDistanceDuration") {
        const duration = rowDuration(row);
        if (duration && row.total_distance) {
          current.distanceDuration += duration;
          current.total_distance += Number(row.total_distance);
        }
      } else if (metric.rankMode === "weightedPlayerLoadDuration") {
        const duration = rowDuration(row);
        if (duration && row.player_load) {
          current.loadDuration += duration;
          current.player_load += Number(row.player_load);
        }
      } else if (metric.rankMode === "countSessions") {
        if (row.session_id) current.sessions.add(row.session_id);
      } else if (metric.rankMode === "max" || metric.mode === "max") {
        current.values[metric.key] = Number.isFinite(value)
          ? Math.max(current.values[metric.key] || 0, value)
          : current.values[metric.key];
      } else if (Number.isFinite(value)) {
        current.values[metric.key] = (current.values[metric.key] || 0) + value;
      }
    });
    byPlayer[id] = current;
  });

  return Object.values(byPlayer)
    .map((player) => ({
      ...player,
      values: Object.fromEntries(metrics.map((metric) => [
        metric.key,
        metric.rankMode === "weightedDistanceDuration"
          ? (player.distanceDuration ? player.total_distance / player.distanceDuration : null)
          : metric.rankMode === "weightedPlayerLoadDuration"
            ? (player.loadDuration ? player.player_load / player.loadDuration : null)
            : metric.rankMode === "countSessions"
              ? player.sessions.size
              : player.values[metric.key],
      ])),
    }))
    .sort((left, right) => (right.values.total_distance || 0) - (left.values.total_distance || 0));
}

async function preloadPlayerPhotos(rows = [], highlights = [], playerMap = {}) {
  const players = new Map();
  rows.forEach((row) => {
    const id = row.player_id;
    if (!id) return;
    const player = row.player || playerMap[id] || {};
    players.set(id, { url: player.photo_url || row.photo_url || "", name: row.player_name || player.full_name || "Jugador" });
  });
  highlights.forEach((highlight) => {
    (highlight.top || []).forEach((item) => {
      const id = item.player_id || item.player?.id;
      if (!id) return;
      const player = item.player || playerMap[id] || {};
      players.set(id, { url: player.photo_url || "", name: item.name || player.full_name || "Jugador" });
    });
  });

  const entries = await Promise.all(
    Array.from(players.entries()).map(async ([id, descriptor]) => [
      id,
      descriptor.url ? await imageToDataUrl(descriptor.url, { circle: true }) : null,
    ])
  );
  return Object.fromEntries(entries);
}

function drawPlayerTable(doc, logo, meta, rows, metrics, playerMap, playerPhotos) {
  const players = aggregatePlayerRows(rows, metrics, playerMap);
  const rowsPerPage = 14;
  chunks(metrics, 6).forEach((metricSet) => {
    chunks(players, rowsPerPage).forEach((playerPage, pageIndex) => {
      addPage(doc, logo, meta);
      setText(doc, [20, 20, 20], 12, "bold");
      doc.text(pageIndex ? "Tabla acumulada de jugadores · continuación" : "Tabla acumulada de jugadores", 12, 48);

      const headers = ["Jugador", "Pos.", ...metricSet.map((metric) => metric.short || metric.label)];
      const widths = [64, 20, ...metricSet.map(() => (PAGE.w - 24 - 84) / Math.max(metricSet.length, 1))];
      let y = 56;
      doc.setFillColor(0, 114, 54);
      doc.rect(12, y, PAGE.w - 24, 8, "F");
      let x = 12;
      headers.forEach((heading, index) => {
        setText(doc, [255, 255, 255], 7, "bold");
        doc.text(heading, x + widths[index] / 2, y + 5.2, { align: "center" });
        x += widths[index];
      });

      y += 8;
      playerPage.forEach((player, rowIndex) => {
        x = 12;
        const rowHeight = 9;
        doc.setFillColor(rowIndex % 2 ? 248 : 238, rowIndex % 2 ? 250 : 244, rowIndex % 2 ? 248 : 240);
        doc.rect(12, y, PAGE.w - 24, rowHeight, "F");
        drawPlayerAvatar(doc, playerPhotos[player.id], x + 2, y + 1.25, 6.5, player.name);
        setText(doc, [35, 35, 35], 6.8, "bold");
        doc.text(player.name, x + 10.5, y + 5.9, { maxWidth: widths[0] - 12 });
        x += widths[0];

        setText(doc, [35, 35, 35], 6.6);
        doc.text(player.position || "—", x + widths[1] / 2, y + 5.9, { align: "center", maxWidth: widths[1] - 2 });
        x += widths[1];

        metricSet.forEach((metric, metricIndex) => {
          setText(doc, [35, 35, 35], 6.8);
          doc.text(fmt(player.values[metric.key], metric.unit), x + widths[metricIndex + 2] / 2, y + 5.9, { align: "center" });
          x += widths[metricIndex + 2];
        });
        y += rowHeight;
      });
    });
  });
}

function rankingScopeLabel(scope) {
  if (/microciclo/i.test(String(scope || ""))) return "Acumulado del microciclo";
  return scope || "Acumulado del microciclo";
}

function drawRankings(doc, logo, meta, highlights, playerPhotos) {
  chunks(highlights || [], 4).forEach((group) => {
    addPage(doc, logo, meta);
    setText(doc, [20, 20, 20], 12, "bold");
    doc.text("Rankings seleccionados", 12, 48);

    group.forEach((highlight, index) => {
      const x = index % 2 === 0 ? 12 : 153.5;
      const y = index < 2 ? 56 : 122;
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, y, 131.5, 56, 3, 3, "F");
      doc.setFillColor(...hexToRgb(highlight.metric.color));
      doc.rect(x, y, 131.5, 4, "F");
      setText(doc, [20, 20, 20], 9, "bold");
      doc.text(`${highlight.metric.label} · ${rankingScopeLabel(highlight.scope)}`, x + 5, y + 12, { maxWidth: 120 });

      (highlight.top || []).slice(0, highlight.topCount || 3).forEach((player, rank) => {
        const rowY = y + 19 + rank * 11;
        setText(doc, [0, 114, 54], 8, "bold");
        doc.text(`#${rank + 1}`, x + 5, rowY + 5);
        drawPlayerAvatar(doc, playerPhotos[player.player_id || player.player?.id], x + 17, rowY, 7, player.name);
        setText(doc, [20, 20, 20], 7, "bold");
        doc.text(player.name || "Jugador", x + 27, rowY + 4.8, { maxWidth: 70 });
        setText(doc, [0, 114, 54], 7, "bold");
        doc.text(fmt(player.value, highlight.metric.unit), x + 124, rowY + 4.8, { align: "right" });
      });
    });
  });
}

function buildHighlightedPlayers(highlights = []) {
  const byPlayer = new Map();
  highlights.forEach((highlight) => {
    (highlight.top || []).forEach((item) => {
      const id = item.player_id || item.player?.id;
      if (!id) return;
      const current = byPlayer.get(id) || {
        id,
        name: item.name || item.player?.full_name || "Jugador",
        position: item.position || item.player?.position || "",
        metrics: [],
      };
      current.metrics.push({
        label: highlight.metric.short || highlight.metric.label,
        value: fmt(item.value, highlight.metric.unit),
        rank: item.rank,
      });
      byPlayer.set(id, current);
    });
  });
  return Array.from(byPlayer.values())
    .sort((left, right) => {
      const leftBest = Math.min(...left.metrics.map((metric) => metric.rank || 99));
      const rightBest = Math.min(...right.metrics.map((metric) => metric.rank || 99));
      return leftBest - rightBest || right.metrics.length - left.metrics.length;
    })
    .slice(0, 6);
}

function drawHighlightedPlayers(doc, logo, meta, highlights, playerPhotos) {
  const players = buildHighlightedPlayers(highlights);
  if (!players.length) return;

  addPage(doc, logo, meta);
  setText(doc, [20, 20, 20], 12, "bold");
  doc.text("Jugadores destacados", 12, 48);
  setText(doc, [90, 90, 90], 7.5);
  doc.text("Síntesis individual de los principales rendimientos del período exportado.", 12, 54);

  players.forEach((player, index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const x = 12 + column * 92;
    const y = 61 + row * 61;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, 87, 55, 3, 3, "F");
    drawPlayerAvatar(doc, playerPhotos[player.id], x + 5, y + 6, 16, player.name);
    setText(doc, [20, 20, 20], 8.5, "bold");
    doc.text(player.name, x + 25, y + 12, { maxWidth: 56 });
    setText(doc, [100, 100, 100], 6.5);
    doc.text(player.position || "—", x + 25, y + 18, { maxWidth: 56 });

    player.metrics.slice(0, 3).forEach((metric, metricIndex) => {
      const metricY = y + 30 + metricIndex * 7;
      setText(doc, [55, 55, 55], 6.7, "bold");
      doc.text(`#${metric.rank || "—"} ${metric.label}`, x + 5, metricY);
      setText(doc, [0, 114, 54], 6.7, "bold");
      doc.text(metric.value, x + 82, metricY, { align: "right" });
    });
  });
}

function drawComparison(doc, logo, meta, comparison) {
  addPage(doc, logo, meta);
  setText(doc, [20, 20, 20], 12, "bold");
  doc.text("Comparación con la semana anterior", 12, 48);
  (comparison || []).slice(0, 10).forEach((item, index) => {
    const x = 12 + (index % 5) * 55;
    const y = 60 + Math.floor(index / 5) * 52;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, 50, 42, 3, 3, "F");
    setText(doc, [25, 25, 25], 7, "bold");
    doc.text(item.metric.label, x + 4, y + 7, { maxWidth: 42 });
    setText(doc, [0, 114, 54], 10, "bold");
    doc.text(fmt(item.current, item.metric.unit), x + 4, y + 19);
    setText(doc, [95, 95, 95], 6.5);
    doc.text(`Prev.: ${fmt(item.previous, item.metric.unit)}`, x + 4, y + 29);
  });
}

function drawAiAnalysis(doc, logo, meta, aiText) {
  if (!aiText) return;
  addPage(doc, logo, meta);
  setText(doc, [20, 20, 20], 12, "bold");
  doc.text("Conclusiones", 12, 48);
  setText(doc, [35, 35, 35], 9);
  doc.text(doc.splitTextToSize(aiText, 265), 12, 60);
}

export async function generateMicrocyclePdf({
  squadName,
  season,
  clubName,
  clubLogoUrl,
  dailySummaries = [],
  highlights = [],
  comparison = [],
  metrics = [],
  cycleDays = [],
  matchContext = null,
  cycleRows = [],
  playerMap = {},
  options = {},
  chartConfig = {},
  aiText = "",
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  const [logo, rivalLogo, playerPhotos] = await Promise.all([
    imageToDataUrl(clubLogoUrl || CLUB_LOGO_URL),
    imageToDataUrl(matchContext?.rival_logo_url),
    preloadPlayerPhotos(cycleRows, highlights, playerMap),
  ]);

  const firstDay = dailySummaries?.[0];
  const lastDay = dailySummaries?.[dailySummaries.length - 1];
  const hasMatch = Boolean(matchContext?.rival);
  const meta = {
    squadName: squadName || "Reserva",
    clubName: clubName || "Defensa y Justicia",
    season,
    start: firstDay?.date ? moment(firstDay.date).format("DD/MM/YYYY") : "—",
    end: lastDay?.date ? moment(lastDay.date).format("DD/MM/YYYY") : "—",
    hasMatch,
    rival: matchContext?.rival || "",
    competition: matchContext?.competition || "",
    round: matchContext?.round || "",
    homeAway: matchContext?.home_away || "",
    isHome: matchContext?.is_home !== false,
    time: matchContext?.time || "",
    matchDate: matchContext?.date ? moment(matchContext.date).format("dddd DD/MM/YYYY") : "",
    coverIncluded: Boolean(options.includeCover),
  };

  if (options.includeCover) drawCover(doc, logo, rivalLogo, meta);
  if (options.includeCycleDays) {
    drawCycleDays(
      doc,
      logo,
      meta,
      dailySummaries.map((day) => ({ ...day, ...(cycleDays.find((cycleDay) => cycleDay.date === day.date) || {}) }))
    );
  }
  if (options.includePlayerTable) drawPlayerTable(doc, logo, meta, cycleRows, metrics, playerMap, playerPhotos);
  if (options.includeCharts) drawCharts(doc, logo, meta, metrics, dailySummaries, chartConfig);
  if (options.includeRankings) drawRankings(doc, logo, meta, highlights, playerPhotos);
  if (options.includeHighlightedPlayers) drawHighlightedPlayers(doc, logo, meta, highlights, playerPhotos);
  if (options.includeWeeklyComparison) drawComparison(doc, logo, meta, comparison);
  if (options.includeConclusions) drawAiAnalysis(doc, logo, meta, aiText);
  if (!doc.__started) addPage(doc, logo, meta);

  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    footer(doc, page, total, meta);
  }
  doc.save(`informe-microciclo-${firstDay?.date || "gps"}.pdf`);
}

