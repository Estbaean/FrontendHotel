import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Menu, UserCircle2, Clock } from 'lucide-react';
import ls from './Layout.module.css';

function useLiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const time = now.toLocaleTimeString('es-PE', { hour:'2-digit', minute:'2-digit' });
  const date = now.toLocaleDateString('es-PE', { weekday:'short', day:'numeric', month:'short' });
  return { time, date };
}

export default function Header({ onMenuToggle, onUserToggle }) {
  const { userRole } = useAuth();
  const { time, date } = useLiveClock();

  return (
    <header className={ls.appHeader}>
      <div style={s.left}>
        <button className={ls.menuToggle} onClick={onMenuToggle} style={{
          border: 'none', background: 'none', cursor: 'pointer', padding: 6,
          color: 'var(--text-muted)',
        }}>
          <Menu size={20} />
        </button>
      </div>

      <div className="header-actions" style={s.right}>
        <div className="clock-box" style={s.clock}>
          <Clock size={13} color="var(--accent)" strokeWidth={2.2} />
          <span style={s.clockTime}>{time}</span>
          <span style={s.clockDate}>{date}</span>
        </div>
        <span style={s.roleBadge}>
          {userRole === 'admin' ? 'Administrador' : 'Recepcionista'}
        </span>
        <button
          type="button"
          style={s.iconBtn}
          onClick={onUserToggle}
          title="Abrir panel de usuario"
          aria-label="Abrir panel de usuario"
        >
          <UserCircle2 size={18} color="var(--text-muted)" />
        </button>
      </div>
    </header>
  );
}

const s = {
  left: { display:'flex', alignItems:'center', gap:12 },
  right: { display:'flex', alignItems:'center', gap:10 },
  clock: {
    display:'flex', alignItems:'center', gap:6,
    padding:'5px 12px', borderRadius:'var(--r-md)',
    background:'var(--accent-light)', border:'1px solid var(--accent-mid)',
  },
  clockTime: { fontSize:13, fontWeight:700, color:'var(--accent-dark)', fontVariantNumeric:'tabular-nums' },
  clockDate: { fontSize:11, color:'var(--text-muted)', textTransform:'capitalize' },
  branchTrigger: {
    display:'inline-flex', alignItems:'center', gap:7,
    padding:'6px 11px', borderRadius:'var(--r-md)', cursor:'pointer',
    border:'1px solid var(--accent-mid)', background:'var(--accent-light)',
    fontSize:'12.5px', color:'var(--accent-dark)', fontFamily:'inherit',
    fontWeight:600, outline:'none', minWidth:150,
  },
  roleBadge: {
    fontSize: 12.5,
    fontWeight: 600,
    color: 'var(--text-2)',
    padding: '5px 11px',
    borderRadius: 'var(--r-sm)',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)',
    userSelect: 'none',
  },
  iconBtn: {
    width:32, height:32, borderRadius:'var(--r-md)',
    border:'1px solid var(--border)', background:'transparent',
    display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer',
  },
};
