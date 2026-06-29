import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Navigate } from 'react-router-dom';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Layout from '@/components/staff/Layout';
import Dashboard from '@/pages/Dashboard';
import Sessions from '@/pages/Sessions';
import Catapult from '@/pages/Catapult';
import Squad from '@/pages/Squad';
import Tactical from '@/pages/Tactical';
import Performance from '@/pages/Performance';
import Team from '@/pages/Team';
import Schedule from '@/pages/Schedule';
import Matches from '@/pages/Matches';
import PlayerNameManagement from '@/pages/PlayerNameManagement';
import PlantilDiagnostic from '@/pages/PlantilDiagnostic';
import WeeklyPlanner from '@/pages/WeeklyPlanner';
import PlayerAdmin from '@/pages/PlayerAdmin';
import DataCrossing from '@/pages/DataCrossing';
import PlayerIdentity from '@/pages/PlayerIdentity';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/catapult" element={<Catapult />} />
          <Route path="/squad" element={<Squad />} />
          <Route path="/tactical" element={<Tactical />} />
          <Route path="/performance" element={<Performance />} />
          <Route path="/team" element={<Team />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/matches" element={<Matches />} />
          <Route path="/player-names" element={<PlayerNameManagement />} />
          <Route path="/plantil-diagnostic" element={<PlantilDiagnostic />} />
          <Route path="/weekly-planner" element={<WeeklyPlanner />} />
          <Route path="/player-admin" element={<PlayerAdmin />} />
          <Route path="/data-crossing" element={<DataCrossing />} />
          <Route path="/identity" element={<PlayerIdentity />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App