import { ApiProperty } from '@nestjs/swagger';
import type { PaginationMeta } from '@pe/shared';

export class PaginationMetaDto implements PaginationMeta {
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() total: number;
  @ApiProperty() totalPages: number;
}
