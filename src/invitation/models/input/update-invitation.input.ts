import { RsvpChoice } from '../../../prisma/generated/client.js';
import { Field, ID, InputType, Int } from '@nestjs/graphql';

@InputType({
  description:
    'Update input for invitations. Only RSVP (guest) and approval/maxInvitees (admin). All other fields are system-managed.',
})
export class InvitationUpdateInput {
  @Field(() => ID, {
    description: 'ID of the invitation that should be updated.',
  })
  id!: string;

  // ----------------------
  // Guest-controlled fields
  // ----------------------

  @Field(() => RsvpChoice, {
    nullable: true,
    description:
      'Guest RSVP choice (YES, NO, MAYBE). Only editable by the guest.',
  })
  rsvpChoice?: RsvpChoice | null;

  // ----------------------
  // Admin-controlled fields
  // ----------------------

  @Field(() => Boolean, {
    nullable: true,
    description:
      'Admin approval of the invitation (true/false). Requires admin authorization.',
  })
  approved?: boolean | null;

  @Field(() => Int, {
    nullable: true,
    description:
      'Maximum number of plus-one invitations allowed. Only editable by admins.',
  })
  maxInvitees?: number | null;
}
