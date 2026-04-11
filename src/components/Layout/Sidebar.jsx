import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, BedDouble, DollarSign, Hotel, Users, Building2, Settings, ClipboardList, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ls from './Layout.module.css';

export default function Sidebar({ open, onClose }) {
  const { userRole } = useAuth();
  const { pathname } = useLocation();

  const NAV_ADMIN = [
    { to:'/',                  icon:LayoutDashboard, label:'Recepción',         sub:'Vista general' },
    { to:'/caja',              icon:DollarSign,      label:'Caja',              sub:'Ingresos/Egresos' },
    { to:'/alquileres',        icon:ClipboardList,   label:'Alquileres',        sub:'Rentas activas' },
    { to:'/habitaciones',      icon:BedDouble,       label:'Habitaciones',      sub:'Gestión de cuartos' },
    { to:'/configuracion',     icon:Settings,        label:'Configuración',     sub:'Tipos hab. y alquiler' },
    { to:'/tarifas',           icon:DollarSign,      label:'Tarifas',           sub:'Precios' },
    { to:'/empresa',           icon:Building2,       label:'Empresas',          sub:'Empresas registradas' },
    { to:'/clientes',          icon:Users,           label:'Clientes',          sub:'Lista completa' },
  ];

  const NAV_RECEPCION = [
    { to:'/',             icon:LayoutDashboard, label:'Recepción',    sub:'Vista general' },
    { to:'/alquileres',   icon:ClipboardList,   label:'Alquileres',   sub:'Rentas activas' },
    { to:'/habitaciones', icon:BedDouble,       label:'Habitaciones', sub:'Estado cuartos' },
    { to:'/clientes',     icon:Users,           label:'Clientes',     sub:'Lista disponible' },
  ];

  const isActive = (to) => to === '/' ? pathname === '/' : pathname.startsWith(to);

  const NAV = userRole === 'admin' ? NAV_ADMIN : NAV_RECEPCION;
  return (
    <aside className={`${ls.sidebar}${open ? ` ${ls.sidebarOpen}` : ''}`}>
      <div style={s.logo}>
        <img src="/logo.png" alt="Hospedaje ARROYO" style={s.logoImg} onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
        <div style={{ ...s.logoMark, display: 'none' }}>
          <Hotel size={18} color="var(--accent)" strokeWidth={2} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={s.logoName}>Hospedaje ARROYO</div>
          <div style={s.logoTag}>Sistema de gestión</div>
        </div>
        <button className={ls.sidebarClose} onClick={onClose} style={{
          border: 'none', background: 'none', cursor: 'pointer', padding: 4,
          color: 'var(--text-muted)',
        }}>
          <X size={18} />
        </button>
      </div>

      <div style={s.divider} />

      {/* Navegación */}
      <nav style={s.nav}>
        <p style={s.groupLabel}>MÓDULOS</p>
        {NAV.map(({ to, icon: Icon, label, sub }) => {
          const active = isActive(to);
          return (
            <Link
              key={to}
              to={to}
              onClick={onClose}
              style={{
                ...s.item,
                background: active ? 'var(--side-active-bg)' : 'transparent',
              }}
            >
              <span style={{
                ...s.iconBox,
                background: active ? 'var(--accent)' : 'var(--surface-2)',
                color: active ? '#fff' : 'var(--text-muted)',
                boxShadow: active ? '0 0 8px rgba(212,134,12,.3)' : 'none',
              }}>
                <Icon size={14} strokeWidth={active ? 2.2 : 1.8} />
              </span>
              <span style={{ flex:1, minWidth:0 }}>
                <span style={{ display:'block', fontSize:13, fontWeight: active ? 700 : 500, color: active ? 'var(--accent-dark)' : 'var(--text-2)', lineHeight:1.2 }}>{label}</span>
                <span style={{ display:'block', fontSize:11, color:'var(--text-xmuted)', marginTop:2 }}>{sub}</span>
              </span>
              {active && (
                <span style={{
                  width:3, height:20, borderRadius:2,
                  background:'var(--accent)', flexShrink:0, marginLeft:4,
                  boxShadow:'0 0 6px rgba(212,134,12,.4)',
                }} />
              )}
            </Link>
          );
        })}

        {/* Divider for user section */}
        <div style={{ margin: '18px 0 8px', height: 1, background: 'var(--border)' }} />

        {/* User section at the bottom */}
        <div style={{ marginTop: 6 }}>
          <Link
            to="/perfil"
            onClick={onClose}
            style={{
              ...s.item,
              marginBottom: 2,
              background: isActive('/perfil') ? 'var(--side-active-bg)' : 'transparent',
            }}
          >
            <span style={{
              ...s.iconBox,
              background: isActive('/perfil') ? 'var(--accent)' : 'var(--surface-2)',
              color: isActive('/perfil') ? '#fff' : 'var(--text-muted)',
            }}>
              <Users size={14} strokeWidth={isActive('/perfil') ? 2.2 : 1.8} />
            </span>
            <span style={{ flex:1, minWidth:0 }}>
              <span style={{ display:'block', fontSize:13, fontWeight: isActive('/perfil') ? 700 : 500, color: isActive('/perfil') ? 'var(--accent-dark)' : 'var(--text-2)', lineHeight:1.2 }}>Perfil</span>
              <span style={{ display:'block', fontSize:11, color:'var(--text-xmuted)', marginTop:2 }}>Mi cuenta</span>
            </span>
          </Link>
          {userRole === 'admin' && (
            <Link
              to="/usuarios"
              onClick={onClose}
              style={{
                ...s.item,
                background: isActive('/usuarios') ? 'var(--side-active-bg)' : 'transparent',
              }}
            >
              <span style={{
                ...s.iconBox,
                background: isActive('/usuarios') ? 'var(--accent)' : 'var(--surface-2)',
                color: isActive('/usuarios') ? '#fff' : 'var(--text-muted)',
              }}>
                <Users size={14} strokeWidth={isActive('/usuarios') ? 2.2 : 1.8} />
              </span>
              <span style={{ flex:1, minWidth:0 }}>
                <span style={{ display:'block', fontSize:13, fontWeight: isActive('/usuarios') ? 700 : 500, color: isActive('/usuarios') ? 'var(--accent-dark)' : 'var(--text-2)', lineHeight:1.2 }}>Usuarios</span>
                <span style={{ display:'block', fontSize:11, color:'var(--text-xmuted)', marginTop:2 }}>Gestión de usuarios</span>
              </span>
            </Link>
          )}
        </div>
      </nav>
    </aside>
  );
}

