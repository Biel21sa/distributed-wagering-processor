import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

import {
  EntityManager,
} from '@mikro-orm/postgresql';

@Controller('health')
export class HealthController {
  constructor(
    private readonly em:
      EntityManager,
  ) {}

  @Get('live')
  live() {
    return {
      status: 'ok',
    };
  }

  @Get('ready')
  async ready() {
    try {
      await this.em.getConnection()
        .execute(
          'SELECT 1',
        );

      return {
        status: 'ok',
        postgres: 'up',
        sqs: 'unknown',
      };
    } catch {
      throw new HttpException(
        {
          status: 'error',
          postgres: 'down',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}