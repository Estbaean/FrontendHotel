import { createContext, useContext, useState, useCallback, useEffect } from 'react';

// API imports (calls will fail gracefully when backend is offline)
import { getHabitaciones, postHabitacion, putHabitacion, deleteHabitacion as deleteHabitacionAPI, patchEstadoHabitacion } from '../api/habitaciones';
import { getAlquileresActivos, getAlquileresHistorial, getAlquiler, postCheckIn, postCheckOut } from '../api/alquileres';
import { getTarifas, postTarifa, putTarifa, deleteTarifa as deleteTarifaAPI, patchIncrementoTarifas } from '../api/tarifas';
import { getTiposHabitacion, postTipoHabitacion, putTipoHabitacion, deleteTipoHabitacion as deleteTipoHabitacionAPI } from '../api/categorias';
import { getTiposAlquiler, postTipoAlquiler, putTipoAlquiler, deleteTipoAlquiler as deleteTipoAlquilerAPI } from '../api/tiposAlquiler';
import { getEmpresas, getEmpresasRecepcion, postEmpresa, putEmpresa, deleteEmpresa as deleteEmpresaAPI } from '../api/empresas';
import { getClientes, postCliente, putCliente, deleteCliente as deleteClienteAPI } from '../api/clientes';
import { getResumenHoy } from '../api/caja';
import { logout as logoutApi } from '../auth/api';
import { deriveAppRole } from '../auth/roles';
import { getAccessToken, hasAccessToken, setAccessToken, clearAuthStorage } from '../auth/storage';

const HotelContext = createContext(null);

