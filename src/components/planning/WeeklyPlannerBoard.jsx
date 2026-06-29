import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Save, ChevronLeft, ChevronRight, Plus, X, Calendar } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";
import "moment/locale/es";
moment.locale("es");

// ─── Constantes ────────────────────────────────────────────────────────────────
const MD_OPTIONS = ["— MD —", "MD-6", "MD-5", "MD-4", "MD-3", "MD-2", "MD-1", "MD", "MD+1", "MD+2"];
const OBJETIVO_OPTIONS = ["—", "Fuerza", "Intermitente", "Aceleración", "Velocidad Máxima", "Recuperación", "Resistencia", "Táctica", "Regenerativo"];
const COMP_OPTIONS = ["—", "Intermitente", "HIIT tren superior", "HIIT tren inferior", "Movilidad", "Técnica individual", "Otro"];
const VUELTA_OPTIONS = ["Elongación pasiva", "Elongación de a 2", "Rolo para cada uno", "Respiración diafragmática"];

function emptyDay(date) {
  return {
    date: date || "",
    md: "— MD —",
    objetivo: "—",
    carga: 0,
    volumen: "",
    intensidad: "",
    sesionGimnasio: "",
    trabajoCompensatorio: "—",
    vueltaCalma: [],
    observaciones: "",
    tareasTecnico: [""],
  };
}

