import { ApiProperty } from '@nestjs/swagger';
import type { AuthResponse, AuthUser, RoleName, UserStatus } from '@pe/shared';

export class AuthUserDto implements AuthUser {
  @ApiProperty() id: string;
  @ApiProperty({ nullable: true, type: String }) email: string | null;
  @ApiProperty({ nullable: true, type: String }) phone: string | null;
  @ApiProperty({ nullable: true, type: String }) firstName: string | null;
  @ApiProperty({ nullable: true, type: String }) lastName: string | null;
  @ApiProperty({ enum: ['ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION', 'DELETED'] })
  status: UserStatus;
  @ApiProperty() emailVerified: boolean;
  @ApiProperty() phoneVerified: boolean;
  @ApiProperty({ type: [String] }) roles: RoleName[];
  @ApiProperty({ type: [String] }) permissions: string[];
  @ApiProperty() createdAt: string;
}

export class AuthResponseDto implements AuthResponse {
  @ApiProperty({ type: AuthUserDto }) user: AuthUserDto;
  @ApiProperty() accessToken: string;
  @ApiProperty({ description: 'Seconds until the access token expires' })
  accessTokenExpiresIn: number;
  @ApiProperty() refreshToken: string;
}

export class MessageResponseDto {
  @ApiProperty() message: string;
}
