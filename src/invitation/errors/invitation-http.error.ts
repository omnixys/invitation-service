import { HttpException, HttpStatus } from '@nestjs/common';
import { ContextAccessor } from '@omnixys/context';

export class InvitationHttpException extends HttpException {
  constructor(
    code: string,
    message: string,
    status: HttpStatus,
    metadata: Readonly<Record<string, unknown>> = {},
  ) {
    const context = ContextAccessor.get();
    super(
      {
        statusCode: status,
        code,
        message,
        requestId: context?.requestId ?? 'unscoped',
        correlationId:
          context?.correlationId ?? context?.requestId ?? 'unscoped',
        traceId: context?.trace?.traceId,
        metadata,
      },
      status,
    );
  }
}

export class InvitationHttpAuthenticationException extends InvitationHttpException {
  constructor() {
    super(
      'UNAUTHENTICATED',
      'Authentication is required',
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class InvitationHttpValidationException extends InvitationHttpException {
  constructor(
    message: string,
    metadata: Readonly<Record<string, unknown>> = {},
  ) {
    super(
      'INVITATION_UPLOAD_INVALID',
      message,
      HttpStatus.BAD_REQUEST,
      metadata,
    );
  }
}
