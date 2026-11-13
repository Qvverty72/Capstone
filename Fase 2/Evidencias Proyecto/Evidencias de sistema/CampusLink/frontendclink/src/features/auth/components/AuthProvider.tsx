/**
 * Proveedor de contexto de autenticación montado en el layout raíz.
 * Ejecuta useAuthSession una vez y comparte su resultado mediante children;
 * los consumidores useAuth leen esa misma instancia de estado.
 */
import type { ReactNode } from 'react';
import { AuthContext } from '../hooks/useAuth';
import { useAuthSession } from '../hooks/useAuthSession';

/** Expone el estado de autenticación compartido al árbol de navegación. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuthSession();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}
