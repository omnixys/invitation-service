import { ObjectType, Field, Directive } from '@nestjs/graphql';

@ObjectType({
  description:
    'Generic success response payload used across mutations. Includes a boolean status flag and an optional human-readable message.',
})
@Directive('@shareable')
export class SuccessPayload {
  @Field({
    description: 'Indicates whether the operation was successful.',
  })
  ok!: boolean;

  @Field(() => String, {
    nullable: true,
    description:
      'Optional human-readable message providing additional context about the operation result.',
  })
  message?: string | null;
}
