import React, { useState, useMemo, useRef, useEffect } from "react";
import { X, Download, FileText, Image as ImageIcon, Calendar, CalendarDays, CalendarRange, Eye, Loader2 } from "lucide-react";
import moment from "moment";
import "moment/locale/es";
import html2canvas from "html2canvas";
import { resolveBrand, contrastText } from "@/lib/clubBrandResolver";
import { buildProfessionalWeekSchedulePDF } from "@/components/schedule/professionalSchedulePdf";
import { buildDailySchedulePDF } from "@/components/schedule/dailySchedulePdf";
import { buildMonthSchedulePDF } from "@/components/schedule/monthSchedulePdf";
import PngScheduleRender from "@/components/schedule/PngScheduleRender";

moment.locale("es");

const FORMATS = [
  { key: "weekly", label: "Semanal", icon: CalendarRange, desc: "A4 horizontal · 7 días" },
  { key: "daily", label: "Diario", icon: CalendarDays, desc: "A4 vertical · 1 día" },
  { key: "monthly", label: "Mensual", icon: Calendar, desc: "A4 horizontal · mes completo" },
];

const OUTPUTS = [
  { key: "pdf", label: "PDF", icon: FileText, desc: "Documento imprimible" },
  { key: "png", label: "PNG", icon: ImageIcon, desc: "Imagen para compartir" },
];

