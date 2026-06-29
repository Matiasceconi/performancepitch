import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Save } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const ATTENDANCE_OPTS = ["presente", "ausente", "diferenciado", "no_entrena"];
const ATTENDANCE_LABELS = { presente: "Presente", ausente: "Ausente", diferenciado: "Diferenciado", no_entrena: "No entrena" };

const STATUS_LABELS = {
  disponible: "Disponible", lesionado: "Lesionado", molestia: "Molestia",
  diferenciado: "Diferenciado", suspendido: "Suspendido", ausente: "Ausente",
  "bajó": "Bajó", "subió": "Subió", convocado: "Convocado", reintegro: "Reintegro",
};

const STATUS_COLORS = {
  disponible: "text-emerald-400", lesionado: "text-red-400", molestia: "text-orange-400",
  diferenciado: "text-amber-400", suspendido: "text-purple-400", ausente: "text-zinc-500",
  "bajó": "text-orange-400", "subió": "text-sky-400", convocado: "text-blue-400",
  reintegro: "text-teal-400",
};

export default function SessionPlayerTable({ sessionPlayers, sessionId }) {
  const [rows, setRows] = useState(
    sessionPlayers.map(sp => ({ ...sp }))
  );
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  function updateRow(idx, key, val) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [key]: val } : r));
  }

  async function saveAll() {
    setSaving(true);
    await Promise.all(
      rows.map(r => r.id
        ? base44.entities.SessionPlayer.update(r.id, {
            attendance: r.attendance,
            minutes: r.minutes,
            rpe: r.rpe,
            notes: r.notes,
          })
        : Promise.resolve()
      )
    );
    setSaving(false);
    toast({ title: "✓ Asistencia guardada" });
  }

  const present = rows.filter(r => r.attendance === "presente").length;
  const absent = rows.filter(r => r.attendance === "ausente").length;
  const diff = rows.filter(r => r.attendance === "diferenciado").length;

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex gap-4 text-xs text-zinc-400">
        <span className="text-emerald-400 font-semibold">{present} presentes</span>
        <span className="text-amber-400 font-semibold">{diff} diferenciados</span>
        <span className="text-zinc-500 font-semibold">{absent} ausentes</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left py-2 px-2 text-zinc-500 font-medium w-[180px]">Jugador</th>
              <th className="text-left py-2 px-2 text-zinc-500 font-medium w-[110px]">Posición</th>
              <th className="text-left py-2 px-2 text-zinc-500 font-medium w-[90px]">Estado día</th>
              <th className="text-left py-2 px-2 text-zinc-500 font-medium w-[120px]">Asistencia</th>
              <th className="text-left py-2 px-2 text-zinc-500 font-medium w-[70px]">Min.</th>
              <th className="text-left py-2 px-2 text-zinc-500 font-medium w-[60px]">RPE</th>
              <th className="text-left py-2 px-2 text-zinc-500 font-medium">Nota</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((sp, idx) => (
              <tr key={sp.player_id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20">
                <td className="py-1.5 px-2 text-white font-medium truncate max-w-[180px]">{sp.player_name}</td>
                <td className="py-1.5 px-2 text-zinc-500">{sp.position}</td>
                <td className="py-1.5 px-2">
                  <span className={`font-semibold ${STATUS_COLORS[sp.status_at_session] || "text-zinc-400"}`}>
                    {STATUS_LABELS[sp.status_at_session] || sp.status_at_session || "—"}
                  </span>
                </td>
                <td className="py-1.5 px-2">
                  <select value={sp.attendance || "presente"}
                    onChange={e => updateRow(idx, "attendance", e.target.value)}
                    className="bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 text-[11px] text-white focus:outline-none w-full">
                    {ATTENDANCE_OPTS.map(o => <option key={o} value={o}>{ATTENDANCE_LABELS[o]}</option>)}
                  </select>
                </td>
                <td className="py-1.5 px-2">
                  <input type="number" min={0} max={180} value={sp.minutes || ""}
                    onChange={e => updateRow(idx, "minutes", parseInt(e.target.value) || 0)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 text-[11px] text-white focus:outline-none" />
                </td>
                <td className="py-1.5 px-2">
                  <input type="number" min={1} max={10} value={sp.rpe || ""}
                    onChange={e => updateRow(idx, "rpe", parseInt(e.target.value) || undefined)}
                    placeholder="1-10"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 text-[11px] text-white focus:outline-none" />
                </td>
                <td className="py-1.5 px-2">
                  <input value={sp.notes || ""}
                    onChange={e => updateRow(idx, "notes", e.target.value)}
                    placeholder="Observación..."
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 text-[11px] text-white focus:outline-none" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button onClick={saveAll} disabled={saving}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-zinc-900 font-semibold text-sm hover:bg-zinc-200 transition-colors disabled:opacity-50">
        <Save size={14} />
        {saving ? "Guardando..." : "Guardar asistencia"}
      </button>
    </div>
  );
}