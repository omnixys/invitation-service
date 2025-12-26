import { Field, InputType, ID, ObjectType, Int } from '@nestjs/graphql';

@InputType()
export class ImportInvitationsInput {
  @Field(() => ID)
  eventId!: string;

  @Field(() => ID)
  uploadId!: string;

  @Field(() => String)
  uploadType!: string;
}

@ObjectType()
export class ImportInvitationsResult {
  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  imported!: number;

  @Field(() => Int)
  skipped!: number;

  @Field(() => [String])
  duplicates!: string[];

  @Field(() => [String])
  errors!: string[];
}
