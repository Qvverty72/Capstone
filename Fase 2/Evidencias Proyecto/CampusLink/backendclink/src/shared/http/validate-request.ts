/**
 * Adaptador entre parsers de datos desconocidos y controladores Express.
 * Acumula errores de params/query/body; solo publica resultados normalizados
 * en response.locals si todas las secciones configuradas son válidas.
 */
import type { RequestHandler, Response } from 'express';

import { ApiError } from '../errors/api-error.js';
import type {
  ApiErrorDetail,
  RequestParser,
  RequestSection,
  ValidatedRequest,
} from './api.types.js';

export type RequestParsers = Partial<Record<RequestSection, RequestParser>>;

/** Valida las secciones configuradas antes del controlador y reúne los errores en una respuesta. */
export function validateRequest(parsers: RequestParsers): RequestHandler {
  return (request, response, next) => {
    const parsed: ValidatedRequest = {};
    const issues: ApiErrorDetail[] = [];

    for (const section of ['params', 'query', 'body'] as const) {
      const parser = parsers[section];
      if (!parser) continue;

      const result = parser(request[section]);
      if (result.success) {
        parsed[section] = result.data;
      } else {
        issues.push(...result.issues);
      }
    }

    if (issues.length > 0) {
      next(
        new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed.', {
          details: issues,
        }),
      );
      return;
    }

    response.locals.validatedRequest = parsed;
    next();
  };
}

/** Lee los valores normalizados que dejó el `validateRequest` previo de la ruta. */
/**
 * El tipo genérico describe lo que la ruta debe haber validado; no valida por sí solo.
 * El controlador depende del orden de middleware para que locals contenga esos datos.
 * Devuelve: Datos ya normalizados, o lanza un error si falta el middleware previo.
 */
export function getValidatedRequest<T>(response: Response): T {
  const validatedRequest = response.locals.validatedRequest as T | undefined;
  if (validatedRequest === undefined) {
    throw new Error('Validated request data is unavailable.');
  }
  return validatedRequest;
}