export default function ScheduleExportModal({ open, onClose, activeSquad, eventsForDate, currentWeekStart, currentMonth }) {
  const [format, setFormat] = useState("weekly");
  const [output, setOutput] = useState("pdf");
  const [includeEmpty, setIncludeEmpty] = useState(true);
  const [singleDate, setSingleDate] = useState(moment().format("YYYY-MM-DD"));
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const previewRef = useRef(null);

  const brand = useMemo(() => resolveBrand(activeSquad || {}), [activeSquad]);

  useEffect(() => {
    if (open) {
      setPreviewUrl("");
      if (format === "daily") setSingleDate(currentWeekStart?.format("YYYY-MM-DD") || moment().format("YYYY-MM-DD"));
      if (format === "monthly") {
        // default to current month
      }
      if (format === "weekly") {
        setRangeStart(currentWeekStart?.format("YYYY-MM-DD") || "");
        setRangeEnd(currentWeekStart?.clone().add(6, "days").format("YYYY-MM-DD") || "");
      }
    }
  }, [open, format, currentWeekStart]);

  const daysToExport = useMemo(() => {
    if (format === "daily") return [moment(singleDate)];
    if (format === "weekly") {
      const start = rangeStart ? moment(rangeStart) : currentWeekStart;
      const end = rangeEnd ? moment(rangeEnd) : start.clone().add(6, "days");
      const days = [];
      let d = start.clone();
      while (d.isSameOrBefore(end, "day")) { days.push(d.clone()); d.add(1, "day"); }
      return days;
    }
    if (format === "monthly") {
      const m = currentMonth || moment().startOf("month");
      const start = m.clone().startOf("month");
      const end = m.clone().endOf("month");
      const days = [];
      let d = start.clone();
      while (d.isSameOrBefore(end, "day")) { days.push(d.clone()); d.add(1, "day"); }
      return days;
    }
    return [];
  }, [format, singleDate, rangeStart, rangeEnd, currentWeekStart, currentMonth]);

  const allEvents = useMemo(() => daysToExport.flatMap((d) => eventsForDate(d.format("YYYY-MM-DD"))), [daysToExport, eventsForDate]);

  async function generate() {
    setGenerating(true);
    setPreviewUrl("");
    try {
      if (output === "png") {
        // PNG: renderizar HTML y capturar con html2canvas
        await new Promise((r) => setTimeout(r, 100)); // esperar render del div
        if (previewRef.current) {
          const canvas = await html2canvas(previewRef.current, {
            scale: 2,
            backgroundColor: "#ffffff",
            useCORS: true,
            logging: false,
          });
          const url = canvas.toDataURL("image/png");
          setPreviewUrl(url);
        }
      } else {
        // PDF: generar con jsPDF
        let doc;
        if (format === "weekly") {
          doc = await buildProfessionalWeekSchedulePDF({
            days: daysToExport,
            eventsForDate,
            weekLabel: daysToExport.length > 7
              ? `${daysToExport[0].format("DD-MM")} _ ${daysToExport[daysToExport.length - 1].format("DD-MM-YYYY")}`
              : `${daysToExport[0].format("DD-MM")}_${daysToExport[daysToExport.length - 1].format("DD-MM-YYYY")}`,
            squadName: activeSquad?.name || "Plantel",
            season: activeSquad?.season || "",
            brand,
            includeEmpty,
          });
        } else if (format === "daily") {
          doc = await buildDailySchedulePDF({
            day: daysToExport[0],
            events: eventsForDate(daysToExport[0].format("YYYY-MM-DD")),
            squadName: activeSquad?.name || "Plantel",
            brand,
          });
        } else {
          doc = await buildMonthSchedulePDF({
            month: currentMonth || moment().startOf("month"),
            eventsForDate,
            squadName: activeSquad?.name || "Plantel",
            season: activeSquad?.season || "",
            brand,
            includeEmpty,
          });
        }
        const blob = doc.output("blob");
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      }
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setGenerating(false);
    }
  }

  function download() {
    if (!previewUrl) return;
    const link = document.createElement("a");
    link.href = previewUrl;
    const baseName = format === "daily"
      ? `cronograma_diario_${singleDate}`
      : format === "weekly"
        ? `cronograma_semanal_${daysToExport[0].format("YYYY-MM-DD")}`
        : `cronograma_mensual_${(currentMonth || moment()).format("YYYY-MM")}`;
    link.download = `${baseName}.${output === "pdf" ? "pdf" : "png"}`;
    link.click();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-4xl my-4 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between gap-4">
          <div>
            <p className="text-white font-bold flex items-center gap-2"><Download size={18} className="text-emerald-400" />Exportar calendario</p>
            <p className="text-zinc-500 text-xs mt-1">Configurá el formato y descargá el cronograma del club activo.</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Formato */}
          <div>
            <p className="text-xs text-zinc-400 mb-2 font-semibold">Formato</p>
            <div className="grid grid-cols-3 gap-2">
              {FORMATS.map((f) => {
                const Icon = f.icon;
                return (
                  <button
                    key={f.key}
                    onClick={() => setFormat(f.key)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 transition ${format === f.key ? "border-emerald-500 bg-emerald-500/10" : "border-zinc-700 bg-zinc-950 hover:border-zinc-600"}`}
                  >
                    <Icon size={18} className={format === f.key ? "text-emerald-400" : "text-zinc-400"} />
                    <span className={`text-xs font-bold ${format === f.key ? "text-white" : "text-zinc-400"}`}>{f.label}</span>
                    <span className="text-[10px] text-zinc-600 text-center">{f.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Salida */}
          <div>
            <p className="text-xs text-zinc-400 mb-2 font-semibold">Tipo de archivo</p>
            <div className="grid grid-cols-2 gap-2">
              {OUTPUTS.map((o) => {
                const Icon = o.icon;
                return (
                  <button
                    key={o.key}
                    onClick={() => setOutput(o.key)}
                    className={`flex items-center gap-2 rounded-xl border p-3 transition ${output === o.key ? "border-emerald-500 bg-emerald-500/10" : "border-zinc-700 bg-zinc-950 hover:border-zinc-600"}`}
                  >
                    <Icon size={16} className={output === o.key ? "text-emerald-400" : "text-zinc-400"} />
                    <div className="text-left">
                      <span className={`text-xs font-bold block ${output === o.key ? "text-white" : "text-zinc-400"}`}>{o.label}</span>
                      <span className="text-[10px] text-zinc-600">{o.desc}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fechas */}
          <div>
            <p className="text-xs text-zinc-400 mb-2 font-semibold">Período</p>
            {format === "daily" && (
              <input type="date" value={singleDate} onChange={(e) => setSingleDate(e.target.value)} className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
            )}
            {format === "weekly" && (
              <div className="flex items-center gap-2">
                <input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
                <span className="text-zinc-500 text-xs">hasta</span>
                <input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
                <span className="text-zinc-600 text-xs ml-2">{daysToExport.length} días</span>
              </div>
            )}
            {format === "monthly" && (
              <p className="text-sm text-zinc-400">{(currentMonth || moment()).format("MMMM YYYY")}</p>
            )}
          </div>

          {/* Opciones */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIncludeEmpty(!includeEmpty)}
              className={`relative w-10 h-5 rounded-full transition ${includeEmpty ? "bg-emerald-500" : "bg-zinc-700"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition ${includeEmpty ? "translate-x-5" : ""}`} />
            </button>
            <span className="text-xs text-zinc-400">Incluir días sin actividades</span>
          </div>

          {/* Resumen del club */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 flex items-center gap-3">
            {brand.logoUrl ? (
              <img src={brand.logoUrl} alt={brand.name} className="w-10 h-10 object-contain" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 font-bold text-xs">{brand.shortName}</div>
            )}
            <div className="flex-1">
              <p className="text-sm font-bold text-white">{brand.name}</p>
              <p className="text-xs text-zinc-500">{brand.squadName} · {brand.season || "Temporada"}</p>
            </div>
            <div className="flex gap-1.5">
              <span className="w-5 h-5 rounded-full border border-zinc-700" style={{ backgroundColor: brand.colors.primary }} title="Principal" />
              <span className="w-5 h-5 rounded-full border border-zinc-700" style={{ backgroundColor: brand.colors.secondary }} title="Secundario" />
              <span className="w-5 h-5 rounded-full border border-zinc-700" style={{ backgroundColor: brand.colors.accent }} title="Acento" />
            </div>
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm">Cancelar</button>
            <button
              onClick={generate}
              disabled={generating || !daysToExport.length}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-bold disabled:opacity-40"
            >
              {generating ? <Loader2 size={15} className="animate-spin" /> : <Eye size={15} />}
              {generating ? "Generando..." : "Vista previa"}
            </button>
            {previewUrl && (
              <button
                onClick={download}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold"
              >
                <Download size={15} /> Descargar
              </button>
            )}
          </div>

          {/* Vista previa */}
          {previewUrl && output === "pdf" && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-2 overflow-hidden">
              <iframe src={previewUrl} title="Vista previa" className="w-full h-[400px] rounded-lg" />
            </div>
          )}
          {previewUrl && output === "png" && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-2 overflow-hidden">
              <img src={previewUrl} alt="Vista previa PNG" className="w-full rounded-lg" />
            </div>
          )}

          {/* Div oculto para captura PNG con html2canvas */}
          {output === "png" && (
            <div style={{ position: "absolute", left: "-9999px", top: 0, width: format === "daily" ? "800px" : "1200px" }} ref={previewRef}>
              <PngScheduleRender days={daysToExport} eventsForDate={eventsForDate} brand={brand} format={format} includeEmpty={includeEmpty} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}