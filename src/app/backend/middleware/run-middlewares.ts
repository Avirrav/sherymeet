import { NextRequest } from 'next/server';
import { AuthenticatedRequest, AppMiddleware } from '../types/auth.types';
import { errorHandlerMiddleware } from './error-handler.middleware';

/**
 * Higher-order runner that sequences an array of AppMiddleware functions,
 * catching any exceptions and routing them to the global error handler.
 */
export function runMiddlewares(
  middlewares: AppMiddleware[],
  handler: (req: AuthenticatedRequest) => Promise<Response>
) {
  return async (req: NextRequest): Promise<Response> => {
    const authReq = req as AuthenticatedRequest;
    let index = 0;
    const next = async (): Promise<Response> => {
      if (index < middlewares.length) {
        const middleware = middlewares[index++];
        return await middleware(authReq, next);
      }
      return await handler(authReq);
    };

    try {
      return await next();
    } catch (err) {
      return await errorHandlerMiddleware(authReq, err as Error);
    }
  };
}
