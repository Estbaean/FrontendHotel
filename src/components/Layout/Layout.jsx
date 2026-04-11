import { useState } from 'react';
import Sidebar from './Sidebar';
import Header  from './Header';
import UserSidebar from './UserSidebar';
import { Outlet } from 'react-router-dom';
import s from './Layout.module.css';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userSidebarOpen, setUserSidebarOpen] = useState(false);

  return (
    <div className={s.appLayout}>
      {/* Mobile overlay solo para sidebar */}
      {sidebarOpen && (
        <div className={s.sidebarOverlay} onClick={() => setSidebarOpen(false)} />
      )}
      {/* Eliminado overlay para userSidebar (dropdown de perfil) */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <UserSidebar open={userSidebarOpen} onClose={() => setUserSidebarOpen(false)} />
      <div className={s.appMain}>
        <Header
          onMenuToggle={() => setSidebarOpen(o => !o)}
          onUserToggle={() => setUserSidebarOpen((o) => !o)}
        />
        <main className={s.appContent}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
