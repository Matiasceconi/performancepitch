import { jsPDF } from "jspdf";
import moment from "moment";
import { CLUB_BRAND } from "@/lib/clubBrand";

function hexToRgb(hex) {
  const value = String(hex || "#000000").replace("#", "");
  const normalized = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  return [0, 2, 4].map((i) => parseInt(normalized.slice(i, i + 2), 16));
}

function setColor(doc, method, hex) {
  const [r, g, b] = hexToRgb(hex);
  doc[method](r, g, b);
}

function fmtMinutes(value) {
  return `${Math.round(Number(value || 0)).toLocaleString("es-AR")}'`;
}

function pct(value, total) {
  if (!total) return "0%";
  return `${Math.round((Number(value || 0) / Number(total || 0)) * 100)}%`;
}

async function imageToDataUrl(url) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateMinutesPdf({ rows, torneo, viewMode, playerMap, activeSquad, activeSeasonId }) {
  const showRes = torneo?.res_total !== null && (viewMode === "reserva" || viewMode === "ambos");
  const showJuv = torneo?.juv_total !== null && (viewMode === "juveniles" || viewMode === "ambos");
  const viewLabel = viewMode === "reserva" ? "Reserva" : viewMode === "juveniles" ? "Juveniles" : "Reserva + Juveniles";
  const totals = rows.reduce((acc, row) => ({
    res: acc.res + Number(row.res || 0),
    juv: acc.juv + Number(row.juv || 0),
  }), { res: 0, juv: 0 });

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const logo = await imageToDataUrl(CLUB_BRAND.logoUrl);
  const margin = 12;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - margin * 2;
  const dateLabel = moment().format("DD/MM/YYYY HH:mm");

  function drawFirstHeader() {
    setColor(doc, "setFillColor", CLUB_BRAND.colors.panel);
    doc.roundedRect(margin, margin, contentW, 34, 4, 4, "F");
    setColor(doc, "setFillColor", CLUB_BRAND.colors.green);
    doc.rect(margin, margin + 32, contentW, 2, "F");
    if (logo) doc.addImage(logo, "PNG", margin + 5, margin + 5, 22, 22);
    setColor(doc, "setTextColor", CLUB_BRAND.colors.greenDark);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(CLUB_BRAND.name.toUpperCase(), margin + 32, margin + 9);
    setColor(doc, "setTextColor", CLUB_BRAND.colors.ink);
    doc.setFontSize(20);
    doc.text("Minutos Jugados", margin + 32, margin + 19);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setColor(doc, "setTextColor", CLUB_BRAND.colors.muted);
    doc.text(`${activeSquad?.name || "Plantel"} · ${activeSeasonId || activeSquad?.season || "Temporada"} · ${torneo?.label || "Todo el semestre"} · ${viewLabel}`, margin + 32, margin + 27);
    doc.text(`Generado: ${dateLabel}`, pageW - margin - 55, margin + 9);
  }

  function drawSmallHeader(page, total) {
    setColor(doc, "setTextColor", CLUB_BRAND.colors.greenDeep);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Minutos Jugados", margin, margin + 2);
    doc.setFont("helvetica", "normal");
    setColor(doc, "setTextColor", CLUB_BRAND.colors.muted);
    doc.text(`Página ${page} de ${total}`, pageW - margin - 25, margin + 2);
    setColor(doc, "setDrawColor", CLUB_BRAND.colors.line);
    doc.line(margin, margin + 6, pageW - margin, margin + 6);
  }

  function drawStats(y) {
    const cards = [
      ["Jugadores", rows.length],
      ...(showRes ? [["Reserva", fmtMinutes(totals.res)]] : []),
      ...(showJuv ? [["Juveniles", fmtMinutes(totals.juv)]] : []),
      ["Total", fmtMinutes((showRes ? totals.res : 0) + (showJuv ? totals.juv : 0))],
    ];
    const gap = 4;
    const w = (contentW - gap * (cards.length - 1)) / cards.length;
    cards.forEach(([label, value], index) => {
      const x = margin + index * (w + gap);
      setColor(doc, "setDrawColor", CLUB_BRAND.colors.line);
      doc.roundedRect(x, y, w, 16, 3, 3, "S");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      setColor(doc, "setTextColor", CLUB_BRAND.colors.muted);
      doc.text(String(label).toUpperCase(), x + 4, y + 5);
      doc.setFontSize(13);
      setColor(doc, "setTextColor", index === cards.length - 1 ? CLUB_BRAND.colors.ink : CLUB_BRAND.colors.greenDark);
      doc.text(String(value), x + 4, y + 12);
    });
  }

  function columns() {
    if (showRes && showJuv) return [
      { key: "idx", label: "#", w: 12 },
      { key: "player", label: "Jugador", w: 100 },
      { key: "position", label: "Posición", w: 44 },
      { key: "res", label: "Reserva", w: 42 },
      { key: "juv", label: "Juveniles", w: 42 },
      { key: "total", label: "Total", w: 33 },
    ];
    return [
      { key: "idx", label: "#", w: 12 },
      { key: "player", label: "Jugador", w: 120 },
      { key: "position", label: "Posición", w: 55 },
      { key: showRes ? "res" : "juv", label: showRes ? "Reserva" : "Juveniles", w: 50 },
      { key: "total", label: "Total", w: 36 },
    ];
  }

  const cols = columns();

  function drawTableHeader(y) {
    setColor(doc, "setFillColor", CLUB_BRAND.colors.greenDark);
    doc.roundedRect(margin, y, contentW, 8, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    let x = margin;
    cols.forEach((col) => {
      doc.text(col.label.toUpperCase(), x + 3, y + 5.3);
      x += col.w;
    });
  }

  function rowValue(row, key, index) {
    const player = row.player_id ? playerMap[row.player_id] : null;
    if (key === "idx") return String(index + 1);
    if (key === "player") return row.player_name || "—";
    if (key === "position") return player?.position || "—";
    if (key === "res") return `${fmtMinutes(row.res)} · ${pct(row.res, torneo?.res_total)}`;
    if (key === "juv") return `${fmtMinutes(row.juv)} · ${pct(row.juv, torneo?.juv_total)}`;
    return fmtMinutes((showRes ? Number(row.res || 0) : 0) + (showJuv ? Number(row.juv || 0) : 0));
  }

  function drawRow(row, index, y) {
    const rowH = 8;
    if (index % 2 === 0) {
      setColor(doc, "setFillColor", CLUB_BRAND.colors.panel);
      doc.rect(margin, y, contentW, rowH, "F");
    }
    setColor(doc, "setDrawColor", CLUB_BRAND.colors.line);
    doc.line(margin, y + rowH, pageW - margin, y + rowH);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setColor(doc, "setTextColor", CLUB_BRAND.colors.ink);
    let x = margin;
    cols.forEach((col) => {
      const value = rowValue(row, col.key, index);
      const text = doc.splitTextToSize(String(value), col.w - 6)[0] || "";
      doc.text(text, x + 3, y + 5.2);
      x += col.w;
    });
  }

  drawFirstHeader();
  drawStats(margin + 40);
  let y = margin + 62;
  drawTableHeader(y);
  y += 8;

  rows.forEach((row, index) => {
    if (y + 8 > pageH - margin - 8) {
      doc.addPage();
      y = margin + 18;
      drawTableHeader(y);
      y += 8;
    }
    drawRow(row, index, y);
    y += 8;
  });

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    if (page > 1) drawSmallHeader(page, totalPages);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setColor(doc, "setTextColor", CLUB_BRAND.colors.muted);
    doc.text(`Página ${page} de ${totalPages}`, pageW - margin - 25, pageH - 7);
  }

  const safeView = viewLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  doc.save(`minutos-jugados-${safeView}-${moment().format("YYYYMMDD-HHmm")}.pdf`);
}