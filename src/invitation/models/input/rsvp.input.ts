import { RsvpChoice } from '../../../prisma/generated/client.js';
import { PublicPlusOneInput } from './public-rsvp.input.js';
import { Field, ID, InputType } from '@nestjs/graphql';
import { PhoneNumberInput } from '@omnixys/graphql';
import { IsEmail, IsOptional, IsString } from 'class-validator';

@InputType({
  description:
    'Optional contact information submitted when a guest RSVPs YES. ' +
    'This data is stored in the invitation or forwarded to the ephemeral contact store.',
})
export class AcceptRSVPInput {
  @Field(() => String, {
    description: 'First name of the guest submitting the RSVP.',
  })
  @IsString()
  firstName!: string;

  @Field(() => String, {
    description: 'Last name of the guest submitting the RSVP.',
  })
  @IsOptional()
  @IsString()
  lastName!: string;

  @Field(() => String, {
    description: 'Email address of the guest. Optional.',
    nullable: true,
  })
  @IsOptional()
  @IsEmail(
    {},
    {
      message: 'invalid email format',
    },
  )
  email?: string;

  @Field(() => [PhoneNumberInput], {
    description: 'Optional list of phone numbers for contact.',
    nullable: true,
  })
  @IsOptional()
  phoneNumbers?: PhoneNumberInput[];

  @Field(() => [PublicPlusOneInput], {
    nullable: true,
    description: 'Optional list of additional guests (plus-ones)',
  })
  plusOnes?: PublicPlusOneInput[];
}

@InputType({
  description:
    'RSVP input for an invitation. A YES response may include optional contact information.',
})
export class RSVPInput {
  @Field(() => ID, {
    description:
      'ID of the invitation for which the guest is submitting an RSVP.',
  })
  invitationId!: string;

  @Field(() => RsvpChoice, {
    description: 'The RSVP response: YES, NO, or MAYBE.',
  })
  choice!: RsvpChoice;

  @Field(() => AcceptRSVPInput, {
    nullable: true,
    description:
      'Additional contact info provided when the guest RSVPs YES. ' +
      'Ignored when choice !== YES.',
  })
  replyInput?: AcceptRSVPInput;
}
