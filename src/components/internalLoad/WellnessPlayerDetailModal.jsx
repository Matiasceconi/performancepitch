import React, { useState } from 'react';
import { X } from 'lucide-react';
import { scaleColor, painColor, sleepColor, PILL_CLASSES } from '@/components/internalLoad/wellnessColors';

const V2_FIELDS = [
  { key: 'fatigue', label: 'Fatiga general', type: 'scale' },
  { key: 'muscular_soreness', label: 'Cansancio muscular', type: 'scale' },
  { key: 'sleep_lack', label: 'Falta de descanso', type: 'scale' },
  { key: 'stress', label: 'Estrés', type: 'scale' },
  { key: 'mood_low', label: 'Ánimo bajo', type: 'scale' },
  { key: 'sleep_hours', label: 'Horas de sueño', type: 'sleep' },
  { key: 'pain_intensity', label: 'Dolor / molestia', type: 'pain' },
];

const V1_FIELDS = [
  { key: 'sleep_quality', label: 'Calidad de sueño (1-5)' },
  { key: 'energy_level', label: 'Energía (1-5)' },
  { key: 'muscular_readiness', label: 'Muscular (1-5)' },
  { key: 'mood', label: 'Ánimo (1-5)' },
  { key: 'calmness', label: 'Tranquilidad (1-5)' },
];

function Pill({ value, colorKey, suffix }) {
  if (value == null || value === '') {
    return <span className="inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold bg-zinc-800/60 text-zinc-600 border border-zinc-700">—</span>;
  }
  return (
    <span className={`inline-flex items-center justify-center min-w-8 h-8 px-2 rounded-full text-xs font-bold ${PILL_CLASSES[colorKey]}`}>
      {value}{suffix}
    </span>
  );
}

export default function WellnessPlayerDetailModal({ player, wellness, onClose }) {
  if (!player) return null;
  const w = wellness;
  const isV2 = w?.wellness_scale_version === 'negative_1_10_v2';

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 p-4 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-white">{player.first_name} {player.last_name}</h3>
            <p className="text-xs text-zinc-500">{player.position || ''} {player.squad_name ? `· ${player.squad_name}` : ''}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={20} /></button>
        </div>

        <div className="p-4 space-y-4">
          {!w ? (
            <p className="text-center text-zinc-500 py-8">Sin respuesta de wellness para esta fecha.</p>
          ) : (
            <>
              {/* Índice general */}
              <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4">
                <p className="text-xs text-zinc-500 uppercase font-semibold">Índice de fatiga y malestar</p>
                <div className="flex items-center gap-3 mt-1">
                  <Pill value={w.wellness_score} colorKey={scaleColor(w.wellness_score)} />
                  <span className="text-sm text-zinc-400 capitalize">{w.alert_level || '—'}</span>
                  {!isV2 && <span className="text-xs text-zinc-600 ml-auto">escala anterior</span>}
                </div>
                {isV2 && w.alert_reasons?.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {w.alert_reasons.map((r) => (
                      <li key={r} className="text-xs text-amber-300 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />{r}</li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Métricas */}
              {isV2 ? (
                <div className="space-y-2">
                  {V2_FIELDS.map((f) => {
                    const val = w[f.key];
                    const colorKey = f.type === 'sleep' ? sleepColor(val) : f.type === 'pain' ? painColor(val) : scaleColor(val);
                    const suffix = f.type === 'sleep' ? 'h' : '';
                    return (
                      <div key={f.key} className="flex items-center justify-between py-1.5 border-b border-zinc-800/60">
                        <span className="text-sm text-zinc-300">{f.label}</span>
                        <Pill value={val} colorKey={colorKey} suffix={suffix} />
                      </div>
                    );
                  })}
                  {w.has_pain && w.pain_zone && (
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-sm text-zinc-300">Zona del dolor</span>
                      <span className="text-sm text-zinc-200 font-medium">{w.pain_zone}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-zinc-500">Escala anterior (1-5, mayor era mejor)</p>
                  {V1_FIELDS.map((f) => (
                    <div key={f.key} className="flex items-center justify-between py-1.5 border-b border-zinc-800/60">
                      <span className="text-sm text-zinc-300">{f.label}</span>
                      <span className="text-sm text-zinc-200 font-bold">{w[f.key] ?? '—'}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-zinc-300">Horas de sueño</span>
                    <span className="text-sm text-zinc-200 font-bold">{w.sleep_hours ?? '—'}h</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-zinc-300">Dolor</span>
                    <span className="text-sm text-zinc-200 font-bold">{w.has_pain ? `${w.pain_intensity}/10` : 'No'}</span>
                  </div>
                </div>
              )}

              {w.comment && (
                <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-3">
                  <p className="text-xs text-zinc-500 uppercase font-semibold mb-1">Comentario</p>
                  <p className="text-sm text-zinc-300">{w.comment}</p>
                </div>
              )}

              <p className="text-xs text-zinc-600 text-center">
                {w.submitted_at ? `Enviado ${new Date(w.submitted_at).toLocaleString('es-AR')}` : ''}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}