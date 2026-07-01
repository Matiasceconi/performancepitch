import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { ChevronLeft, ChevronRight, Plus, X, Clock, MapPin, Pencil, Trash2, Download, Settings2, FileText, Copy, ArrowUp, ArrowDown } from "lucide-react";
import moment from "moment";
import "moment/locale/es";
import { jsPDF } from "jspdf";
import { useWorkspace } from "@/lib/WorkspaceContext";

moment.locale("es");

const COLOR_MAP = {
  blue:   { bg: "bg-blue-500/20",   border: "border-blue-500/40",   text: "text-blue-300",   dot: "bg-blue-400",   hex: "#3b82f6" },
  green:  { bg: "bg-emerald-500/20", border: "border-emerald-500/40", text: "text-emerald-300", dot: "bg-emerald-400", hex: "#22c55e" },
  yellow: { bg: "bg-yellow-500/20", border: "border-yellow-500/40", text: "text-yellow-300", dot: "bg-yellow-400", hex: "#eab308" },
  orange: { bg: "bg-orange-500/20", border: "border-orange-500/40", text: "text-orange-300", dot: "bg-orange-400", hex: "#f97316" },
  red:    { bg: "bg-red-500/20",    border: "border-red-500/40",    text: "text-red-300",    dot: "bg-red-400",    hex: "#ef4444" },
  purple: { bg: "bg-violet-500/20", border: "border-violet-500/40", text: "text-violet-300", dot: "bg-violet-400", hex: "#8b5cf6" },
  pink:   { bg: "bg-pink-500/20",   border: "border-pink-500/40",   text: "text-pink-300",   dot: "bg-pink-400",   hex: "#ec4899" },
  cyan:   { bg: "bg-cyan-500/20",   border: "border-cyan-500/40",   text: "text-cyan-300",   dot: "bg-cyan-400",   hex: "#06b6d4" },
};

const COLORS = ["blue","green","yellow","orange","red","purple","pink","cyan"];
const COLOR_LABELS = { blue:"Azul", green:"Verde", yellow:"Amarillo", orange:"Naranja", red:"Rojo", purple:"Violeta", pink:"Rosa", cyan:"Celeste" };

const EMPTY_FORM = { date: "", time: "", title: "", type: "", duration_minutes: "", location: "", notes: "", color: "blue", rival_logo_url: "" };

const DAY_NAMES_ES = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const DAY_NAMES_FULL = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
// 0=Dom,1=Lun,...,6=Sáb
const START_DAY_OPTIONS = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];

const STORAGE_KEY = "schedule_custom_templates";
const WEEK_START_KEY = "schedule_week_start_day";

function loadCustomTemplates() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function saveCustomTemplates(templates) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}
function loadWeekStartDay() {
  try { return parseInt(localStorage.getItem(WEEK_START_KEY) || "1", 10); } catch { return 1; }
}
function saveWeekStartDay(day) {
  localStorage.setItem(WEEK_START_KEY, String(day));
}

// Get the start of a custom week (isoWeek equivalent but with any start day)
function getCustomWeekStart(refDate, startDay) {
  const d = refDate.clone().startOf("day");
  const currentDay = d.day(); // 0=Dom,...,6=Sáb
  let diff = currentDay - startDay;
  if (diff < 0) diff += 7;
  return d.subtract(diff, "days");
}

const EMPTY_TEMPLATE = { title: "", time: "", duration_minutes: "", color: "blue", type: "" };

