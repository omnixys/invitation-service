import { InputType, Field, ID } from '@nestjs/graphql';

@InputType()
export class PublicRsvpInput {
  @Field(() => ID, {
    description: 'Public event identifier (eventId or slug)',
  })
  eventId!: string;

  @Field(() => String)
  firstName!: string;

  @Field(() => String)
  lastName!: string;

  @Field(() => String, {
    nullable: true,
  })
  phoneNumber?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Optional RSVP message from guest',
  })
  message?: string;

  @Field(() => [PublicPlusOneInput], {
    nullable: true,
    description: 'Optional list of additional guests (plus-ones)',
  })
  plusOnes?: PublicPlusOneInput[];
}

@InputType()
export class PublicPlusOneInput {
  @Field(() => String)
  firstName!: string;

  @Field(() => String)
  lastName!: string;
}
