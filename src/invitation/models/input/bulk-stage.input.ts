import { Field, ID, InputType } from '@nestjs/graphql';

@InputType()
export class StageInvitationDataInput {
  @Field(() => ID)
  invitationId!: string;
}

@InputType()
export class BulkStageInvitationInput {
  @Field(() => [StageInvitationDataInput], {
    description: 'Invitations to stage or return to their RSVP-derived status.',
  })
  invitationIds!: StageInvitationDataInput[];

  @Field(() => Boolean, {
    description: 'True stages approval without creating a guest or ticket.',
  })
  staged!: boolean;
}
