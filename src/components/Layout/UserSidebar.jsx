import { Link, useLocation } from 'react-router-dom';
import { LogOut, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

// Dropdown flotante pequeño para menú de usuario
export default function UserSidebar({ open, onClose }) {
  const { logout } = useAuth();
  const { pathname } = useLocation();
  if (!open) return null;

  const isActive = (to) => (to === '/' ? pathname === '/' : pathname.startsWith(to));

  return (
    <div
      className="user-dropdown"
      style={{
        position: 'absolute',
        top: 56, // justo debajo del header
        right: 24,
        minWidth: 210,
        background: 'var(--surface)',
        boxShadow: '0 4px 24px #0003',
        borderRadius: 12,
        padding: '10px 0 6px 0',
        zIndex: 200,
        border: '1px solid var(--border)',
        display: open ? 'block' : 'none',
        animation: 'fadeIn .18s',
      }}
      onClick={onClose}
    >
      <Link
        to="/perfil"
        className="user-dropdown-item"
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 22px', borderRadius: 8,
          background: isActive('/perfil') ? 'var(--side-active-bg)' : 'transparent',
          color: isActive('/perfil') ? 'var(--accent-dark)' : 'var(--text-2)',
          fontWeight: isActive('/perfil') ? 700 : 500,
          marginBottom: 2,
          transition: 'background .12s',
          textDecoration: 'none',
        }}
        onClick={e => { e.stopPropagation(); onClose(); }}
      >
        <span style={{background: isActive('/perfil') ? 'var(--accent)' : 'var(--surface-2)', color: isActive('/perfil') ? '#fff' : 'var(--text-muted)', borderRadius: 6, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <User size={16} />
        </span>
        <span>
          <span style={{fontSize:13}}>Mi Perfil</span>
          <span style={{fontSize:10, color:'var(--text-xmuted)', display:'block'}}>Datos de tu cuenta</span>
        </span>
      </Link>
      <div style={{ height: 1, background: 'var(--border)', margin: '8px 16px 0' }} />
      <button
        type="button"
        onClick={e => { e.stopPropagation(); logout(); }}
        style={{
          margin: '8px 16px 0 16px', padding: '10px 0', width: 'calc(100% - 32px)',
          background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', fontSize: 13,
          boxShadow: '0 1px 4px #0001',
        }}
      >
        <LogOut size={16} />
        Cerrar sesión
      </button>
    </div>
  );
}
