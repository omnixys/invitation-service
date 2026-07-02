import { Optional } from '@nestjs/common';
import { Field, ID, InputType } from '@nestjs/graphql';

/**
 * Input for bulk approving multiple invitations.
 *
 * WHY:
 * - Avoid multiple network roundtrips
 * - Ensure atomic-like batch processing
 * - Align with enterprise bulk operations
 */
@InputType()
export class BulkApproveInvitationInput {
  @Field(() => [ApproveInvitationDataInput], {
    description: 'List of invitation IDs to approve/unapprove.',
  })
  invitationIds!: ApproveInvitationDataInput[];

  @Field(() => Boolean, {
    description: 'Approval flag applied to all invitations.',
  })
  approved!: boolean;
}

@InputType()
export class ApproveInvitationDataInput {
  @Field(() => ID, {
    description: 'ID of the invitation to approve/unapprove (cuid).',
  })
  invitationId!: string;

  @Field(() => ID, {
    description: 'ID of the seat to assign when approving the invitation.',
    nullable: true,
  })
  @Optional()
  seatId?: string;
}
