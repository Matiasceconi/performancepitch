import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

const UserTypeContext = createContext(null);

export function UserTypeProvider({ children }) {
  const { isAuthenticated, user, authChecked } = useAuth();
  const [userType, setUserType] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const resolveType = useCallback(async () => {
    if (!authChecked || !isAuthenticated || !user) {
      setUserType(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('resolveUserType', {});
      setUserType(res.data || res);
    } catch (e) {
      setUserType(null);
      setError(e?.message || 'Error al verificar acceso');
    } finally {
      setLoading(false);
    }
  }, [authChecked, isAuthenticated, user]);

  useEffect(() => { resolveType(); }, [resolveType]);

  return (
    <UserTypeContext.Provider value={{
      isStaff: !!userType?.is_staff,
      isPlayer: !!userType?.is_player,
      playerAccess: userType?.player_access || null,
      staffAccess: userType?.staff_access || null,
      isPlatformAdmin: !!userType?.is_platform_admin,
      loading,
      error,
      retry: resolveType,
    }}>
      {children}
    </UserTypeContext.Provider>
  );
}

export const useUserType = () => {
  const ctx = useContext(UserTypeContext);
  return ctx || { isStaff: false, isPlayer: false, playerAccess: null, staffAccess: null, isPlatformAdmin: false, loading: true, error: null, retry: () => {} };
};