import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { logout as logoutApi } from '../auth/api';
import { deriveAppRole } from '../auth/roles';
import { getAccessToken, hasAccessToken, setAccessToken, clearAuthStorage } from '../auth/storage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(() => hasAccessToken());
  const [userRole,   setUserRole]   = useState(() => deriveAppRole(getAccessToken()));
  const [token,      setToken]      = useState(getAccessToken);
  const [userName,   setUserName]   = useState('');

  const login = useCallback((authResponse) => {
    setIsLoggedIn(true);
    if (authResponse) {
      setToken(authResponse.access_token);
      setUserRole(deriveAppRole(authResponse.access_token, authResponse.rol));
      setUserName(authResponse.nombre || '');
      setAccessToken(authResponse.access_token);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch (_) {
      // ignore — token may already be expired
    } finally {
      setIsLoggedIn(false);
      setUserRole('recepcion');
      setToken(null);
      setUserName('');
      clearAuthStorage();
    }
  }, []);

  // Restore auth state on mount — also validates JWT expiry
  useEffect(() => {
    const savedToken = getAccessToken();
    if (savedToken) {
      try {
        const payload = JSON.parse(atob(savedToken.split('.')[1]));
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          clearAuthStorage();
          setIsLoggedIn(false);
          setToken(null);
          return;
        }
      } catch (_) {
        clearAuthStorage();
        setIsLoggedIn(false);
        setToken(null);
        return;
      }
      setIsLoggedIn(true);
      setToken(savedToken);
      setUserRole(deriveAppRole(savedToken));
    }
  }, []);

  // Respond to auth:logout events dispatched by the API interceptor
  useEffect(() => {
    const handleAuthLogout = () => logout();
    window.addEventListener('auth:logout', handleAuthLogout);
    return () => window.removeEventListener('auth:logout', handleAuthLogout);
  }, [logout]);

  // Keep React token state in sync when the API interceptor silently refreshes it
  useEffect(() => {
    const handleTokenRefreshed = (e) => {
      const newToken = e.detail;
      if (newToken) {
        setToken(newToken);
        setUserRole(deriveAppRole(newToken));
      }
    };
    window.addEventListener('auth:tokenRefreshed', handleTokenRefreshed);
    return () => window.removeEventListener('auth:tokenRefreshed', handleTokenRefreshed);
  }, []);

  // Keep app role aligned with the current access token
  useEffect(() => {
    if (!token) {
      setUserRole('recepcion');
      return;
    }
    setUserRole(deriveAppRole(token));
  }, [token]);

  return (
    <AuthContext.Provider value={{ isLoggedIn, userRole, token, userName, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};
