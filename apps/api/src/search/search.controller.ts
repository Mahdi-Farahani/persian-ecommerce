import { Controller, Get, HttpCode, HttpStatus, Post, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser, Paginated, ProductCard, SearchSuggestions } from '@pe/shared';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { AuditService } from '../audit/audit.service.js';
import { CurrentUser, Public, RequirePermissions } from '../auth/auth.decorators.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { ProductListQueryDto } from '../products/dto/product.dto.js';
import { Permissions } from '../rbac/permissions.js';
import { SearchService } from './search.service.js';

export class SuggestQueryDto {
  @ApiPropertyOptional({ description: 'Partial query (Persian or English)' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : ''))
  @IsString()
  @MaxLength(100)
  q = '';
}

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Full-text product search with the catalogue filters' })
  list(@Query() query: ProductListQueryDto): Promise<Paginated<ProductCard>> {
    return this.search.search(query);
  }

  @Get('suggest')
  @Public()
  @ApiOperation({ summary: 'Autocomplete: products, categories and brands' })
  suggest(@Query() query: SuggestQueryDto): Promise<SearchSuggestions> {
    return this.search.suggest(query.q);
  }
}

@ApiTags('admin/search')
@ApiBearerAuth('access-token')
@ApiCookieAuth('pe_access')
@Controller('admin/search')
export class AdminSearchController {
  constructor(
    private readonly search: SearchService,
    private readonly audit: AuditService,
  ) {}

  @Post('reindex')
  @RequirePermissions(Permissions.CatalogManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rebuild the search text of every product' })
  async reindex(
    @CurrentUser() actor: AuthUser,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ indexed: number }> {
    const indexed = await this.search.reindexAll();
    await this.audit.record({
      actorId: actor.id,
      action: 'search.reindex',
      entityType: 'Product',
      metadata: { indexed },
      request: req,
    });
    return { indexed };
  }
}
