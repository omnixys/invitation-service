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
export class InvitationPayload {
  @Field(() => ID)
  id!: string;

  // optional strings
  @Field(() => String, {
    nullable: true,
  })
  firstName?: string;

  @Field(() => String, {
    nullable: true,
  })
  lastName?: string;

  // REQUIRED: eventId is NOT nullable in Prisma
  @Field(() => ID)
  eventId!: string;

  // OPTIONAL
  @Field(() => ID, {
    nullable: true,
  })
  guestProfileId?: string;

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
  pendingContactId?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Pointer to PII record inside Ephemeral Redis Store.',
  })
  phoneNumber?: string;

  @Field(() => RsvpChoice, {
    nullable: true,
  })
  rsvpChoice?: RsvpChoice;

  @Field(() => GraphQLISODateTime, {
    nullable: true,
  })
  rsvpAt?: Date | undefined;

  // approved = Boolean, default false → never null in Prisma
  @Field(() => Boolean)
  approved!: boolean;

  @Field(() => GraphQLISODateTime, {
    nullable: true,
  })
  approvedAt?: Date;

  @Field(() => ID, {
    nullable: true,
  })
  approvedByUserId?: string;

  @Field(() => Int)
  maxInvitees!: number;

  @Field(() => ID, {
    nullable: true,
  })
  invitedByInvitationId?: string;

  @Field(() => ID, {
    nullable: true,
  })
  invitedByUserId?: string;
}
