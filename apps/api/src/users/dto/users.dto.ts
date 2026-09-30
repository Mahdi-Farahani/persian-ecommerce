import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoleNames, type RoleName, UserStatuses, type UserStatus } from '@pe/shared';
import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'علی' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'رضایی' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  lastName?: string;
}

export class AdminUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Search in email, phone and name' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  search?: string;

  @ApiPropertyOptional({ enum: UserStatuses })
  @IsOptional()
  @IsIn(UserStatuses)
  status?: UserStatus;

  @ApiPropertyOptional({ enum: RoleNames })
  @IsOptional()
  @IsIn(RoleNames)
  role?: RoleName;
}

export class UpdateUserStatusDto {
  @ApiProperty({ enum: UserStatuses })
  @IsIn(UserStatuses)
  status: UserStatus;
}

export class UpdateUserRolesDto {
  @ApiProperty({ enum: RoleNames, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(RoleNames, { each: true })
  roles: RoleName[];
}
