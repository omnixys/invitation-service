import { Field, ID, InputType } from '@nestjs/graphql';

@InputType({
  description:
    'Input used by admins to approve or unapprove an invitation. All other fields are system-managed.',
})
export class ApproveInvitationInput {
  @Field(() => ID, {
    description: 'ID of the invitation to approve/unapprove (cuid).',
  })
  id!: string;

  @Field(() => Boolean, {
    nullable: false,
    description:
      'Admin approval flag (true = approved, false = unapproved). Requires admin permissions.',
  })
  approved!: boolean;
}
