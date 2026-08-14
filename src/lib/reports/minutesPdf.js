import { jsPDF } from "jspdf";
import moment from "moment";
import { resolveInstitutionBrand } from "@/lib/clubBrandResolver";
import pdfFontRegularUrl from "@/assets/fonts/DejaVuSans.ttf?url";
import pdfFontBoldUrl from "@/assets/fonts/DejaVuSans-Bold.ttf?url";

const PAGE = {
  width: 297,
  height: 210,
  margin: 11,
  footerLineY: 198,
  contentBottom: 194,
};

const imageCache = new Map();
const fontCache = new Map();

function safeText(value, fallback = "—") {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function hexToRgb(hex, fallback = "#0F172A") {
  const clean = String(hex || fallback).replace("#", "");
  const normalized = /^[0-9a-fA-F]{3}$/.test(clean)
    ? clean.split("").map((char) => char + char).join("")
    : clean;
  const valid = /^[0-9a-fA-F]{6}$/.test(normalized)
    ? normalized
    : String(fallback).replace("#", "");
  return [0, 2, 4].map((index) => parseInt(valid.slice(index, index + 2), 16));
}

function mixWithWhite(hex, ratio = 0.88) {
  const [r, g, b] = hexToRgb(hex);
  return [
    Math.round(r + (255 - r) * ratio),
    Math.round(g + (255 - g) * ratio),
    Math.round(b + (255 - b) * ratio),
  ];
}

function setColor(doc, method, color) {
  const rgb = Array.isArray(color) ? color : hexToRgb(color);
  doc[method](rgb[0], rgb[1], rgb[2]);
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

async function loadFontBase64(url) {
  if (!fontCache.has(url)) {
    fontCache.set(url, (async () => {
      const response = await fetch(url);
      if (!response.ok) throw new Error("No se pudo cargar la tipografía del PDF");
      return arrayBufferToBase64(await response.arrayBuffer());
    })());
  }
  return fontCache.get(url);
}

async function registerPdfFonts(doc) {
  try {
    const [regular, bold] = await Promise.all([
      loadFontBase64(pdfFontRegularUrl),
      loadFontBase64(pdfFontBoldUrl),
    ]);
    doc.addFileToVFS("DejaVuSans.ttf", regular);
    doc.addFileToVFS("DejaVuSans-Bold.ttf", bold);
    doc.addFont("DejaVuSans.ttf", "DejaVuSans", "normal");
    doc.addFont("DejaVuSans-Bold.ttf", "DejaVuSans", "bold");
    doc.__minutesFontFamily = "DejaVuSans";
  } catch {
    doc.__minutesFontFamily = "courier";
  }
}

function setText(doc, color, size, style = "normal") {
  setColor(doc, "setTextColor", color);
  doc.setFont(doc.__minutesFontFamily || "courier", style);
  doc.setFontSize(size);
  doc.setCharSpace(0);
}

function formatMinutes(value) {
  return Math.round(Number(value || 0)).toLocaleString("es-AR") + "'";
}

function formatPercent(value) {
  return Math.round(Number(value || 0) * 100) + "%";
}

function initials(name) {
  return safeText(name, "Club")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase() || "C";
}

function slugify(value) {
  return safeText(value, "club")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "club";
}

function ellipsize(doc, value, maxWidth) {
  const original = safeText(value);
  if (doc.getTextWidth(original) <= maxWidth) return original;
  let text = original;
  while (text.length > 1 && doc.getTextWidth(text + "…") > maxWidth) {
    text = text.slice(0, -1);
  }
  return text.trimEnd() + "…";
}

function dataUrlFromBlob(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve(null);
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
        const context = canvas.getContext("2d");
        const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
        const width = image.naturalWidth * scale;
        const height = image.naturalHeight * scale;
        const x = (size - width) / 2;
        const y = (size - height) / 2;
        context.clearRect(0, 0, size, size);
        context.save();
        context.beginPath();
        context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        context.clip();
        context.drawImage(image, x, y, width, height);
        context.restore();
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(dataUrl);
      }
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

async function imageToDataUrl(url, options = {}) {
  if (!url) return null;
  const circle = options.circle === true;
  const cacheKey = (circle ? "circle:" : "plain:") + url;
  if (!imageCache.has(cacheKey)) {
    imageCache.set(cacheKey, (async () => {
      if (String(url).startsWith("data:")) {
        return circle ? circularizeImage(url) : url;
      }
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timeout = controller ? setTimeout(() => controller.abort(), 8000) : null;
      try {
        const response = await fetch(url, {
          mode: "cors",
          signal: controller?.signal,
        });
        if (!response.ok) return null;
        const dataUrl = await dataUrlFromBlob(await response.blob());
        return circle ? circularizeImage(dataUrl) : dataUrl;
      } catch {
        return null;
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    })());
  }
  return imageCache.get(cacheKey);
}

function addImage(doc, dataUrl, x, y, width, height) {
  if (!dataUrl) return false;
  try {
    const format = String(dataUrl).includes("image/png") ? "PNG" : "JPEG";
    doc.addImage(dataUrl, format, x, y, width, height);
    return true;
  } catch {
    return false;
  }
}

function drawFallbackBadge(doc, x, y, size, name, brand, square = false) {
  setColor(doc, "setFillColor", mixWithWhite(brand.colors.primary, 0.86));
  if (square) {
    doc.roundedRect(x, y, size, size, 3, 3, "F");
  } else {
    doc.circle(x + size / 2, y + size / 2, size / 2, "F");
  }
  setText(doc, brand.colors.primaryDark, square ? 9.5 : Math.max(5.5, size * 0.43), "bold");
  doc.text(initials(name), x + size / 2, y + size / 2 + size * 0.14, { align: "center" });
}

function drawAvatar(doc, dataUrl, x, y, size, name, brand) {
  if (addImage(doc, dataUrl, x, y, size, size)) {
    setColor(doc, "setDrawColor", brand.colors.line);
    doc.circle(x + size / 2, y + size / 2, size / 2, "S");
    return;
  }
  drawFallbackBadge(doc, x, y, size, name, brand);
}

function normalizeRows(rows = [], playerMap = {}) {
  return rows.map((row, index) => {
    const player = row.player_id ? playerMap[row.player_id] || {} : {};
    const legacyMinutes = Number(row.total ?? row.res ?? row.juv ?? 0);
    const accumulatedMinutes = row.accumulatedMinutes == null
      ? legacyMinutes
      : Number(row.accumulatedMinutes || 0);
    const availableMinutes = Number(row.availableMinutes || 0);
    return {
      ...row,
      rank: Number(row.rank || index + 1),
      player_name: safeText(row.player_name || player.full_name, "Jugador"),
      position: safeText(row.position || player.position),
      photo_url: row.photo_url || player.photo_url || "",
      matchesCount: Number(row.matchesCount ?? row.partidos_count ?? 0),
      starts: Number(row.starts || 0),
      subEntries: Number(row.subEntries || 0),
      accumulatedMinutes,
      availableMinutes,
      percentage: row.percentage == null
        ? (availableMinutes > 0 ? accumulatedMinutes / availableMinutes : 0)
        : Number(row.percentage || 0),
    };
  });
}

function normalizeFilters(filters, legacy) {
  if (filters) return filters;
  return {
    squad: legacy.activeSquad?.name || "Plantel activo",
    season: legacy.activeSeasonId || legacy.activeSquad?.season || "—",
    competition: legacy.torneo?.label || legacy.torneo?.name || "Todas las competencias",
    type: legacy.viewMode ? safeText(legacy.viewMode) : "Todos",
    range: "Toda la temporada",
  };
}

export async function generateMinutesPdf(input = {}) {
  const {
    filters: rawFilters,
    availableMinutes = 0,
    includedMatches = 0,
    playersWithMinutes = 0,
    pendingMatches = 0,
    rows = [],
    brand: suppliedBrand,
    institutionProfile = null,
    squad = null,
    playerMap = {},
    download = true,
    filename,
  } = input;

  const brand = suppliedBrand || resolveInstitutionBrand(institutionProfile, squad || input.activeSquad || {});
  const filters = normalizeFilters(rawFilters, input);
  const tableRows = normalizeRows(rows, playerMap);
  const generatedAt = moment().format("DD/MM/YYYY HH:mm");
  const profile = institutionProfile || {};
  const showPerformancePitch = profile.show_performancepitch_brand !== false;
  const showSquad = profile.show_squad_name !== false;
  const showSeason = profile.show_season !== false;
  const showExportDate = profile.show_export_date !== false;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  await registerPdfFonts(doc);
  const contentWidth = PAGE.width - PAGE.margin * 2;
  const primaryText = brand.colors.onPrimary || "#FFFFFF";
  const footerText = safeText(profile.export_footer_text, "Documento operativo del cuerpo técnico");

  const columns = [
    { key: "rank", label: "#", width: 9, align: "center" },
    { key: "player", label: "Jugador", width: 75, align: "left" },
    { key: "position", label: "Posición", width: 43, align: "left" },
    { key: "matchesCount", label: "PJ", width: 20, align: "center" },
    { key: "starts", label: "Tit.", width: 24, align: "center" },
    { key: "subEntries", label: "Ingresos", width: 20, align: "center" },
    { key: "accumulatedMinutes", label: "Minutos", width: 26, align: "center" },
    { key: "availableMinutes", label: "Disponibles", width: 30, align: "center" },
    { key: "percentage", label: "% jugado", width: 28, align: "center" },
  ];

  const photoEntries = tableRows.map((row, index) => ({
    key: row.player_id || "row-" + index,
    url: row.photo_url,
  }));
  const [logo, loadedPhotos] = await Promise.all([
    imageToDataUrl(brand.logoUrl),
    Promise.all(photoEntries.map(async (entry) => ({
      key: entry.key,
      dataUrl: entry.url ? await imageToDataUrl(entry.url, { circle: true }) : null,
    }))),
  ]);
  const photoMap = Object.fromEntries(loadedPhotos.map((entry) => [entry.key, entry.dataUrl]));

  doc.setProperties({
    title: "Minutos jugados - " + brand.name,
    subject: "Informe de minutos jugados",
    author: brand.name + " · PerformancePitch",
    creator: "PerformancePitch",
  });

  function filterLine() {
    const parts = [];
    if (showSquad) parts.push("Plantel: " + safeText(filters.squad));
    if (showSeason) parts.push("Temporada: " + safeText(filters.season));
    parts.push("Competencia: " + safeText(filters.competition));
    return parts.join("  ·  ");
  }

  function scopeLine() {
    const parts = [
      "Tipo: " + safeText(filters.type),
      "Rango: " + safeText(filters.range),
    ];
    if (showExportDate) parts.push("Generado: " + generatedAt);
    return parts.join("  ·  ");
  }

  function drawClubMark(x, y, size) {
    if (!addImage(doc, logo, x, y, size, size)) {
      drawFallbackBadge(doc, x, y, size, brand.name, brand, true);
    }
  }

  function drawPageHeader(compact = false) {
    setColor(doc, "setFillColor", "#FFFFFF");
    doc.rect(0, 0, PAGE.width, PAGE.height, "F");
    setColor(doc, "setFillColor", brand.colors.primary);
    doc.rect(0, 0, PAGE.width, compact ? 7 : 9, "F");
    setColor(doc, "setFillColor", brand.colors.accent);
    doc.rect(0, compact ? 7 : 9, PAGE.width, compact ? 1.5 : 2, "F");

    if (compact) {
      drawClubMark(PAGE.margin, 12, 12);
      setText(doc, brand.colors.primaryDark, 9, "bold");
      doc.text(ellipsize(doc, brand.name.toUpperCase(), 66), 28, 16.5);
      setText(doc, brand.colors.ink, 14.5, "bold");
      doc.text("Minutos jugados", 28, 23.2);
      setText(doc, brand.colors.muted, 8.2);
      doc.text(ellipsize(doc, filterLine(), 133), 104, 18.2);
      doc.text(ellipsize(doc, scopeLine(), 133), 104, 23.2);
      if (showPerformancePitch) {
        setText(doc, brand.colors.primaryDark, 9, "bold");
        doc.text("PERFORMANCEPITCH", PAGE.width - PAGE.margin, 18.5, { align: "right" });
      }
      return;
    }

    setColor(doc, "setFillColor", brand.colors.panel);
    doc.roundedRect(PAGE.margin, 15, contentWidth, 32, 4, 4, "F");
    drawClubMark(PAGE.margin + 5, 20, 22);
    setText(doc, brand.colors.primaryDark, 10.5, "bold");
    doc.text(ellipsize(doc, brand.name.toUpperCase(), 145), PAGE.margin + 32, 23);
    setText(doc, brand.colors.ink, 22, "bold");
    doc.text("Minutos jugados", PAGE.margin + 32, 33.5);
    setText(doc, brand.colors.muted, 9.5);
    doc.text(ellipsize(doc, filterLine(), 208), PAGE.margin + 32, 40);
    setText(doc, brand.colors.muted, 9);
    doc.text(ellipsize(doc, scopeLine(), 208), PAGE.margin + 32, 45);
    if (showPerformancePitch) {
      setText(doc, brand.colors.primaryDark, 10, "bold");
      doc.text("PERFORMANCEPITCH", PAGE.width - PAGE.margin - 5, 23, { align: "right" });
    }
  }

  function drawSummaryCards(y) {
    const cards = [
      ["Minutos disponibles", formatMinutes(availableMinutes)],
      ["Partidos incluidos", String(includedMatches)],
      ["Jugadores con minutos", String(playersWithMinutes)],
      ["Partidos pendientes", String(pendingMatches)],
    ];
    const gap = 4;
    const width = (contentWidth - gap * 3) / 4;
    cards.forEach((card, index) => {
      const x = PAGE.margin + index * (width + gap);
      setColor(doc, "setFillColor", "#FFFFFF");
      setColor(doc, "setDrawColor", brand.colors.line);
      doc.roundedRect(x, y, width, 18, 3, 3, "FD");
      setColor(doc, "setFillColor", brand.colors.primary);
      doc.roundedRect(x, y, 2.3, 18, 1.2, 1.2, "F");
      setText(doc, brand.colors.muted, 8.3, "bold");
      doc.text(card[0].toUpperCase(), x + 6, y + 6);
      setText(doc, brand.colors.ink, 15, "bold");
      doc.text(card[1], x + 6, y + 14.2);
    });
  }

  function drawTableHeader(y) {
    setColor(doc, "setFillColor", brand.colors.primaryDark);
    doc.roundedRect(PAGE.margin, y, contentWidth, 9.5, 2, 2, "F");
    let x = PAGE.margin;
    columns.forEach((column) => {
      setText(doc, primaryText, 8.2, "bold");
      const textX = column.align === "left" ? x + 3 : x + column.width / 2;
      doc.text(column.label, textX, y + 6.2, { align: column.align });
      x += column.width;
    });
  }

  function cellCenter(columnIndex) {
    let x = PAGE.margin;
    for (let index = 0; index < columnIndex; index += 1) x += columns[index].width;
    return x + columns[columnIndex].width / 2;
  }

  function drawTableRow(row, index, y) {
    const rowHeight = 11.2;
    if (index % 2 === 0) {
      setColor(doc, "setFillColor", brand.colors.panel);
      doc.rect(PAGE.margin, y, contentWidth, rowHeight, "F");
    }
    setColor(doc, "setDrawColor", brand.colors.line);
    doc.line(PAGE.margin, y + rowHeight, PAGE.width - PAGE.margin, y + rowHeight);

    setText(doc, brand.colors.muted, 8.7, "bold");
    doc.text(String(row.rank), cellCenter(0), y + 6.9, { align: "center" });

    const playerX = PAGE.margin + columns[0].width;
    const photoKey = row.player_id || "row-" + index;
    drawAvatar(doc, photoMap[photoKey], playerX + 2.2, y + 1.5, 8.2, row.player_name, brand);
    setText(doc, brand.colors.ink, 9.3, "bold");
    doc.text(ellipsize(doc, row.player_name, columns[1].width - 14), playerX + 12.3, y + 6.9);

    const positionX = playerX + columns[1].width;
    setText(doc, brand.colors.ink, 8.5);
    doc.text(ellipsize(doc, row.position, columns[2].width - 5), positionX + 2.5, y + 6.9);

    const numericValues = [
      String(row.matchesCount),
      String(row.starts),
      String(row.subEntries),
      formatMinutes(row.accumulatedMinutes),
      formatMinutes(row.availableMinutes),
    ];
    numericValues.forEach((value, valueIndex) => {
      const columnIndex = valueIndex + 3;
      const isMinutes = columnIndex === 6;
      setText(doc, isMinutes ? brand.colors.primaryDark : brand.colors.ink, isMinutes ? 9.4 : 9, isMinutes ? "bold" : "normal");
      doc.text(value, cellCenter(columnIndex), y + 6.9, { align: "center" });
    });

    const percentCenter = cellCenter(8);
    const pillWidth = 17;
    setColor(doc, "setFillColor", mixWithWhite(brand.colors.primary, 0.88));
    doc.roundedRect(percentCenter - pillWidth / 2, y + 2.5, pillWidth, 6.3, 2.5, 2.5, "F");
    setText(doc, brand.colors.primaryDark, 8.4, "bold");
    doc.text(formatPercent(row.percentage), percentCenter, y + 6.9, { align: "center" });
  }

  drawPageHeader(false);
  drawSummaryCards(52);
  let y = 76;
  drawTableHeader(y);
  y += 9.5;

  if (tableRows.length === 0) {
    setColor(doc, "setFillColor", brand.colors.panel);
    doc.roundedRect(PAGE.margin, y + 4, contentWidth, 28, 4, 4, "F");
    setText(doc, brand.colors.ink, 12, "bold");
    doc.text("No hay jugadores para los filtros seleccionados", PAGE.width / 2, y + 17, { align: "center" });
    setText(doc, brand.colors.muted, 9);
    doc.text("Revisá el plantel, la temporada, la competencia o el rango de fechas.", PAGE.width / 2, y + 24, { align: "center" });
  } else {
    tableRows.forEach((row, index) => {
      if (y + 11.2 > PAGE.contentBottom) {
        doc.addPage("a4", "landscape");
        drawPageHeader(true);
        y = 31;
        drawTableHeader(y);
        y += 9.5;
      }
      drawTableRow(row, index, y);
      y += 11.2;
    });
  }

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    setColor(doc, "setDrawColor", brand.colors.line);
    doc.line(PAGE.margin, PAGE.footerLineY, PAGE.width - PAGE.margin, PAGE.footerLineY);
    setText(doc, brand.colors.muted, 7.6);
    doc.text(ellipsize(doc, footerText, 106), PAGE.margin, 203);
    const contextParts = [];
    if (showSquad) contextParts.push(safeText(filters.squad));
    if (showSeason) contextParts.push("Temporada " + safeText(filters.season));
    const context = contextParts.join(" · ");
    if (context) doc.text(ellipsize(doc, context, 92), PAGE.width / 2, 203, { align: "center" });
    setText(doc, brand.colors.ink, 7.8, "bold");
    doc.text("Página " + page + " de " + totalPages, PAGE.width - PAGE.margin, 203, { align: "right" });
  }

  const outputName = filename || (
    "minutos-jugados-" +
    slugify(brand.name) +
    "-" +
    moment().format("YYYYMMDD-HHmm") +
    ".pdf"
  );

  if (download) doc.save(outputName);
  return doc;
}
