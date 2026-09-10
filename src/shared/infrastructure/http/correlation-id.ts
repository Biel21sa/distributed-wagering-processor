import {
  randomUUID,
} from 'node:crypto';

import {
  Injectable,
  NestMiddleware,
} from '@nestjs/common';

import {
  Request,
  Response,
  NextFunction,
} from 'express';

@Injectable()
export class CorrelationIdMiddleware
  implements NestMiddleware
{
  use(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    const correlationId =
      req.header(
        'x-correlation-id',
      ) ?? randomUUID();

    req.headers[
      'x-correlation-id'
    ] = correlationId;

    res.setHeader(
      'x-correlation-id',
      correlationId,
    );

    next();
  }
}