const s = {
  logo: {
    display:'flex', alignItems:'center', gap:11,
    padding:'16px 16px 14px',
  },
  logoImg: {
    width:36, height:36, borderRadius:'var(--r-md)',
    objectFit:'contain', flexShrink:0,
  },
  logoMark: {
    width:32, height:32, borderRadius:'var(--r-md)',
    background:'var(--accent-light)', border:'1px solid var(--accent-mid)',
    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
    boxShadow:'0 0 0 4px rgba(212,134,12,.1)',
  },
  logoName: {
    fontSize:14, fontWeight:800, color:'var(--text)', letterSpacing:'-0.3px',
  },
  logoTag: {
    fontSize:10, color:'var(--text-xmuted)', marginTop:1,
  },
  divider: {
    height:1, background:'var(--border)', margin:'0 14px 8px',
  },
  nav: {
    flex:1, overflowY:'auto', padding:'0 8px 10px',
  },
  groupLabel: {
    fontSize:10, fontWeight:800, letterSpacing:'1.3px',
    color:'var(--text-xmuted)', padding:'6px 10px 8px',
    textTransform:'uppercase', margin:0,
  },
  item: {
    display:'flex', alignItems:'center', gap:8,
    padding:'8px 9px', borderRadius:'var(--r-md)',
    textDecoration:'none', marginBottom:2,
    transition:'background .12s ease',
  },
  itemActive: {
    background:'var(--side-active-bg)',
  },
  iconBox: {
    width:28, height:28, borderRadius:'var(--r-sm)',
    display:'flex', alignItems:'center', justifyContent:'center',
    flexShrink:0, transition:'all .15s ease',
  },
};

