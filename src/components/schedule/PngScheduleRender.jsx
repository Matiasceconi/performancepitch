import React from "react";
import moment from "moment";
import "moment/locale/es";
import { contrastText } from "@/lib/clubBrandResolver";

moment.locale("es");

const TYPE_COLORS = {
  Comida: "#D97706",
  Video: "#EA580C",
  Gimnasio: "#1D4ED8",
  Cancha: "#16A34A",
  Viaje: "#8B3FDB",
  Partido: "#DC2626",
  Descanso: "#8D7AD9",
  Reunión: "#D9A400",
  Otro: "#64748B",
};

function normalize(text) {
  return String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function typeKey(ev) {
  const text = normalize(`${ev.event_type || ""} ${ev.type || ""} ${ev.title || ""} ${ev.location || ""}`);
  if (text.includes("partido") || text.includes(" vs ")) return "Partido";
  if (text.includes("descanso") || text.includes("libre")) return "Descanso";
  if (text.includes("viaje") || text.includes("llegada") || text.includes("traslado")) return "Viaje";
  if (text.includes("desayuno") || text.includes("almuerzo") || text.includes("cena") || text.includes("comida")) return "Comida";
  if (text.includes("video") || text.includes("auditorio")) return "Video";
  if (text.includes("gimnasio") || text.includes("fuerza") || text.includes("gym")) return "Gimnasio";
  if (text.includes("cancha") || text.includes("entrenamiento")) return "Cancha";
  if (text.includes("reunion") || text.includes("charla")) return "Reunión";
  return "Otro";
}

function EventRow({ ev, brand }) {
  const color = TYPE_COLORS[typeKey(ev)] || TYPE_COLORS.Otro;
  const textCol = contrastText(color);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 8px", borderRadius: "6px", backgroundColor: color, color: textCol, marginBottom: "4px" }}>
      {ev.rival_logo_url && <img src={ev.rival_logo_url} alt="" style={{ width: "20px", height: "20px", objectFit: "contain", backgroundColor: "#fff", borderRadius: "4px", padding: "1px" }} />}
      <span style={{ fontSize: "12px", fontWeight: 700, minWidth: "40px" }}>{ev.time || ev.start_time || ""}</span>
      <span style={{ fontSize: "12px", fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.rival ? `vs ${ev.rival}` : ev.title}</span>
      {ev.location && <span style={{ fontSize: "10px", opacity: 0.85 }}>{ev.location}</span>}
    </div>
  );
}

export default function PngScheduleRender({ days, eventsForDate, brand, format, includeEmpty }) {
  const colors = brand.colors;
  const isPortrait = format === "daily";

  return (
    <div style={{
      width: "100%",
      backgroundColor: "#ffffff",
      padding: "20px",
      fontFamily: "system-ui, sans-serif",
      color: "#0f172a",
    }}>
      {/* Encabezado */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", paddingBottom: "12px", borderBottom: `3px solid ${colors.primary}`, marginBottom: "16px" }}>
        {brand.logoUrl ? (
          <img src={brand.logoUrl} alt={brand.name} style={{ width: "48px", height: "48px", objectFit: "contain" }} crossOrigin="anonymous" />
        ) : (
          <div style={{ width: "48px", height: "48px", borderRadius: "50%", backgroundColor: colors.primary, color: contrastText(colors.primary), display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "14px" }}>{brand.shortName}</div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "20px", fontWeight: 800, color: colors.primaryDeep }}>{format === "daily" ? "CRONOGRAMA DIARIO" : format === "monthly" ? "CRONOGRAMA MENSUAL" : "CRONOGRAMA SEMANAL"}</div>
          <div style={{ fontSize: "12px", color: colors.muted }}>{brand.name} · {brand.squadName} · {brand.season || "Temporada"}</div>
        </div>
        <div style={{ fontSize: "12px", color: colors.muted, textAlign: "right" }}>
          {format === "daily" ? days[0].format("dddd DD/MM/YYYY") : `${days[0].format("DD/MM")} - ${days[days.length - 1].format("DD/MM/YYYY")}`}
        </div>
      </div>

      {/* Contenido */}
      {format === "daily" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {eventsForDate(days[0].format("YYYY-MM-DD")).length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: colors.muted, fontSize: "14px" }}>Sin actividades</div>
          ) : (
            eventsForDate(days[0].format("YYYY-MM-DD")).map((ev) => <EventRow key={ev.id} ev={ev} brand={brand} />)
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(days.length, 7)}, 1fr)`, gap: "8px" }}>
          {days.map((d) => {
            const dateStr = d.format("YYYY-MM-DD");
            const dayEvents = eventsForDate(dateStr) || [];
            return (
              <div key={dateStr} style={{ border: `1px solid ${colors.line}`, borderRadius: "8px", overflow: "hidden" }}>
                <div style={{ backgroundColor: colors.primary, color: contrastText(colors.primary), padding: "6px 8px", fontSize: "11px", fontWeight: 700 }}>
                  {d.format("dddd")} <span style={{ float: "right", fontSize: "14px" }}>{d.date()}</span>
                </div>
                <div style={{ padding: "6px", minHeight: "120px", backgroundColor: dayEvents.length ? "#fff" : colors.panel }}>
                  {dayEvents.length === 0 ? (
                    <div style={{ textAlign: "center", color: colors.muted, fontSize: "11px", padding: "20px 0" }}>Sin actividades</div>
                  ) : (
                    dayEvents.slice(0, 6).map((ev) => <EventRow key={ev.id} ev={ev} brand={brand} />)
                  )}
                  {dayEvents.length > 6 && <div style={{ fontSize: "10px", color: colors.muted, padding: "4px 8px" }}>+{dayEvents.length - 6} eventos</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pie */}
      <div style={{ marginTop: "16px", paddingTop: "8px", borderTop: `1px solid ${colors.line}`, fontSize: "10px", color: colors.muted, textAlign: "center" }}>
        Documento generado el {moment().format("DD/MM/YYYY")} · {brand.name}
      </div>
    </div>
  );
}