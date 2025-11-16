import { registerEnumType } from '@nestjs/graphql';

export enum InvitationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  CANCELED = 'CANCELED',
  REJECTED = 'REJECTED',
  APPROVED = 'APPROVED',
}

registerEnumType(InvitationStatus, {
  name: 'InvitationStatus',
  description:
    'Represents the lifecycle state of an invitation. PENDING = newly created, ACCEPTED = guest confirmed, DECLINED = guest declined, CANCELED = invitation was canceled by issuer, REJECTED = invitation was rejected by admin, APPROVED = invitation has been approved by admin.',
});