export function HotelProvider({ children }) {
  // ── State aligned to backend DTOs ──────────────────────────────────
  const [tiposHabitacion, setTiposHabitacion] = useState([]);
  const [tiposAlquiler,   setTiposAlquiler]   = useState([]);
  const [tarifas,         setTarifas]         = useState([]);
  const [habitaciones,    setHabitaciones]    = useState([]);
  const [empresas,        setEmpresas]        = useState([]);
  const [clientes,        setClientes]        = useState([]);
  const [alquileres,      setAlquileres]      = useState([]);
  const [movimientosCaja, setMovimientosCaja] = useState([]);
  const [tiposDocumento]                      = useState([]);

  // ── Auth state ─────────────────────────────────────────────────────
  const [isLoggedIn, setIsLoggedIn] = useState(() => hasAccessToken());
  const [userRole,   setUserRole]   = useState('recepcion');
  const [token,      setToken]      = useState(getAccessToken());
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

  // Initial sync from backend when authenticated
  useEffect(() => {
    if (!token) return;

    let alive = true;
    const currentRole = deriveAppRole(token);

    (async () => {
      try {
        const empresasRequest = currentRole === 'admin' ? getEmpresas() : getEmpresasRecepcion();
        const historialRequest = currentRole === 'admin' ? getAlquileresHistorial() : Promise.resolve([]);

        const [
          habitacionesRes,
          tarifasRes,
          tiposHabRes,
          tiposAlqRes,
          empresasRes,
          clientesRes,
          activosRes,
          historialRes,
          resumenRes,
        ] = (await Promise.allSettled([
          getHabitaciones(),
          getTarifas(),
          getTiposHabitacion(),
          getTiposAlquiler(),
          empresasRequest,
          getClientes(),
          getAlquileresActivos(),
          historialRequest,
          getResumenHoy(),
        ])).map(r => r.status === 'fulfilled' ? r.value : null);

        if (!alive) return;
        if (Array.isArray(habitacionesRes)) setHabitaciones(habitacionesRes);
        if (Array.isArray(tarifasRes)) setTarifas(tarifasRes);
        if (Array.isArray(tiposHabRes)) setTiposHabitacion(tiposHabRes);
        if (Array.isArray(tiposAlqRes)) setTiposAlquiler(tiposAlqRes);
        if (Array.isArray(empresasRes)) setEmpresas(empresasRes);
        if (Array.isArray(clientesRes)) setClientes(clientesRes);
        const hasActivos = Array.isArray(activosRes);
        const hasHistorial = Array.isArray(historialRes);
        if (hasActivos || hasHistorial) {
          const alquileresMerged = [
            ...(hasActivos ? activosRes : []),
            ...(hasHistorial ? historialRes : []),
          ];
          setAlquileres(alquileresMerged);
        }
        if (Array.isArray(resumenRes)) {
          setMovimientosCaja(resumenRes);
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('Error en sincronización inicial con el backend:', err);
      }
    })();

    return () => {
      alive = false;
    };
  }, [token]);

  // ── Tipos Habitación CRUD ──────────────────────────────────────────
  const addTipoHabitacion = useCallback(async (d) => {
    const created = await postTipoHabitacion(d);
    setTiposHabitacion(p => [...p, created]);
  }, []);

  const updateTipoHabitacion = useCallback(async (id, d) => {
    const updated = await putTipoHabitacion(id, d);
    setTiposHabitacion(p => p.map(t => t.id === id ? updated : t));
  }, []);

  const deleteTipoHabitacion = useCallback(async (id) => {
    await deleteTipoHabitacionAPI(id);
    setTiposHabitacion(p => p.filter(t => t.id !== id));
  }, []);

  // ── Tipos Alquiler CRUD ────────────────────────────────────────────
  const addTipoAlquiler = useCallback(async (d) => {
    const created = await postTipoAlquiler(d);
    setTiposAlquiler(p => [...p, created]);
  }, []);

  const updateTipoAlquiler = useCallback(async (id, d) => {
    const updated = await putTipoAlquiler(id, d);
    setTiposAlquiler(p => p.map(t => t.id === id ? updated : t));
  }, []);

  const deleteTipoAlquiler = useCallback(async (id) => {
    await deleteTipoAlquilerAPI(id);
    setTiposAlquiler(p => p.filter(t => t.id !== id));
  }, []);

  // ── Tarifas CRUD ───────────────────────────────────────────────────
  const addTarifa = useCallback(async (d) => {
    const created = await postTarifa(d);
    setTarifas(p => [...p, created]);
  }, []);

  const updateTarifa = useCallback(async (id, d) => {
    const updated = await putTarifa(id, d);
    setTarifas(p => p.map(t => t.id === id ? updated : t));
  }, []);

  const deleteTarifa = useCallback(async (id) => {
    await deleteTarifaAPI(id);
    setTarifas(p => p.filter(t => t.id !== id));
  }, []);

  const incrementarTarifasPorcentaje = useCallback(async (porcentaje) => {
    const updated = await patchIncrementoTarifas(porcentaje);
    setTarifas(updated);
    return updated;
  }, []);

  // ── Habitaciones CRUD ──────────────────────────────────────────────
  const addHabitacion = useCallback(async (d) => {
    const created = await postHabitacion(d);
    setHabitaciones(p => [...p, created]);
  }, []);

  const updateHabitacion = useCallback(async (id, d) => {
    const updated = await putHabitacion(id, d);
    setHabitaciones(p => p.map(h => h.id === id ? updated : h));
  }, []);

  const deleteHabitacion = useCallback(async (id) => {
    await deleteHabitacionAPI(id);
    setHabitaciones(p => p.filter(h => h.id !== id));
  }, []);

  const cambiarEstado = useCallback(async (id, estado) => {
    await patchEstadoHabitacion(id, estado);
    setHabitaciones(p => p.map(h => h.id === id ? { ...h, estado } : h));
  }, []);

  // ── Empresas CRUD ──────────────────────────────────────────────────
  const addEmpresa = useCallback(async (d) => {
    const created = await postEmpresa(d);
    setEmpresas(p => [...p, created]);
  }, []);

  const updateEmpresa = useCallback(async (id, d) => {
    const updated = await putEmpresa(id, d);
    setEmpresas(p => p.map(e => e.id === id ? updated : e));
    try {
      const activos = await getAlquileresActivos();
      setAlquileres(p => {
        const activosMap = new Map(activos.map(a => [a.id, a]));
        return p.map(a => activosMap.has(a.id) ? activosMap.get(a.id) : a);
      });
    } catch (_) {}
  }, []);

  const deleteEmpresa = useCallback(async (id) => {
    await deleteEmpresaAPI(id);
    setEmpresas(p => p.filter(e => e.id !== id));
  }, []);

  // ── Clientes CRUD ──────────────────────────────────────────────────
  const addCliente = useCallback(async (d) => {
    const created = await postCliente(d);
    setClientes(p => [...p, created]);
    return created;
  }, []);

  const updateCliente = useCallback(async (id, d) => {
    const updated = await putCliente(id, d);
    setClientes(p => p.map(c => c.id === id ? updated : c));
    try {
      const activos = await getAlquileresActivos();
      setAlquileres(p => {
        const activosMap = new Map(activos.map(a => [a.id, a]));
        return p.map(a => activosMap.has(a.id) ? activosMap.get(a.id) : a);
      });
    } catch (_) {}
    return updated;
  }, []);

  const deleteCliente = useCallback(async (id) => {
    await deleteClienteAPI(id);
    setClientes(p => p.filter(c => c.id !== id));
  }, []);

  // ── Check-in / Check-out ────────────────────────────────────────────
  const checkIn = useCallback(async (checkInData) => {
    const result = await postCheckIn(checkInData);
    setAlquileres(p => [...p, result]);
    setHabitaciones(p => p.map(h =>
      h.id === checkInData.idHabitacion ? { ...h, estado: 'OCUPADA' } : h
    ));
  }, []);

  const checkOut = useCallback(async (alquilerId, metodoPago) => {
    const updated = await postCheckOut(alquilerId, metodoPago || undefined);
    setAlquileres(p => p.map(a => a.id === alquilerId ? updated : a));
    setHabitaciones(p => p.map(h =>
      h.numero === updated.numeroHabitacion ? { ...h, estado: updated.estadoHabitacion } : h
    ));
  }, []);

  const refreshAlquiler = useCallback(async (id) => {
    try {
      const updated = await getAlquiler(id);
      setAlquileres(p => p.map(a => a.id === id ? updated : a));
      return updated;
    } catch (err) {
      if (import.meta.env.DEV) console.error('Error al refrescar alquiler:', err);
    }
  }, []);

  const refetchAlquileres = useCallback(async () => {
    try {
      const currentRole = deriveAppRole(token);
      const [activosRes, historialRes] = await Promise.allSettled([
        getAlquileresActivos(),
        currentRole === 'admin' ? getAlquileresHistorial() : Promise.resolve([]),
      ]);
      const merged = [
        ...(activosRes.status === 'fulfilled' && Array.isArray(activosRes.value) ? activosRes.value : []),
        ...(historialRes.status === 'fulfilled' && Array.isArray(historialRes.value) ? historialRes.value : []),
      ];
      setAlquileres(merged);
    } catch (err) {
      if (import.meta.env.DEV) console.error('Error al refrescar alquileres:', err);
    }
  }, [token]);

  // ── Derived: unique pisos from habitaciones ────────────────────────
  const pisos = [...new Set(habitaciones.map(h => h.piso))].sort((a, b) => a - b);

  // ── Provider value ─────────────────────────────────────────────────
  return (
    <HotelContext.Provider value={{
      // Tipos
      tiposHabitacion, addTipoHabitacion, updateTipoHabitacion, deleteTipoHabitacion,
      tiposAlquiler,   addTipoAlquiler,   updateTipoAlquiler,   deleteTipoAlquiler,
      tiposDocumento,

      // Tarifas
      tarifas, addTarifa, updateTarifa, deleteTarifa, incrementarTarifasPorcentaje,

      // Habitaciones
      habitaciones, addHabitacion, updateHabitacion, deleteHabitacion, cambiarEstado,
      pisos,

      // Empresas (was "sucursales" / "empresa")
      empresas, addEmpresa, updateEmpresa, deleteEmpresa,

      // Clientes
      clientes, addCliente, updateCliente, deleteCliente,

      // Alquileres (check-in / check-out)
      alquileres, checkIn, checkOut, refreshAlquiler, refetchAlquileres,

      // Caja
      movimientosCaja,

      // Auth
      isLoggedIn, userRole, token, userName, login, logout,
    }}>
      {children}
    </HotelContext.Provider>
  );
}

export const useHotel = () => {
  const ctx = useContext(HotelContext);
  if (!ctx) throw new Error('useHotel must be inside HotelProvider');
  return ctx;
};
