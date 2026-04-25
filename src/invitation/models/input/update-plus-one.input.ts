import { Field, ID, InputType } from '@nestjs/graphql';
import { PhoneNumberInput } from '@omnixys/graphql';

@InputType()
export class UpdatePlusOneInput {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  firstName!: string;

  @Field(() => String)
  lastName!: string;

  @Field(() => String, {
    nullable: true,
  })
  email?: string;

  @Field(() => [PhoneNumberInput], {
    nullable: true,
  })
  phoneNumbers?: PhoneNumberInput[];
}
