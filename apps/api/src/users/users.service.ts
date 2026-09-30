import { Injectable } from '@nestjs/common';
import {
  type AuthUser,
  buildPagination,
  normalizeIranMobile,
  type Paginated,
  type RoleName,
} from '@pe/shared';
import { ConflictAppException, NotFoundAppException } from '../common/errors/app.exception.js';
import type { Prisma, UserStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const authUserInclude = {
  roles: {
    include: {
      role: {
        include: { permissions: { include: { permission: { select: { key: true } } } } },
      },
    },
  },
} satisfies Prisma.UserInclude;

export type UserWithRoles = Prisma.UserGetPayload<{ include: typeof authUserInclude }>;

export interface CreateUserInput {
  email?: string;
  phone?: string;
  passwordHash: string;
  firstName?: string;
  lastName?: string;
  roleName: RoleName;
}

export interface AdminUserListQuery {
  page: number;
  limit: number;
  search?: string;
  status?: UserStatus;
  role?: RoleName;
}

export interface AdminUserSummary extends AuthUser {
  lastLoginAt: string | null;
  updatedAt: string;
}

/**
 * User persistence and projection. Password hashes never leave this layer
 * except through `findCredentialsByIdentifier` used by AuthService.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  toAuthUser(user: UserWithRoles): AuthUser {
    const roles = user.roles.map((ur) => ur.role.name as RoleName);
    const permissions = new Set<string>();
    for (const ur of user.roles) {
      for (const rp of ur.role.permissions) permissions.add(rp.permission.key);
    }
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      emailVerified: user.emailVerifiedAt !== null,
      phoneVerified: user.phoneVerifiedAt !== null,
      roles,
      permissions: [...permissions].sort(),
      createdAt: user.createdAt.toISOString(),
    };
  }

  async findAuthUser(id: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id }, include: authUserInclude });
    return user ? this.toAuthUser(user) : null;
  }

  async findAuthUserOrThrow(id: string): Promise<AuthUser> {
    const user = await this.findAuthUser(id);
    if (!user) throw new NotFoundAppException('USER_NOT_FOUND', 'کاربر پیدا نشد');
    return user;
  }

  /** Resolves an email address or Iranian mobile number to its unique lookup. */
  static identifierWhere(identifier: string): Prisma.UserWhereUniqueInput | null {
    const trimmed = identifier.trim().toLowerCase();
    if (trimmed.includes('@')) return { email: trimmed };
    const phone = normalizeIranMobile(trimmed);
    return phone ? { phone } : null;
  }

  async findCredentialsByIdentifier(identifier: string): Promise<UserWithRoles | null> {
    const where = UsersService.identifierWhere(identifier);
    if (!where) return null;
    return this.prisma.user.findUnique({ where, include: authUserInclude });
  }

  async findByIdWithRoles(id: string): Promise<UserWithRoles | null> {
    return this.prisma.user.findUnique({ where: { id }, include: authUserInclude });
  }

  async create(input: CreateUserInput): Promise<UserWithRoles> {
    await this.assertIdentifiersAvailable(input.email, input.phone);
    const role = await this.prisma.role.findUniqueOrThrow({ where: { name: input.roleName } });
    return this.prisma.user.create({
      data: {
        email: input.email,
        phone: input.phone,
        passwordHash: input.passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        roles: { create: { roleId: role.id } },
      },
      include: authUserInclude,
    });
  }

  async assertIdentifiersAvailable(
    email?: string,
    phone?: string,
    exceptUserId?: string,
  ): Promise<void> {
    if (email) {
      const existing = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (existing && existing.id !== exceptUserId) {
        throw new ConflictAppException('EMAIL_TAKEN', 'این ایمیل قبلاً ثبت شده است');
      }
    }
    if (phone) {
      const existing = await this.prisma.user.findUnique({
        where: { phone },
        select: { id: true },
      });
      if (existing && existing.id !== exceptUserId) {
        throw new ConflictAppException('PHONE_TAKEN', 'این شماره موبایل قبلاً ثبت شده است');
      }
    }
  }

  async updateProfile(
    id: string,
    data: { firstName?: string; lastName?: string },
  ): Promise<AuthUser> {
    const user = await this.prisma.user.update({ where: { id }, data, include: authUserInclude });
    return this.toAuthUser(user);
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
  }

  async recordLoginSuccess(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null },
    });
  }

  /** Increments the failure counter and returns the lock expiry when the limit is hit. */
  async recordLoginFailure(
    id: string,
    maxAttempts: number,
    lockMinutes: number,
  ): Promise<Date | null> {
    const user = await this.prisma.user.update({
      where: { id },
      data: { failedLoginCount: { increment: 1 } },
      select: { failedLoginCount: true },
    });
    if (user.failedLoginCount >= maxAttempts) {
      const lockedUntil = new Date(Date.now() + lockMinutes * 60_000);
      await this.prisma.user.update({
        where: { id },
        data: { lockedUntil, failedLoginCount: 0 },
      });
      return lockedUntil;
    }
    return null;
  }

  async markVerified(id: string, channel: 'EMAIL' | 'PHONE'): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: channel === 'EMAIL' ? { emailVerifiedAt: new Date() } : { phoneVerifiedAt: new Date() },
    });
  }

  // --- administration -------------------------------------------------------

  async adminList(query: AdminUserListQuery): Promise<Paginated<AdminUserSummary>> {
    const where: Prisma.UserWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.role) where.roles = { some: { role: { name: query.role } } };
    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { email: { contains: term } },
        { phone: { contains: term } },
        { firstName: { contains: term } },
        { lastName: { contains: term } },
      ];
    }
    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: authUserInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    return {
      items: users.map((u) => this.toAdminSummary(u)),
      pagination: buildPagination(query.page, query.limit, total),
    };
  }

  async adminGet(id: string): Promise<AdminUserSummary> {
    const user = await this.findByIdWithRoles(id);
    if (!user) throw new NotFoundAppException('USER_NOT_FOUND', 'کاربر پیدا نشد');
    return this.toAdminSummary(user);
  }

  async adminSetStatus(id: string, status: UserStatus): Promise<AdminUserSummary> {
    const user = await this.prisma.user.update({
      where: { id },
      data: { status },
      include: authUserInclude,
    });
    return this.toAdminSummary(user);
  }

  async adminSetRoles(id: string, roleNames: RoleName[]): Promise<AdminUserSummary> {
    const roles = await this.prisma.role.findMany({ where: { name: { in: roleNames } } });
    if (roles.length !== new Set(roleNames).size) {
      throw new NotFoundAppException('ROLE_NOT_FOUND', 'نقش نامعتبر است');
    }
    const user = await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.userRole.createMany({ data: roles.map((r) => ({ userId: id, roleId: r.id })) });
      return tx.user.findUniqueOrThrow({ where: { id }, include: authUserInclude });
    });
    return this.toAdminSummary(user);
  }

  /** Adds or removes one role for a user inside a transaction (idempotent). */
  async setRoleMembership(
    tx: Prisma.TransactionClient,
    userId: string,
    roleName: RoleName,
    member: boolean,
  ): Promise<void> {
    const role = await tx.role.findUniqueOrThrow({ where: { name: roleName } });
    if (member) {
      await tx.userRole.upsert({
        where: { userId_roleId: { userId, roleId: role.id } },
        update: {},
        create: { userId, roleId: role.id },
      });
    } else {
      await tx.userRole.deleteMany({ where: { userId, roleId: role.id } });
    }
  }

  private toAdminSummary(user: UserWithRoles): AdminUserSummary {
    return {
      ...this.toAuthUser(user),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
