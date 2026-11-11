import type { ErrorRequestHandler, RequestHandler } from 'express';
import { MongoError } from 'mongodb';
import { logEvent } from '../observability/logger.js';

import { ApiError } from '../errors/api-error.js';
import { sendApiError } from './api-response.js';

interface BodyParserError extends Error {
  type?: string;
}

function isInvalidJson(error: unknown): error is BodyParserError {
  return (
    error instanceof Error &&
    'type' in error &&
    error.type === 'entity.parse.failed'
  );
}

function isPayloadTooLarge(error: unknown): error is BodyParserError {
  return error instanceof Error && 'type' in error && error.type === 'entity.too.large';
}

/** Convierte errores de aplicación y del analizador JSON al contrato público de la API. */
export const apiErrorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  next,
) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  if (isInvalidJson(error)) {
    sendApiError(response, 400, 'VALIDATION_ERROR', 'Request validation failed.', [
      { field: 'body', message: 'Request body must contain valid JSON.' },
    ]);
    return;
  }

  if (isPayloadTooLarge(error)) {
    sendApiError(response, 413, 'PAYLOAD_TOO_LARGE', 'Request body exceeds the size limit.');
    return;
  }

  if (error instanceof MongoError) {
    logEvent('error', 'api.dependency_unavailable', { requestId: response.locals.requestId, errorKind: 'mongodb' });
    sendApiError(response, 503, 'DEPENDENCY_UNAVAILABLE', 'Service temporarily unavailable.');
    return;
  }

  if (error instanceof ApiError) {
    if (error.status === 429 && error.retryAfterSeconds !== undefined) {
      response.setHeader('Retry-After', String(error.retryAfterSeconds));
    }

    if (error.status === 500) {
      logEvent('error', 'api.unhandled_error', { requestId: response.locals.requestId, errorKind: 'application' });
      sendApiError(
        response,
        500,
        'INTERNAL_SERVER_ERROR',
        'Internal server error.',
      );
      return;
    }

    if (error.status === 503) {
      logEvent('error', 'api.dependency_unavailable', { requestId: response.locals.requestId, errorKind: 'dependency' });
      sendApiError(
        response,
        503,
        error.code,
        'Service temporarily unavailable.',
      );
      return;
    }

    sendApiError(response, error.status, error.code, error.message, error.details);
    return;
  }

  logEvent('error', 'api.unhandled_error', { requestId: response.locals.requestId, errorKind: 'unexpected' });
  sendApiError(
    response,
    500,
    'INTERNAL_SERVER_ERROR',
    'Internal server error.',
  );
};

/** Conserva el 404 de rutas ajenas a la API versionada. */
export const notFoundHandler: RequestHandler = (_request, _response, next) => {
  next(new ApiError(404, 'NOT_FOUND', 'Route not found.'));
};
