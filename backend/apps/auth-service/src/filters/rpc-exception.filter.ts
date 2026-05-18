import { Catch, HttpException, Logger, RpcExceptionFilter } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';

/**
 * Exception filter for RPC (microservice) layer.
 * Converts NestJS HTTP exceptions to RPC-compatible format that preserves status codes.
 */
@Catch()
export class MicroserviceRpcExceptionFilter implements RpcExceptionFilter<any> {
  private readonly logger = new Logger(MicroserviceRpcExceptionFilter.name);

  catch(exception: any): Observable<any> {
    // If it's an HttpException (including UnauthorizedException), serialize properly
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();

      // Return as RPC error with proper statusCode
      return throwError(() => ({
        statusCode: status,
        message:
          typeof response === 'object' && 'message' in response
            ? response.message
            : exception.message,
        error:
          typeof response === 'object' && 'error' in response
            ? response.error
            : exception.name,
      }));
    }

    // For non-HTTP exceptions, still return with error format
    return throwError(() => ({
      statusCode: 500,
      message: exception.message || 'Internal server error',
      error: exception.name || 'Error',
    }));
  }
}
