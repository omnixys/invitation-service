import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { PhoneNumberInput } from '@omnixys/graphql';

@InputType({
  description:
    'Input type for creating an invitation. A guest profile is not created here; only basic invite metadata is stored.',
})
export class InvitationCreateInput {
  @Field(() => ID, {
    description: 'ID of the event this invitation belongs to.',
  })
  eventId!: string;

  @Field(() => Int, {
    defaultValue: 0,
    description: 'Maximum number of plus-one invitations (must be >= 0).',
  })
  maxInvitees!: number;

  @Field(() => ID, {
    nullable: true,
    description: 'Optional: ID of the parent invitation (for invite chains).',
  })
  invitedByInvitationId?: string;

  @Field(() => String, {
    description: 'Optional: first name of the invited guest.',
  })
  firstName!: string;

  @Field(() => String, {
    description: 'Optional: last name of the invited guest.',
  })
  lastName!: string;

  @Field(() => String, { nullable: true })
  email?: string;

  @Field(() => [PhoneNumberInput], {
    nullable: true,
  })
  phoneNumbers?: PhoneNumberInput[];

  @Field(() => String, { nullable: true })
  phoneNumber?: string;
}
