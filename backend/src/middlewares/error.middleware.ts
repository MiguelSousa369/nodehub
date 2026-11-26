import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import { HttpError } from '../utils/http-error';
import logger from '../utils/logger';

export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Invalid request.', code: 'VALIDATION_ERROR', details: err.issues });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }

  // Malformed JSON body (thrown by express.json)
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'Malformed JSON body.', code: 'INVALID_JSON' });
    return;
  }

  // Unexpected errors: details go to the log only, never to the client (they can include SQL,
  // file paths or library internals). Look them up in backend/logs/error.log.
  if (err instanceof Error) {
    logger.error('Unhandled error', { message: err.message, stack: err.stack });
    res.status(500).json({ error: 'Internal server error. Details are in the server log.', code: 'INTERNAL_ERROR' });
    return;
  }

  logger.error('Unhandled non-Error value', { err });
  res.status(500).json({ error: 'Internal server error.', code: 'INTERNAL_ERROR' });
}
