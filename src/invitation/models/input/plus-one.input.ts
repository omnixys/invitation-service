import { Field, ID, InputType } from '@nestjs/graphql';

@InputType()
export class CreatePlusOneInput {
  @Field(() => ID)
  eventId!: string;

  @Field(() => ID)
  invitedByInvitationId!: string;

  @Field(() => String)
  firstName!: string;

  @Field(() => String)
  lastName!: string;
}
