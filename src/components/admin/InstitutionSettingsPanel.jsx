import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { loadOrSeedInstitutionProfile, updateInstitutionProfile, isValidHex } from "@/lib/institutionProfile";
import { contrastText } from "@/lib/clubBrandResolver";
import { Upload, Save, Building2, Palette, Sliders, FileOutput, ShieldCheck, Lock } from "lucide-react";

const TABS = [
  { id: "info", label: "Información", icon: Building2 },
  { id: "visual", label: "Identidad visual", icon: Palette },
  { id: "prefs", label: "Preferencias", icon: Sliders },
  { id: "exports", label: "Exportaciones", icon: FileOutput },
];

const EMPTY = {
  official_name: "", short_name: "", abbreviation: "", shield_url: "", horizontal_logo_url: "",
  country: "", province: "", city: "", address: "", website: "", institutional_email: "", phone: "",
  instagram: "", other_social_links: [], founded_year: null, stadium: "", training_ground: "", description: "",
  brand_primary: "#00843D", brand_secondary: "#005A34", brand_accent: "#FFD400",
  brand_background: "#09090B", brand_surface: "#18181B", brand_text_primary: "#FFFFFF", brand_text_secondary: "#A1A1AA",
  default_squad_id: "", default_season: "", default_competition_id: "",
  language: "Español", timezone: "America/Argentina/Buenos_Aires", date_format: "DD/MM/YYYY", time_format: "24h",
  week_starts_on: "lunes", unit_system: "metrico", currency: "ARS",
  default_export_format: "PDF", default_paper_size: "A4", default_orientation: "portrait", show_performancepitch_brand: true,
  export_footer_text: "", sponsor_logo_url: "", watermark_url: "",
  show_squad_name: true, show_season: true, show_export_date: true,
};

