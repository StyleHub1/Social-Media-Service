import { BadRequestException } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export interface CursorPayload {
  createdAt: string; // ISO 8601
  id: string; // UUID
}

export interface CursorPaginationResponse<T> {
  items: T[];
  nextCursor: string | null;
}

export class CursorPaginationParams {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

export function encodeCursor(createdAt: Date, id: string): string {
  const payload: CursorPayload = { createdAt: createdAt.toISOString(), id };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function decodeCursor(cursor: string): CursorPayload {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf-8');
    const parsed = JSON.parse(raw) as CursorPayload;
    if (!parsed.createdAt || !parsed.id) throw new Error('invalid shape');
    return parsed;
  } catch {
    throw new BadRequestException('Invalid pagination cursor');
  }
}
