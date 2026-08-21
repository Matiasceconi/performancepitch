import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PlayerLayout from '@/components/player/PlayerLayout';
import PlayerHome from '@/pages/player/PlayerHome';
import PlayerWellness from '@/pages/player/PlayerWellness';
import PlayerRpe from '@/pages/player/PlayerRpe';
import PlayerHistory from '@/pages/player/PlayerHistory';
import PlayerMatchReports from '@/pages/player/PlayerMatchReports';

export default function PlayerApp() {
  return (
    <Routes>
      <Route path="/player" element={<PlayerLayout />}>
        <Route index element={<PlayerHome />} />
        <Route path="/player/wellness" element={<PlayerWellness />} />
        <Route path="/player/rpe" element={<PlayerRpe />} />
        <Route path="/player/rpe/:sessionId" element={<PlayerRpe />} />
        <Route path="/player/history" element={<PlayerHistory />} />
        <Route path="/player/reports" element={<PlayerMatchReports />} />
      </Route>
      <Route path="*" element={<Navigate to="/player" replace />} />
    </Routes>
  );
}