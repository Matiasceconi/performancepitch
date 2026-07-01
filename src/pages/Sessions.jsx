import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, ClipboardList } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useWorkspace } from "@/lib/WorkspaceContext";
import SessionList from "@/components/sessions/SessionList";
import SessionForm from "@/components/sessions/SessionForm";
import SessionDetail from "@/components/sessions/SessionDetail";

export default function Sessions() {
  const { activeSquadId, activeSquad } = useWorkspace();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list"); // "list" | "new" | "detail"
  const [selectedSession, setSelectedSession] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    setLoading(true);
    setView("list");
    setSelectedSession(null);
    base44.entities.TrainingSession.list("-date", 200).then(all => {
      const filtered = activeSquadId
        ? all.filter(s => s.squad_id === activeSquadId)
        : all;
      setSessions(filtered);
      setLoading(false);

      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get("session");
      if (sessionId) {
        const found = filtered.find(s => s.id === sessionId);
        if (found) { setSelectedSession(found); setView("detail"); }
      }
    });
  }, [activeSquadId]);

  function handleCreated(session) {
    setSessions(prev => [session, ...prev]);
    setSelectedSession(session);
    setView("detail");
    toast({ title: "✓ Sesión creada" });
  }

  function handleSelect(session) {
    setSelectedSession(session);
    setView("detail");
  }

  async function handleDelete(id) {
    if (!window.confirm("¿Eliminar esta sesión?")) return;
    await base44.entities.TrainingSession.delete(id);
    setSessions(prev => prev.filter(s => s.id !== id));
    toast({ title: "Sesión eliminada" });
  }

  function handleBack() {
    setSelectedSession(null);
    setView("list");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      {view === "list" && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-4">
            <ClipboardList size={22} className="text-zinc-400" />
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Sesiones</h1>
              <p className="text-zinc-500 text-sm mt-0.5">
                {activeSquad ? activeSquad.name : "Todos los planteles"}
              </p>
            </div>
          </div>
          <button
            onClick={() => setView("new")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-zinc-900 font-semibold text-sm hover:bg-zinc-200 transition-colors">
            <Plus size={15} /> Nueva sesión
          </button>
        </div>
      )}

      {view === "new" && (
        <>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Nueva sesión</h1>
            <p className="text-zinc-500 text-sm mt-0.5">Los jugadores se cargan automáticamente desde Estado del Plantel</p>
          </div>
          <SessionForm onCreated={handleCreated} onCancel={handleBack} />
        </>
      )}

      {view === "list" && (
        loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
          </div>
        ) : (
          <SessionList sessions={sessions} onSelect={handleSelect} onDelete={handleDelete} />
        )
      )}

      {view === "detail" && selectedSession && (
        <SessionDetail session={selectedSession} onBack={handleBack} />
      )}
    </div>
  );
}