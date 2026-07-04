import jsPDF from "jspdf";
import moment from "moment";
import { REPORT_METRICS, fmtMetricVal } from "./sessionGpsReportData";

const CLUB_LOGO = "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/4379a507a_defensa.png";
const YELLOW = [240, 200, 0];
const DARK = [20, 20, 20];
const GRAY = [100, 100, 100];
const LIGHT = [245, 245, 245];
const WHITE = [255, 255, 255];
const GREEN = [16, 185, 129];
const RED = [239, 68, 68];

async function toDataURL(url) {
  if (!url) return null;
  try {
    const resp = await fetch(url, { mode: "cors" });
    const blob = await resp.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function pctColor(pct) {
  if (pct == null) return GRAY;
  if (pct >= 90) return GREEN;
  if (pct >= 70) return YELLOW;
  return RED;
}

export async function generateSessionGPSReportPDF({ session, reportData, observations }) {
  const { summary, teamAverages, weekAverages, highlights, comparison, alerts, insights, principal, excluded } = reportData;

  const [logoData, playerPhotos] = await Promise.all([
    toDataURL(CLUB_LOGO),
    Promise.all(
      [...highlights, ...comparison].map(async (item) => [item.photo_url, item.photo_url ? await toDataURL(item.photo_url) : null])
    ),
  ]);
  const photoMap = Object.fromEntries(playerPhotos.filter(([url]) => url));

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210, pageH = 297, margin = 14, contentW = pageW - margin * 2;
  let y = 0;

  function addPageIfNeeded(needed = 20) {
    if (y + needed > pageH - 10) { doc.addPage(); y = 14; drawHeader(); }
  }
  function drawHeader() {
    doc.setFillColor(...YELLOW); doc.rect(0, 0, pageW, 6, "F");
    if (logoData) doc.addImage(logoData, "PNG", margin, 8, 10, 10);
    doc.setFontSize(7); doc.setTextColor(...GRAY);
    doc.text(`Informe GPS — ${session.title}`, margin + 12, 12);
    doc.text(moment(session.date).format("DD/MM/YYYY"), pageW - margin, 12, { align: "right" });
    doc.setDrawColor(220, 220, 220); doc.line(margin, 20, pageW - margin, 20);
    y = 24;
  }
  function sectionTitle(title) {
    addPageIfNeeded(14);
    doc.setFillColor(...YELLOW); doc.rect(margin, y, contentW, 7, "F");
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(...DARK);
    doc.text(title.toUpperCase(), margin + 3, y + 5);
    y += 10;
  }

  // ── COVER ──────────────────────────────────────────────
  doc.setFillColor(...DARK); doc.rect(0, 0, pageW, pageH, "F");
  doc.setFillColor(...YELLOW); doc.rect(0, 0, pageW, 12, "F");
  if (logoData) doc.addImage(logoData, "PNG", pageW / 2 - 20, 30, 40, 40);
  doc.setFontSize(16); doc.setTextColor(...YELLOW); doc.setFont("helvetica", "bold");
  doc.text("DEFENSA Y JUSTICIA", pageW / 2, 82, { align: "center" });
  doc.setFontSize(10); doc.setTextColor(...WHITE); doc.setFont("helvetica", "normal");
  doc.text("Informe de Sesión GPS", pageW / 2, 92, { align: "center" });
  doc.setDrawColor(...YELLOW); doc.setLineWidth(0.8);
  doc.line(margin + 20, 98, pageW - margin - 20, 98);

  const infoY = 108;
  doc.setFillColor(35, 35, 35); doc.roundedRect(margin, infoY, contentW, 72, 3, 3, "F");
  const infoData = [
    ["Plantel", session.squad_name || "—"],
    ["Sesión", session.title],
    ["Fecha", moment(session.date).format("dddd DD [de] MMMM YYYY")],
    ["MD", session.match_day_code || "—"],
    ["Duración", session.duration_minutes ? `${session.duration_minutes} min` : "—"],
    ["Jugadores con GPS", String(summary.conGps)],
  ];
  let iy = infoY + 10;
  infoData.forEach(([label, value]) => {
    doc.setFontSize(8); doc.setTextColor(...YELLOW); doc.setFont("helvetica", "bold");
    doc.text(label + ":", margin + 6, iy);
    doc.setTextColor(...WHITE); doc.setFont("helvetica", "normal");
    doc.text(String(value), margin + 45, iy);
    iy += 10;
  });
  doc.setFontSize(7); doc.setTextColor(...GRAY);
  doc.text(`Exportado el ${moment().format("DD/MM/YYYY HH:mm")}`, pageW / 2, pageH - 10, { align: "center" });
  doc.setFillColor(...YELLOW); doc.rect(0, pageH - 6, pageW, 6, "F");

  // ── PAGE 2 ─────────────────────────────────────────────
  doc.addPage(); doc.setFillColor(255, 255, 255); doc.rect(0, 0, pageW, pageH, "F"); drawHeader();

  sectionTitle("1. Resumen general");
  const summaryBadges = [
    ["Con GPS", summary.conGps], ["Excluidos", summary.excluidos], ["Diferenciados", summary.diferenciados],
    ["Kinesiología", summary.kinesiologia], ["Arqueros", summary.arqueros], ["Duración (min)", summary.duracion || "—"],
  ];
  addPageIfNeeded(16);
  let bx = margin;
  const bw = contentW / summaryBadges.length;
  summaryBadges.forEach(([label, val]) => {
    doc.setFillColor(...LIGHT); doc.roundedRect(bx, y, bw - 2, 14, 1, 1, "F");
    doc.setFontSize(6); doc.setTextColor(...GRAY); doc.text(label, bx + 2, y + 5);
    doc.setFontSize(9); doc.setTextColor(...DARK); doc.setFont("helvetica", "bold");
    doc.text(String(val), bx + 2, y + 11);
    doc.setFont("helvetica", "normal");
    bx += bw;
  });
  y += 20;

  addPageIfNeeded(10);
  doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(...GRAY);
  doc.text("Promedios del grupo principal (vs. promedio semanal)", margin, y + 4);
  y += 8;
  REPORT_METRICS.forEach((m) => {
    addPageIfNeeded(6);
    const val = teamAverages[m.key], wk = weekAverages[m.key];
    const diff = (val != null && wk) ? Math.round(((val - wk) / wk) * 100) : null;
    doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(...DARK);
    doc.text(m.label, margin + 2, y + 4);
    doc.text(fmtMetricVal(m.key, val) + " " + m.unit, margin + 70, y + 4);
    if (diff != null) {
      doc.setTextColor(...(diff >= 0 ? GREEN : RED));
      doc.text(`${diff >= 0 ? "+" : ""}${diff}% vs semana`, margin + 110, y + 4);
    }
    y += 5.5;
  });
  y += 4;

  sectionTitle("2. Jugadores destacados");
  const hCols = 2, hw = contentW / hCols;
  let hx = margin, hy = y, hRow = 0;
  highlights.forEach((h, idx) => {
    addPageIfNeeded(24);
    doc.setFillColor(...LIGHT); doc.roundedRect(hx, hy, hw - 3, 20, 1.5, 1.5, "F");
    const photo = photoMap[h.photo_url];
    if (photo) doc.addImage(photo, "JPEG", hx + 2, hy + 2, 16, 16);
    const tx = hx + (photo ? 20 : 3);
    doc.setFontSize(6); doc.setTextColor(...GRAY); doc.text(h.label, tx, hy + 5);
    doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(...DARK);
    doc.text(h.player_name || "—", tx, hy + 10, { maxWidth: hw - (photo ? 24 : 6) });
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); doc.setTextColor(...GRAY);
    doc.text(h.position || "", tx, hy + 14);
    doc.setFontSize(9); doc.setTextColor(...YELLOW[2] !== undefined ? [180, 140, 0] : DARK);
    doc.text(h.value, tx, hy + 18.5);
    hx += hw;
    if ((idx + 1) % hCols === 0) { hx = margin; hy += 22; }
  });
  y = hy + ((highlights.length % hCols) ? 22 : 0) + 4;

  sectionTitle("3. Tabla general (grupo principal)");
  const cols = [
    { label: "Jugador", w: 42 },
    { label: "Pos.", w: 22 },
    ...REPORT_METRICS.map((m) => ({ label: m.label, w: (contentW - 64) / REPORT_METRICS.length })),
  ];
  function drawTableHeader() {
    addPageIfNeeded(8);
    doc.setFillColor(...DARK); doc.rect(margin, y, contentW, 6, "F");
    doc.setFontSize(6); doc.setFont("helvetica", "bold"); doc.setTextColor(...WHITE);
    let cx = margin;
    cols.forEach((c) => { doc.text(c.label, cx + 1, y + 4, { maxWidth: c.w - 2 }); cx += c.w; });
    y += 6;
  }
  drawTableHeader();
  const rankByKey = {};
  REPORT_METRICS.forEach((m) => {
    rankByKey[m.key] = [...principal].sort((a, b) => (b[m.key] || 0) - (a[m.key] || 0)).map((r) => r.player_id).slice(0, 3);
  });
  principal.forEach((r, idx) => {
    addPageIfNeeded(6);
    if (idx % 2 === 0) { doc.setFillColor(248, 248, 248); doc.rect(margin, y, contentW, 5.5, "F"); }
    let cx = margin;
    doc.setFontSize(6); doc.setFont("helvetica", "normal"); doc.setTextColor(...DARK);
    doc.text(r.player_name || "—", cx + 1, y + 4, { maxWidth: cols[0].w - 2 }); cx += cols[0].w;
    doc.text(r._player?.position || "—", cx + 1, y + 4, { maxWidth: cols[1].w - 2 }); cx += cols[1].w;
    REPORT_METRICS.forEach((m, i) => {
      const isTop3 = rankByKey[m.key].includes(r.player_id);
      doc.setFont("helvetica", isTop3 ? "bold" : "normal");
      doc.setTextColor(...(isTop3 ? GREEN : DARK));
      doc.text(fmtMetricVal(m.key, r[m.key]), cx + 1, y + 4, { maxWidth: cols[2 + i].w - 2 });
      cx += cols[2 + i].w;
    });
    y += 5.5;
  });
  y += 4;

  if (excluded.length > 0) {
    addPageIfNeeded(10);
    doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(...GRAY);
    doc.text(`Excluidos de los promedios (${excluded.length})`, margin, y + 4);
    y += 6;
    excluded.forEach((r) => {
      addPageIfNeeded(5);
      doc.setFontSize(7); doc.setFont("helvetica", "italic"); doc.setTextColor(180, 130, 0);
      doc.text(`${r.player_name} — ${r.exclusion_reason || "excluido"}`, margin + 2, y + 4);
      y += 5;
    });
    y += 4;
  }

  if (comparison.length > 0) {
    sectionTitle("4. Comparación vs. perfil competitivo");
    comparison.forEach((c) => {
      addPageIfNeeded(24);
      doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(...DARK);
      doc.text(c.player_name || "—", margin, y + 4);
      y += 5;
      let cx = margin;
      const mw = contentW / c.metrics.length;
      c.metrics.forEach((m) => {
        const color = pctColor(m.pct);
        doc.setFillColor(...color); doc.roundedRect(cx, y, mw - 2, 12, 1, 1, "F");
        doc.setFontSize(5.5); doc.setTextColor(...WHITE);
        doc.text(m.label, cx + 1.5, y + 4, { maxWidth: mw - 3 });
        doc.setFontSize(7); doc.setFont("helvetica", "bold");
        doc.text(m.pct != null ? `${Math.round(m.pct)}%` : "—", cx + 1.5, y + 9.5);
        doc.setFont("helvetica", "normal");
        cx += mw;
      });
      y += 15;
    });
    y += 2;
  }

  sectionTitle("5. Análisis automático");
  insights.forEach((line) => {
    addPageIfNeeded(8);
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(...DARK);
    const lines = doc.splitTextToSize(`• ${line}`, contentW);
    doc.text(lines, margin, y + 4);
    y += lines.length * 5 + 1;
  });
  y += 3;

  if (alerts.length > 0) {
    sectionTitle("6. Alertas");
    alerts.forEach((a) => {
      addPageIfNeeded(6);
      doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(180, 40, 40);
      const lines = doc.splitTextToSize(`⚠ ${a.text}`, contentW);
      doc.text(lines, margin, y + 4);
      y += lines.length * 4.5 + 1;
    });
    y += 3;
  }

  sectionTitle("7. Observaciones");
  if (observations) {
    addPageIfNeeded(20);
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(...DARK);
    const lines = doc.splitTextToSize(observations, contentW);
    doc.text(lines, margin, y + 4);
    y += lines.length * 5 + 4;
  } else {
    addPageIfNeeded(8);
    doc.setFontSize(8); doc.setTextColor(...GRAY);
    doc.text("Sin observaciones", margin, y + 4);
    y += 8;
  }

  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 2; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFillColor(...YELLOW); doc.rect(0, pageH - 4, pageW, 4, "F");
    doc.setFontSize(6); doc.setTextColor(...GRAY);
    doc.text(`${p} / ${totalPages}`, pageW - margin, pageH - 6, { align: "right" });
  }

  const filename = `informe_gps_${moment(session.date).format("YYYY-MM-DD")}_${(session.title || "sesion").replace(/\s+/g, "_")}.pdf`;
  doc.save(filename);
}