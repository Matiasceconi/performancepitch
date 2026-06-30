import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { X, Shield, Check, Mail } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { ROLE_DEFAULTS } from "@/lib/WorkspaceContext";

const ROLES = Object.keys(ROLE_DEFAULTS);

const MODULES = [
  { key: "dashboard",        label: "Dashboard" },
  { key: "daily_squad",      label: "Estado del Plantel" },
  { key: "sessions",         label: "Sesiones" },
  { key: "field_library",    label: "Bib. Campo" },
  { key: "strength_library", label: "Bib. Fuerza" },
  { key: "matches",          label: "Partidos" },
  { key: "performance",      label: "Rendimiento" },
  { key: "gps",              label: "GPS" },
  { key: "tactical",         label: "Táctico" },
  { key: "schedule",         label: "Calendario" },
  { key: "team",             label: "Cuerpo Técnico" },
  { key: "weekly_planner",   label: "Plan Semanal" },
  { key: "squad_manager",    label: "Planteles" },
  { key: "admin",            label: "Administración" },
];

const PERMS = [
  { key: "can_create", label: "Crear" },
  { key: "can_edit",   label: "Editar" },
  { key: "can_delete", label: "Eliminar" },
  { key: "can_export", label: "Exportar" },
  { key: "can_admin",  label: "Admin" },
  { key: "can_manage_users", label: "Gestionar usuarios" },
];

