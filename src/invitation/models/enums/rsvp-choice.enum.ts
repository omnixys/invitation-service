import { registerEnumType } from '@nestjs/graphql';

export enum RsvpChoice {
  YES = 'YES',
  NO = 'NO',
  MAYBE = 'MAYBE',
}

registerEnumType(RsvpChoice, {
  name: 'RsvpChoice',
  description:
    'Represents the RSVP response of a guest. YES = attending, NO = not attending, MAYBE = undecided.',
});
