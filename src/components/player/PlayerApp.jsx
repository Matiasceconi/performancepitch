import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PlayerLayout from '@/components/player/PlayerLayout';
import PlayerHome from '@/pages/player/PlayerHome';
import PlayerWellness from '@/pages/player/PlayerWellness';
import PlayerRpe from '@/pages/player/PlayerRpe';
import PlayerHistory from '@/pages/player/PlayerHistory';

export default function PlayerApp() {
  return (
    <Routes>
      <Route path="/" element={<PlayerLayout />}>
        <Route index element={<PlayerHome />} />
        <Route path="wellness" element={<PlayerWellness />} />
        <Route path="rpe" element={<PlayerRpe />} />
        <Route path="rpe/:sessionId" element={<PlayerRpe />} />
        <Route path="history" element={<PlayerHistory />} />
      </Route>
      <Route path="*" element={<Navigate to="/player" replace />} />
    </Routes>
  );
}