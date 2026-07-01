import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { FileText, X, Loader } from "lucide-react";
import { isGoalkeeper } from "@/components/squad/squadConstants";
import { useToast } from "@/components/ui/use-toast";
import { fmtMetric, fmtSmax } from "@/utils";
import moment from "moment";
import jsPDF from "jspdf";

const DYJ_LOGO = "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/4379a507a_defensa.png";

const GPS_METRICS = [
  { key: "total_distance", label: "Dist. Total (m)" },
  { key: "m_min",          label: "m/min" },
  { key: "distance_19_8",  label: "D >19.8 (m)" },
  { key: "distance_25",    label: "D >25 (m)" },
  { key: "sprints",        label: "Sprints" },
  { key: "acc_3",          label: "ACC +3" },
  { key: "dec_3",          label: "DEC +3" },
  { key: "player_load",    label: "P.Load" },
  { key: "smax",           label: "Smax km/h" },
];

function avg(rows, key) {
  const vals = rows.map(r => r[key] || 0).filter(v => v > 0);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function fmtVal(key, val) {
  if (val == null) return "—";
  return key === "smax" ? fmtSmax(val) : fmtMetric(val);
}

// Convert image URL to base64 dataURL
async function toDataURL(url) {
  try {
    const resp = await fetch(url, { mode: "cors" });
    const blob = await resp.blob();
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export default function SessionPDFExport({ session, sessionPlayers, onClose }) {
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  async function generate() {
    setGenerating(true);
    try {
      // Fetch all data in parallel
      const [exercises, gpsRows] = await Promise.all([
        base44.entities.SessionExercise.filter({ session_id: session.id }, "order", 100),
        base44.entities.SessionGPSData.filter({ session_id: session.id }, "player_name", 200),
      ]);

      exercises.sort((a, b) => (a.order || 0) - (b.order || 0));

      // Pre-fetch logo
      const logoData = await toDataURL(DYJ_LOGO);

      // Pre-fetch exercise images
      const exerciseImgs = {};
      await Promise.all(exercises.map(async ex => {
        if (ex.image_url) {
          exerciseImgs[ex.id] = await toDataURL(ex.image_url);
        }
      }));

      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pageW = 210;
      const pageH = 297;
      const margin = 14;
      const contentW = pageW - margin * 2;
      let y = 0;

      // ── Colors ───────────────────────────────────────────────────────────────
      const YELLOW = [240, 200, 0];
      const DARK = [20, 20, 20];
      const GRAY = [100, 100, 100];
      const LIGHT = [245, 245, 245];
      const WHITE = [255, 255, 255];

      function addPageIfNeeded(needed = 20) {
        if (y + needed > pageH - 10) {
          doc.addPage();
          y = 14;
          drawPageHeader();
        }
      }

      function drawPageHeader() {
        // Thin top bar
        doc.setFillColor(...YELLOW);
        doc.rect(0, 0, pageW, 6, "F");
        if (logoData) {
          doc.addImage(logoData, "PNG", margin, 8, 10, 10);
        }
        doc.setFontSize(7);
        doc.setTextColor(...GRAY);
        doc.text("Defensa y Justicia — PerformancePitch", margin + 12, 12);
        doc.text(session.title, margin + 12, 16);
        doc.text(`Fecha: ${moment(session.date).format("DD/MM/YYYY")}`, pageW - margin, 12, { align: "right" });
        doc.setDrawColor(220, 220, 220);
        doc.line(margin, 20, pageW - margin, 20);
        y = 24;
      }

      // ── COVER PAGE ────────────────────────────────────────────────────────────
      // Background
      doc.setFillColor(...DARK);
      doc.rect(0, 0, pageW, pageH, "F");

      // Yellow bar top
      doc.setFillColor(...YELLOW);
      doc.rect(0, 0, pageW, 12, "F");

      // Logo centered
      if (logoData) {
        doc.addImage(logoData, "PNG", pageW / 2 - 20, 28, 40, 40);
      }

      // Club name
      doc.setFontSize(16);
      doc.setTextColor(...YELLOW);
      doc.setFont("helvetica", "bold");
      doc.text("DEFENSA Y JUSTICIA", pageW / 2, 80, { align: "center" });

      doc.setFontSize(10);
      doc.setTextColor(...WHITE);
      doc.setFont("helvetica", "normal");
      doc.text("Informe de Sesión de Entrenamiento", pageW / 2, 90, { align: "center" });

      // Yellow divider
      doc.setDrawColor(...YELLOW);
      doc.setLineWidth(0.8);
      doc.line(margin + 20, 96, pageW - margin - 20, 96);

      // Session info box
      const infoY = 105;
      doc.setFillColor(35, 35, 35);
      doc.roundedRect(margin, infoY, contentW, 80, 3, 3, "F");

      const infoData = [
        ["Sesión", session.title],
        ["Plantel", session.squad_name || "—"],
        ["Fecha", moment(session.date).format("dddd DD [de] MMMM YYYY")],
        ["Tipo", session.session_type || "—"],
        ["MD", session.match_day_code || "—"],
        ["Duración", session.duration_minutes ? `${session.duration_minutes} min` : "—"],
        ["Lugar", session.location || "—"],
        ["Intensidad", session.intensity_goal || "—"],
      ];

      let iy = infoY + 8;
      infoData.forEach(([label, value]) => {
        doc.setFontSize(8);
        doc.setTextColor(...YELLOW);
        doc.setFont("helvetica", "bold");
        doc.text(label + ":", margin + 6, iy);
        doc.setTextColor(...WHITE);
        doc.setFont("helvetica", "normal");
        doc.text(String(value), margin + 40, iy);
        iy += 8;
      });

      if (session.objective) {
        doc.setFillColor(45, 45, 45);
        doc.roundedRect(margin, infoY + 84, contentW, 20, 2, 2, "F");
        doc.setFontSize(7);
        doc.setTextColor(...YELLOW);
        doc.setFont("helvetica", "bold");
        doc.text("OBJETIVO:", margin + 4, infoY + 91);
        doc.setTextColor(...WHITE);
        doc.setFont("helvetica", "normal");
        const objLines = doc.splitTextToSize(session.objective, contentW - 50);
        doc.text(objLines[0], margin + 28, infoY + 91);
      }

      // Footer cover
      doc.setFontSize(7);
      doc.setTextColor(...GRAY);
      doc.text(`Exportado el ${moment().format("DD/MM/YYYY HH:mm")}`, pageW / 2, pageH - 10, { align: "center" });

      doc.setFillColor(...YELLOW);
      doc.rect(0, pageH - 6, pageW, 6, "F");

      // ── PAGE 2+ ────────────────────────────────────────────────────────────────
      doc.addPage();
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pageW, pageH, "F");
      drawPageHeader();

      // ── SECTION: JUGADORES ─────────────────────────────────────────────────────
      function sectionTitle(title, color = YELLOW) {
        addPageIfNeeded(14);
        doc.setFillColor(...color);
        doc.rect(margin, y, contentW, 7, "F");
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...DARK);
        doc.text(title.toUpperCase(), margin + 3, y + 5);
        y += 10;
      }

      function subSectionTitle(title) {
        addPageIfNeeded(8);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...GRAY);
        doc.text(title, margin, y + 4);
        y += 7;
      }

      function drawPlayersGroup(players, label) {
        if (!players.length) return;
        subSectionTitle(label + ` (${players.length})`);

        // Table header
        addPageIfNeeded(8);
        doc.setFillColor(...LIGHT);
        doc.rect(margin, y, contentW, 6, "F");
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...DARK);
        doc.text("Jugador", margin + 2, y + 4);
        doc.text("Posición", margin + 55, y + 4);
        doc.text("Estado", margin + 90, y + 4);
        doc.text("Asistencia", margin + 120, y + 4);
        doc.text("Observaciones", margin + 152, y + 4);
        y += 6;

        players.forEach((sp, idx) => {
          addPageIfNeeded(7);
          if (idx % 2 === 0) {
            doc.setFillColor(250, 250, 250);
            doc.rect(margin, y, contentW, 6, "F");
          }
          doc.setFontSize(7);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(...DARK);
          doc.text(sp.player_name || "—", margin + 2, y + 4, { maxWidth: 50 });
          doc.text(sp.position || "—", margin + 55, y + 4);
          doc.text(sp.status_at_session || "—", margin + 90, y + 4, { maxWidth: 28 });
          doc.text(sp.attendance || "—", margin + 120, y + 4);
          doc.text(sp.notes || "", margin + 152, y + 4, { maxWidth: 40 });
          y += 6;
        });
        y += 4;
      }

      sectionTitle("1. Jugadores presentes");

      const presentes = sessionPlayers.filter(sp => sp.attendance === "presente");
      const diferenciados = sessionPlayers.filter(sp => sp.attendance === "diferenciado");
      const ausentes = sessionPlayers.filter(sp => sp.attendance === "ausente");
      const kinesiologia = sessionPlayers.filter(sp => sp.attendance === "kinesiologia");
      const presentesField = presentes.filter(sp => !isGoalkeeper({ position: sp.position }));
      const presentesGK = presentes.filter(sp => isGoalkeeper({ position: sp.position }));

      if (sessionPlayers.length === 0) {
        doc.setFontSize(8);
        doc.setTextColor(...GRAY);
        doc.text("Sin jugadores registrados", margin, y + 5);
        y += 10;
      } else {
        drawPlayersGroup(presentesField, "Jugadores de campo presentes");
        drawPlayersGroup(presentesGK, "Arqueros presentes");
        drawPlayersGroup(diferenciados, "Diferenciados");
        drawPlayersGroup(kinesiologia, "Trabajaron en kinesiología");
        drawPlayersGroup(ausentes, "Ausentes");
      }

      // ── SECTION: EJERCICIOS ────────────────────────────────────────────────────
      sectionTitle("2. Ejercicios del día");

      if (exercises.length === 0) {
        doc.setFontSize(8);
        doc.setTextColor(...GRAY);
        doc.text("Sin ejercicios cargados", margin, y + 5);
        y += 10;
      } else {
        exercises.forEach((ex, idx) => {
          addPageIfNeeded(50);
          // Exercise header
          doc.setFillColor(235, 235, 235);
          doc.rect(margin, y, contentW, 7, "F");
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...DARK);
          doc.text(`${idx + 1}. ${ex.name}`, margin + 2, y + 5);
          if (ex.type) {
            doc.setFontSize(7);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(...GRAY);
            doc.text(ex.type, pageW - margin - 2, y + 5, { align: "right" });
          }
          y += 9;

          // Image (left) + details (right)
          const imgSize = 40;
          const detailX = margin + imgSize + 4;
          const detailW = contentW - imgSize - 4;
          const startY = y;

          const imgData = exerciseImgs[ex.id];
          if (imgData) {
            addPageIfNeeded(imgSize + 5);
            doc.addImage(imgData, "JPEG", margin, y, imgSize, imgSize);
          }

          const details = [
            ["Objetivo", ex.objective],
            ["Descripción", ex.description],
            ["Duración", ex.duration_min ? `${ex.duration_min} min` : null],
            ["Bloques", ex.blocks ? `${ex.blocks}` : null],
            ["Trabajo / Pausa", (ex.work_time || ex.rest_time) ? `${ex.work_time || "—"} / ${ex.rest_time || "—"}` : null],
            ["Dimensiones", (ex.length_m && ex.width_m) ? `${ex.length_m} × ${ex.width_m} m` : null],
            ["Jugadores", ex.players_count ? `${ex.players_count}` : null],
            ["Superficie", ex.total_area ? `${ex.total_area} m²` : null],
            ["EII", ex.eii ? `${ex.eii} m²/jug` : null],
            ["Notas", ex.notes],
          ].filter(([, v]) => v);

          let dy = y;
          details.forEach(([label, value]) => {
            if (dy - startY > (imgData ? imgSize : 0) + 5 || !imgData) {
              addPageIfNeeded(6);
            }
            const xBase = imgData ? detailX : margin;
            const wBase = imgData ? detailW : contentW;
            doc.setFontSize(7);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(...GRAY);
            doc.text(`${label}:`, xBase, dy + 4);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(...DARK);
            const lines = doc.splitTextToSize(String(value), wBase - 28);
            doc.text(lines, xBase + 26, dy + 4);
            dy += lines.length * 5 + 1;
          });

          y = Math.max(startY + (imgData ? imgSize + 2 : 0), dy) + 6;
        });
      }

      // ── SECTION: GPS ──────────────────────────────────────────────────────────
      sectionTitle("3. Carga externa de la sesión");

      if (gpsRows.length === 0) {
        doc.setFontSize(8);
        doc.setTextColor(...GRAY);
        doc.text("Sin carga externa cargada", margin, y + 5);
        y += 10;
      } else {
        // Solo el grupo principal (include_in_session_average !== false) entra en los promedios
        const principalRows = gpsRows.filter(r => r.include_in_session_average !== false);
        const excludedGpsRows = gpsRows.filter(r => r.include_in_session_average === false);

        // Classify GPS rows (grupo principal)
        const gpsField = principalRows.filter(r => !isGoalkeeper({ position: r.player_name_original }));
        const gpsGK = principalRows.filter(r => isGoalkeeper({ position: r.player_name_original }));

        // Summary row
        addPageIfNeeded(30);
        subSectionTitle(`Resumen del equipo — ${principalRows.length} jugadores en promedio (Campo: ${gpsField.length} · ARQ: ${gpsGK.length})${excludedGpsRows.length ? ` · ${excludedGpsRows.length} excluidos` : ""}`);

        const summaryData = GPS_METRICS.map(m => ({
          label: m.label,
          value: fmtVal(m.key, avg(principalRows, m.key)),
          field: fmtVal(m.key, avg(gpsField, m.key)),
          gk: fmtVal(m.key, avg(gpsGK, m.key)),
        }));

        const colW = contentW / 3;
        let sx = margin, sy = y;
        summaryData.forEach((item, i) => {
          if (i > 0 && i % 3 === 0) {
            sy += 16;
            sx = margin;
            addPageIfNeeded(16);
          }
          doc.setFillColor(...LIGHT);
          doc.roundedRect(sx, sy, colW - 2, 14, 1, 1, "F");
          doc.setFontSize(6);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...GRAY);
          doc.text(item.label, sx + 2, sy + 4);
          doc.setFontSize(9);
          doc.setTextColor(...DARK);
          doc.text(item.value, sx + 2, sy + 9);
          // Campo / ARQ sub-line
          doc.setFontSize(5.5);
          doc.setTextColor(...GRAY);
          doc.text(`C: ${item.field}  A: ${item.gk}`, sx + 2, sy + 13);
          sx += colW;
        });
        y = sy + 20;

        // GPS Table
        addPageIfNeeded(20);
        subSectionTitle("Detalle por jugador");

        // Header
        doc.setFillColor(...DARK);
        doc.rect(margin, y, contentW, 6, "F");
        doc.setFontSize(6);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...WHITE);
        const gpsHeaders = ["Jugador", ...GPS_METRICS.map(m => m.label)];
        const colWidths = [38, ...GPS_METRICS.map(() => (contentW - 38) / GPS_METRICS.length)];
        let hx = margin;
        gpsHeaders.forEach((h, i) => {
          doc.text(h, hx + 1, y + 4, { maxWidth: colWidths[i] - 2 });
          hx += colWidths[i];
        });
        y += 6;

        gpsRows.forEach((row, idx) => {
          addPageIfNeeded(6);
          const isExcluded = row.include_in_session_average === false;
          if (idx % 2 === 0) {
            doc.setFillColor(248, 248, 248);
            doc.rect(margin, y, contentW, 5.5, "F");
          }
          doc.setFontSize(6);
          doc.setFont("helvetica", isExcluded ? "italic" : "normal");
          doc.setTextColor(isExcluded ? 180 : DARK[0], isExcluded ? 130 : DARK[1], isExcluded ? 0 : DARK[2]);
          let rx = margin;
          const nameLabel = (row.player_name || "—") + (isExcluded ? " (excluido)" : "");
          const cells = [nameLabel, ...GPS_METRICS.map(m => fmtVal(m.key, row[m.key]))];
          cells.forEach((cell, i) => {
            doc.text(String(cell), rx + 1, y + 4, { maxWidth: colWidths[i] - 2 });
            rx += colWidths[i];
          });
          y += 5.5;
        });
        y += 4;
      }

      // ── SECTION: NOTAS FINALES ────────────────────────────────────────────────
      if (session.notes || session.created_by) {
        sectionTitle("4. Observaciones finales");
        if (session.notes) {
          addPageIfNeeded(20);
          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(...DARK);
          const noteLines = doc.splitTextToSize(session.notes, contentW);
          doc.text(noteLines, margin, y + 4);
          y += noteLines.length * 5 + 8;
        }
        if (session.created_by) {
          addPageIfNeeded(10);
          doc.setFontSize(8);
          doc.setTextColor(...GRAY);
          doc.text(`Responsable: ${session.created_by}`, margin, y);
          y += 6;
        }
      }

      // Export date footer on last page
      addPageIfNeeded(10);
      doc.setFontSize(7);
      doc.setTextColor(...GRAY);
      doc.text(`Exportado el ${moment().format("DD/MM/YYYY [a las] HH:mm")}`, margin, y + 4);

      // ── Thin yellow bottom bar on all pages ──────────────────────────────────
      const totalPages = doc.internal.getNumberOfPages();
      for (let p = 2; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFillColor(...YELLOW);
        doc.rect(0, pageH - 4, pageW, 4, "F");
        doc.setFontSize(6);
        doc.setTextColor(...GRAY);
        doc.text(`${p} / ${totalPages}`, pageW - margin, pageH - 6, { align: "right" });
      }

      const filename = `sesion_${moment(session.date).format("YYYY-MM-DD")}_${session.title.replace(/\s+/g, "_")}.pdf`;
      doc.save(filename);
      toast({ title: "✓ PDF exportado correctamente" });
    } catch (err) {
      console.error(err);
      toast({ title: "Error al generar el PDF: " + err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <FileText size={15} className="text-yellow-400" />
            <p className="text-sm font-semibold text-white">Exportar sesión en PDF</p>
          </div>
          <button onClick={onClose} disabled={generating} className="text-zinc-500 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-zinc-400">El PDF incluirá:</p>
          <ul className="text-xs text-zinc-400 space-y-1 list-disc list-inside">
            <li>Portada con datos de la sesión</li>
            <li>Jugadores presentes, diferenciados y ausentes</li>
            <li>Ejercicios con imagen y descripción</li>
            <li>Carga externa GPS (resumen + detalle por jugador)</li>
            <li>Observaciones finales</li>
          </ul>
          <button
            onClick={generate}
            disabled={generating}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-yellow-500 hover:bg-yellow-400 text-zinc-900 font-semibold text-sm rounded-xl transition-colors disabled:opacity-50"
          >
            {generating ? (
              <><Loader size={15} className="animate-spin" /> Generando PDF...</>
            ) : (
              <><FileText size={15} /> Generar y descargar PDF</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}