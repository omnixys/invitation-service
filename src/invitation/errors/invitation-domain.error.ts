import { ContextAccessor } from '@omnixys/context';
import {
  FrameworkException,
  InvitationAlreadyApprovedException as ContractInvitationAlreadyApprovedException,
  InvitationAlreadyExistsException as ContractInvitationAlreadyExistsException,
  InvitationNotFoundException as ContractInvitationNotFoundException,
  type FrameworkExceptionOptions,
} from '@omnixys/contracts';

function options(
  metadata: Readonly<Record<string, unknown>> = {},
  cause?: unknown,
): FrameworkExceptionOptions {
  const context = ContextAccessor.get();
  return {
    cause,
    context: {
      requestId: context?.requestId,
      correlationId: context?.correlationId,
      traceId: context?.trace?.traceId,
      actorId: context?.principal?.actorId,
      tenantId: context?.tenant?.tenantId ?? context?.principal?.tenantId,
    },
    metadata,
  };
}

export class InvitationNotFoundException extends ContractInvitationNotFoundException {
  constructor(invitationId?: string) {
    super(invitationId, options());
  }
}

export class InvitationAlreadyExistsException extends ContractInvitationAlreadyExistsException {
  constructor(invitationId?: string) {
    super(invitationId, options());
  }
}

export class InvitationAlreadyApprovedException extends ContractInvitationAlreadyApprovedException {
  constructor(invitationId?: string) {
    super(invitationId, options());
  }
}

export class InvitationDomainException extends FrameworkException {
  constructor(
    code: string,
    message: string,
    metadata: Readonly<Record<string, unknown>> = {},
    cause?: unknown,
  ) {
    super(code, message, options(metadata, cause));
  }
}

export class InvitationValidationException extends InvitationDomainException {
  constructor(
    message: string,
    metadata: Readonly<Record<string, unknown>> = {},
  ) {
    super('INVITATION_INVALID_INPUT', message, metadata);
  }
}

export class InvitationAuthenticationRequiredException extends InvitationDomainException {
  constructor() {
    super('UNAUTHENTICATED', 'Authentication is required');
  }
}

export class InvitationAccessDeniedException extends InvitationDomainException {
  constructor(invitationId?: string, reason = 'insufficient-permission') {
    super('INVITATION_ACCESS_DENIED', 'Invitation access is not authorized', {
      invitationId,
      reason,
    });
  }
}

export class InvitationAlreadyRejectedException extends InvitationDomainException {
  constructor(invitationId?: string) {
    super(
      'INVITATION_ALREADY_REJECTED',
      'Invitation has already been rejected',
      {
        invitationId,
      },
    );
  }
}

export class RsvpNotSubmittedException extends InvitationDomainException {
  constructor(invitationId?: string) {
    super('RSVP_NOT_SUBMITTED', 'Guest has not submitted an RSVP yet', {
      invitationId,
    });
  }
}

export class RsvpNotAcceptedException extends InvitationDomainException {
  constructor(invitationId?: string) {
    super('RSVP_NOT_ACCEPTED', 'Guest must accept the RSVP before approval', {
      invitationId,
    });
  }
}

export class RsvpAlreadyAcceptedException extends InvitationDomainException {
  constructor(invitationId?: string) {
    super('RSVP_ALREADY_ACCEPTED', 'Invitation has already been accepted', {
      invitationId,
    });
  }
}

export class MissingGuestNameException extends InvitationDomainException {
  constructor(missing: readonly string[], invitationId?: string) {
    super('MISSING_GUEST_NAME', 'Guest name is incomplete', {
      invitationId,
      missing,
    });
  }
}

export class MissingPendingContactException extends InvitationDomainException {
  constructor(invitationId?: string) {
    super('MISSING_PENDING_CONTACT', 'Pending contact token is missing', {
      invitationId,
    });
  }
}

export class MissingRsvpContactDetailsException extends InvitationDomainException {
  constructor(invitationId?: string) {
    super(
      'MISSING_RSVP_CONTACT_DETAILS',
      'Contact details are required to complete RSVP',
      { invitationId },
    );
  }
}

export class MissingContactMethodException extends InvitationDomainException {
  constructor(invitationId?: string) {
    super('MISSING_CONTACT_METHOD', 'Email or phone number is required', {
      invitationId,
    });
  }
}
