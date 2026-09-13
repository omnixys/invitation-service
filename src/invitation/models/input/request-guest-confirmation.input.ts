import { Field, ID, InputType } from '@nestjs/graphql';

@InputType({
  description:
    'Public request for a fresh guest-registration confirmation link. The response is intentionally enumeration-safe.',
})
export class RequestGuestConfirmationInput {
  @Field(() => ID)
  eventId!: string;

  @Field(() => String)
  firstName!: string;

  @Field(() => String)
  lastName!: string;

  @Field(() => String, {
    description:
      'The email address or international phone number used for the invitation.',
  })
  identifier!: string;
}
