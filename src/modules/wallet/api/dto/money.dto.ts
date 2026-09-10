import {
  IsNotEmpty,
  IsString,
  Matches,
} from 'class-validator';

export class MoneyDto {
  @IsString()
  @IsNotEmpty()
  @Matches(
    /^(0|[1-9]\d*)(\.\d{1,2})?$/,
    {
      message:
        'amount must be a non-negative decimal with up to 2 decimal places',
    },
  )
  amount!: string;

  @IsString()
  @Matches(/^[A-Z]{3}$/, {
    message:
      'currency must be a 3-letter ISO-4217 code',
  })
  currency!: string;
}