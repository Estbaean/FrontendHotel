import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { HotelProvider } from './context/HotelContext';
import { TooltipProvider, ToastProvider } from './components/UI/index.jsx';
import Layout from './components/Layout/Layout.jsx';
import Login from './pages/Login';
import RecepcionGeneral from './pages/RecepcionGeneral';
import Habitaciones from './pages/Habitaciones';
import Tarifas from './pages/Tarifas';
import Caja from './pages/Caja';
import Empresa from './pages/Empresa';
import Clientes from './pages/Clientes';
import Configuracion from './pages/Configuracion';
import Alquileres from './pages/Alquileres';
import Usuarios from './pages/Usuarios';
import Perfil from './pages/Perfil';

function AppContent() {
  const { isLoggedIn, userRole } = useAuth();

  const RequireAdmin = ({ children }) => {
    if (userRole !== 'admin') {
      return <Navigate to="/" replace />;
    }
    return children;
  };

  if (!isLoggedIn) {
    return <Login />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<RecepcionGeneral />} />
          <Route path="habitaciones" element={<Habitaciones />} />
          <Route path="configuracion" element={<RequireAdmin><Configuracion /></RequireAdmin>} />
          <Route path="tarifas" element={<RequireAdmin><Tarifas /></RequireAdmin>} />
          <Route path="caja" element={<RequireAdmin><Caja /></RequireAdmin>} />
          <Route path="empresa" element={<RequireAdmin><Empresa /></RequireAdmin>} />
          <Route path="clientes" element={<Clientes />} />

          <Route path="alquileres" element={<Alquileres />} />
          <Route path="usuarios" element={<RequireAdmin><Usuarios /></RequireAdmin>} />
          <Route path="perfil" element={<Perfil />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <HotelProvider>
        <TooltipProvider>
          <ToastProvider>
            <AppContent />
          </ToastProvider>
        </TooltipProvider>
      </HotelProvider>
    </AuthProvider>
  );
}

