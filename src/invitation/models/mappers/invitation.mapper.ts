import type { Invitation } from '../entity/invitation.entity.js';
import type { InvitationStatus } from '../enums/invitation-status.enum.js';
import type { RsvpChoice } from '../enums/rsvp-choice.enum.js';
import type { Invitation as PrismaInvitation } from '@prisma/client';

/**
 * Maps Prisma Invitation → GraphQL Invitation entity.
 * Required because Prisma enums differ from GraphQL enums.
 */
export function mapInvitation(p: PrismaInvitation): Invitation {
  return {
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    eventId: p.eventId,
    guestProfileId: p.guestProfileId,
    status: p.status as InvitationStatus,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    pendingContactId: p.pendingContactId,
    rsvpChoice: p.rsvpChoice as RsvpChoice,
    rsvpAt: p.rsvpAt,
    approved: p.approved,
    approvedAt: p.approvedAt,
    approvedByUserId: p.approvedByUserId,
    maxInvitees: p.maxInvitees,
    invitedByInvitationId: p.invitedByInvitationId,
    invitedByUserId: p.invitedByUserId,
    plusOnes: p.plusOnes,
  };
}