export default function StaffPermissionsModal({ member, squads, existingAccess, onSaved, onClose }) {
  const [form, setForm] = useState(() => {
    if (existingAccess) {
      return {
        user_email: existingAccess.user_email || member.email || "",
        role: existingAccess.role || "Solo lectura",
        all_squads: existingAccess.all_squads || false,
        squad_ids: existingAccess.squad_ids || [],
        squad_names: existingAccess.squad_names || [],
        allowed_modules: existingAccess.allowed_modules || [],
        can_create: existingAccess.can_create || false,
        can_edit: existingAccess.can_edit || false,
        can_delete: existingAccess.can_delete || false,
        can_export: existingAccess.can_export || false,
        can_admin: existingAccess.can_admin || false,
        can_manage_users: existingAccess.can_manage_users || false,
        active: existingAccess.active !== false,
        notes: existingAccess.notes || "",
      };
    }
    // New access: pre-fill email from staff member
    const defaults = ROLE_DEFAULTS["Solo lectura"];
    return {
      user_email: member.email || "",
      role: "Solo lectura",
      all_squads: false,
      squad_ids: member.squad_ids || [],
      squad_names: member.squad_names || [],
      allowed_modules: defaults.allowed_modules || [],
      can_create: false, can_edit: false, can_delete: false,
      can_export: false, can_admin: false, can_manage_users: false,
      active: true, notes: "",
    };
  });

  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState(false);
  const { toast } = useToast();

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function applyRoleDefaults(role) {
    const d = ROLE_DEFAULTS[role] || {};
    setForm(f => ({
      ...f,
      role,
      allowed_modules: d.allowed_modules || [],
      can_create: d.can_create ?? false,
      can_edit: d.can_edit ?? false,
      can_delete: d.can_delete ?? false,
      can_export: d.can_export ?? false,
      can_admin: d.can_admin ?? false,
      can_manage_users: d.can_manage_users ?? false,
      all_squads: d.all_squads ?? false,
    }));
  }

  function toggleSquad(id) {
    setForm(f => {
      const ids = f.squad_ids.includes(id) ? f.squad_ids.filter(s => s !== id) : [...f.squad_ids, id];
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

  async function handleSave() {
    if (!form.user_email) {
      toast({ title: "El email es obligatorio para crear un acceso", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      staff_id: member.id,
      staff_name: `${member.first_name} ${member.last_name}`,
      user_name: `${member.first_name} ${member.last_name}`,
    };
    let saved;
    if (existingAccess) {
      saved = await base44.entities.UserAccess.update(existingAccess.id, payload);
      toast({ title: "✓ Permisos actualizados" });
    } else {
      saved = await base44.entities.UserAccess.create(payload);
      toast({ title: "✓ Cuenta de acceso creada" });
    }
    setSaving(false);
    onSaved({ ...payload, id: saved?.id || existingAccess?.id });
  }

  async function handleInvite() {
    if (!form.user_email) return;
    setInviting(true);
    try {
      await base44.users.inviteUser(form.user_email, "user");
      toast({ title: `✓ Invitación enviada a ${form.user_email}` });
    } catch (e) {
      toast({ title: "Error al invitar: " + e.message, variant: "destructive" });
    }
    setInviting(false);
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg my-4">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <Shield size={14} className="text-blue-400" />
              <p className="text-sm font-bold text-white">Acceso y Permisos</p>
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5">{member.first_name} {member.last_name} · {member.role}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Email + invite */}
          <div>
            <label className="text-[10px] text-zinc-400 mb-1 block">Email de usuario *</label>
            <div className="flex gap-2">
              <input
                value={form.user_email}
                onChange={e => setF("user_email", e.target.value)}
                placeholder="usuario@email.com"
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
              />
              <button
                type="button"
                onClick={handleInvite}
                disabled={!form.user_email || inviting}
                className="flex items-center gap-1.5 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-lg text-xs transition-colors disabled:opacity-40"
              >
                <Mail size={11} /> {inviting ? "..." : "Invitar"}
              </button>
            </div>
            <p className="text-[10px] text-zinc-600 mt-1">Envía una invitación para que el usuario pueda ingresar a la plataforma.</p>
          </div>

          {/* Role */}
          <div>
            <label className="text-[10px] text-zinc-400 mb-1 block">Rol de plataforma</label>
            <select value={form.role} onChange={e => applyRoleDefaults(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none">
              {ROLES.map(r => <option key={r}>{r}</option>)}
            </select>
            <p className="text-[10px] text-zinc-600 mt-1">Al cambiar el rol se aplican los permisos por defecto de ese rol.</p>
          </div>

          {/* Planteles */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Planteles</label>
              <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-zinc-400">
                <input type="checkbox" checked={form.all_squads} onChange={e => setF("all_squads", e.target.checked)}
                  className="w-3 h-3 accent-yellow-400" />
                Todos los planteles
              </label>
            </div>
            {!form.all_squads && (
              <div className="flex flex-wrap gap-1.5">
                {squads.map(s => (
                  <button key={s.id} type="button" onClick={() => toggleSquad(s.id)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors ${
                      form.squad_ids.includes(s.id)
                        ? "bg-yellow-400/20 border-yellow-400/40 text-yellow-300"
                        : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"
                    }`}>
                    {form.squad_ids.includes(s.id) && <Check size={8} className="inline mr-1" />}
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
            <div className="flex flex-wrap gap-1.5">
              {MODULES.map(m => (
                <button key={m.key} type="button" onClick={() => toggleModule(m.key)}
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

          {/* Permisos */}
          <div>
            <label className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider block mb-2">Permisos de acción</label>
            <div className="flex flex-wrap gap-2">
              {PERMS.map(p => (
                <button key={p.key} type="button" onClick={() => setF(p.key, !form[p.key])}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium border transition-colors ${
                    form[p.key]
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                      : "bg-zinc-800 border-zinc-700 text-zinc-500"
                  }`}>
                  <span className={`w-2.5 h-2.5 rounded border ${form[p.key] ? "bg-emerald-400 border-emerald-400" : "border-zinc-600"}`} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3 pt-1">
            <button type="button" onClick={() => setF("active", !form.active)}
              className={`w-9 h-5 rounded-full relative transition-colors ${form.active ? "bg-emerald-500" : "bg-zinc-700"}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.active ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
            <span className="text-xs text-zinc-400">Cuenta {form.active ? "activa" : "desactivada"}</span>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-2 border-t border-zinc-800">
            <button type="button" onClick={onClose}
              className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-xs hover:bg-zinc-700 transition-colors">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 bg-white text-zinc-900 font-semibold rounded-lg text-xs hover:bg-zinc-200 transition-colors disabled:opacity-50">
              {saving ? "Guardando..." : existingAccess ? "Actualizar permisos" : "Crear acceso"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}