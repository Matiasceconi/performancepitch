import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const [records, players] = await Promise.all([
      base44.asServiceRole.entities.MinutesRecord.list("-created_date", 500),
      base44.asServiceRole.entities.Player.list("-created_date", 200),
    ]);

    // Consolidar por jugador
    const map = {};
    records.forEach(r => {
      const mins = r.minutes || 0;
      const key = r.player_id || `name:${(r.player_name || "").toLowerCase()}`;
      if (!map[key]) {
        map[key] = { player_id: r.player_id, player_name: r.player_name, reserva: 0, juveniles: 0, amistosos: 0 };
      }
      const t = r.tournament;
      if (t === "Proyección Apertura" || t === "Clausura") map[key].reserva += mins;
      else if (t === "Juveniles") map[key].juveniles += mins;
      else if (t === "Amistosos") map[key].amistosos += mins;
    });

    const data = Object.values(map)
      .map(p => ({
        ...p,
        total: (p.reserva || 0) + (p.juveniles || 0) + (p.amistosos || 0),
      }))
      .sort((a, b) => (b.reserva || 0) - (a.reserva || 0));

    const TOT_RESERVA = 1727;
    const TOT_JUVENILES = 1252;

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = 297;

    // Columnas: # + Jugador + Reserva + %Res + Juveniles + %Juv + Amistosos + Total
    const colW = [8, 64, 20, 18, 20, 18, 18, 18];
    const gap = 2;
    const xStart = 14;
    const xCols = [];
    let px = xStart;
    colW.forEach((w, i) => {
      xCols.push(px);
      px += w + gap;
    });

    function header() {
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("PerformancePitch — Minutos por jugador", 14, 16);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Generado: ${new Date().toLocaleDateString("es-AR")}`, 14, 23);
      doc.setLineWidth(0.5);
      doc.line(14, 26, pageW - 14, 26);
    }

    let y = 33;
    let rowNum = 0;
    const ROW_H = 6;

    function drawCell(text, colIdx, align, bold) {
      if (y > 190) {
        doc.addPage();
        y = 16;
      }
      doc.setFontSize(bold ? 7 : 6.5);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      const cx = align === "left" ? xCols[colIdx] + 1 : xCols[colIdx] + colW[colIdx] / 2;
      doc.text(String(text ?? ""), cx, y + 0.5, { align: align || "left" });
    }

    function drawRow(parts, bold) {
      if (y > 190) {
        doc.addPage();
        y = 16;
      }
      if (rowNum % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(xStart, y - 1, pageW - 2 * xStart, 5.5, "F");
      }
      drawCell(parts[0], 0, "center", bold);
      drawCell(parts[1], 1, "left", bold);
      drawCell(parts[2], 2, "center", bold);
      drawCell(parts[3], 3, "center", bold);
      drawCell(parts[4], 4, "center", bold);
      drawCell(parts[5], 5, "center", bold);
      drawCell(parts[6], 6, "center", bold);
      drawCell(parts[7], 7, "center", bold);
    }

    function renderCell(n, colIdx) {
      drawCell(n, colIdx, "center", false);
    }

    header();
    y += 6;

    function row(strs) {
      if (y > 190) { doc.addPage(); y = 16; }
      if (rowNum % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(xStart, y - 1, pageW - 2 * xStart, 5.5, "F");
      }
      strs.forEach((s, i) => {
        const ci = i === 1 ? xCols[1] + 1 : xCols[i] + colW[i] / 2;
        const al = i === 1 ? "left" : "center";
        doc.setFontSize(i === 1 ? 7 : 6.5);
        doc.setFont("helvetica", i === 1 ? "normal" : "normal");
        doc.text(String(s ?? ""), ci, y + 0.5, { align: al });
      });
      y += ROW_H;
      rowNum++;
    }

    // Header row
    doc.setFont("helvetica", "bold");
    row(["#", "Jugador", "Reserva", "%Res", "Juveniles", "%Juv", "Ami.", "Total"]);

    data.forEach((p, i) => {
      row([
        String(i + 1),
        p.player_name || "",
        `${p.reserva || 0}'`,
        TOT_RESERVA > 0 ? `${Math.round(((p.reserva || 0) / TOT_RESERVA) * 100)}%` : "-",
        `${p.juveniles || 0}'`,
        TOT_JUVENILES > 0 ? `${Math.round(((p.juveniles || 0) / TOT_JUVENILES) * 100)}%` : "-",
        `${p.amistosos || 0}'`,
        `${p.total}'`,
      ]);
    });

    // Totales
    y += 2;
    const totals = data.reduce((s, p) => ({
      reserva: s.reserva + (p.reserva || 0),
      juveniles: s.juveniles + (p.juveniles || 0),
    }), { reserva: 0, juveniles: 0 });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(
      `Totales: ${totals.reserva}' / ${TOT_RESERVA}' Reserva  |  ${totals.juveniles}' / ${TOT_JUVENILES}' Juveniles  |  ${data.length} jugadores`,
      14, y + 4
    );

    const pdfBytes = doc.output('arraybuffer');
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename=minutos-por-jugador.pdf'
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});