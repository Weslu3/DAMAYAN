import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

type AppRole = 'admin' | 'dispatcher' | 'line_manager' | 'citizen';

type SeedUser = {
  email: string;
  password: string;
  role: AppRole;
  firstName: string;
  lastName: string;
  phone: string;
  status: 'active' | 'pending' | 'rejected';
  dutyStatus?: 'on_duty' | 'off_duty';
};

const USERS: SeedUser[] = [
  {
    email: 'admin@damayan.local',
    password: 'Damayan123!',
    role: 'admin',
    firstName: 'Alyssa',
    lastName: 'Admin',
    phone: '09170000001',
    status: 'active',
  },
  {
    email: 'dispatcher@damayan.local',
    password: 'Damayan123!',
    role: 'dispatcher',
    firstName: 'Diego',
    lastName: 'Dispatcher',
    phone: '09170000002',
    status: 'active',
    dutyStatus: 'on_duty',
  },
  {
    email: 'sitemanager@damayan.local',
    password: 'Damayan123!',
    role: 'line_manager',
    firstName: 'Mara',
    lastName: 'Manager',
    phone: '09170000003',
    status: 'active',
    dutyStatus: 'on_duty',
  },
  {
    email: 'citizen1@damayan.local',
    password: 'Damayan123!',
    role: 'citizen',
    firstName: 'Carlo',
    lastName: 'Citizen',
    phone: '09170000004',
    status: 'active',
  },
  {
    email: 'citizen2@damayan.local',
    password: 'Damayan123!',
    role: 'citizen',
    firstName: 'Nina',
    lastName: 'Citizen',
    phone: '09170000005',
    status: 'active',
  },
];

function mustEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function findUserByEmail(supabase: ReturnType<typeof createClient>, email: string) {
  const perPage = 200;
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }

    const found = data.users.find((u) => (u.email ?? '').toLowerCase() === email.toLowerCase());
    if (found) {
      return found;
    }

    if (data.users.length < perPage) {
      break;
    }
  }

  return null;
}

async function ensureAuthUser(supabase: ReturnType<typeof createClient>, user: SeedUser) {
  const existing = await findUserByEmail(supabase, user.email);
  if (existing) {
    return existing;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: {
      first_name: user.firstName,
      last_name: user.lastName,
      role: user.role,
    },
  });

  if (error || !data.user) {
    throw error ?? new Error(`Failed to create auth user ${user.email}`);
  }

  return data.user;
}

async function safeInsert<T extends Record<string, unknown>>(
  supabase: ReturnType<typeof createClient>,
  table: string,
  rows: T[] | T,
) {
  const { error } = await supabase.from(table).insert(rows as never);
  if (!error) {
    return;
  }

  const msg = (error.message ?? '').toLowerCase();
  if (
    error.code === '42P01' ||
    msg.includes('relation') ||
    msg.includes('does not exist') ||
    msg.includes('duplicate key')
  ) {
    return;
  }

  throw error;
}

async function safeUpsert<T extends Record<string, unknown>>(
  supabase: ReturnType<typeof createClient>,
  table: string,
  rows: T[] | T,
  onConflict?: string,
) {
  const query = supabase.from(table).upsert(rows as never, onConflict ? { onConflict } : undefined);
  const { error } = await query;
  if (!error) {
    return;
  }

  if (error.code === '42P01') {
    return;
  }

  throw error;
}