// ── PDF helpers ──
function buildWeekPDF(days, eventsForDate, weekLabel) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  // Header
  doc.setFillColor(20, 20, 20);
  doc.rect(0, 0, pw, ph, "F");
  doc.setFillColor(34, 197, 94);
  doc.rect(0, 0, pw, 14, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("CRONOGRAMA", 8, 9);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(weekLabel, pw / 2, 9, { align: "center" });

  const colW = (pw - 16) / days.length;
  const startY = 18;
  const headerH = 10;

  // Day headers
  days.forEach((d, i) => {
    const x = 8 + i * colW;
    doc.setFillColor(40, 40, 40);
    doc.rect(x, startY, colW - 1, headerH, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    const label = d.format("dddd D").toUpperCase();
    doc.text(label, x + colW / 2 - 0.5, startY + 7, { align: "center" });
  });

  // Events
  const evY = startY + headerH + 2;
  const rowH = 9;
  const maxRows = Math.floor((ph - evY - 8) / rowH);
  const hexToRgb = (hex) => {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return [r,g,b];
  };

  days.forEach((d, i) => {
    const x = 8 + i * colW;
    const evs = eventsForDate(d.format("YYYY-MM-DD")).slice(0, maxRows);
    evs.forEach((ev, j) => {
      const y = evY + j * rowH;
      const [r,g,b] = hexToRgb(COLOR_MAP[ev.color]?.hex || "#3b82f6");
      doc.setFillColor(r,g,b);
      doc.roundedRect(x, y, colW - 2, rowH - 1, 1, 1, "F");
      doc.setTextColor(255,255,255);
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "bold");
      doc.text(ev.title, x + 2, y + 4, { maxWidth: colW - 4 });
      if (ev.time) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(5.5);
        doc.text(ev.time + (ev.duration_minutes ? ` · ${ev.duration_minutes}min` : ""), x + 2, y + 7.5);
      }
    });
    if (evs.length === 0) {
      doc.setTextColor(100,100,100);
      doc.setFontSize(6);
      doc.setFont("helvetica", "italic");
      doc.text("Sin eventos", x + colW / 2 - 0.5, evY + 5, { align: "center" });
    }
  });

  doc.setTextColor(120,120,120);
  doc.setFontSize(5.5);
  doc.text("HORARIOS SUJETOS A MODIFICACIONES", pw / 2, ph - 4, { align: "center" });
  return doc;
}

function buildDayPDF(day, events) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a5" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  doc.setFillColor(20,20,20);
  doc.rect(0,0,pw,ph,"F");
  doc.setFillColor(34,197,94);
  doc.rect(0,0,pw,14,"F");
  doc.setTextColor(255,255,255);
  doc.setFontSize(11);
  doc.setFont("helvetica","bold");
  doc.text("CRONOGRAMA DEL DÍA", pw/2, 9, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica","normal");
  doc.text(day.format("dddd D [de] MMMM YYYY").toUpperCase(), pw/2, 14+5, { align: "center" });

  const hexToRgb = (hex) => {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return [r,g,b];
  };

  let y = 26;
  if (events.length === 0) {
    doc.setTextColor(120,120,120);
    doc.setFontSize(8);
    doc.text("Sin eventos para este día.", pw/2, y+10, { align: "center" });
  }
  events.forEach((ev) => {
    const [r,g,b] = hexToRgb(COLOR_MAP[ev.color]?.hex || "#3b82f6");
    doc.setFillColor(r,g,b);
    doc.roundedRect(8, y, pw-16, 14, 2, 2, "F");
    doc.setTextColor(255,255,255);
    doc.setFontSize(9);
    doc.setFont("helvetica","bold");
    doc.text(ev.title, 12, y+6);
    doc.setFontSize(7);
    doc.setFont("helvetica","normal");
    const sub = [ev.time && `${ev.time}${ev.duration_minutes ? ` · ${ev.duration_minutes}min` : ""}`, ev.location].filter(Boolean).join("  |  ");
    if (sub) doc.text(sub, 12, y+11);
    y += 17;
    if (y > ph - 12) { doc.addPage(); y = 10; }
  });

  doc.setTextColor(120,120,120);
  doc.setFontSize(5.5);
  doc.text("HORARIOS SUJETOS A MODIFICACIONES", pw/2, ph-4, { align: "center" });
  return doc;
}