// ─── Gauge circular ────────────────────────────────────────────────────────────
function CircularGauge({ value }) {
  const r = 28;
  const circ = Math.PI * r;
  const pct = Math.min(Math.max(value, 0), 100) / 100;
  const offset = circ * (1 - pct);
  const color = value <= 0 ? "#3f3f46" : value < 50 ? "#22c55e" : value < 75 ? "#f97316" : "#ef4444";
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={72} height={42} viewBox="0 0 72 42">
        <path d="M 8 36 A 28 28 0 0 1 64 36" fill="none" stroke="#27272a" strokeWidth={7} strokeLinecap="round" />
        <path d="M 8 36 A 28 28 0 0 1 64 36" fill="none" stroke={color} strokeWidth={7} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.3s, stroke 0.3s" }} />
        <text x="36" y="33" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#fff">{value}%</text>
      </svg>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function WeeklyPlannerBoard() {
  const { toast } = useToast();

  // El plan se identifica por la fecha del primer día
  const [startDate, setStartDate] = useState(moment().startOf("isoWeek").format("YYYY-MM-DD"));
  const [days, setDays] = useState(() => {
    return Array.from({ length: 7 }, (_, i) =>
      emptyDay(moment().startOf("isoWeek").add(i, "days").format("YYYY-MM-DD"))
    );
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recordId, setRecordId] = useState(null);

  // Cargar plan desde BD cuando cambia la fecha de inicio
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const records = await base44.entities.WeeklyPlan.filter({ week_start: startDate });
        if (records.length > 0) {
          const rec = records[0];
          setRecordId(rec.id);
          // Compatibilidad con planes viejos que no tienen `date` en cada día
          const loaded = (rec.days_data || []).map((d, i) => ({
            ...emptyDay(moment(startDate).add(i, "days").format("YYYY-MM-DD")),
            ...d,
          }));
          setDays(loaded.length > 0 ? loaded : buildDays(startDate, 7));
        } else {
          setRecordId(null);
          setDays(buildDays(startDate, 7));
        }
      } catch {
        setDays(buildDays(startDate, 7));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [startDate]);

  function buildDays(start, count) {
    return Array.from({ length: count }, (_, i) =>
      emptyDay(moment(start).add(i, "days").format("YYYY-MM-DD"))
    );
  }

  // Cambiar fecha de inicio: preservar datos, recalcular fechas
  function changeStartDate(newStart) {
    setStartDate(newStart);
    // La carga desde BD se activa sola por el useEffect
  }

  // Navegar al ciclo anterior/siguiente según cantidad de días del plan actual
  function prevCycle() {
    const newStart = moment(startDate).subtract(days.length, "days").format("YYYY-MM-DD");
    setStartDate(newStart);
  }
  function nextCycle() {
    const newStart = moment(startDate).add(days.length, "days").format("YYYY-MM-DD");
    setStartDate(newStart);
  }

  function handleChange(idx, key, value) {
    setDays(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: value };
      return next;
    });
  }

  // Agregar día al final
  function addDay() {
    const lastDate = days[days.length - 1]?.date;
    const nextDate = lastDate
      ? moment(lastDate).add(1, "days").format("YYYY-MM-DD")
      : moment(startDate).add(days.length, "days").format("YYYY-MM-DD");
    setDays(prev => [...prev, emptyDay(nextDate)]);
  }

  // Eliminar último día (mínimo 1)
  function removeLastDay() {
    if (days.length <= 1) return;
    setDays(prev => prev.slice(0, -1));
  }

  // Cambiar fecha de un día individual
  function changeDayDate(idx, newDate) {
    handleChange(idx, "date", newDate);
  }

  async function save() {
    setSaving(true);
    try {
      if (recordId) {
        await base44.entities.WeeklyPlan.update(recordId, { days_data: days, week_start: startDate });
      } else {
        const rec = await base44.entities.WeeklyPlan.create({ week_start: startDate, days_data: days });
        setRecordId(rec.id);
      }
      toast({ title: "Plan guardado correctamente" });
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const ROW_LABELS = [
    { key: "md",          label: "MD",                   bg: "bg-blue-900/50" },
    { key: "objetivo",    label: "Objetivo físico",       bg: "" },
    { key: "carga",       label: "Carga (%)",             bg: "" },
    { key: "volumen",     label: "Volumen (min)",         bg: "" },
    { key: "intensidad",  label: "Intensidad",            bg: "" },
    { key: "gymDT",       label: "Sesión gym / Tareas DT",bg: "" },
    { key: "comp",        label: "Trabajo compensatorio", bg: "" },
    { key: "vuelta",      label: "Vuelta a la calma",     bg: "" },
    { key: "obs",         label: "Observaciones",         bg: "" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={prevCycle} className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white transition-colors">
            <ChevronLeft size={16} />
          </button>

          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5">
            <Calendar size={13} className="text-zinc-500" />
            <span className="text-xs text-zinc-400">Inicio:</span>
            <input
              type="date"
              value={startDate}
              onChange={e => changeStartDate(e.target.value)}
              className="bg-transparent text-white text-sm font-semibold focus:outline-none"
            />
          </div>

          <button onClick={nextCycle} className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white transition-colors">
            <ChevronRight size={16} />
          </button>

          <span className="text-zinc-500 text-xs">
            {days.length} día{days.length !== 1 ? "s" : ""} ·{" "}
            {days[0]?.date && days[days.length - 1]?.date
              ? `${moment(days[0].date).format("DD/MM")} → ${moment(days[days.length - 1].date).format("DD/MM/YY")}`
              : ""}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Controles de columnas */}
          <div className="flex items-center gap-1 bg-zinc-800 border border-zinc-700 rounded-lg p-1">
            <button
              onClick={removeLastDay}
              disabled={days.length <= 1}
              title="Quitar último día"
              className="p-1 rounded text-zinc-400 hover:text-red-400 disabled:opacity-30 transition-colors"
            >
              <X size={14} />
            </button>
            <span className="text-xs text-zinc-500 px-1">{days.length} días</span>
            <button
              onClick={addDay}
              disabled={days.length >= 10}
              title="Agregar día"
              className="p-1 rounded text-zinc-400 hover:text-green-400 disabled:opacity-30 transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={15} />}
            Guardar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-700">
          <table className="w-full border-collapse" style={{ minWidth: `${110 + days.length * 150}px` }}>
            <thead>
              <tr className="bg-zinc-800">
                <th className="w-[110px] min-w-[110px] px-3 py-2.5 text-left text-xs font-bold text-zinc-400 border-r border-zinc-700">
                  CAMPO
                </th>
                {days.map((d, i) => (
                  <th key={i} className="px-2 py-2 text-center border-r border-zinc-700 last:border-r-0 min-w-[140px]">
                    <div className="flex flex-col items-center gap-1">
                      <p className="text-xs font-bold text-white tracking-wider">
                        {d.date ? moment(d.date).format("dddd").toUpperCase() : `DÍA ${i + 1}`}
                      </p>
                      <input
                        type="date"
                        value={d.date || ""}
                        onChange={e => changeDayDate(i, e.target.value)}
                        className="bg-zinc-700 border border-zinc-600 text-blue-300 text-[10px] rounded px-1 py-0.5 focus:outline-none focus:border-blue-500 text-center"
                      />
                    </div>
                  </th>
                ))}
                {/* Columna para agregar día rápido */}
                <th className="px-2 py-2 text-center w-10">
                  <button
                    onClick={addDay}
                    disabled={days.length >= 10}
                    title="Agregar día"
                    className="p-1 rounded-lg border border-dashed border-zinc-600 text-zinc-600 hover:text-green-400 hover:border-green-600 transition-colors disabled:opacity-30"
                  >
                    <Plus size={14} />
                  </button>
                </th>
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
                <td className="border-zinc-700" />
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
                <td className="border-zinc-700" />
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
                <td className="border-zinc-700" />
              </tr>

              {/* Volumen */}
              <tr className="border-t border-zinc-700 bg-zinc-900/60">
                <td className="px-3 py-2 text-xs font-semibold text-zinc-400 border-r border-zinc-700 bg-zinc-800 align-top">Volumen (min)</td>
                {days.map((d, i) => (
                  <td key={i} className="border-r border-zinc-700 last:border-r-0 px-2 py-1.5 align-top">
                    <textarea rows={2} value={d.volumen} onChange={e => handleChange(i, "volumen", e.target.value)}
                      placeholder="—" className="w-full bg-transparent text-white text-[10px] resize-none focus:outline-none placeholder-zinc-600" />
                  </td>
                ))}
                <td className="border-zinc-700" />
              </tr>

              {/* Intensidad */}
              <tr className="border-t border-zinc-700 bg-zinc-900">
                <td className="px-3 py-2 text-xs font-semibold text-zinc-400 border-r border-zinc-700 bg-zinc-800 align-top">Intensidad</td>
                {days.map((d, i) => (
                  <td key={i} className="border-r border-zinc-700 last:border-r-0 px-2 py-1.5 align-top">
                    <textarea rows={2} value={d.intensidad} onChange={e => handleChange(i, "intensidad", e.target.value)}
                      placeholder="—" className="w-full bg-transparent text-white text-[10px] resize-none focus:outline-none placeholder-zinc-600" />
                  </td>
                ))}
                <td className="border-zinc-700" />
              </tr>

              {/* Sesión gym + Tareas DT */}
              <tr className="border-t border-zinc-700 bg-zinc-900/60">
                <td className="px-3 py-2 text-xs font-semibold text-zinc-400 border-r border-zinc-700 bg-zinc-800 align-top">
                  <span className="text-blue-400">Sesión gym</span>
                  <br />
                  <span className="font-normal text-[10px] text-emerald-400 mt-1 block">Tareas DT</span>
                </td>
                {days.map((d, i) => {
                  const tareas = d.tareasTecnico || [""];
                  const setTareas = (newTareas) => handleChange(i, "tareasTecnico", newTareas);
                  return (
                    <td key={i} className="border-r border-zinc-700 last:border-r-0 px-2 py-1.5 align-top">
                      <div className="mb-1.5">
                        <span className="text-[9px] text-blue-400 bg-blue-900/30 px-1.5 py-0.5 rounded border border-blue-800/40">Sesión de gimnasio</span>
                      </div>
                      <textarea rows={4} value={d.sesionGimnasio} onChange={e => handleChange(i, "sesionGimnasio", e.target.value)}
                        placeholder="—" className="w-full bg-transparent text-white text-[10px] resize-none focus:outline-none placeholder-zinc-600" />
                      <div className="border-t border-emerald-800/50 mt-2 mb-1.5 pt-1.5">
                        <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">Director Técnico</span>
                      </div>
                      <div className="space-y-1.5">
                        {tareas.map((t, ti) => (
                          <div key={ti} className="flex items-start gap-1">
                            <div className="flex flex-col flex-1 min-w-0">
                              <span className="text-[9px] text-emerald-500 font-semibold mb-0.5">Tarea {ti + 1}</span>
                              <textarea rows={2} value={t}
                                onChange={e => { const next = [...tareas]; next[ti] = e.target.value; setTareas(next); }}
                                placeholder="—"
                                className="w-full bg-emerald-900/10 border border-emerald-800/30 rounded text-white text-[10px] resize-none focus:outline-none focus:border-emerald-600/50 placeholder-zinc-600 px-1 py-0.5" />
                            </div>
                            {tareas.length > 1 && (
                              <button onClick={() => setTareas(tareas.filter((_, idx) => idx !== ti))}
                                className="mt-4 text-zinc-600 hover:text-red-400 transition-colors shrink-0">
                                <X size={11} />
                              </button>
                            )}
                          </div>
                        ))}
                        <button onClick={() => setTareas([...tareas, ""])}
                          className="flex items-center gap-1 text-[9px] text-emerald-500 hover:text-emerald-300 transition-colors mt-1">
                          <Plus size={10} /> Agregar tarea
                        </button>
                      </div>
                    </td>
                  );
                })}
                <td className="border-zinc-700" />
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
                <td className="border-zinc-700" />
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
                <td className="border-zinc-700" />
              </tr>

              {/* Observaciones */}
              <tr className="border-t border-zinc-700 bg-zinc-900">
                <td className="px-3 py-2 text-xs font-semibold text-zinc-400 border-r border-zinc-700 bg-zinc-800 align-top">Observaciones</td>
                {days.map((d, i) => (
                  <td key={i} className="border-r border-zinc-700 last:border-r-0 px-2 py-1.5 align-top">
                    <textarea rows={3} value={d.observaciones} onChange={e => handleChange(i, "observaciones", e.target.value)}
                      placeholder="—" className="w-full bg-transparent text-white text-[10px] resize-none focus:outline-none placeholder-zinc-600" />
                  </td>
                ))}
                <td className="border-zinc-700" />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}