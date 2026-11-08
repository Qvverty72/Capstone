/**
 * Estado local del formulario de acceso; no decide roles ni navega por sí mismo.
 * El cliente API instala la sesión y el provider reacciona a su cambio.
 * La contraseña se descarta en finally tanto si el intento funciona como si falla.
 */
import { useState } from 'react';
import { Keyboard } from 'react-native';
import { useAuth } from './useAuth';
import { loginAccount } from '../api/sessionApi';

/** Mantiene el formulario de acceso, valida campos y descarta la contraseña tras enviar. */
export function useLogin() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

/**
 * Normaliza correo, comprueba campos y evita reenvíos mientras está ocupado.
 * Devuelve: Promesa sin datos; expone cualquier fallo como estado error para la pantalla.
 */
  async function submit() {
    if (busy || auth.status === 'loading') return;
    setError(null);
    const address = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || !password) {
      setError('Ingresa tu correo y contraseña.'); return;
    }
    Keyboard.dismiss();
    setBusy(true);
    try { await loginAccount(address, password); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo iniciar sesión.'); }
    finally { setPassword(''); setBusy(false); }
  }

  return { auth, email, setEmail, password, setPassword, busy, setBusy, error, submit };
}
