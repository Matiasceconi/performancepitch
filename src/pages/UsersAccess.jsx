import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useWorkspace, ROLE_DEFAULTS } from "@/lib/WorkspaceContext";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Edit2, Trash2, X, Mail, Check, RefreshCw, UserCheck, UserX, Shield } from "lucide-react";
import moment from "moment";

const ROLES = Object.keys(ROLE_DEFAULTS);

const MODULES = [
  { key: "dashboard",        label: "Dashboard" },
  { key: "daily_squad",      label: "Estado del Plantel" },
  { key: "sessions",         label: "Sesiones" },
  { key: "matches",          label: "Partidos" },
  { key: "performance",      label: "Rendimiento" },
  { key: "gps",              label: "GPS" },
  { key: "field_library",    label: "Biblioteca de Campo" },
  { key: "strength_library", label: "Biblioteca de Fuerza" },
  { key: "tactical",         label: "Mapa Táctico" },
  { key: "schedule",         label: "Calendario" },
  { key: "team",             label: "Cuerpo Técnico" },
  { key: "weekly_planner",   label: "Plan Semanal" },
  { key: "admin",            label: "Administración" },
  { key: "squad_manager",    label: "Gestión de Planteles" },
  { key: "player_names",     label: "Nombres de Jugadores" },
];

const EMPTY_FORM = {
  user_email: "", user_name: "", role: "Preparador Físico", phone: "",
  all_squads: false, squad_ids: [], squad_names: [],
  allowed_modules: ROLE_DEFAULTS["Preparador Físico"].allowed_modules,
  can_create: true, can_edit: true, can_delete: false, can_export: true,
  can_admin: false, can_manage_users: false, active: true, notes: "",
};

