import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser } from '@pe/shared';
import { CurrentUser } from '../auth/auth.decorators.js';
import { AuthUserDto } from '../auth/dto/auth.response.js';
import { AddressesService } from './addresses.service.js';
import { AddressDto, CreateAddressDto, UpdateAddressDto } from './dto/address.dto.js';
import { UpdateProfileDto } from './dto/users.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@ApiBearerAuth('access-token')
@ApiCookieAuth('pe_access')
@Controller('users/me')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly addresses: AddressesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Current user profile' })
  @ApiOkResponse({ type: AuthUserDto })
  profile(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }

  @Patch()
  @ApiOperation({ summary: 'Update profile' })
  @ApiOkResponse({ type: AuthUserDto })
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto): Promise<AuthUser> {
    return this.users.updateProfile(user.id, dto);
  }

  @Get('addresses')
  @ApiOperation({ summary: 'List addresses' })
  @ApiOkResponse({ type: [AddressDto] })
  listAddresses(@CurrentUser() user: AuthUser): Promise<AddressDto[]> {
    return this.addresses.list(user.id);
  }

  @Post('addresses')
  @ApiOperation({ summary: 'Create address' })
  @ApiCreatedResponse({ type: AddressDto })
  createAddress(@CurrentUser() user: AuthUser, @Body() dto: CreateAddressDto): Promise<AddressDto> {
    return this.addresses.create(user.id, dto);
  }

  @Get('addresses/:id')
  @ApiOperation({ summary: 'Get address' })
  @ApiOkResponse({ type: AddressDto })
  getAddress(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<AddressDto> {
    return this.addresses.get(user.id, id);
  }

  @Patch('addresses/:id')
  @ApiOperation({ summary: 'Update address' })
  @ApiOkResponse({ type: AddressDto })
  updateAddress(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
  ): Promise<AddressDto> {
    return this.addresses.update(user.id, id, dto);
  }

  @Delete('addresses/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete address' })
  deleteAddress(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.addresses.remove(user.id, id);
  }
}