// ── TemplateManagerModal ──
function TemplateManagerModal({ open, onClose }) {
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState(EMPTY_TEMPLATE);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (open) { setTemplates(loadCustomTemplates()); setAdding(false); setForm(EMPTY_TEMPLATE); }
  }, [open]);

  if (!open) return null;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function handleAdd() {
    if (!form.title) return;
    const next = [...templates, { ...form, duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : undefined }];
    setTemplates(next);
    saveCustomTemplates(next);
    setForm(EMPTY_TEMPLATE);
    setAdding(false);
  }

  function handleDelete(idx) {
    const next = templates.filter((_, i) => i !== idx);
    setTemplates(next);
    saveCustomTemplates(next);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 w-full max-w-sm mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold text-sm">Gestionar plantillas</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={16} /></button>
        </div>
        {templates.length === 0 && !adding && (
          <p className="text-zinc-600 text-xs text-center py-4">No tenés plantillas personalizadas aún.</p>
        )}
        <div className="space-y-1.5 mb-3 max-h-48 overflow-y-auto">
          {templates.map((t, idx) => {
            const c = COLOR_MAP[t.color] || COLOR_MAP.blue;
            return (
              <div key={idx} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${c.bg} ${c.border}`}>
                <div>
                  <span className={`text-xs font-semibold ${c.text}`}>{t.title}</span>
                  {t.time && <span className="text-xs text-zinc-500 ml-2">{t.time}</span>}
                  {t.duration_minutes && <span className="text-xs text-zinc-600 ml-1">· {t.duration_minutes}min</span>}
                </div>
                <button onClick={() => handleDelete(idx)} className="p-1 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors">
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
        {adding ? (
          <div className="space-y-2 border-t border-zinc-800 pt-3">
            <input className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" placeholder="Título *" value={form.title} onChange={(e) => set("title", e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <input className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" placeholder="Tipo (ej: Comida)" value={form.type} onChange={(e) => set("type", e.target.value)} />
              <input type="time" className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-zinc-500" value={form.time} onChange={(e) => set("time", e.target.value)} />
              <input type="number" className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" placeholder="Duración (min)" value={form.duration_minutes} onChange={(e) => set("duration_minutes", e.target.value)} />
              <div className="flex gap-1.5 items-center">
                {COLORS.map((c) => (
                  <button key={c} onClick={() => set("color", c)} className={`w-5 h-5 rounded-full border-2 transition-all ${COLOR_MAP[c].dot} ${form.color === c ? "border-white scale-110" : "border-transparent opacity-50 hover:opacity-100"}`} />
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={handleAdd} disabled={!form.title} className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-white text-zinc-900 font-semibold hover:bg-zinc-200 disabled:opacity-40 transition-colors">Guardar</button>
              <button onClick={() => setAdding(false)} className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">Cancelar</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-zinc-700 text-xs text-zinc-500 hover:text-white hover:border-zinc-500 transition-colors">
            <Plus size={12} /> Nueva plantilla
          </button>
        )}
      </div>
    </div>
  );
}

// ── WeekSettingsModal ──
function WeekSettingsModal({ open, onClose, startDay, onChangeStartDay }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 w-full max-w-xs mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold text-sm">Configurar semana</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={16} /></button>
        </div>
        <p className="text-xs text-zinc-500 mb-3">Día de inicio de la semana</p>
        <div className="grid grid-cols-2 gap-2">
          {START_DAY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChangeStartDay(opt.value); onClose(); }}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${startDay === opt.value ? "bg-white text-zinc-900 border-white" : "bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-zinc-500"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── EventCard ──
function EventCard({ event, onEdit, onDelete, onCopy, onMoveUp, onMoveDown }) {
  const c = COLOR_MAP[event.color] || COLOR_MAP.blue;
  return (
    <div className={`rounded-lg border ${c.bg} ${c.border} overflow-hidden`}>
      <div className="flex items-start gap-2 p-2">
        {event.rival_logo_url
          ? <img src={event.rival_logo_url} alt="Escudo" className="w-6 h-6 object-contain shrink-0 mt-0.5" onError={(e) => { e.target.style.display = "none"; }} />
          : <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${c.dot}`} />
        }
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-bold ${c.text} leading-tight`}>{event.title}</p>
          {event.time && (
            <p className="text-xs text-zinc-400 mt-0.5">
              {event.time}{event.duration_minutes ? ` · ${event.duration_minutes}min` : ""}
            </p>
          )}
          {event.location && <p className="text-xs text-zinc-500 truncate">{event.location}</p>}
        </div>
        {/* Move up/down arrows */}
        <div className="flex flex-col gap-0.5 shrink-0">
          <button onClick={(e) => { e.stopPropagation(); onMoveUp(event); }} title="Mover antes" className="p-0.5 rounded hover:bg-white/20 text-zinc-500 hover:text-white transition-colors">
            <ArrowUp size={11} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onMoveDown(event); }} title="Mover después" className="p-0.5 rounded hover:bg-white/20 text-zinc-500 hover:text-white transition-colors">
            <ArrowDown size={11} />
          </button>
        </div>
      </div>
      <div className="flex border-t border-white/10">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(event); }}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-zinc-300 hover:bg-white/10 hover:text-white transition-colors"
        >
          <Pencil size={11} /> Editar
        </button>
        <div className="w-px bg-white/10" />
        <button
          onClick={(e) => { e.stopPropagation(); onCopy(event); }}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-zinc-300 hover:bg-white/10 hover:text-white transition-colors"
        >
          <Copy size={11} /> Copiar
        </button>
        <div className="w-px bg-white/10" />
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(event.id); }}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
        >
          <Trash2 size={11} /> Eliminar
        </button>
      </div>
    </div>
  );
}

// ── EventModal ──
function EventModal({ open, onClose, onSave, initial, copyData, defaultDate }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [customTemplates, setCustomTemplates] = useState([]);

  const DEFAULT_TEMPLATES = [
    { title: "Desayuno", time: "08:00", duration_minutes: 45, color: "yellow", type: "Comida" },
    { title: "Almuerzo", time: "13:00", duration_minutes: 60, color: "orange", type: "Comida" },
    { title: "Cena", time: "20:00", duration_minutes: 60, color: "orange", type: "Comida" },
    { title: "Entrenamiento", time: "10:00", duration_minutes: 90, color: "green", type: "Entrenamiento" },
    { title: "Partido", time: "20:00", duration_minutes: 105, color: "red", type: "Partido" },
    { title: "Jornada de Juveniles", time: "14:00", duration_minutes: 120, color: "pink", type: "Jornada de Juveniles" },
    { title: "Charla técnica", time: "09:00", duration_minutes: 60, color: "blue", type: "Charla" },
    { title: "Recuperación", time: "11:00", duration_minutes: 60, color: "cyan", type: "Físico" },
    { title: "Viaje", time: "07:00", duration_minutes: 120, color: "purple", type: "Logística" },
    { title: "Gimnasio", time: "09:30", duration_minutes: 60, color: "purple", type: "Físico" },
    { title: "Cancha", time: "10:00", duration_minutes: 90, color: "green", type: "Entrenamiento" },
  ];

  useEffect(() => {
    if (open) {
      if (initial) {
        setForm({ ...EMPTY_FORM, ...initial });
      } else if (copyData) {
        setForm({ ...EMPTY_FORM, ...copyData, date: defaultDate || copyData.date || "" });
      } else {
        setForm({ ...EMPTY_FORM, date: defaultDate || "" });
      }
      setCustomTemplates(loadCustomTemplates());
    }
  }, [open, initial, copyData, defaultDate]);

  const allTemplates = [...DEFAULT_TEMPLATES, ...customTemplates];
  if (!open) return null;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!form.title || !form.date) return;
    setSaving(true);
    const payload = { ...form, duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : undefined };
    await onSave(payload);
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold">{initial ? "Editar evento" : copyData ? "Copiar evento" : "Nuevo evento"}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={18} /></button>
        </div>
        {/* Quick templates */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-zinc-500">Plantillas rápidas</p>
            <button type="button" onClick={() => setShowTemplateManager(true)} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-white transition-colors px-2 py-0.5 rounded hover:bg-zinc-800">
              <Plus size={11} /> Gestionar
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allTemplates.map((t, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setForm((f) => ({ ...f, title: t.title, time: t.time || f.time, duration_minutes: t.duration_minutes || f.duration_minutes, color: t.color, type: t.type || f.type }))}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${COLOR_MAP[t.color].bg} ${COLOR_MAP[t.color].text} ${COLOR_MAP[t.color].border} hover:opacity-80`}
              >
                {t.title}
              </button>
            ))}
          </div>
        </div>
        <TemplateManagerModal open={showTemplateManager} onClose={() => { setShowTemplateManager(false); setCustomTemplates(loadCustomTemplates()); }} />
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-zinc-400 mb-1 block">Título *</label>
              <input className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" placeholder="Ej: Desayuno, Viaje al estadio..." value={form.title} onChange={(e) => set("title", e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Tipo de evento</label>
              <input className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" placeholder="Ej: Comida, Viaje..." value={form.type} onChange={(e) => set("type", e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Fecha *</label>
              <input type="date" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500" value={form.date} onChange={(e) => set("date", e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Hora</label>
              <input type="time" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500" value={form.time} onChange={(e) => set("time", e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Duración (min)</label>
              <input type="number" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" placeholder="60" value={form.duration_minutes} onChange={(e) => set("duration_minutes", e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Lugar</label>
              <input className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" placeholder="Ej: Hotel, Estadio..." value={form.location} onChange={(e) => set("location", e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-zinc-400 mb-1 block">Notas</label>
              <textarea rows={2} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 resize-none" placeholder="Observaciones..." value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </div>
            {(form.type === "Partido" || form.type === "Jornada de Juveniles") && (
              <div className="col-span-2">
                <label className="text-xs text-zinc-400 mb-1 block">URL escudo rival (opcional)</label>
                <input className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" placeholder="https://..." value={form.rival_logo_url || ""} onChange={(e) => set("rival_logo_url", e.target.value)} />
                {form.rival_logo_url && (
                  <img src={form.rival_logo_url} alt="Escudo" className="mt-2 w-12 h-12 object-contain rounded" onError={(e) => e.target.style.display="none"} />
                )}
              </div>
            )}
            <div className="col-span-2">
              <label className="text-xs text-zinc-400 mb-2 block">Color</label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((c) => (
                  <button key={c} title={COLOR_LABELS[c]} onClick={() => set("color", c)} className={`w-7 h-7 rounded-full border-2 transition-all ${COLOR_MAP[c].dot} ${form.color === c ? "border-white scale-110" : "border-transparent opacity-60 hover:opacity-100"}`} />
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={!form.title || !form.date || saving} className="px-4 py-2 rounded-lg text-sm bg-white text-zinc-900 font-semibold hover:bg-zinc-200 disabled:opacity-40 transition-colors">
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Schedule ──
export default function Schedule() {
  const { activeSquadId, activeSquad } = useWorkspace();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weekStartDay, setWeekStartDay] = useState(loadWeekStartDay);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getCustomWeekStart(moment(), loadWeekStartDay()));
  const [view, setView] = useState("week");
  const [currentMonth, setCurrentMonth] = useState(moment().startOf("month"));
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [defaultDate, setDefaultDate] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [copyData, setCopyData] = useState(null);
  const [copyingEvent, setCopyingEvent] = useState(null); // event being copied
  const [copyTargetDate, setCopyTargetDate] = useState(""); // target date for paste

  async function loadEvents() {
    setLoading(true);
    const all = await base44.entities.DayEvent.list("-date", 500);
    // Mostrar únicamente eventos del plantel activo
    const filtered = activeSquadId
      ? all.filter(e => e.squad_id === activeSquadId)
      : all;
    setEvents(filtered);
    setLoading(false);
  }

  useEffect(() => { setLoading(true); loadEvents(); }, [activeSquadId]);

  // Re-compute week start when weekStartDay changes
  useEffect(() => {
    setCurrentWeekStart(getCustomWeekStart(moment(), weekStartDay));
  }, [weekStartDay]);

  function handleChangeStartDay(day) {
    saveWeekStartDay(day);
    setWeekStartDay(day);
  }

  function getEventsForDate(dateStr) {
    return events
      .filter((e) => e.date === dateStr)
      .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  }

  async function handleSave(form) {
    const payload = { ...form, squad_id: activeSquadId, squad_name: activeSquad?.name || "" };
    if (editingEvent) {
      await base44.entities.DayEvent.update(editingEvent.id, payload);
    } else {
      await base44.entities.DayEvent.create(payload);
    }
    await loadEvents();
  }

  async function handleDelete(id) {
    try {
      await base44.entities.DayEvent.delete(id);
    } catch (e) {
      // Si el evento ya no existe, ignorar el error
    }
    await loadEvents();
  }

  function handleCopy(event) {
    setCopyingEvent(event);
    setCopyTargetDate(event.date);
  }

  async function handlePaste() {
    if (!copyingEvent || !copyTargetDate) return;
    const { id, created_date, updated_date, created_by_id, ...rest } = copyingEvent;
    await base44.entities.DayEvent.create({ ...rest, date: copyTargetDate });
    setCopyingEvent(null);
    setCopyTargetDate("");
    await loadEvents();
  }

  async function handleMoveUp(event) {
    if (!event.time) return;
    const [h, m] = event.time.split(":").map(Number);
    const totalMins = h * 60 + m - 30;
    if (totalMins < 0) return;
    const newTime = `${String(Math.floor(totalMins / 60)).padStart(2, "0")}:${String(totalMins % 60).padStart(2, "0")}`;
    await base44.entities.DayEvent.update(event.id, { time: newTime });
    await loadEvents();
  }

  async function handleMoveDown(event) {
    if (!event.time) return;
    const [h, m] = event.time.split(":").map(Number);
    const totalMins = h * 60 + m + 30;
    if (totalMins >= 24 * 60) return;
    const newTime = `${String(Math.floor(totalMins / 60)).padStart(2, "0")}:${String(totalMins % 60).padStart(2, "0")}`;
    await base44.entities.DayEvent.update(event.id, { time: newTime });
    await loadEvents();
  }

  function openNew(dateStr = "") {
    setEditingEvent(null);
    setCopyData(null);
    setDefaultDate(dateStr);
    setModalOpen(true);
  }

  function openEdit(event) {
    setEditingEvent(event);
    setCopyData(null);
    setDefaultDate(event.date);
    setModalOpen(true);
  }

  function getWeekDays() {
    return Array.from({ length: 7 }, (_, i) => currentWeekStart.clone().add(i, "day"));
  }

  function downloadWeekPDF() {
    const days = getWeekDays();
    const weekLabel = `${activeSquad?.name ? activeSquad.name + " · " : ""}${days[0].format("D MMM")} – ${days[6].format("D MMM YYYY")}`.toUpperCase();
    const doc = buildWeekPDF(days, getEventsForDate, weekLabel);
    doc.save(`cronograma-semana-${days[0].format("YYYY-MM-DD")}.pdf`);
  }

  function downloadDayPDF(day) {
    const evs = getEventsForDate(day.format("YYYY-MM-DD"));
    const doc = buildDayPDF(day, evs);
    doc.save(`cronograma-${day.format("YYYY-MM-DD")}.pdf`);
  }

  // ── WEEK VIEW ──
  function renderWeek() {
    const days = getWeekDays();
    const today = moment().format("YYYY-MM-DD");

    return (
      <>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCurrentWeekStart((w) => w.clone().subtract(7, "days"))} className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors">
            <ChevronLeft size={16} />
          </button>
          <h2 className="text-white font-semibold capitalize">
            {days[0].format("D MMM")} – {days[6].format("D MMM YYYY")}
          </h2>
          <button onClick={() => setCurrentWeekStart((w) => w.clone().add(7, "days"))} className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-3" style={{ scrollSnapType: "x mandatory" }}>
          {days.map((d) => {
            const dateStr = d.format("YYYY-MM-DD");
            const isToday = dateStr === today;
            const dayEvents = getEventsForDate(dateStr);

            return (
              <div key={dateStr} style={{ minWidth: "200px", scrollSnapAlign: "start" }} className={`bg-zinc-900 border rounded-xl flex flex-col ${isToday ? "border-white/20" : "border-zinc-800"}`}>
                <div className={`flex items-center justify-between px-3 py-2 border-b ${isToday ? "border-white/10" : "border-zinc-800"}`}>
                  <div>
                    <p className="text-xs text-zinc-500 uppercase font-medium">{d.format("ddd")}</p>
                    <p className={`text-lg font-bold ${isToday ? "text-white" : "text-zinc-300"}`}>{d.date()}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => downloadDayPDF(d)} className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-600 hover:text-zinc-300 transition-colors" title="Descargar PDF del día">
                      <FileText size={12} />
                    </button>
                    <button onClick={() => openNew(dateStr)} className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-500 hover:text-white transition-colors" title="Agregar evento">
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
                <div className="flex-1 p-2 space-y-1.5 min-h-[120px]">
                  {dayEvents.length === 0 && (
                    <p className="text-xs text-zinc-700 text-center pt-4">Sin eventos</p>
                  )}
                  {dayEvents.map((ev) => (
                    <EventCard key={ev.id} event={ev} onEdit={openEdit} onDelete={handleDelete} onCopy={handleCopy} onMoveUp={handleMoveUp} onMoveDown={handleMoveDown} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  }

  // ── MONTH VIEW ──
  function renderMonth() {
    const DAYS_HEADER = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
    const startOfMonth = currentMonth.clone();
    const gridStart = startOfMonth.clone().startOf("isoWeek");
    const gridEnd = currentMonth.clone().endOf("month").endOf("isoWeek");
    const days = [];
    let day = gridStart.clone();
    while (day.isSameOrBefore(gridEnd, "day")) { days.push(day.clone()); day.add(1, "day"); }
    const today = moment().format("YYYY-MM-DD");

    return (
      <>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCurrentMonth((m) => m.clone().subtract(1, "month"))} className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors">
            <ChevronLeft size={16} />
          </button>
          <h2 className="text-white font-semibold capitalize">{currentMonth.format("MMMM YYYY")}</h2>
          <button onClick={() => setCurrentMonth((m) => m.clone().add(1, "month"))} className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="grid grid-cols-7 mb-1">
          {DAYS_HEADER.map((d) => <div key={d} className="text-center text-xs text-zinc-600 font-medium py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-px bg-zinc-800 rounded-xl overflow-hidden border border-zinc-800">
          {days.map((d) => {
            const dateStr = d.format("YYYY-MM-DD");
            const isCurrentMonth = d.isSame(currentMonth, "month");
            const isToday = dateStr === today;
            const dayEvents = getEventsForDate(dateStr);
            return (
              <div key={dateStr} className={`bg-zinc-900 min-h-[90px] p-1.5 ${!isCurrentMonth ? "opacity-25" : ""}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? "bg-white text-zinc-900" : "text-zinc-400"}`}>{d.date()}</div>
                  {isCurrentMonth && (
                    <button onClick={() => openNew(dateStr)} className="p-0.5 rounded hover:bg-zinc-700 text-zinc-700 hover:text-zinc-400 transition-colors">
                      <Plus size={10} />
                    </button>
                  )}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map((ev) => {
                    const c = COLOR_MAP[ev.color] || COLOR_MAP.blue;
                    return (
                      <div key={ev.id} className={`flex items-center gap-1 text-xs px-1 py-0.5 rounded truncate cursor-pointer ${c.bg} ${c.text}`} onClick={() => openEdit(ev)}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
                        <span className="truncate">{ev.time && `${ev.time} `}{ev.title}</span>
                      </div>
                    );
                  })}
                  {dayEvents.length > 3 && <p className="text-xs text-zinc-600 pl-1">+{dayEvents.length - 3} más</p>}
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Cronograma</h1>
          <p className="text-zinc-500 text-sm mt-1">{activeSquad?.name || "Planificación diaria del equipo"}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-zinc-800 rounded-lg p-1 gap-1">
            <button onClick={() => setView("week")} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "week" ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"}`}>Semana</button>
            <button onClick={() => setView("month")} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "month" ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"}`}>Mes</button>
          </div>
          {view === "week" && (
            <>
              <button onClick={() => setShowSettings(true)} className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-sm hover:bg-zinc-700 transition-colors" title="Configurar semana">
                <Settings2 size={15} /> Configurar
              </button>
              <button onClick={downloadWeekPDF} className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-sm hover:bg-zinc-700 transition-colors">
                <Download size={15} /> PDF semana
              </button>
            </>
          )}
          <button onClick={() => openNew(moment().format("YYYY-MM-DD"))} className="flex items-center gap-1.5 px-3 py-2 bg-white text-zinc-900 rounded-lg text-sm font-semibold hover:bg-zinc-200 transition-colors">
            <Plus size={15} /> Nuevo evento
          </button>
        </div>
      </div>

      {/* Banner de pegado */}
      {copyingEvent && (
        <div className="flex items-center gap-3 bg-violet-500/10 border border-violet-500/30 rounded-xl px-4 py-3">
          <Copy size={15} className="text-violet-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-violet-300 font-semibold truncate">Copiando: <span className="text-white">{copyingEvent.title}</span></p>
            <p className="text-xs text-zinc-500 mt-0.5">Elegí el día de destino:</p>
          </div>
          <input
            type="date"
            value={copyTargetDate}
            onChange={(e) => setCopyTargetDate(e.target.value)}
            className="bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-violet-500"
          />
          <button
            onClick={handlePaste}
            disabled={!copyTargetDate}
            className="px-4 py-1.5 rounded-lg text-sm bg-violet-600 text-white font-semibold hover:bg-violet-700 disabled:opacity-40 transition-colors"
          >
            Pegar
          </button>
          <button
            onClick={() => { setCopyingEvent(null); setCopyTargetDate(""); }}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {view === "week" ? renderWeek() : renderMonth()}

      <EventModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingEvent(null); setCopyData(null); }}
        onSave={handleSave}
        initial={editingEvent}
        copyData={copyData}
        defaultDate={defaultDate}
      />

      <WeekSettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        startDay={weekStartDay}
        onChangeStartDay={handleChangeStartDay}
      />
    </div>
  );
}