export default function UsersAccess() {
  const { squads, reloadWorkspace } = useWorkspace();
  const { toast } = useToast();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState(false);

  async function load() {
    setLoading(true);
    const data = await base44.entities.UserAccess.list("-created_date", 200);
    setRecords(data);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function applyRoleDefaults(role) {
    const defaults = ROLE_DEFAULTS[role] || {};
    setForm(f => ({
      ...f,
      role,
      allowed_modules: defaults.allowed_modules || [],
      can_create: defaults.can_create ?? true,
      can_edit: defaults.can_edit ?? true,
      can_delete: defaults.can_delete ?? false,
      can_export: defaults.can_export ?? true,
      can_admin: defaults.can_admin ?? false,
      can_manage_users: defaults.can_manage_users ?? false,
      all_squads: defaults.all_squads ?? false,
    }));
  }

  function toggleSquad(squadId, squadName) {
    setForm(f => {
      const ids = f.squad_ids.includes(squadId)
        ? f.squad_ids.filter(id => id !== squadId)
        : [...f.squad_ids, squadId];
      const names = squads.filter(s => ids.includes(s.id)).map(s => s.name);
      return { ...f, squad_ids: ids, squad_names: names };
    });
  }

  function toggleModule(key) {
    setForm(f => ({
      ...f,
      allowed_modules: f.allowed_modules.includes(key)
        ? f.allowed_modules.filter(m => m !== key)
        : [...f.allowed_modules, key],
    }));
  }

  function openNew() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setShowForm(true);
  }

  function openEdit(rec) {
    setForm({
      user_email: rec.user_email || "",
      user_name: rec.user_name || "",
      role: rec.role || "Solo lectura",
      phone: rec.phone || "",
      all_squads: rec.all_squads || false,
      squad_ids: rec.squad_ids || [],
      squad_names: rec.squad_names || [],
      allowed_modules: rec.allowed_modules || [],
      can_create: rec.can_create ?? false,
      can_edit: rec.can_edit ?? false,
      can_delete: rec.can_delete ?? false,
      can_export: rec.can_export ?? false,
      can_admin: rec.can_admin ?? false,
      can_manage_users: rec.can_manage_users ?? false,
      active: rec.active ?? true,
      notes: rec.notes || "",
    });
    setEditId(rec.id);
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    if (editId) {
      await base44.entities.UserAccess.update(editId, form);
      toast({ title: "✓ Acceso actualizado" });
    } else {
      await base44.entities.UserAccess.create(form);
      toast({ title: "✓ Usuario creado" });
    }
    setShowForm(false);
    setEditId(null);
    await load();
    reloadWorkspace();
    setSaving(false);
  }

  async function handleInvite(email) {
    setInviting(true);
    try {
      await base44.users.inviteUser(email, "user");
      toast({ title: `✓ Invitación enviada a ${email}` });
    } catch (e) {
      toast({ title: "Error al invitar: " + e.message, variant: "destructive" });
    }
    setInviting(false);
  }

  async function toggleActive(rec) {
    await base44.entities.UserAccess.update(rec.id, { active: !rec.active });
    setRecords(prev => prev.map(r => r.id === rec.id ? { ...r, active: !rec.active } : r));
  }

  async function handleDelete(id) {
    if (!window.confirm("¿Eliminar este acceso?")) return;
    await base44.entities.UserAccess.delete(id);
    setRecords(prev => prev.filter(r => r.id !== id));
    toast({ title: "Acceso eliminado" });
  }

  const PERM_FIELDS = [
    { key: "can_create", label: "Crear" },
    { key: "can_edit", label: "Editar" },
    { key: "can_delete", label: "Eliminar" },
    { key: "can_export", label: "Exportar" },
    { key: "can_admin", label: "Administración" },
    { key: "can_manage_users", label: "Gestionar usuarios" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-white">Usuarios y Accesos</h2>
          <p className="text-zinc-500 text-xs mt-0.5">Gestión de roles, planteles y permisos por usuario</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-white text-zinc-900 font-semibold text-sm rounded-lg hover:bg-zinc-200 transition-colors">
          <Plus size={14} /> Nuevo usuario
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Usuario</th>
                <th className="text-left py-3 px-3 text-zinc-400 font-medium">Rol</th>
                <th className="text-left py-3 px-3 text-zinc-400 font-medium">Planteles</th>
                <th className="text-left py-3 px-3 text-zinc-400 font-medium">Último acceso</th>
                <th className="text-left py-3 px-3 text-zinc-400 font-medium">Estado</th>
                <th className="py-3 px-3 text-zinc-400 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-zinc-600">Sin usuarios configurados</td></tr>
              )}
              {records.map(rec => (
                <tr key={rec.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                  <td className="py-3 px-4">
                    <p className="font-semibold text-white">{rec.user_name || rec.user_email}</p>
                    <p className="text-zinc-500 text-[10px]">{rec.user_email}</p>
                  </td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded-full text-zinc-300 text-[10px] font-medium">{rec.role}</span>
                  </td>
                  <td className="py-3 px-3">
                    {rec.all_squads
                      ? <span className="text-emerald-400 text-[10px] font-semibold">Todos</span>
                      : <span className="text-zinc-400 text-[10px]">{(rec.squad_names || []).join(", ") || "—"}</span>
                    }
                  </td>
                  <td className="py-3 px-3 text-zinc-500 text-[10px]">
                    {rec.last_seen ? moment(rec.last_seen).fromNow() : "Nunca"}
                  </td>
                  <td className="py-3 px-3">
                    <span className={`text-[10px] font-semibold ${rec.active ? "text-emerald-400" : "text-zinc-600"}`}>
                      {rec.active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => handleInvite(rec.user_email)} disabled={inviting} title="Enviar invitación"
                        className="p-1.5 text-zinc-500 hover:text-blue-400 transition-colors"><Mail size={12} /></button>
                      <button onClick={() => toggleActive(rec)} title={rec.active ? "Desactivar" : "Activar"}
                        className="p-1.5 text-zinc-500 hover:text-amber-400 transition-colors">
                        {rec.active ? <UserX size={12} /> : <UserCheck size={12} />}
                      </button>
                      <button onClick={() => openEdit(rec)} className="p-1.5 text-zinc-500 hover:text-white transition-colors"><Edit2 size={12} /></button>
                      <button onClick={() => handleDelete(rec.id)} className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-2xl my-4">
            <div className="flex items-center justify-between p-5 border-b border-zinc-800">
              <p className="text-sm font-bold text-white flex items-center gap-2">
                <Shield size={14} className="text-yellow-400" />
                {editId ? "Editar acceso" : "Nuevo usuario"}
              </p>
              <button onClick={() => { setShowForm(false); setEditId(null); }} className="text-zinc-500 hover:text-white"><X size={16} /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-5">
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-[10px] text-zinc-400 mb-1 block">Nombre completo</label>
                  <input value={form.user_name} onChange={e => setF("user_name", e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-[10px] text-zinc-400 mb-1 block">Email *</label>
                  <input required type="email" value={form.user_email} onChange={e => setF("user_email", e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-400 mb-1 block">Teléfono</label>
                  <input value={form.phone} onChange={e => setF("phone", e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-400 mb-1 block">Rol *</label>
                  <select value={form.role} onChange={e => applyRoleDefaults(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-2 text-xs text-white focus:outline-none">
                    {ROLES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              {/* Planteles */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Planteles</label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-zinc-400">
                    <input type="checkbox" checked={form.all_squads} onChange={e => setF("all_squads", e.target.checked)}
                      className="w-3 h-3 rounded accent-yellow-400" />
                    Todos los planteles
                  </label>
                </div>
                {!form.all_squads && (
                  <div className="flex flex-wrap gap-2">
                    {squads.map(s => (
                      <button type="button" key={s.id}
                        onClick={() => toggleSquad(s.id, s.name)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors ${
                          form.squad_ids.includes(s.id)
                            ? "bg-yellow-400/20 border-yellow-400/40 text-yellow-300"
                            : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"
                        }`}>
                        {form.squad_ids.includes(s.id) && <Check size={9} className="inline mr-1" />}
                        {s.name}
                      </button>
                    ))}
                    {squads.length === 0 && <p className="text-[10px] text-zinc-600">No hay planteles creados.</p>}
                  </div>
                )}
              </div>

              {/* Módulos */}
              <div>
                <label className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider block mb-2">Módulos habilitados</label>
                <div className="flex flex-wrap gap-2">
                  {MODULES.map(m => (
                    <button type="button" key={m.key}
                      onClick={() => toggleModule(m.key)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors ${
                        form.allowed_modules.includes(m.key)
                          ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
                          : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-500"
                      }`}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Permisos por acción */}
              <div>
                <label className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider block mb-2">Permisos por acción</label>
                <div className="flex flex-wrap gap-3">
                  {PERM_FIELDS.map(p => (
                    <label key={p.key} className="flex items-center gap-1.5 cursor-pointer text-[10px] text-zinc-300">
                      <input type="checkbox" checked={!!form[p.key]} onChange={e => setF(p.key, e.target.checked)}
                        className="w-3 h-3 rounded accent-yellow-400" />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Active + notes */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-zinc-400 mb-1 block">Notas</label>
                  <input value={form.notes} onChange={e => setF("notes", e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                    <input type="checkbox" checked={form.active} onChange={e => setF("active", e.target.checked)}
                      className="w-3.5 h-3.5 rounded accent-yellow-400" />
                    Usuario activo
                  </label>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2 border-t border-zinc-800">
                <button type="button" onClick={() => { setShowForm(false); setEditId(null); }}
                  className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-xs hover:bg-zinc-700 transition-colors">
                  Cancelar
                </button>
                {!editId && (
                  <button type="button" onClick={() => handleInvite(form.user_email)} disabled={!form.user_email || inviting}
                    className="px-4 py-2 bg-zinc-700 text-zinc-200 rounded-lg text-xs hover:bg-zinc-600 transition-colors disabled:opacity-40 flex items-center gap-1.5">
                    <Mail size={11} /> {inviting ? "Invitando..." : "Invitar"}
                  </button>
                )}
                <button type="submit" disabled={saving}
                  className="px-4 py-2 bg-white text-zinc-900 font-semibold rounded-lg text-xs hover:bg-zinc-200 transition-colors disabled:opacity-50">
                  {saving ? "Guardando..." : editId ? "Actualizar" : "Crear acceso"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}