async function main() {
  const supabaseUrl = mustEnv('SUPABASE_URL');
  const serviceRoleKey = mustEnv('SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('Seeding auth users...');
  const authUsers = new Map<string, string>();

  for (const user of USERS) {
    const authUser = await ensureAuthUser(supabase, user);
    authUsers.set(user.email, authUser.id);
  }

  console.log('Seeding user_profiles...');
  const profileRows = USERS.map((u) => ({
    auth_user_id: authUsers.get(u.email),
    first_name: u.firstName,
    last_name: u.lastName,
    phone: u.phone,
    role: u.role,
    status: u.status,
    duty_status: u.dutyStatus ?? 'off_duty',
    municipality: 'Manila',
    province: 'Metro Manila',
    barangay: 'Sampaloc',
  }));

  await safeUpsert(supabase, 'user_profiles', profileRows, 'auth_user_id');

  console.log('Seeding singleton settings...');
  await safeUpsert(
    supabase,
    'system_settings',
    [{ id: 1, current_phase: 'BEFORE' }],
    'id',
  );

  console.log('Seeding organizations...');
  await safeInsert(supabase, 'organizations', [
    {
      name: 'Philippine Red Cross - Sample',
      type: 'ngo',
      contact_email: 'sample-redcross@damayan.local',
      contact_phone: '02-8123-4567',
      address: 'Manila',
      verified: true,
    },
    {
      name: 'NDRRMC - Sample',
      type: 'government',
      contact_email: 'sample-ndrrmc@damayan.local',
      contact_phone: '02-8765-4321',
      address: 'Quezon City',
      verified: true,
    },
  ]);

  console.log('Seeding disaster event...');
  const adminId = authUsers.get('admin@damayan.local');
  const dispatcherId = authUsers.get('dispatcher@damayan.local');
  const lineManagerId = authUsers.get('sitemanager@damayan.local');
  const citizen1Id = authUsers.get('citizen1@damayan.local');
  const citizen2Id = authUsers.get('citizen2@damayan.local');

  if (!adminId || !dispatcherId || !lineManagerId || !citizen1Id || !citizen2Id) {
    throw new Error('Auth user IDs not resolved.');
  }

  const { data: disasterRows } = await supabase
    .from('disaster_events')
    .select('id')
    .limit(1);

  let disasterId = disasterRows?.[0]?.id as string | undefined;

  if (!disasterId) {
    const { data, error } = await supabase
      .from('disaster_events')
      .insert({
        name: 'Typhoon Sample 2026',
        type: 'typhoon',
        severity_level: 'high',
        affected_areas: ['Manila', 'Quezon City'],
        province: 'Metro Manila',
        date_started: new Date().toISOString().slice(0, 10),
        status: 'active',
        declared_by: adminId,
        notes: 'Seeded disaster event',
      })
      .select('id')
      .single();

    if (error) {
      throw error;
    }
    disasterId = data.id;
  }

  console.log('Seeding evacuation centers...');
  await safeInsert(supabase, 'evacuation_centers', [
    {
      name: 'Sampaloc Evacuation Center A',
      address: 'Lacson Ave, Sampaloc, Manila',
      barangay: 'Sampaloc',
      municipality: 'Manila',
      capacity: 300,
      current_occupancy: 87,
      facilities: ['water', 'toilets', 'clinic'],
      contact_person: 'Mara Manager',
      contact_phone: '09170000003',
      status: 'open',
      description: 'Main center for north Sampaloc',
      max_managers: 2,
      lat: 14.6101,
      lng: 120.9892,
    },
    {
      name: 'Sampaloc Evacuation Center B',
      address: 'España Blvd, Sampaloc, Manila',
      barangay: 'Sampaloc',
      municipality: 'Manila',
      capacity: 250,
      current_occupancy: 140,
      facilities: ['water', 'food_station'],
      contact_person: 'Diego Dispatcher',
      contact_phone: '09170000002',
      status: 'open',
      description: 'Overflow center',
      max_managers: 2,
      lat: 14.6048,
      lng: 120.9885,
    },
  ]);

  const { data: centerRows } = await supabase
    .from('evacuation_centers')
    .select('id,name')
    .limit(2);

  if (centerRows && centerRows[0]) {
    await safeUpsert(
      supabase,
      'shelter_assignments',
      [{ center_id: centerRows[0].id, manager_id: lineManagerId }],
      'manager_id',
    );
  }

  console.log('Seeding relief operation and inventory...');
  const { data: operationRows } = await supabase
    .from('relief_operations')
    .select('id')
    .limit(1);

  let operationId = operationRows?.[0]?.id as string | undefined;

  if (!operationId) {
    const { data, error } = await supabase
      .from('relief_operations')
      .insert({
        disaster_id: disasterId,
        name: 'Initial Relief Wave',
        description: 'Seeded relief operation for dashboard',
        start_date: new Date().toISOString().slice(0, 10),
        lead_officer_id: adminId,
        status: 'ongoing',
      })
      .select('id')
      .single();

    if (error) {
      throw error;
    }
    operationId = data.id;
  }

  await safeInsert(supabase, 'relief_items', [
    {
      operation_id: operationId,
      item_name: 'Rice Packs',
      category: 'food',
      quantity: 500,
      unit: 'packs',
      source: 'donated',
      status: 'available',
    },
    {
      operation_id: operationId,
      item_name: 'Basic Medicines',
      category: 'medicine',
      quantity: 120,
      unit: 'kits',
      source: 'procured',
      status: 'available',
    },
  ]);

  console.log('Seeding incident + dispatch order...');
  const { data: incidentRows } = await supabase
    .from('incident_reports')
    .select('id')
    .limit(1);

  let incidentId = incidentRows?.[0]?.id as string | undefined;

  if (!incidentId) {
    const { data, error } = await supabase
      .from('incident_reports')
      .insert({
        disaster_id: disasterId,
        reported_by: citizen1Id,
        title: 'Flooded street near barangay hall',
        content: 'Water is knee-deep, families requesting rescue support.',
        severity: 'high',
        location: 'Sampaloc, Manila',
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) {
      throw error;
    }
    incidentId = data.id;
  }

  await safeInsert(supabase, 'dispatch_orders', {
    report_id: incidentId,
    operation_id: operationId,
    assigned_to: dispatcherId,
    disaster_id: disasterId,
    priority: 'urgent',
    instructions: 'Assess area and coordinate evac support.',
    status: 'pending',
  });

  console.log('Seeding citizens, family and notifications...');
  await safeUpsert(
    supabase,
    'register_citizens',
    [
      {
        user_id: citizen1Id,
        registration_type: 'Individual',
        full_name: 'Carlo Citizen',
        gender: 'male',
        blood_type: 'O+',
        medical_conditions: 'None',
        qr_code_id: 'QR-CITIZEN-0001',
      },
      {
        user_id: citizen2Id,
        registration_type: 'Individual',
        full_name: 'Nina Citizen',
        gender: 'female',
        blood_type: 'A+',
        medical_conditions: 'Asthma',
        qr_code_id: 'QR-CITIZEN-0002',
      },
    ],
    'user_id',
  );

  const { data: familyGroupRows } = await supabase
    .from('family_groups')
    .select('id')
    .eq('head_user_id', citizen1Id)
    .limit(1);

  let familyGroupId = familyGroupRows?.[0]?.id as string | undefined;

  if (!familyGroupId) {
    const { data, error } = await supabase
      .from('family_groups')
      .insert({
        family_qr_code_id: 'QR-FAMILY-0001',
        head_user_id: citizen1Id,
        family_name: 'Citizen Household',
      })
      .select('id')
      .single();

    if (!error && data) {
      familyGroupId = data.id;
    }
  }

  if (familyGroupId) {
    await safeInsert(supabase, 'family_group_members', {
      family_group_id: familyGroupId,
      citizen_qr_code_id: 'QR-CITIZEN-0002',
      member_user_id: citizen2Id,
      member_full_name: 'Nina Citizen',
      relationship: 'Sibling',
    });
  }

  await safeInsert(supabase, 'notifications', [
    {
      user_id: dispatcherId,
      title: 'Dispatch Queue Ready',
      body: 'Sample incident has been queued for response.',
      type: 'dispatch',
      read: false,
      data: { severity: 'high' },
    },
    {
      user_id: lineManagerId,
      title: 'Shelter Occupancy Update',
      body: 'Center A occupancy reached 87/300.',
      type: 'capacity',
      read: false,
      data: { center: 'Sampaloc Evacuation Center A' },
    },
  ]);

  await safeInsert(supabase, 'drm_alerts', {
    id: `ALERT-${Date.now()}`,
    dispatcher_id: dispatcherId,
    scope: 'barangay',
    target: 'Sampaloc',
    title: 'Flood Advisory',
    message: 'Moderate flooding expected in low-lying streets.',
    severity: 'warning',
    instructions: ['Avoid flooded roads', 'Proceed to nearest evacuation center'],
  });

  await safeInsert(supabase, 'drm_sos', {
    id: `SOS-${Date.now()}`,
    sender_id: citizen1Id,
    barangay: 'Sampaloc',
    name: 'Carlo Citizen',
    message: 'Need assistance for elderly evacuee.',
    lat: 14.6048,
    lng: 120.9885,
    resolved: false,
  });

  await safeInsert(supabase, 'ph_city_catalog', {
    psgc_code: '133900000',
    city_name: 'City of Manila',
    province_name: 'Metro Manila',
    region_name: 'NCR',
    latitude: 14.5904,
    longitude: 120.9804,
  });

  await safeInsert(supabase, 'barangay_demographics', [
    {
      name: 'Brgy. 390',
      population: 5200,
      density: 45000,
      elderly: 450,
      infants: 120,
      risk_level: 'High',
      lat: 14.6051,
      lng: 120.9897,
      municipality: 'Sampaloc, Manila',
    },
    {
      name: 'Brgy. 485',
      population: 3800,
      density: 32000,
      elderly: 280,
      infants: 85,
      risk_level: 'Medium',
      lat: 14.6072,
      lng: 120.9872,
      municipality: 'Sampaloc, Manila',
    },
  ]);

  console.log('Seeding complete.');
  console.log('Seeded logins:');
  for (const user of USERS) {
    console.log(`- ${user.email} / ${user.password}`);
  }
}

main().catch((error) => {
  console.error('Seeder failed:', error);
  process.exit(1);
});
