/**
 * Frontera HTTP de sesión, registro institucional y recuperación con OTP.
 * Las rutas públicas intercambian credenciales; completar registro requiere
 * identidad confirmada y /me requiere además contexto de cuenta.
 */
import { createPolicyRouter, publicEndpoint } from '../../shared/http/endpoint-policy.js';
import type { Router } from 'express';
import { loginAccountController, recoverAccountController, resetAccountPasswordController, completeInstitutionalRegistrationController, confirmInstitutionalRegistrationController, getAuthHealthController, getAuthIdentityController, getRegistrationOptionsController, registerInstitutionalAccountController, resendInstitutionalConfirmationController } from './controllers/auth.controller.js';
import { requireAuthentication, requireVerifiedIdentity } from './middleware/auth.middleware.js';

// Salud es un diagnóstico público optativo. `/me` requiere identidad y devuelve solo su contexto.
/**
 * Devuelve un router con política declarada en cada endpoint.
 * El parámetro de diagnóstico solo agrega /health; la composición superior
 * restringe su activación al entorno de desarrollo.
 */
export function createAuthRouter(diagnosticsEnabled: boolean): Router {
  const router = createPolicyRouter();
  if (diagnosticsEnabled) router.get('/health', publicEndpoint, getAuthHealthController);
  // Intercambios públicos de credenciales; Auth valida contraseñas y el OTP de recuperación temporal.
  router.post('/login', publicEndpoint, loginAccountController);
  router.post('/recover', publicEndpoint, recoverAccountController);
  router.post('/recover/confirm', publicEndpoint, resetAccountPasswordController);
  router.get('/registration-options', publicEndpoint, getRegistrationOptionsController);
  router.post('/register', publicEndpoint, registerInstitutionalAccountController);
  router.post('/register/confirm', publicEndpoint, confirmInstitutionalRegistrationController);
  router.post('/register/resend', publicEndpoint, resendInstitutionalConfirmationController);
  router.post('/register/complete', requireVerifiedIdentity, completeInstitutionalRegistrationController);
  router.get('/me', requireAuthentication, getAuthIdentityController);
  return router;
}