function Field({ label, children, full }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="text-xs text-zinc-400 mb-1 block">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500";

function ColorRow({ label, value, onChange }) {
  const valid = isValidHex(value);
  return (
    <div className="flex items-center gap-2">
      <input type="color" value={valid ? value : "#000000"} onChange={(e) => onChange(e.target.value.toUpperCase())} className="w-9 h-9 rounded-lg border border-zinc-700 bg-zinc-800 cursor-pointer shrink-0" />
      <input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="#RRGGBB" className={`${inputCls} font-mono uppercase ${!valid && value ? "border-red-500/50" : ""}`} />
      <span className="text-xs text-zinc-500 w-20 shrink-0">{label}</span>
    </div>
  );
}

function BrandPreview({ form }) {
  const primary = isValidHex(form.brand_primary) ? form.brand_primary : "#1E293B";
  const accent = isValidHex(form.brand_accent) ? form.brand_accent : "#0EA5E9";
  const onPrimary = contrastText(primary);
  return (
    <div className="rounded-xl border border-zinc-700 overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-2" style={{ backgroundColor: primary }}>
        <span className="text-sm font-bold" style={{ color: onPrimary }}>{form.short_name || form.official_name || "Club"}</span>
        <span className="text-xs ml-auto" style={{ color: onPrimary, opacity: 0.8 }}>Encabezado</span>
      </div>
      <div className="flex">
        <div className="w-1/3 bg-zinc-900 p-2 space-y-1">
          <div className="h-2 rounded" style={{ backgroundColor: accent }} />
          <div className="h-2 rounded bg-zinc-700/50" />
          <div className="h-2 rounded bg-zinc-700/50" />
        </div>
        <div className="flex-1 p-3 space-y-2">
          <button className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: primary, color: onPrimary }}>Botón principal</button>
          <div className="rounded-lg border border-zinc-700 p-2 bg-zinc-800/50">
            <p className="text-xs text-zinc-400">Tarjeta</p>
            <p className="text-xs text-zinc-500 mt-1">Contenido de ejemplo</p>
          </div>
          <div className="rounded-lg overflow-hidden border border-zinc-700">
            <div className="px-2 py-1 text-xs font-semibold" style={{ backgroundColor: primary, color: onPrimary }}>Encabezado tabla</div>
            <div className="px-2 py-1 text-xs text-zinc-400 bg-zinc-800/30">Fila</div>
            <div className="px-2 py-1 text-xs text-zinc-400">Fila</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InstitutionSettingsPanel({ isAdmin, squads = [] }) {
  const { toast } = useToast();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [tab, setTab] = useState("info");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(null); // "shield" | "horizontal" | "sponsor" | "watermark" | null
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    const p = await loadOrSeedInstitutionProfile();
    if (!p) {
      setError("No se pudo cargar el perfil institucional. Reintentá desde el botón.");
      setLoading(false);
      return;
    }
    setProfile(p);
    setForm({ ...EMPTY, ...p, other_social_links: p.other_social_links || [] });
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function uploadImage(file, field) {
    if (!file) return;
    setUploading(field);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set(field, file_url);
    } catch (e) {
      toast({ title: "Error al subir la imagen", description: e?.message, variant: "destructive" });
    } finally {
      setUploading(null);
    }
  }

  async function save() {
    if (!isValidHex(form.brand_primary) || !isValidHex(form.brand_secondary) || !isValidHex(form.brand_accent)) {
      toast({ title: "Colores inválidos", description: "Los colores principales deben tener formato #RRGGBB", variant: "destructive" });
      return;
    }
    if (!form.official_name) {
      toast({ title: "Nombre obligatorio", description: "El nombre oficial es obligatorio", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const updated = await updateInstitutionProfile(profile.id, form);
      setProfile(updated);
      toast({ title: "Perfil institucional guardado" });
    } catch (e) {
      toast({ title: "Error al guardar", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  // Porcentaje de configuración completada
  const completionFields = ["official_name", "short_name", "shield_url", "brand_primary", "brand_secondary", "brand_accent", "country", "city", "language", "timezone"];
  const filled = completionFields.filter((f) => form[f]).length;
  const completion = Math.round((filled / completionFields.length) * 100);

  if (loading) {
    return <div className="flex items-center justify-center py-10"><div className="w-5 h-5 border-2 border-zinc-700 border-t-cyan-400 rounded-full animate-spin" /></div>;
  }

  const defaultSquad = squads.find((s) => s.id === form.default_squad_id);

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex items-start gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="w-14 h-14 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden shrink-0">
          {form.shield_url ? <img src={form.shield_url} alt="Escudo" className="w-full h-full object-contain" /> : <Building2 size={22} className="text-zinc-500" />}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-bold text-base truncate">{form.official_name || "Institución sin nombre"}</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            {form.short_name || "—"} · {defaultSquad?.name || "Sin plantel predeterminado"} · {form.default_season || "Temporada —"}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 max-w-xs h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div className="h-full rounded-full bg-cyan-500 transition-all" style={{ width: `${completion}%` }} />
            </div>
            <span className="text-xs text-zinc-500">{completion}% configurado</span>
          </div>
        </div>
        {isAdmin ? (
          <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/30 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors shrink-0">
            <Save size={14} /> {saving ? "Guardando..." : "Guardar"}
          </button>
        ) : (
          <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-700 text-zinc-500 text-xs shrink-0">
            <Lock size={12} /> Solo lectura
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={load} className="text-xs underline hover:text-red-200">Reintentar</button>
        </div>
      )}

      {/* Pestañas */}
      <div className="flex gap-1 border-b border-zinc-800">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? "border-cyan-400 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}>
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        {tab === "info" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Nombre oficial *"><input className={inputCls} value={form.official_name} onChange={(e) => set("official_name", e.target.value)} disabled={!isAdmin} /></Field>
            <Field label="Nombre corto"><input className={inputCls} value={form.short_name} onChange={(e) => set("short_name", e.target.value)} disabled={!isAdmin} /></Field>
            <Field label="Abreviatura"><input className={inputCls} value={form.abbreviation} onChange={(e) => set("abbreviation", e.target.value)} disabled={!isAdmin} /></Field>
            <Field label="Año de fundación"><input type="number" className={inputCls} value={form.founded_year ?? ""} onChange={(e) => set("founded_year", e.target.value ? Number(e.target.value) : null)} disabled={!isAdmin} /></Field>
            <Field label="País"><input className={inputCls} value={form.country} onChange={(e) => set("country", e.target.value)} disabled={!isAdmin} /></Field>
            <Field label="Provincia"><input className={inputCls} value={form.province} onChange={(e) => set("province", e.target.value)} disabled={!isAdmin} /></Field>
            <Field label="Ciudad"><input className={inputCls} value={form.city} onChange={(e) => set("city", e.target.value)} disabled={!isAdmin} /></Field>
            <Field label="Domicilio"><input className={inputCls} value={form.address} onChange={(e) => set("address", e.target.value)} disabled={!isAdmin} /></Field>
            <Field label="Sitio web"><input className={inputCls} value={form.website} onChange={(e) => set("website", e.target.value)} disabled={!isAdmin} /></Field>
            <Field label="Email institucional"><input className={inputCls} value={form.institutional_email} onChange={(e) => set("institutional_email", e.target.value)} disabled={!isAdmin} /></Field>
            <Field label="Teléfono"><input className={inputCls} value={form.phone} onChange={(e) => set("phone", e.target.value)} disabled={!isAdmin} /></Field>
            <Field label="Instagram"><input className={inputCls} value={form.instagram} onChange={(e) => set("instagram", e.target.value)} disabled={!isAdmin} /></Field>
            <Field label="Estadio"><input className={inputCls} value={form.stadium} onChange={(e) => set("stadium", e.target.value)} disabled={!isAdmin} /></Field>
            <Field label="Predio de entrenamiento"><input className={inputCls} value={form.training_ground} onChange={(e) => set("training_ground", e.target.value)} disabled={!isAdmin} /></Field>
            <Field label="Descripción" full><textarea rows={2} className={`${inputCls} resize-none`} value={form.description} onChange={(e) => set("description", e.target.value)} disabled={!isAdmin} /></Field>
          </div>
        )}

        {tab === "visual" && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Escudo</label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden shrink-0">
                    {form.shield_url ? <img src={form.shield_url} alt="Escudo" className="w-full h-full object-contain" /> : <ShieldCheck size={22} className="text-zinc-500" />}
                  </div>
                  {isAdmin && (
                    <label className="flex cursor-pointer items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors">
                      <Upload size={13} /> {uploading === "shield" ? "Subiendo..." : "Reemplazar"}
                      <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml" className="hidden" onChange={(e) => uploadImage(e.target.files?.[0], "shield_url")} disabled={!isAdmin} />
                    </label>
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Logo horizontal (opcional)</label>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-12 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden shrink-0">
                    {form.horizontal_logo_url ? <img src={form.horizontal_logo_url} alt="Logo" className="w-full h-full object-contain" /> : <span className="text-xs text-zinc-600">—</span>}
                  </div>
                  {isAdmin && (
                    <label className="flex cursor-pointer items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors">
                      <Upload size={13} /> {uploading === "horizontal" ? "Subiendo..." : "Reemplazar"}
                      <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml" className="hidden" onChange={(e) => uploadImage(e.target.files?.[0], "horizontal_logo_url")} disabled={!isAdmin} />
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-zinc-400 font-semibold">Colores principales</p>
              <ColorRow label="Principal" value={form.brand_primary} onChange={(v) => set("brand_primary", v)} />
              <ColorRow label="Secundario" value={form.brand_secondary} onChange={(v) => set("brand_secondary", v)} />
              <ColorRow label="Acento" value={form.brand_accent} onChange={(v) => set("brand_accent", v)} />
            </div>

            <div className="space-y-2">
              <p className="text-xs text-zinc-400 font-semibold">Colores de superficie (opcional)</p>
              <ColorRow label="Fondo" value={form.brand_background} onChange={(v) => set("brand_background", v)} />
              <ColorRow label="Superficie" value={form.brand_surface} onChange={(v) => set("brand_surface", v)} />
              <ColorRow label="Texto principal" value={form.brand_text_primary} onChange={(v) => set("brand_text_primary", v)} />
              <ColorRow label="Texto secundario" value={form.brand_text_secondary} onChange={(v) => set("brand_text_secondary", v)} />
            </div>

            <div>
              <p className="text-xs text-zinc-400 font-semibold mb-2">Vista previa</p>
              <BrandPreview form={form} />
            </div>
          </div>
        )}

        {tab === "prefs" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Plantel predeterminado">
              <select className={inputCls} value={form.default_squad_id} onChange={(e) => set("default_squad_id", e.target.value)} disabled={!isAdmin}>
                <option value="">—</option>
                {squads.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Temporada predeterminada"><input className={inputCls} value={form.default_season || ""} onChange={(e) => set("default_season", e.target.value)} disabled={!isAdmin} /></Field>
            <Field label="Idioma"><input className={inputCls} value={form.language} onChange={(e) => set("language", e.target.value)} disabled={!isAdmin} /></Field>
            <Field label="Zona horaria"><input className={inputCls} value={form.timezone} onChange={(e) => set("timezone", e.target.value)} disabled={!isAdmin} /></Field>
            <Field label="Formato de fecha"><input className={inputCls} value={form.date_format} onChange={(e) => set("date_format", e.target.value)} disabled={!isAdmin} /></Field>
            <Field label="Formato de hora">
              <select className={inputCls} value={form.time_format} onChange={(e) => set("time_format", e.target.value)} disabled={!isAdmin}>
                <option value="24h">24 horas</option>
                <option value="12h">12 horas (AM/PM)</option>
              </select>
            </Field>
            <Field label="Primer día de la semana">
              <select className={inputCls} value={form.week_starts_on} onChange={(e) => set("week_starts_on", e.target.value)} disabled={!isAdmin}>
                <option value="lunes">Lunes</option>
                <option value="domingo">Domingo</option>
                <option value="sabado">Sábado</option>
              </select>
            </Field>
            <Field label="Sistema de unidades">
              <select className={inputCls} value={form.unit_system} onChange={(e) => set("unit_system", e.target.value)} disabled={!isAdmin}>
                <option value="metrico">Métrico</option>
                <option value="imperial">Imperial</option>
              </select>
            </Field>
            <Field label="Moneda"><input className={inputCls} value={form.currency} onChange={(e) => set("currency", e.target.value)} disabled={!isAdmin} /></Field>
          </div>
        )}

        {tab === "exports" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Formato predeterminado">
                <select className={inputCls} value={form.default_export_format} onChange={(e) => set("default_export_format", e.target.value)} disabled={!isAdmin}>
                  <option>PDF</option>
                  <option>PNG</option>
                </select>
              </Field>
              <Field label="Tamaño de papel">
                <select className={inputCls} value={form.default_paper_size} onChange={(e) => set("default_paper_size", e.target.value)} disabled={!isAdmin}>
                  <option>A4</option>
                  <option>A5</option>
                  <option>Letter</option>
                </select>
              </Field>
              <Field label="Orientación">
                <select className={inputCls} value={form.default_orientation} onChange={(e) => set("default_orientation", e.target.value)} disabled={!isAdmin}>
                  <option value="portrait">Vertical</option>
                  <option value="landscape">Horizontal</option>
                </select>
              </Field>
            </div>
            <Field label="Texto de pie de exportaciones" full><input className={inputCls} value={form.export_footer_text || ""} onChange={(e) => set("export_footer_text", e.target.value)} placeholder="Ej: Documento operativo del cuerpo técnico" disabled={!isAdmin} /></Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Logo sponsor (exportaciones)</label>
                <div className="flex items-center gap-3">
                  <div className="w-20 h-10 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden shrink-0">
                    {form.sponsor_logo_url ? <img src={form.sponsor_logo_url} alt="Sponsor" className="w-full h-full object-contain" /> : <span className="text-xs text-zinc-600">—</span>}
                  </div>
                  {isAdmin && (
                    <label className="flex cursor-pointer items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors">
                      <Upload size={13} /> {uploading === "sponsor" ? "Subiendo..." : "Reemplazar"}
                      <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml" className="hidden" onChange={(e) => uploadImage(e.target.files?.[0], "sponsor_logo_url")} disabled={!isAdmin} />
                    </label>
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Marca de agua (exportaciones)</label>
                <div className="flex items-center gap-3">
                  <div className="w-20 h-10 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden shrink-0">
                    {form.watermark_url ? <img src={form.watermark_url} alt="Watermark" className="w-full h-full object-contain" /> : <span className="text-xs text-zinc-600">—</span>}
                  </div>
                  {isAdmin && (
                    <label className="flex cursor-pointer items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors">
                      <Upload size={13} /> {uploading === "watermark" ? "Subiendo..." : "Reemplazar"}
                      <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml" className="hidden" onChange={(e) => uploadImage(e.target.files?.[0], "watermark_url")} disabled={!isAdmin} />
                    </label>
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-2 pt-2">
              <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={!!form.show_squad_name} onChange={(e) => set("show_squad_name", e.target.checked)} disabled={!isAdmin} /> Mostrar nombre del plantel</label>
              <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={!!form.show_season} onChange={(e) => set("show_season", e.target.checked)} disabled={!isAdmin} /> Mostrar temporada</label>
              <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={!!form.show_export_date} onChange={(e) => set("show_export_date", e.target.checked)} disabled={!isAdmin} /> Mostrar fecha de exportación</label>
              <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={!!form.show_performancepitch_brand} onChange={(e) => set("show_performancepitch_brand", e.target.checked)} disabled={!isAdmin} /> Mostrar marca PerformancePitch</label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}