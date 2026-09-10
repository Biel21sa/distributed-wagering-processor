import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class LedgerQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}

export function encodeCursor(
  createdAt: Date,
  id: string,
): string {
  return Buffer.from(
    JSON.stringify({
      createdAt:
        createdAt.toISOString(),

      id,
    }),
  ).toString(
    'base64url',
  );
}

export function decodeCursor(
  cursor: string,
): {
  createdAt: Date;
  id: string;
} {
  const parsed =
    JSON.parse(
      Buffer.from(
        cursor,
        'base64url',
      ).toString(
        'utf8',
      ),
    );

  return {
    createdAt:
      new Date(
        parsed.createdAt,
      ),

    id:
      parsed.id,
  };
}