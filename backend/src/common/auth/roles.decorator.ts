import { SetMetadata } from '@nestjs/common';
import { AppRole } from '../../../libs/contracts/src/roles.js';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
