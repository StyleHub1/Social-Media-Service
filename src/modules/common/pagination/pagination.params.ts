import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export class PaginationParams {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number=10;
  
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  offset: number=0;
}