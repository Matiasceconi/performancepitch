import { base44 } from "@/api/base44Client";

export async function medicalGateway(action, squadId, payload = {}) {
  if (!squadId) throw new Error("Seleccioná un plantel");
  const response = await base44.functions.invoke("medicalGateway", { action, squad_id: squadId, ...payload });
  const data = response?.data || {};
  if (data.error) throw new Error(data.error);
  return data;
}

export const medicalOverview = (squadId) => medicalGateway("overview", squadId);
export const createMedicalEpisode = (squadId, payload) => medicalGateway("create_episode", squadId, payload);
export const updateMedicalEpisode = (squadId, episodeId, payload) => medicalGateway("update_episode", squadId, { episode_id: episodeId, ...payload });
export const addMedicalFollowUp = (squadId, episodeId, payload) => medicalGateway("add_follow_up", squadId, { episode_id: episodeId, ...payload });
export const giveMedicalClearance = (squadId, episodeId, payload) => medicalGateway("medical_clearance", squadId, { episode_id: episodeId, ...payload });
export const reopenMedicalEpisode = (squadId, episodeId, payload = {}) => medicalGateway("reopen_episode", squadId, { episode_id: episodeId, ...payload });
export const reviewMedicalWellnessSignal = (squadId, signalId, payload = {}) => medicalGateway("review_wellness_signal", squadId, { signal_id: signalId, ...payload });
export const convertMedicalWellnessSignal = (squadId, signalId, payload = {}) => medicalGateway("convert_wellness_signal", squadId, { signal_id: signalId, ...payload });
export const getPlayerMedicalHistory = (squadId, playerId) => medicalGateway("player_history", squadId, { player_id: playerId });
