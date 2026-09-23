import { Field, ID, InputType, Int } from '@nestjs/graphql';

@InputType()
export class UpdateInvitationPlusOneLimitInput {
  @Field(() => ID)
  id!: string;

  @Field(() => Int, {
    description: 'Total number of plus-ones permitted for the invitation.',
  })
  maxPlusOnes!: number;
}
