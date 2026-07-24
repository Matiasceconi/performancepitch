import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useWorkspace } from "@/lib/WorkspaceContext";
import { Plus, Search, Loader2, LayoutGrid } from "lucide-react";
import moment from "moment";
import "moment/locale/es";
import TacticalProjectCard from "@/components/tactical/projects/TacticalProjectCard";
import TacticalProjectFilters from "@/components/tactical/projects/TacticalProjectFilters";
import NewTacticalProjectModal from "@/components/tactical/projects/NewTacticalProjectModal";
import { resolveTacticalBrand } from "@/components/tactical/lib/tacticalBrandResolver";

moment.locale("es");

export default function Tactical() {
  const navigate = useNavigate();
  const { activeSquadId, activeSquad, activeSeasonId, can, clubBrand } = useWorkspace();
  const brand = resolveTacticalBrand({ clubBrand, activeSquad });

  const [projects, setProjects] = useState([]);
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [showNew, setShowNew] = useState(false);

  const canCreate = can("create", "/tactical");
  const canEdit = can("edit", "/tactical");
  const canDelete = can("delete", "/tactical");

  const load = useCallback(async () => {
    if (!activeSquadId) {
      setProjects([]);
      setBoards([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [projRows, boardRows] = await Promise.all([
        base44.entities.TacticalProject.filter({ squad_id: activeSquadId }, "-updated_at", 200),
        base44.entities.TacticalBoard.filter({ squad_id: activeSquadId }, "order", 500),
      ]);
      setProjects(projRows);
      setBoards(boardRows);
    } catch (e) {
      console.error("Error loading tactical projects", e);
    } finally {
      setLoading(false);
    }
  }, [activeSquadId]);

  useEffect(() => {
    load();
    const unsubP = base44.entities.TacticalProject.subscribe(load);
    const unsubB = base44.entities.TacticalBoard.subscribe(load);
    return () => { unsubP?.(); unsubB?.(); };
  }, [load]);

  const boardsByProject = useMemo(() => {
    const map = {};
    boards.forEach((b) => {
      if (!map[b.project_id]) map[b.project_id] = [];
      map[b.project_id].push(b);
    });
    return map;
  }, [boards]);

  const filtered = useMemo(() => {
    let list = projects;
    if (filter === "archived") {
      list = list.filter((p) => p.status === "archived");
    } else if (filter === "templates") {
      list = list.filter((p) => p.is_template);
    } else if (filter === "templates") {
      list = list.filter((p) => p.is_template);
    } else if (["formation", "tactical", "exercise"].includes(filter)) {
      list = list.filter((p) => p.default_mode === filter && p.status !== "archived");
    } else {
      list = list.filter((p) => p.status !== "archived");
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => (p.name || "").toLowerCase().includes(q));
    }
    return list;
  }, [projects, filter, search]);

  function handleOpen(projectId) {
    navigate(`/tactical/${projectId}`);
  }

  async function handleDuplicate(project) {
    if (!canCreate) return;
    try {
      const { id, created_date, updated_date, created_by_id, ...rest } = project;
      const newProj = await base44.entities.TacticalProject.create({
        ...rest,
        name: `${project.name} (copia)`,
        source_project_id: project.id,
        status: "active",
        is_template: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      const projBoards = boardsByProject[project.id] || [];
      for (const b of projBoards) {
        const { id: bid, created_date: _cd, updated_date: _ud, created_by_id: _cb, ...brest } = b;
        await base44.entities.TacticalBoard.create({
          ...brest,
          project_id: newProj.id,
          elements: (b.elements || []).map((el) => ({ ...el, id: `${el.id}_copy_${Date.now()}` })),
          revision: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
      await load();
    } catch (e) {
      console.error("Error duplicating project", e);
    }
  }

  async function handleRename(project, newName) {
    if (!canEdit) return;
    await base44.entities.TacticalProject.update(project.id, { name: newName, updated_at: new Date().toISOString() });
    await load();
  }

  async function handleArchive(project) {
    if (!canDelete) return;
    await base44.entities.TacticalProject.update(project.id, { status: "archived", updated_at: new Date().toISOString() });
    await load();
  }

  async function handleSaveAsTemplate(project) {
    if (!canEdit) return;
    await base44.entities.TacticalProject.update(project.id, { is_template: true, template_category: project.template_category || "General", updated_at: new Date().toISOString() });
    await load();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Pizarra Táctica</h1>
          <p className="text-zinc-500 text-sm mt-1">{activeSquad?.name || "Seleccioná un plantel"}</p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-zinc-950 transition-colors"
            style={{ backgroundColor: brand.colors.accent, color: brand.colors.onAccent }}
          >
            <Plus size={16} /> Nueva pizarra
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar proyectos..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
          />
        </div>
        <TacticalProjectFilters value={filter} onChange={setFilter} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 text-zinc-600 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <LayoutGrid size={40} className="text-zinc-700 mb-3" />
          <p className="text-zinc-500 text-sm">
            {activeSquadId ? "No hay proyectos tácticos aún." : "Seleccioná un plantel para ver sus proyectos."}
          </p>
          {canCreate && activeSquadId && (
            <button onClick={() => setShowNew(true)} className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-zinc-950" style={{ backgroundColor: brand.colors.accent, color: brand.colors.onAccent }}>
              <Plus size={15} /> Crear primer proyecto
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((p) => (
            <TacticalProjectCard
              key={p.id}
              project={p}
              boards={boardsByProject[p.id] || []}
              onOpen={() => handleOpen(p.id)}
              onDuplicate={() => handleDuplicate(p)}
              onRename={(name) => handleRename(p, name)}
              onArchive={() => handleArchive(p)}
              onSaveAsTemplate={() => handleSaveAsTemplate(p)}
              canEdit={canEdit}
              canDelete={canDelete}
              canCreate={canCreate}
            />
          ))}
        </div>
      )}

      <NewTacticalProjectModal
        open={showNew}
        onClose={() => setShowNew(false)}
        onCreated={(projectId) => { setShowNew(false); navigate(`/tactical/${projectId}`); }}
      />
    </div>
  );
}