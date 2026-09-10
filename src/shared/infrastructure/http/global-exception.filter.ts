import { Catch, ExceptionFilter, ArgumentsHost, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { DomainError } from "../../domain/errors/domain.error.js";

@Catch()
export class GlobalExceptionFilter
  implements ExceptionFilter
{
  private readonly logger =
    new Logger(GlobalExceptionFilter.name);

  catch(
    exception: unknown,
    host: ArgumentsHost,
  ) {
    const response =
      host
        .switchToHttp()
        .getResponse();

    if (
      exception instanceof
      HttpException
    ) {
      const status =
        exception.getStatus();

      const body =
        exception.getResponse();

      response
        .status(status)
        .json({
          statusCode: status,
          error: body,
        });

      return;
    }

    if (
      exception instanceof
      DomainError
    ) {
      const status =
        this.mapDomainError(
          exception.code,
        );

      response
        .status(status)
        .json({
          statusCode: status,

          code:
            exception.code,

          message:
            exception.message,
        });

      return;
    }

    this.logger.error(
      'Unhandled exception',
      exception instanceof Error
        ? exception.stack
        : String(exception),
    );

    response
      .status(
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
      .json({
        statusCode:
          HttpStatus.INTERNAL_SERVER_ERROR,

        code:
          'INTERNAL_ERROR',

        message:
          'Internal server error',
      });
  }

  private mapDomainError(
    code: string,
  ): number {
    switch (code) {
      case 'RESOURCE_NOT_FOUND':
        return 404;

      case 'IDEMPOTENCY_CONFLICT':
        return 409;

      case 'WALLET_ALREADY_EXISTS':
        return 409;

      case 'INSUFFICIENT_FUNDS':
        return 422;

      case 'CURRENCY_MISMATCH':
        return 422;

      default:
        return 400;
    }
  }
}