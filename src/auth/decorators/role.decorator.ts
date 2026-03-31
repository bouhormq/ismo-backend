import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common';
import { Role } from '@prisma/client';
import { RolesGuard } from '../guard';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const AllowedRoles = (...roles: Role[]) => {
  return applyDecorators(Roles(...roles), UseGuards(RolesGuard));
};
