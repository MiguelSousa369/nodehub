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

  if (err instanceof Error) {
    logger.error('Unhandled error', { message: err.message, stack: err.stack });
    res.status(500).json({
      error: process.env.NODE_ENV === 'production' ? 'Internal server error.' : err.message,
      code : 'INTERNAL_ERROR',
    });
    return;
  }

  logger.error('Unhandled non-Error value', { err });
  res.status(500).json({ error: 'Internal server error.', code: 'INTERNAL_ERROR' });
}
