import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Legacy importer intentionally disabled.
// Medical data must enter through medicalGateway or syncMedicalFromSheet so that
// player_id, permissions, audit trail, operational availability and explicit
// medical clearance semantics remain consistent.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    return Response.json({
      error: 'Este importador médico legacy está deshabilitado.',
      code: 'LEGACY_MEDICAL_IMPORT_DISABLED',
      next_step: 'Usar Área Médica > Nuevo registro o la integración configurada del club.'
    }, { status: 410 });
  } catch (error) {
    return Response.json({ error: error?.message || 'Unexpected error' }, { status: 500 });
  }
});
