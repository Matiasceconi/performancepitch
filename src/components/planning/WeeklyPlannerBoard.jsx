import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Save, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";
import "moment/locale/es";
moment.locale("es");

// ─── Constantes ────────────────────────────────────────────────────────────────
const DAYS = ["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO", "DOMINGO"];
const MD_OPTIONS = ["— MD —", "MD-6", "MD-5", "MD-4", "MD-3", "MD-2", "MD-1", "MD", "MD+1", "MD+2"];
const OBJETIVO_OPTIONS = ["—", "Fuerza", "Intermitente", "Aceleración", "Velocidad Máxima", "Recuperación", "Resistencia", "Táctica", "Regenerativo"];
const COMP_OPTIONS = ["—", "Intermitente", "HIIT tren superior", "HIIT tren inferior", "Movilidad", "Técnica individual", "Otro"];

const VUELTA_OPTIONS = [
  "Elongación pasiva",
  "Elongación de a 2",
  "Rolo para cada uno",
  "Respiración diafragmática",
];

const EMPTY_DAY = {
  md: "— MD —",
  objetivo: "—",
  carga: 0,
  volumen: "",
  intensidad: "",
  tarea1: "",
  sesionGimnasio: "",
  trabajoCompensatorio: "—",
  vueltaCalma: [],
  observaciones: "",
  tareasTecnico: [""], // array de strings, una por tarea del técnico
};

// ─── Gauge circular ────────────────────────────────────────────────────────────
function CircularGauge({ value }) {
  const r = 28;
  const circ = Math.PI * r; // semicircle
  const pct = Math.min(Math.max(value, 0), 100) / 100;
  const offset = circ * (1 - pct);

  // Color: verde < 50, naranja 50-75, rojo > 75
  const color = value <= 0 ? "#3f3f46" : value < 50 ? "#22c55e" : value < 75 ? "#f97316" : "#ef4444";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={72} height={42} viewBox="0 0 72 42">
        {/* Track */}
        <path
          d="M 8 36 A 28 28 0 0 1 64 36"
          fill="none" stroke="#27272a" strokeWidth={7} strokeLinecap="round"
        />
        {/* Progress */}
        <path
          d="M 8 36 A 28 28 0 0 1 64 36"
          fill="none" stroke={color} strokeWidth={7} strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.3s, stroke 0.3s" }}
        />
        <text x="36" y="33" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#fff">
          {value}%
        </text>
      </svg>
    </div>
  );
}

