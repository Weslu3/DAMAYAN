export enum AppRole {
  ADMIN = 'admin',
  DISPATCHER = 'dispatcher',
  LINE_MANAGER = 'line_manager',
  CITIZEN = 'citizen',
}

export const MANAGEMENT_ROLES = [
  AppRole.ADMIN,
  AppRole.DISPATCHER,
  AppRole.LINE_MANAGER,
] as const;
