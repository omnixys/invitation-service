import { PhoneNumberInput } from './phone-number.input.js';
import { Field, ID, InputType, Int } from '@nestjs/graphql';

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
  invitedByInvitationId?: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Optional: first name of the invited guest.',
  })
  firstName?: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Optional: last name of the invited guest.',
  })
  lastName?: string | null;

  @Field(() => [PhoneNumberInput], {
    nullable: true,
  })
  phoneNumbers?: PhoneNumberInput[];
}
