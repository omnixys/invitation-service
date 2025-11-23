import { PhoneNumberType } from '../enums/phone-number-type.enum.js';
import { Field, InputType } from '@nestjs/graphql';
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  IsBoolean,
} from 'class-validator';

/**
 * Regex for validating international phone numbers.
 * Allows:
 * - Optional leading '+'
 * - Digits, spaces, parentheses, hyphens and dots
 * - Length between 6 and 20 characters
 */
export const PHONE_RE = /^\+?[0-9 .\-()]{6,20}$/;

@InputType({
  description:
    'Input type for phone numbers, including kind, value, optional label and primary flag.',
})
export class PhoneNumberInput {
  @Field(() => PhoneNumberType, {
    description:
      'The category/type of the phone number (e.g., MOBILE, HOME, WORK).',
  })
  @IsEnum(PhoneNumberType)
  type!: PhoneNumberType;

  @Field(() => String, {
    description: 'Phone number value in international format. Regex validated.',
  })
  @IsString()
  @Matches(PHONE_RE, {
    message: 'invalid phone number format',
  })
  number!: string;

  @Field(() => String, {
    nullable: true,
    description:
      'Optional user-defined label (e.g., “Office Line”, “Private”).',
  })
  @IsOptional()
  @IsString()
  label?: string | null;

  @Field(() => Boolean, {
    nullable: true,
    description: 'Marks this number as primary for the associated profile.',
  })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean | null;
}
