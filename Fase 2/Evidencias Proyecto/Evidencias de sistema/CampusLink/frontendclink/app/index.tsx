/**
 * Ruta inicial sin pantalla propia: deriva el destino del estado de autenticación.
 * El layout comparte la sesión; el destino login presenta los estados de carga,
 * configuración o rechazo cuando la identidad todavía no está lista.
 */
import { Redirect } from 'expo-router';
import { useAuth } from '@/features/auth/hooks/useAuth';

/** Envía al usuario a perfil si su identidad está lista o al acceso en los demás estados. */
export default function IndexRedirect() {
  const auth = useAuth();
  return <Redirect href={auth.status === 'ready' ? '/profile' : '/login'} />;
}
