export const AUTH_PATTERNS = {
  SIGNUP: 'auth.signup',
  LOGIN: 'auth.login',
  GET_PROFILE: 'auth.get-profile',
  UPDATE_PROFILE: 'auth.update-profile',
  CREATE_GOVERNMENT_ID_UPLOAD_URL: 'auth.create-government-id-upload-url',
  FORGOT_PASSWORD: 'auth.forgot-password',
  RESET_PASSWORD: 'auth.reset-password',
  // Admin user management
  FIND_ALL_USERS: 'auth.find-all-users',
  FIND_USER_BY_ID: 'auth.find-user-by-id',
  UPDATE_USER_STATUS: 'auth.update-user-status',
  UPDATE_USER_ROLE: 'auth.update-user-role',
  // Site manager profile
  UPDATE_DUTY_STATUS: 'auth.update-duty-status',
  UPDATE_ZONE: 'auth.update-zone',
} as const;

export const INVENTORY_PATTERNS = {
  FIND_ALL: 'operations.inventory.find-all',
  FIND_ONE: 'operations.inventory.find-one',
  CREATE: 'operations.inventory.create',
  UPDATE: 'operations.inventory.update',
  DELETE: 'operations.inventory.delete',
  ADJUST_QUANTITY: 'operations.inventory.adjust-quantity',
  GET_STATS: 'operations.inventory.get-stats',
} as const;

export const CAPACITY_PATTERNS = {
  FIND_ALL: 'operations.capacity.find-all',
  GET_STATS: 'operations.capacity.get-stats',
} as const;

export const ORGANIZATION_PATTERNS = {
  FIND_ALL: 'operations.organizations.find-all',
  FIND_ONE: 'operations.organizations.find-one',
  CREATE: 'operations.organizations.create',
  UPDATE: 'operations.organizations.update',
  DELETE: 'operations.organizations.delete',
  GET_STATS: 'operations.organizations.get-stats',
} as const;

export const DISASTER_EVENT_PATTERNS = {
  FIND_ALL: 'operations.disaster-events.find-all',
  FIND_ONE: 'operations.disaster-events.find-one',
  FIND_ACTIVE: 'operations.disaster-events.find-active',
  CREATE: 'operations.disaster-events.create',
  UPDATE: 'operations.disaster-events.update',
  DELETE: 'operations.disaster-events.delete',
  GET_STATS: 'operations.disaster-events.get-stats',
} as const;

export const RELIEF_OPERATION_PATTERNS = {
  FIND_ALL: 'operations.relief-operations.find-all',
  FIND_ONE: 'operations.relief-operations.find-one',
  CREATE: 'operations.relief-operations.create',
  UPDATE: 'operations.relief-operations.update',
  DELETE: 'operations.relief-operations.delete',
  GET_STATS: 'operations.relief-operations.get-stats',
} as const;

export const INCIDENT_REPORT_PATTERNS = {
  FIND_ALL: 'operations.incident-reports.find-all',
  FIND_ONE: 'operations.incident-reports.find-one',
  CREATE: 'operations.incident-reports.create',
  UPDATE: 'operations.incident-reports.update',
  DELETE: 'operations.incident-reports.delete',
  GET_STATS: 'operations.incident-reports.get-stats',
} as const;

export const DISTRIBUTION_PATTERNS = {
  FIND_ALL: 'operations.distributions.find-all',
  FIND_ONE: 'operations.distributions.find-one',
  CREATE: 'operations.distributions.create',
  UPDATE: 'operations.distributions.update',
  DELETE: 'operations.distributions.delete',
  GET_STATS: 'operations.distributions.get-stats',
} as const;

export const DISPATCH_ORDER_PATTERNS = {
  FIND_ALL: 'operations.dispatch-orders.find-all',
  FIND_ONE: 'operations.dispatch-orders.find-one',
  CREATE: 'operations.dispatch-orders.create',
  UPDATE: 'operations.dispatch-orders.update',
  DELETE: 'operations.dispatch-orders.delete',
  GET_STATS: 'operations.dispatch-orders.get-stats',
} as const;

export const REGISTRATION_PATTERNS = {
  FIND_CITIZENS: 'operations.registrations.find-citizens',
  FIND_CITIZEN: 'operations.registrations.find-citizen',
  CREATE_CITIZEN: 'operations.registrations.create-citizen',
  UPDATE_CITIZEN: 'operations.registrations.update-citizen',
  DELETE_CITIZEN: 'operations.registrations.delete-citizen',
  FIND_FAMILIES: 'operations.registrations.find-families',
  FIND_FAMILIES_BY_HEAD: 'operations.registrations.find-families-by-head',
  FIND_FAMILY: 'operations.registrations.find-family',
  CREATE_FAMILY: 'operations.registrations.create-family',
  UPDATE_FAMILY: 'operations.registrations.update-family',
  DELETE_FAMILY: 'operations.registrations.delete-family',
  DELETE_FAMILY_BY_QR: 'operations.registrations.delete-family-by-qr',
  CREATE_ANIMAL: 'operations.registrations.create-animal',
  FIND_ANIMALS_BY_USER: 'operations.registrations.find-animals-by-user',
  DELETE_ANIMALS_BY_USER: 'operations.registrations.delete-animals-by-user',
  GET_STATS: 'operations.registrations.get-stats',
} as const;

export const CHECK_IN_PATTERNS = {
  FIND_ALL: 'operations.check-in.find-all',
  FIND_ONE: 'operations.check-in.find-one',
  CREATE_MANUAL: 'operations.check-in.create-manual',
  SCAN_QR: 'operations.check-in.scan-qr',
  CHECK_OUT: 'operations.check-in.check-out',
  GET_STATS: 'operations.check-in.get-stats',
  GET_RECENT: 'operations.check-in.get-recent',
} as const;

export const DASHBOARD_PATTERNS = {
  GET_OVERVIEW: 'operations.dashboard.get-overview',
} as const;

export const AFTER_ACTION_ASSESSMENT_PATTERNS = {
  GET_LATEST: 'operations.after-action-assessment.get-latest',
  UPSERT: 'operations.after-action-assessment.upsert',
} as const;

export const UPLOAD_PATTERNS = {
  CREATE_DISASTER_COVER_UPLOAD_URL: 'operations.uploads.create-disaster-cover-upload-url',
  CREATE_INCIDENT_ATTACHMENT_UPLOAD_URL: 'operations.uploads.create-incident-attachment-upload-url',
  CREATE_OBJECT_VIEW_URL: 'operations.uploads.create-object-view-url',
} as const;
