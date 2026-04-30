import { Field, ID, InputType } from '@nestjs/graphql';
import { PhoneNumberInput } from '@omnixys/graphql';

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

  @Field(() => String, { nullable: true })
  email?: string;

  @Field(() => [PhoneNumberInput], {
    nullable: true,
  })
  phoneNumbers?: PhoneNumberInput[];
}
