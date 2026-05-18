import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

/**
 * Catches errors thrown by NestJS TCP microservice calls (via ClientProxy.send).
 * Microservice exceptions arrive as plain objects with statusCode/message fields.
 * Without this filter they would be treated as unhandled errors and return 500.
 */
@Catch()
export class RpcToHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(RpcToHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    // Already a proper HTTP exception – let default behaviour handle it
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      return response.status(status).json(body);
    }

    // Microservice TCP errors come back as plain objects like:
    // { statusCode: 401, message: 'Invalid credentials', error: 'Unauthorized' }
    if (typeof exception === 'object' && exception !== null) {
      const err = exception as Record<string, unknown>;
      
      // First check for statusCode (from properly serialized RPC errors)
      if (typeof err['statusCode'] === 'number') {
        const statusCode = err['statusCode'] as number;
        if (statusCode >= 100 && statusCode < 600) {
          const message =
            typeof err['message'] === 'string'
              ? err['message']
              : 'An unexpected error occurred';
          return response.status(statusCode).json({
            statusCode,
            message,
            error: err['error'] ?? HttpStatus[statusCode] ?? 'Error',
          });
        }
      }
      
      // Fallback: default to 500 for other object formats
      const message =
        typeof err['message'] === 'string'
          ? err['message']
          : 'Internal server error';

      return response.status(500).json({
        statusCode: 500,
        message,
        error: HttpStatus[500] ?? 'Error',
      });
    }

    console.error('[RpcToHttpExceptionFilter] Handling as unhandled exception');
    this.logger.error('Unhandled exception', exception);
    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    });
  }
}
