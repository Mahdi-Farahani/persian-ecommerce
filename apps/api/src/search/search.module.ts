import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module.js';
import { AdminSearchController, SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';

@Module({
  imports: [CategoriesModule],
  controllers: [SearchController, AdminSearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
