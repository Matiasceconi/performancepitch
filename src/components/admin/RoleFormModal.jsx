import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { X, Check } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { AREAS, PAGES } from "@/lib/areasConfig";

const PERMS = [
  { key: "can_view",   label: "Ver" },
  { key: "can_create", label: "Crear" },
  { key: "can_edit",   label: "Editar" },
  { key: "can_delete", label: "Eliminar" },
  { key: "can_export", label: "Exportar" },
  { key: "can_admin",  label: "Administrar (acceso total)" },
];

export default function RoleFormModal({ existingRole, onSaved, onClose }) {
  const [form, setForm] = useState(() => ({
    name: existingRole?.name || "",
    description: existingRole?.description || "",
    areas: existingRole?.areas || [],
    allowed_pages: existingRole?.allowed_pages || [],
    can_view: existingRole ? existingRole.can_view !== false : true,
    can_create: existingRole?.can_create || false,
    can_edit: existingRole?.can_edit || false,
    can_delete: existingRole?.can_delete || false,
    can_export: existingRole?.can_export || false,
    can_admin: existingRole?.can_admin || false,
    active: existingRole ? existingRole.active !== false : true,
  }));
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function toggleArea(id) {
    setForm(f => ({ ...f, areas: f.areas.includes(id) ? f.areas.filter(a => a !== id) : [...f.areas, id] }));
  }

  function togglePage(path) {
    setForm(f => ({ ...f, allowed_pages: f.allowed_pages.includes(path) ? f.allowed_pages.filter(p => p !== path) : [...f.allowed_pages, path] }));
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast({ title: "El nombre del rol es obligatorio", variant: "destructive" });
      return;
    }
    setSaving(true);
    if (existingRole) {
      await base44.entities.AppRole.update(existingRole.id, form);
      toast({ title: "✓ Rol actualizado" });
    } else {
      await base44.entities.AppRole.create(form);
      toast({ title: "✓ Rol creado" });
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-xl my-4">
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <p className="text-sm font-bold text-white">{existingRole ? "Editar rol" : "Nuevo rol"}</p>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <label className="text-[10px] text-zinc-400 mb-1 block">Nombre del rol *</label>
            <input value={form.name} onChange={e => setF("name", e.target.value)} placeholder="Ej: Preparador Físico"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
          </div>

          <div>
            <label className="text-[10px] text-zinc-400 mb-1 block">Descripción</label>
            <input value={form.description} onChange={e => setF("description", e.target.value)} placeholder="Descripción breve del rol"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
          </div>

          <div>
            <label className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider block mb-2">Áreas de trabajo</label>
            <div className="flex flex-wrap gap-1.5">
              {AREAS.map(a => (
                <button key={a.id} type="button" onClick={() => toggleArea(a.id)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors ${
                    form.areas.includes(a.id) ? "bg-violet-500/20 border-violet-500/40 text-violet-300" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"
                  }`}>
                  {form.areas.includes(a.id) && <Check size={8} className="inline mr-1" />}
                  {a.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider block mb-2">Páginas permitidas</label>
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
              {PAGES.map(p => (
                <button key={p.path} type="button" onClick={() => togglePage(p.path)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors ${
                    form.allowed_pages.includes(p.path) ? "bg-blue-500/20 border-blue-500/40 text-blue-300" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"
                  }`}>
                  {form.allowed_pages.includes(p.path) && <Check size={8} className="inline mr-1" />}
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider block mb-2">Permisos de acción</label>
            <div className="flex flex-wrap gap-2">
              {PERMS.map(p => (
                <button key={p.key} type="button" onClick={() => setF(p.key, !form[p.key])}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium border transition-colors ${
                    form[p.key] ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300" : "bg-zinc-800 border-zinc-700 text-zinc-500"
                  }`}>
                  <span className={`w-2.5 h-2.5 rounded border ${form[p.key] ? "bg-emerald-400 border-emerald-400" : "border-zinc-600"}`} />
                  {p.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-zinc-600 mt-1.5">"Administrar" da acceso total a todas las áreas y páginas, sin restricciones.</p>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button type="button" onClick={() => setF("active", !form.active)}
              className={`w-9 h-5 rounded-full relative transition-colors ${form.active ? "bg-emerald-500" : "bg-zinc-700"}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.active ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
            <span className="text-xs text-zinc-400">Rol {form.active ? "activo" : "desactivado"}</span>
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t border-zinc-800">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-xs hover:bg-zinc-700 transition-colors">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 bg-white text-zinc-900 font-semibold rounded-lg text-xs hover:bg-zinc-200 transition-colors disabled:opacity-50">
              {saving ? "Guardando..." : existingRole ? "Actualizar rol" : "Crear rol"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}