// ─── Celda de un día ───────────────────────────────────────────────────────────
function DayCell({ day, idx, data, onChange }) {
  const set = (k, v) => onChange(idx, k, v);

  function toggleVuelta(opt) {
    const current = data.vueltaCalma || [];
    const next = current.includes(opt)
      ? current.filter(x => x !== opt)
      : [...current, opt];
    set("vueltaCalma", next);
  }

  return (
    <div className="flex flex-col divide-y divide-zinc-700/40 min-w-[140px]">

      {/* MD selector */}
      <div className="bg-blue-900/60 px-2 py-1.5">
        <select
          value={data.md}
          onChange={e => set("md", e.target.value)}
          className="w-full bg-transparent text-white text-[11px] font-semibold focus:outline-none text-center"
        >
          {MD_OPTIONS.map(o => <option key={o} value={o} className="bg-zinc-900">{o}</option>)}
        </select>
      </div>

      {/* Objetivo físico */}
      <div className="px-2 py-1.5">
        <select
          value={data.objetivo}
          onChange={e => set("objetivo", e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 text-white text-[10px] rounded px-1 py-0.5 focus:outline-none"
        >
          {OBJETIVO_OPTIONS.map(o => <option key={o} value={o} className="bg-zinc-900">{o}</option>)}
        </select>
      </div>

      {/* Carga gauge */}
      <div className="px-2 py-2 flex flex-col items-center gap-1">
        <CircularGauge value={data.carga} />
        <input
          type="range" min={0} max={100} step={5}
          value={data.carga}
          onChange={e => set("carga", Number(e.target.value))}
          className="w-full h-1 accent-blue-500"
        />
      </div>

      {/* Volumen */}
      <div className="px-2 py-1.5">
        <textarea
          rows={2}
          value={data.volumen}
          onChange={e => set("volumen", e.target.value)}
          placeholder="—"
          className="w-full bg-transparent text-white text-[10px] resize-none focus:outline-none placeholder-zinc-600"
        />
      </div>

      {/* Intensidad */}
      <div className="px-2 py-1.5">
        <textarea
          rows={2}
          value={data.intensidad}
          onChange={e => set("intensidad", e.target.value)}
          placeholder="—"
          className="w-full bg-transparent text-white text-[10px] resize-none focus:outline-none placeholder-zinc-600"
        />
      </div>

      {/* Tarea 1 */}
      <div className="px-2 py-1.5">
        <textarea
          rows={3}
          value={data.tarea1}
          onChange={e => set("tarea1", e.target.value)}
          placeholder="—"
          className="w-full bg-transparent text-white text-[10px] resize-none focus:outline-none placeholder-zinc-600"
        />
        <div className="mt-1">
          <span className="text-[9px] text-blue-400 bg-blue-900/40 px-1.5 py-0.5 rounded">Sesión de gimnasio</span>
        </div>
        <textarea
          rows={4}
          value={data.sesionGimnasio}
          onChange={e => set("sesionGimnasio", e.target.value)}
          placeholder="—"
          className="w-full bg-transparent text-white text-[10px] resize-none focus:outline-none placeholder-zinc-600 mt-1"
        />
      </div>

      {/* Trabajo compensatorio */}
      <div className="px-2 py-1.5">
        <select
          value={data.trabajoCompensatorio}
          onChange={e => set("trabajoCompensatorio", e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 text-white text-[10px] rounded px-1 py-0.5 focus:outline-none"
        >
          {COMP_OPTIONS.map(o => <option key={o} value={o} className="bg-zinc-900">{o}</option>)}
        </select>
      </div>

      {/* Vuelta a la calma */}
      <div className="px-2 py-1.5 space-y-0.5">
        {VUELTA_OPTIONS.map(opt => (
          <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={(data.vueltaCalma || []).includes(opt)}
              onChange={() => toggleVuelta(opt)}
              className="accent-blue-500 w-3 h-3"
            />
            <span className="text-[9px] text-zinc-400 leading-tight">{opt}</span>
          </label>
        ))}
      </div>

      {/* Observaciones */}
      <div className="px-2 py-1.5">
        <textarea
          rows={2}
          value={data.observaciones}
          onChange={e => set("observaciones", e.target.value)}
          placeholder="—"
          className="w-full bg-transparent text-white text-[10px] resize-none focus:outline-none placeholder-zinc-600"
        />
      </div>
    </div>
  );
}

// ─── Entidad para persistir ────────────────────────────────────────────────────
// Guardamos todo el plan de la semana en una entidad WeeklyPlan
// key: weekStart (lunes de la semana en formato YYYY-MM-DD)

export default function WeeklyPlannerBoard() {
  const { toast } = useToast();
  const [weekStart, setWeekStart] = useState(
    moment().startOf("isoWeek").format("YYYY-MM-DD")
  );
  const [days, setDays] = useState(DAYS.map(() => ({ ...EMPTY_DAY })));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recordId, setRecordId] = useState(null);

  // Navegar semanas
  function prevWeek() { setWeekStart(moment(weekStart).subtract(1, "week").format("YYYY-MM-DD")); }
  function nextWeek() { setWeekStart(moment(weekStart).add(1, "week").format("YYYY-MM-DD")); }

  // Cargar plan de la semana desde la BD
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const records = await base44.entities.WeeklyPlan.filter({ week_start: weekStart });
        if (records.length > 0) {
          const rec = records[0];
          setRecordId(rec.id);
          setDays(rec.days_data || DAYS.map(() => ({ ...EMPTY_DAY })));
        } else {
          setRecordId(null);
          setDays(DAYS.map(() => ({ ...EMPTY_DAY })));
        }
      } catch {
        setDays(DAYS.map(() => ({ ...EMPTY_DAY })));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [weekStart]);

  function handleChange(idx, key, value) {
    setDays(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: value };
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      if (recordId) {
        await base44.entities.WeeklyPlan.update(recordId, { days_data: days, week_start: weekStart });
      } else {
        const rec = await base44.entities.WeeklyPlan.create({ week_start: weekStart, days_data: days });
        setRecordId(rec.id);
      }
      toast({ title: "Plan guardado correctamente" });
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const weekDates = DAYS.map((_, i) => moment(weekStart).add(i, "days"));

  const ROW_LABELS = [
    "MD",
    "Objetivo físico",
    "Carga (%)",
    "Volumen (min)",
    "Intensidad",
    "Tarea 1 / Sesión gym",
    "Trabajo compensatorio",
    "Vuelta a la calma",
    "Observaciones",
  ];

  return (
    <div className="space-y-4">
      {/* Header con navegación de semana */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={prevWeek} className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white transition-colors">
            <ChevronLeft size={16} />
          </button>
          <div>
            <p className="text-white font-bold text-base">
              Semana del {moment(weekStart).format("DD [de] MMMM")} al {moment(weekStart).add(6, "days").format("DD [de] MMMM YYYY")}
            </p>
          </div>
          <button onClick={nextWeek} className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={15} />}
          Guardar semana
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-700">
          <table className="w-full border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-blue-900/80">
                {/* Etiqueta columna izquierda */}
                <th className="w-[110px] min-w-[110px] px-3 py-2.5 text-left text-xs font-bold text-zinc-300 border-r border-zinc-700 bg-zinc-800">
                  CAMPO
                </th>
                {DAYS.map((day, i) => (
                  <th key={day} className="px-2 py-2.5 text-center border-r border-zinc-700 last:border-r-0">
                    <p className="text-xs font-bold text-white tracking-wider">{day}</p>
                    <p className="text-[10px] text-blue-300 font-normal">{weekDates[i].format("DD/MM")}</p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* MD */}
              <tr className="border-t border-zinc-700 bg-zinc-900">
                <td className="px-3 py-2 text-xs font-semibold text-zinc-400 border-r border-zinc-700 bg-zinc-800 align-top">MD</td>
                {days.map((d, i) => (
                  <td key={i} className="border-r border-zinc-700 last:border-r-0 bg-blue-900/50 align-top">
                    <select value={d.md} onChange={e => handleChange(i, "md", e.target.value)}
                      className="w-full bg-transparent text-white text-[11px] font-semibold focus:outline-none text-center py-2 px-1">
                      {MD_OPTIONS.map(o => <option key={o} value={o} className="bg-zinc-900">{o}</option>)}
                    </select>
                  </td>
                ))}
              </tr>

              {/* Objetivo físico */}
              <tr className="border-t border-zinc-700 bg-zinc-900/60">
                <td className="px-3 py-2 text-xs font-semibold text-zinc-400 border-r border-zinc-700 bg-zinc-800 align-top">Objetivo físico</td>
                {days.map((d, i) => (
                  <td key={i} className="border-r border-zinc-700 last:border-r-0 px-2 py-1.5 align-top">
                    <select value={d.objetivo} onChange={e => handleChange(i, "objetivo", e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 text-white text-[10px] rounded px-1 py-0.5 focus:outline-none">
                      {OBJETIVO_OPTIONS.map(o => <option key={o} value={o} className="bg-zinc-900">{o}</option>)}
                    </select>
                  </td>
                ))}
              </tr>

              {/* Carga % */}
              <tr className="border-t border-zinc-700 bg-zinc-900">
                <td className="px-3 py-2 text-xs font-semibold text-zinc-400 border-r border-zinc-700 bg-zinc-800 align-middle">Carga (%)</td>
                {days.map((d, i) => (
                  <td key={i} className="border-r border-zinc-700 last:border-r-0 px-2 py-2 align-top">
                    <div className="flex flex-col items-center gap-1">
                      <CircularGauge value={d.carga} />
                      <input type="range" min={0} max={100} step={5} value={d.carga}
                        onChange={e => handleChange(i, "carga", Number(e.target.value))}
                        className="w-full h-1 accent-blue-500" />
                    </div>
                  </td>
                ))}
              </tr>

              {/* Volumen */}
              <tr className="border-t border-zinc-700 bg-zinc-900/60">
                <td className="px-3 py-2 text-xs font-semibold text-zinc-400 border-r border-zinc-700 bg-zinc-800 align-top">Volumen (min)</td>
                {days.map((d, i) => (
                  <td key={i} className="border-r border-zinc-700 last:border-r-0 px-2 py-1.5 align-top">
                    <textarea rows={2} value={d.volumen} onChange={e => handleChange(i, "volumen", e.target.value)}
                      placeholder="—"
                      className="w-full bg-transparent text-white text-[10px] resize-none focus:outline-none placeholder-zinc-600" />
                  </td>
                ))}
              </tr>

              {/* Intensidad */}
              <tr className="border-t border-zinc-700 bg-zinc-900">
                <td className="px-3 py-2 text-xs font-semibold text-zinc-400 border-r border-zinc-700 bg-zinc-800 align-top">Intensidad</td>
                {days.map((d, i) => (
                  <td key={i} className="border-r border-zinc-700 last:border-r-0 px-2 py-1.5 align-top">
                    <textarea rows={2} value={d.intensidad} onChange={e => handleChange(i, "intensidad", e.target.value)}
                      placeholder="—"
                      className="w-full bg-transparent text-white text-[10px] resize-none focus:outline-none placeholder-zinc-600" />
                  </td>
                ))}
              </tr>

              {/* Tarea 1 + Sesión de gimnasio */}
              <tr className="border-t border-zinc-700 bg-zinc-900/60">
                <td className="px-3 py-2 text-xs font-semibold text-zinc-400 border-r border-zinc-700 bg-zinc-800 align-top">
                  Tarea 1<br />
                  <span className="font-normal text-[10px] text-blue-400">Sesión gym</span>
                </td>
                {days.map((d, i) => (
                  <td key={i} className="border-r border-zinc-700 last:border-r-0 px-2 py-1.5 align-top">
                    <textarea rows={3} value={d.tarea1} onChange={e => handleChange(i, "tarea1", e.target.value)}
                      placeholder="—"
                      className="w-full bg-transparent text-white text-[10px] resize-none focus:outline-none placeholder-zinc-600" />
                    <div className="mt-1 mb-1">
                      <span className="text-[9px] text-blue-400 bg-blue-900/30 px-1.5 py-0.5 rounded border border-blue-800/40">Sesión de gimnasio</span>
                    </div>
                    <textarea rows={4} value={d.sesionGimnasio} onChange={e => handleChange(i, "sesionGimnasio", e.target.value)}
                      placeholder="—"
                      className="w-full bg-transparent text-white text-[10px] resize-none focus:outline-none placeholder-zinc-600" />
                  </td>
                ))}
              </tr>

              {/* Trabajo compensatorio */}
              <tr className="border-t border-zinc-700 bg-zinc-900">
                <td className="px-3 py-2 text-xs font-semibold text-zinc-400 border-r border-zinc-700 bg-zinc-800 align-top">Trabajo compensatorio</td>
                {days.map((d, i) => (
                  <td key={i} className="border-r border-zinc-700 last:border-r-0 px-2 py-1.5 align-top">
                    <select value={d.trabajoCompensatorio} onChange={e => handleChange(i, "trabajoCompensatorio", e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 text-white text-[10px] rounded px-1 py-0.5 focus:outline-none">
                      {COMP_OPTIONS.map(o => <option key={o} value={o} className="bg-zinc-900">{o}</option>)}
                    </select>
                  </td>
                ))}
              </tr>

              {/* Vuelta a la calma */}
              <tr className="border-t border-zinc-700 bg-zinc-900/60">
                <td className="px-3 py-2 text-xs font-semibold text-zinc-400 border-r border-zinc-700 bg-zinc-800 align-top">Vuelta a la calma</td>
                {days.map((d, i) => (
                  <td key={i} className="border-r border-zinc-700 last:border-r-0 px-2 py-2 align-top space-y-0.5">
                    {VUELTA_OPTIONS.map(opt => (
                      <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={(d.vueltaCalma || []).includes(opt)}
                          onChange={() => {
                            const cur = d.vueltaCalma || [];
                            const next = cur.includes(opt) ? cur.filter(x => x !== opt) : [...cur, opt];
                            handleChange(i, "vueltaCalma", next);
                          }}
                          className="accent-blue-500 w-3 h-3 shrink-0" />
                        <span className="text-[9px] text-zinc-400 leading-tight">{opt}</span>
                      </label>
                    ))}
                  </td>
                ))}
              </tr>

              {/* Observaciones */}
              <tr className="border-t border-zinc-700 bg-zinc-900">
                <td className="px-3 py-2 text-xs font-semibold text-zinc-400 border-r border-zinc-700 bg-zinc-800 align-top">Observaciones</td>
                {days.map((d, i) => (
                  <td key={i} className="border-r border-zinc-700 last:border-r-0 px-2 py-1.5 align-top">
                    <textarea rows={3} value={d.observaciones} onChange={e => handleChange(i, "observaciones", e.target.value)}
                      placeholder="—"
                      className="w-full bg-transparent text-white text-[10px] resize-none focus:outline-none placeholder-zinc-600" />
                  </td>
                ))}
              </tr>

              {/* ── Separador Director Técnico ── */}
              <tr>
                <td colSpan={8} className="px-3 py-2 bg-emerald-900/70 border-t-2 border-emerald-600" style={{ colSpan: 8 }}>
                  <span className="text-xs font-bold text-emerald-300 uppercase tracking-widest">Director Técnico</span>
                </td>
              </tr>

              {/* Tareas del técnico (dinámicas) */}
              <tr className="border-t border-zinc-700 bg-zinc-900/60">
                <td className="px-3 py-2 text-xs font-semibold text-zinc-400 border-r border-zinc-700 bg-zinc-800 align-top">
                  Tareas
                </td>
                {days.map((d, i) => {
                  const tareas = d.tareasTecnico || [""];
                  function setTareas(newTareas) { handleChange(i, "tareasTecnico", newTareas); }
                  return (
                    <td key={i} className="border-r border-zinc-700 last:border-r-0 px-2 py-1.5 align-top">
                      <div className="space-y-1.5">
                        {tareas.map((t, ti) => (
                          <div key={ti} className="flex items-start gap-1 group">
                            <div className="flex flex-col flex-1 min-w-0">
                              <span className="text-[9px] text-emerald-400 font-semibold mb-0.5">Tarea {ti + 1}</span>
                              <textarea
                                rows={2}
                                value={t}
                                onChange={e => {
                                  const next = [...tareas];
                                  next[ti] = e.target.value;
                                  setTareas(next);
                                }}
                                placeholder="—"
                                className="w-full bg-emerald-900/10 border border-emerald-800/30 rounded text-white text-[10px] resize-none focus:outline-none focus:border-emerald-600/50 placeholder-zinc-600 px-1 py-0.5"
                              />
                            </div>
                            {tareas.length > 1 && (
                              <button
                                onClick={() => setTareas(tareas.filter((_, idx) => idx !== ti))}
                                className="mt-4 text-zinc-600 hover:text-red-400 transition-colors shrink-0"
                              >
                                <X size={11} />
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          onClick={() => setTareas([...tareas, ""])}
                          className="flex items-center gap-1 text-[9px] text-emerald-500 hover:text-emerald-300 transition-colors mt-1"
                        >
                          <Plus size={10} /> Agregar tarea
                        </button>
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}