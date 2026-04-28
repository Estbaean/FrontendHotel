import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Btn } from '../../components/UI/index.jsx';
import { Label } from '@radix-ui/react-label';
import { LogIn, Loader2 } from 'lucide-react';
import { login as apiLogin } from '../../auth/api';
import c from './Login.module.css';

export default function Login() {
  const { login } = useAuth();
  const [dni, setDni] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!dni.trim() || !password.trim()) {
      setError('Por favor, ingresa tu DNI y contraseña');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const authResponse = await apiLogin({ numDocumento: dni.trim(), password });
      login(authResponse);
    } catch (err) {
      const msg = err?.response?.data?.message
        || err?.response?.data?.error
        || 'Credenciales inválidas o servidor no disponible';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={c.wrapper}>
      <div className={c.container}>

        {/* Panel izquierdo — marca */}
        <div className={c.brand}>
          <img src="/arroyo hospedaje.jpg" alt="Hospedaje ARROYO" className={c.logo} />
          <h1 className={c.brandTitle}>Hospedaje ARROYO</h1>
          <p className={c.brandSub}>Sistema de gestión hotelera</p>
        </div>

        {/* Panel derecho — formulario */}
        <div className={c.formPanel}>
          <h2 className={c.title}>Bienvenido</h2>
          <p className={c.subtitle}>Ingresa tus credenciales para acceder</p>

          <form onSubmit={handleSubmit}>
            <div className={c.group}>
              <Label htmlFor="dni" className={c.fieldLabel}>DNI</Label>
<input id="dni" type="text" className={c.input} value={dni} onChange={(e) => setDni(e.target.value)} placeholder="12345678" inputMode="numeric" maxLength={8} pattern="[0-9]{8}" autoComplete="username" />
            </div>

            <div className={c.groupLast}>
              <Label htmlFor="password" className={c.fieldLabel}>Contraseña</Label>
              <input id="password" type="password" className={c.input} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>

            {error && <div className={c.error}>{error}</div>}

            <Btn type="submit" full icon={loading ? <Loader2 size={16} className="spin" /> : <LogIn size={16} />} disabled={loading}>
              {loading ? 'Ingresando…' : 'Iniciar Sesión'}
            </Btn>
          </form>
        </div>

      </div>
    </div>
  );
}