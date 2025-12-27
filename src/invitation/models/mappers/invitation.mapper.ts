import { Invitation } from '../../../prisma/generated/client.js';
import { n2u } from '../../../utils/null-to-undefined.js';
import type { InvitationStatus } from '../enums/invitation-status.enum.js';
import type { RsvpChoice } from '../enums/rsvp-choice.enum.js';
import type { InvitationPayload } from '../payloads/invitation.payload.js';

/**
 * Maps Prisma Invitation → GraphQL Invitation entity.
 * Required because Prisma enums differ from GraphQL enums.
 */

export class InvitationMapper {
  static toPayload(invitation: Invitation): InvitationPayload {
    return {
      id: invitation.id,
      status: invitation.status as InvitationStatus,
      eventId: invitation.eventId,
      firstName: n2u(invitation.firstName),
      lastName: n2u(invitation.lastName),
      guestProfileId: n2u(invitation.guestProfileId),
      createdAt: invitation.createdAt,
      updatedAt: invitation.updatedAt,
      pendingContactId: n2u(invitation.pendingContactId),
      rsvpChoice: invitation.rsvpChoice as RsvpChoice,
      rsvpAt: n2u(invitation.rsvpAt),
      approved: invitation.approved,
      approvedAt: n2u(invitation.approvedAt),
      approvedByUserId: n2u(invitation.approvedByUserId),
      maxInvitees: invitation.maxInvitees,
      invitedByInvitationId: n2u(invitation.invitedByInvitationId),
      invitedByUserId: n2u(invitation.invitedByUserId),
      phoneNumber: n2u(invitation.phoneNumber),
    };
  }

  static toPayloadList(list: Invitation[]): InvitationPayload[] {
    return list.map((x) => this.toPayload(x));
  }
}
