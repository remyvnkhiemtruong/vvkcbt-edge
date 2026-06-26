import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Observable, from, throwError } from 'rxjs';
import { switchMap, tap, catchError } from 'rxjs/operators';
import { IdempotencyService } from './idempotency.service';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly idempotency: IdempotencyService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      body?: unknown;
    }>();
    const rawKey = req.headers['idempotency-key'] ?? req.headers['x-idempotency-key'];
    const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;
    if (!key?.trim()) return next.handle();

    const fingerprint = IdempotencyService.fingerprint(req.body);

    return from(this.idempotency.begin(key.trim(), fingerprint)).pipe(
      switchMap((begin) => {
        if (begin.status === 'replay') return from([begin.response]);
        if (begin.status === 'processing') {
          return throwError(
            () => new ConflictException('Yêu cầu đang xử lý — thử lại sau vài giây'),
          );
        }
        if (begin.status === 'mismatch') {
          return throwError(
            () =>
              new UnprocessableEntityException(
                'Idempotency-Key đã dùng với payload khác',
              ),
          );
        }
        return next.handle().pipe(
          tap(async (response) => {
            await this.idempotency.complete(key.trim(), response);
          }),
          catchError((err) => {
            void this.idempotency.fail(key.trim());
            return throwError(() => err);
          }),
        );
      }),
    );
  }
}
