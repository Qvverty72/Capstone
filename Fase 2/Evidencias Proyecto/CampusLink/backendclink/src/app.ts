/**
 * Fábrica HTTP: combina seguridad, cuotas, parseo, rutas y errores sin escuchar.
 * AppDependencies permite sustituir consultas, almacén de cuotas y readiness
 * en pruebas; crear la app no demuestra que las bases estén disponibles.
 */
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import type { Express } from 'express';

import { apiErrorHandler } from './shared/http/error-handler.js';
import { notFoundHandler } from './shared/http/error-handler.js';
import { createApiRouter } from './routes/index.js';
import type { ActiveMapLookup } from './modules/maps/services/map.service.js';
import type { ActivityDependencies } from './modules/activities/services/activities.service.js';
import { createRateLimits } from './shared/http/rate-limit.middleware.js';
import type { RateLimitStore } from './shared/rate-limit/rate-limit.js';
import type { DependencyReadiness } from './shared/health/readiness.js';
import { env } from './config/env.js';

export interface AppDependencies {
  getActiveMap?: ActiveMapLookup;
  activities?: ActivityDependencies;
  diagnosticsEnabled?: boolean;
  rateLimitStore?: RateLimitStore;
  readiness?: () => Promise<DependencyReadiness>;
}

/**
 * Ensambla middleware y rutas HTTP sin iniciar conexiones ni abrir el puerto.
 * La separación permite montar la aplicación con dependencias simuladas en pruebas.
 */
export function createApp(dependencies: AppDependencies = {}): Express {
  const app = express();
/**
 * El número de proxies confiables determina cómo Express calcula la IP.
 * Las cuotas por origen dependen de esa IP, por lo que debe coincidir con el despliegue.
 */
  app.set('trust proxy', env.trustProxyHops);

  app.use(helmet());
  app.use(cors({ preflightContinue: true, exposedHeaders: ['Retry-After'],
    origin: (origin, callback) => callback(null,
      env.nodeEnv !== 'production' && env.corsAllowedOrigins.length === 0 ? '*'
        : !origin || env.corsAllowedOrigins.includes(origin)),
  }));
  const limits = createRateLimits(dependencies.rateLimitStore);
  app.locals.rateLimitIdentity = limits.identity;
  app.use('/api/v1', (request, response, next) => {
    // Health y ready deben poder responder aunque Redis o las cuotas estén caídos.
    if (['GET', 'HEAD'].includes(request.method) && /^\/(health|ready)\/?$/i.test(request.path)) next();
    else void limits.origin(request, response, next);
  });
  app.options(/.*/, (_request, response) => { response.sendStatus(204); });
  const jsonParser = express.json();
  app.use((request, response, next) => {
    // Las publicaciones analizan sus cargas acotadas después de autenticar.
    if (request.method === 'POST' && (/^\/api\/v1\/marketplace\/physicalgoods(?:\/[^/]+\/images)?\/?$/i.test(request.path)
      || /^\/api\/v1\/marketplace\/elibrary(?:\/[^/]+\/files)?\/?$/i.test(request.path))) next();
    else jsonParser(request, response, next);
  });
  app.use('/api/v1', createApiRouter(dependencies));
/**
 * El orden es significativo: primero se resuelven rutas y después los 404.
 * El manejador de errores va al final para traducir fallos de las capas anteriores.
 */
  app.use(notFoundHandler);
  app.use(apiErrorHandler);

  return app;
}

export const app = createApp();
