import { RsvpChoice } from '../enums/rsvp-choice.enum.js';
import { PhoneNumberInput } from './phone-number.input.js';
import { Field, ID, InputType } from '@nestjs/graphql';
import { IsEmail, IsOptional, IsString } from 'class-validator';

@InputType({
  description:
    'Optional contact information submitted when a guest RSVPs YES. ' +
    'This data is stored in the invitation or forwarded to the ephemeral contact store.',
})
export class AcceptRSVPInput {
  @Field(() => String, {
    description: 'First name of the guest submitting the RSVP.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  firstName?: string | null;

  @Field(() => String, {
    description: 'Last name of the guest submitting the RSVP.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  lastName?: string | null;

  @Field(() => String, {
    description: 'Email address of the guest. Optional.',
    nullable: true,
  })
  @IsOptional()
  @IsEmail({}, { message: 'invalid email format' })
  email?: string | null;

  @Field(() => [PhoneNumberInput], {
    description: 'Optional list of phone numbers for contact.',
    nullable: true,
  })
  @IsOptional()
  phoneNumbers?: PhoneNumberInput[] | null;
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
  id!: string;

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
  replyInput?: AcceptRSVPInput | null;
}
