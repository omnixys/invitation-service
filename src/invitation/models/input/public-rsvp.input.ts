import { PlusOneAgeCategory } from '../../../prisma/generated/client.js';
import { InputType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { PhoneNumberInput } from '@omnixys/graphql';

registerEnumType(PlusOneAgeCategory, { name: 'PlusOneAgeCategory' });

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

  @Field(() => [PhoneNumberInput])
  phoneNumbers!: PhoneNumberInput[];

  @Field(() => String, {
    nullable: true,
  })
  email?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Optional RSVP message from guest',
  })
  message?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Optional note from guest',
  })
  guestNote?: string;

  @Field(() => [String], {
    nullable: true,
    description: 'Configured inviter/source options selected by the guest',
  })
  selectedInvitedBy?: string[];

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

  @Field(() => String, { nullable: true })
  email?: string;

  @Field(() => PlusOneAgeCategory)
  plusOneAgeCategory!: PlusOneAgeCategory;

  @Field(() => [PhoneNumberInput], { nullable: true })
  phoneNumbers?: PhoneNumberInput[];
}
