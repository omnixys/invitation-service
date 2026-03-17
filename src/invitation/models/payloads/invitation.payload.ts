import {
  Field,
  GraphQLISODateTime,
  ID,
  Int,
  ObjectType,
} from '@nestjs/graphql';
import { InvitationStatus, RsvpChoice } from '../../../prisma/generated/client.js';

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

  @Field(() => ID)
  eventId!: string;


  @Field(() => ID, {
    nullable: true,
  })
  guestProfileId?: string;

    @Field(() => String, {
    nullable: true,
  })
  email?: string;

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

  @Field(() => RsvpChoice, {
    nullable: true,
  })
  rsvpChoice?: RsvpChoice;

  @Field(() => GraphQLISODateTime, {
    nullable: true,
  })
  rsvpAt?: Date;

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
