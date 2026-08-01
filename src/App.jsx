import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import { Component } from 'react';
import { base44 } from '@/api/base44Client';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Layout from '@/components/staff/Layout';
import { WorkspaceProvider } from '@/lib/WorkspaceContext';
import { UserTypeProvider, useUserType } from '@/lib/UserTypeContext';
import { PlayerCard360Provider } from '@/components/player/PlayerCard360Context';
import PlayerCard360 from '@/components/player/PlayerCard360';
import PlayerApp from '@/components/player/PlayerApp';
import PublicHome from '@/pages/PublicHome';
import ActivatePlayer from '@/pages/ActivatePlayer';
import IngresoJugador from '@/pages/IngresoJugador';
import AccessScreen from '@/components/AccessScreen';
import Dashboard from '@/pages/Dashboard';
import Sessions from '@/pages/Sessions';
import Catapult from '@/pages/Catapult';
import Tactical from '@/pages/Tactical';
import TacticalEditor from '@/pages/TacticalEditor';
import PerformanceExternalLoad from '@/pages/PerformanceExternalLoad';
import MicrocycleHistory from '@/pages/MicrocycleHistory';
import PerformanceInternalLoad from '@/pages/PerformanceInternalLoad';
import PerformanceMedical from '@/pages/PerformanceMedical';
import PerformanceNutrition from '@/pages/PerformanceNutrition';
import PerformanceMinutes from '@/pages/PerformanceMinutes';
import Team from '@/pages/Team';
import Schedule from '@/pages/Schedule';
import Matches from '@/pages/Matches';
import MatchDetail from '@/pages/MatchDetail';
import PlayerNameManagement from '@/pages/PlayerNameManagement';
import PlantilDiagnostic from '@/pages/PlantilDiagnostic';
import WeeklyPlanner from '@/pages/WeeklyPlanner';
import AdminHub from '@/pages/AdminHub';
import DailySquad from '@/pages/DailySquad';
import Players from '@/pages/Players';
import SquadManager from '@/pages/SquadManager';
import FieldLibrary from '@/pages/FieldLibrary';
import StrengthLibrary from '@/pages/StrengthLibrary';
import UsersAccess from '@/pages/UsersAccess';
import PlayerAccess from '@/pages/PlayerAccess';
import ComplementaryStrengthPlans from '@/pages/ComplementaryStrengthPlans';
import FutbolArgentino from '@/pages/FutbolArgentino';
import ClubDashboard from '@/pages/ClubDashboard';

// ── Global Error Boundary ─────────────────────────────────────────────────
class GlobalErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(err, info) { console.error("GlobalErrorBoundary:", err, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
          <div className="w-full max-w-sm text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto">
              <span className="text-red-400 text-2xl">✕</span>
            </div>
            <h2 className="text-white font-bold text-lg">Ocurrió un error inesperado</h2>
            <p className="text-zinc-400 text-sm">{this.state.error?.message}</p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
                className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors">
                Reintentar
              </button>
              <button
                onClick={() => { localStorage.clear(); base44.auth.logout('/'); }}
                className="w-full px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-xl transition-colors">
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-zinc-950">
      <div className="w-8 h-8 border-4 border-zinc-700 border-t-blue-400 rounded-full animate-spin" />
    </div>
  );
}

