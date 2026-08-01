import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolvePlayerAccessAdmin } from "../../shared/playerPortalAuth.ts";
import { generateUsernameBase, generateUniqueUsername, normalizeDni, getNormalizedPlayerDni } from "../../shared/playerAccessUtils.ts";
import { resolvePlayerContextForDate } from "../../shared/squadRosterResolver.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

    const admin = await resolvePlayerAccessAdmin(base44, user);
    if (!admin) return Response.json({ error: 'No tenés permisos de administrador' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'dry_run');
    const squadId = String(body.squad_id || '');

    // ── Auditoría de DNI: reportar estado de dni vs document_number ──────
    if (action === 'dni_audit') {
      const playerQuery: any = {};
      if (squadId) playerQuery.squad_id = squadId;
      const allPlayers = await base44.asServiceRole.entities.Player.filter(playerQuery, "last_name", 2000);
      const stats = {
        total: allPlayers.length,
        with_dni: 0,
        with_document_number: 0,
        both_equal: 0,
        both_different: 0,
        without_document: 0,
        duplicates: [] as any[],
      };
      const docMap: Record<string, string[]> = {};
      for (const p of allPlayers) {
        const dni = normalizeDni(p.dni);
        const docNum = normalizeDni(p.document_number);
        if (dni) stats.with_dni++;
        if (docNum) stats.with_document_number++;
        if (dni && docNum) {
          if (dni === docNum) stats.both_equal++;
          else stats.both_different++;
        }
        if (!dni && !docNum) stats.without_document++;
        const doc = dni || docNum;
        if (doc) {
          if (!docMap[doc]) docMap[doc] = [];
          docMap[doc].push(`${p.first_name} ${p.last_name}`);
        }
      }
      for (const [doc, names] of Object.entries(docMap)) {
        if (names.length > 1) stats.duplicates.push({ document: doc, players: names });
      }
      return Response.json({ ok: true, stats });
    }

    // ── Unificación de DNI: completar el campo faltante ─────────────────
    if (action === 'dni_unify') {
      const playerQuery: any = {};
      if (squadId) playerQuery.squad_id = squadId;
      const allPlayers = await base44.asServiceRole.entities.Player.filter(playerQuery, "last_name", 2000);
      let updated = 0;
      let skipped = 0;
      for (const p of allPlayers) {
        const dni = normalizeDni(p.dni);
        const docNum = normalizeDni(p.document_number);
        if (dni && !docNum) {
          await base44.asServiceRole.entities.Player.update(p.id, { document_number: dni });
          updated++;
        } else if (!dni && docNum) {
          await base44.asServiceRole.entities.Player.update(p.id, { dni: docNum });
          updated++;
        } else if (dni && docNum && dni !== docNum) {
          skipped++;
        }
      }
      return Response.json({ ok: true, updated, skipped });
    }

    // ── Auditoría de Wellness: reportar estado de squad_id/season_id ────
    if (action === 'wellness_audit') {
      const wQuery: any = {};
      if (squadId) wQuery.squad_id = squadId;
      const allWellness = await base44.asServiceRole.entities.WellnessResponse.filter(wQuery, "-response_date", 5000);
      const orphanWellness = await base44.asServiceRole.entities.WellnessResponse.filter({ squad_id: '' }, "-response_date", 2000);
      const merged = [...allWellness, ...orphanWellness];
      const seen = new Set<string>();
      const unique = merged.filter((w) => { if (seen.has(w.id)) return false; seen.add(w.id); return true; });

      const stats = {
        total: unique.length,
        with_squad_id: 0,
        without_squad_id: 0,
        without_season: 0,
        duplicates: [] as any[],
      };
      const byPlayerDate: Record<string, any[]> = {};
      for (const w of unique) {
        if (w.squad_id) stats.with_squad_id++; else stats.without_squad_id++;
        if (!w.season_id) stats.without_season++;
        const key = `${w.player_id}|${w.response_date}`;
        if (!byPlayerDate[key]) byPlayerDate[key] = [];
        byPlayerDate[key].push(w);
      }
      for (const [key, rows] of Object.entries(byPlayerDate)) {
        if (rows.length > 1) stats.duplicates.push({ key, count: rows.length, player_name: rows[0].player_name, response_date: rows[0].response_date });
      }
      return Response.json({ ok: true, stats });
    }

    // ── Reparación de Wellness: resolver plantel vigente y corregir ──────
    if (action === 'wellness_repair') {
      const wQuery: any = {};
      if (squadId) wQuery.squad_id = squadId;
      const allWellness = await base44.asServiceRole.entities.WellnessResponse.filter(wQuery, "-response_date", 5000);
      const orphanWellness = await base44.asServiceRole.entities.WellnessResponse.filter({ squad_id: '' }, "-response_date", 2000);
      const merged = [...allWellness, ...orphanWellness];
      const seen = new Set<string>();
      const unique = merged.filter((w) => { if (seen.has(w.id)) return false; seen.add(w.id); return true; });

      let updated = 0;
      let skipped = 0;
      for (const w of unique) {
        const ctx = await resolvePlayerContextForDate(base44, w.player_id, w.response_date);
        if (!ctx) { skipped++; continue; }
        const correctSquadId = ctx.squad_id || '';
        const correctSeasonId = ctx.season_id || '';
        const needsUpdate = w.squad_id !== correctSquadId || (correctSeasonId && w.season_id !== correctSeasonId);
        if (!needsUpdate) { skipped++; continue; }
        const patch: any = { squad_id: correctSquadId };
        if (correctSeasonId) patch.season_id = correctSeasonId;
        await base44.asServiceRole.entities.WellnessResponse.update(w.id, patch);
        updated++;
      }
      return Response.json({ ok: true, updated, skipped, total: unique.length });
    }

    // Obtener todos los jugadores
    const playerQuery: any = {};
    if (squadId) playerQuery.squad_id = squadId;
    const players = await base44.asServiceRole.entities.Player.filter(playerQuery, "last_name", 2000);

    // Obtener accesos existentes
    const accessQuery: any = {};
    if (squadId) accessQuery.squad_id = squadId;
    const existingAccess = await base44.asServiceRole.entities.PlayerUserAccess.filter(accessQuery, "-created_date", 5000);

    const accessByPlayerId: Record<string, any> = {};
    const existingUsernames = new Set<string>();
    existingAccess.forEach(a => {
      accessByPlayerId[a.player_id] = a;
      if (a.username) existingUsernames.add(a.username);
    });

    const stats = {
      total: players.length,
      with_dni: 0,
      without_dni: 0,
      users_to_create: 0,
      existing_access: existingAccess.length,
      username_conflicts: 0,
    };

    const playersWithoutDni: any[] = [];
    const operations: any[] = [];

    for (const player of players) {
      const dni = getNormalizedPlayerDni(player);
      const hasDni = dni.length > 0;
      const existing = accessByPlayerId[player.id];

      if (hasDni) stats.with_dni++;
      else stats.without_dni++;

      if (!existing) {
        if (hasDni) {
          const base = generateUsernameBase(player.first_name, player.last_name) || `jugador.${player.id.slice(-6)}`;
          const username = generateUniqueUsername(base, existingUsernames);
          if (base !== username) stats.username_conflicts++;
          existingUsernames.add(username);
          stats.users_to_create++;
          operations.push({ type: 'create', player, username, status: 'ready_to_activate' });
        } else {
          stats.users_to_create++;
          playersWithoutDni.push({ id: player.id, name: `${player.first_name} ${player.last_name}`, squad: player.squad_name });
          operations.push({ type: 'create', player, username: '', status: 'missing_document' });
        }
      } else if (!existing.username && hasDni) {
        const base = generateUsernameBase(player.first_name, player.last_name) || `jugador.${player.id.slice(-6)}`;
        const username = generateUniqueUsername(base, existingUsernames);
        if (base !== username) stats.username_conflicts++;
        existingUsernames.add(username);
        operations.push({ type: 'update', access: existing, username, status: 'ready_to_activate' });
      } else if (!existing.username && !hasDni) {
        operations.push({ type: 'update', access: existing, username: '', status: 'missing_document' });
      }
    }

    if (action === 'dry_run') {
      return Response.json({
        ok: true,
        dry_run: true,
        stats,
        players_without_dni: playersWithoutDni.slice(0, 50),
        sample: operations.slice(0, 10).map(op => ({
          player: `${op.player?.first_name} ${op.player?.last_name}`,
          username: op.username,
          status: op.status,
          type: op.type,
        })),
      });
    }

    // Ejecutar
    const nowISO = new Date().toISOString();
    let created = 0;
    let updated = 0;

    for (const op of operations) {
      if (op.type === 'create') {
        await base44.asServiceRole.entities.PlayerUserAccess.create({
          player_id: op.player.id,
          player_name: op.player.full_name || `${op.player.first_name} ${op.player.last_name}`,
          squad_id: op.player.squad_id || '',
          squad_name: op.player.squad_name || '',
          username: op.username,
          status: op.status,
          active: false,
          invitation_status: 'pending',
          failed_attempts: 0,
          created_at: nowISO,
          updated_at: nowISO,
          created_by: user.id,
        });
        created++;
      } else {
        await base44.asServiceRole.entities.PlayerUserAccess.update(op.access.id, {
          username: op.username,
          status: op.status,
          updated_at: nowISO,
        });
        updated++;
      }
    }

    return Response.json({ ok: true, dry_run: false, stats, created, updated });
  } catch (error) {
    console.error('reviewPlayerAccess error:', error);
    return Response.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}