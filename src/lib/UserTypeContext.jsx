import { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

const UserTypeContext = createContext(null);

export function UserTypeProvider({ children }) {
  const { isAuthenticated, user, authChecked } = useAuth();
  const [userType, setUserType] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authChecked || !isAuthenticated || !user) {
      setUserType(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    base44.functions.invoke('resolveUserType', {})
      .then((res) => setUserType(res.data || res))
      .catch(() => setUserType(null))
      .finally(() => setLoading(false));
  }, [authChecked, isAuthenticated, user]);

  return (
    <UserTypeContext.Provider value={{
      isStaff: !!userType?.is_staff,
      isPlayer: !!userType?.is_player,
      playerAccess: userType?.player_access || null,
      loading,
    }}>
      {children}
    </UserTypeContext.Provider>
  );
}

export const useUserType = () => {
  const ctx = useContext(UserTypeContext);
  return ctx || { isStaff: false, isPlayer: false, playerAccess: null, loading: true };
};