// ── Staff Routes (wrapped with WorkspaceProvider) ─────────────────────────
function StaffRoutes() {
  return (
    <WorkspaceProvider>
      <PlayerCard360Provider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/club-dashboard" element={<ClubDashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/sessions" element={<Sessions />} />
            <Route path="/catapult" element={<Catapult />} />
            <Route path="/tactical" element={<Tactical />} />
            <Route path="/tactical/new" element={<TacticalEditor />} />
            <Route path="/tactical/:projectId" element={<TacticalEditor />} />
            <Route path="/performance/external-load" element={<PerformanceExternalLoad />} />
            <Route path="/gps" element={<PerformanceExternalLoad />} />
            <Route path="/performance/microcycle-history" element={<MicrocycleHistory />} />
            <Route path="/performance/internal-load" element={<PerformanceInternalLoad />} />
            <Route path="/performance/medical" element={<PerformanceMedical />} />
            <Route path="/performance/nutrition" element={<PerformanceNutrition />} />
            <Route path="/performance/minutes" element={<PerformanceMinutes />} />
            <Route path="/team" element={<Team />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/matches" element={<Matches />} />
            <Route path="/matches/:id" element={<MatchDetail />} />
            <Route path="/player-names" element={<PlayerNameManagement />} />
            <Route path="/plantil-diagnostic" element={<PlantilDiagnostic />} />
            <Route path="/weekly-planner" element={<WeeklyPlanner />} />
            <Route path="/admin" element={<AdminHub />} />
            <Route path="/daily-squad" element={<DailySquad />} />
            <Route path="/players" element={<Players />} />
            <Route path="/squad-manager" element={<SquadManager />} />
            <Route path="/field-library" element={<FieldLibrary />} />
            <Route path="/strength-library" element={<StrengthLibrary />} />
            <Route path="/users-access" element={<UsersAccess />} />
            <Route path="/player-access" element={<PlayerAccess />} />
            <Route path="/complementary-strength" element={<ComplementaryStrengthPlans />} />
            <Route path="/futbol-argentino" element={<FutbolArgentino />} />
          </Route>
          <Route path="*" element={<Navigate to="/club-dashboard" replace />} />
        </Routes>
        <PlayerCard360 />
      </PlayerCard360Provider>
    </WorkspaceProvider>
  );
}

// ── Post-login redirect based on real permissions ──────────────────────────
function PostLoginRedirect() {
  const { isStaff, isPlayer, loading, error, retry } = useUserType();
  const { logout } = useAuth();
  const location = useLocation();
  const access = new URLSearchParams(location.search).get('access');

  if (loading) return <LoadingScreen />;
  if (error) return <AccessScreen variant="error" onRetry={retry} onLogout={() => logout('/')} />;

  if (access === 'player') {
    if (isPlayer) return <Navigate to="/player" replace />;
    if (isStaff) return <AccessScreen variant="no-player" onLogout={() => logout('/')} />;
    return <AccessScreen variant="none" onLogout={() => logout('/')} />;
  }
  if (access === 'staff') {
    if (isStaff) return <Navigate to="/club-dashboard" replace />;
    if (isPlayer) return <AccessScreen variant="no-staff" onLogout={() => logout('/')} />;
    return <AccessScreen variant="none" onLogout={() => logout('/')} />;
  }
  // Sin access especificado — redirigir automáticamente
  if (isStaff) return <Navigate to="/club-dashboard" replace />;
  if (isPlayer) return <Navigate to="/player" replace />;
  return <AccessScreen variant="none" onLogout={() => logout('/')} />;
}

// ── Main App Shell ─────────────────────────────────────────────────────────
function AppShell() {
  const { isAuthenticated, isLoadingAuth, isLoadingPublicSettings, authError, logout } = useAuth();
  const { isStaff, isPlayer, loading: loadingType, error: typeError, retry } = useUserType();
  const location = useLocation();
  const pathname = location.pathname;

  if (isLoadingPublicSettings || isLoadingAuth) return <LoadingScreen />;

  // ── Rutas públicas (sin auth, sin WorkspaceProvider) ─────────────────────
  if (pathname === '/') {
    if (!isAuthenticated) return <PublicHome />;
    if (loadingType) return <LoadingScreen />;
    if (typeError) return <AccessScreen variant="error" onRetry={retry} onLogout={() => logout('/')} />;
    if (isStaff) return <Navigate to="/club-dashboard" replace />;
    if (isPlayer) return <Navigate to="/player" replace />;
    return <AccessScreen variant="none" onLogout={() => logout('/')} />;
  }

  if (pathname === '/login') {
    if (isAuthenticated) return <PostLoginRedirect />;
    return <Login />;
  }

  if (pathname === '/register') {
    if (isAuthenticated) return <Navigate to="/" replace />;
    return <Register />;
  }
  if (pathname === '/forgot-password') return <ForgotPassword />;
  if (pathname.startsWith('/reset-password')) return <ResetPassword />;
  if (pathname === '/activar-jugador') return <ActivatePlayer />;
  if (pathname === '/ingreso-jugador') return <IngresoJugador />;

  // ── Rutas protegidas (requieren auth) ────────────────────────────────────
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <AccessScreen variant="not-registered" onLogout={() => logout('/')} />;
    }
    return <Navigate to="/login" replace />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (loadingType) return <LoadingScreen />;

  if (typeError) {
    return <AccessScreen variant="error" onRetry={retry} onLogout={() => logout('/')} />;
  }

  // ── Rutas del jugador ────────────────────────────────────────────────────
  if (pathname === '/player' || pathname.startsWith('/player/')) {
    if (!isPlayer) return <AccessScreen variant="no-player" onLogout={() => logout('/')} />;
    return <PlayerApp />;
  }

  // ── Rutas del staff ───────────────────────────────────────────────────────
  if (!isStaff) return <AccessScreen variant="no-staff" onLogout={() => logout('/')} />;
  return <StaffRoutes />;
}

function App() {
  return (
    <GlobalErrorBoundary>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <ScrollToTop />
            <UserTypeProvider>
              <AppShell />
            </UserTypeProvider>
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </GlobalErrorBoundary>
  );
}

export default App;