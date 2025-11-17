import { InvitationStatus } from '../enums/invitation-status.enum.js';
import { RsvpChoice } from '../enums/rsvp-choice.enum.js';
import {
  Field,
  GraphQLISODateTime,
  ID,
  Int,
  ObjectType,
} from '@nestjs/graphql';

@ObjectType({
  description: 'GraphQL Invitation entity matching the Prisma model exactly.',
})
export class Invitation {
  @Field(() => ID)
  id!: string;

  // optional strings
  @Field(() => String, {
    nullable: true,
  })
  firstName?: string | null;

  @Field(() => String, {
    nullable: true,
  })
  lastName?: string | null;

  // REQUIRED: eventId is NOT nullable in Prisma
  @Field(() => ID)
  eventId!: string;

  // OPTIONAL
  @Field(() => ID, {
    nullable: true,
  })
  guestProfileId?: string | null;

  // REQUIRED ENUM
  @Field(() => InvitationStatus)
  status!: InvitationStatus;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;

  @Field(() => String, {
    nullable: true,
    description: 'Pointer to PII record inside Ephemeral Redis Store.',
  })
  pendingContactId?: string | null;

  @Field(() => RsvpChoice, {
    nullable: true,
  })
  rsvpChoice?: RsvpChoice | null;

  @Field(() => GraphQLISODateTime, {
    nullable: true,
  })
  rsvpAt?: Date | null;

  // approved = Boolean, default false → never null in Prisma
  @Field(() => Boolean)
  approved!: boolean;

  @Field(() => GraphQLISODateTime, {
    nullable: true,
  })
  approvedAt?: Date | null;

  @Field(() => ID, {
    nullable: true,
  })
  approvedByUserId?: string | null;

  @Field(() => Int)
  maxInvitees!: number;

  @Field(() => ID, {
    nullable: true,
  })
  invitedByInvitationId?: string | null;

  @Field(() => ID, {
    nullable: true,
  })
  invitedByUserId?: string | null;

  // Array fields NEVER nullable in Prisma (defaults to [])
  @Field(() => [String])
  plusOnes!: string[];
}
