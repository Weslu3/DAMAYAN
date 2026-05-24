import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

type SeedUser = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  qrCodeId: string;
  registrationType: 'Individual' | 'Household';
};

const DEMO_PASSWORD = process.env.SEED_DEMO_USER_PASSWORD ?? 'password123';

const USERS: SeedUser[] = [
  {
    email: 'carlo.citizen@damayan.local',
    password: DEMO_PASSWORD,
    firstName: 'Carlo',
    lastName: 'Citizen',
    qrCodeId: 'QR-CITIZEN-0001',
    registrationType: 'Family',
  },
  {
    email: 'nina.citizen@damayan.local',
    password: DEMO_PASSWORD,
    firstName: 'Nina',
    lastName: 'Citizen',
    qrCodeId: 'QR-CITIZEN-0002',
    registrationType: 'Individual',
  },
];

const FAMILY_QR = 'QR-FAMILY-GROUP-0001';
const FAMILY_NAME = 'Citizen Household';

async function ensureUser(
  supabase: ReturnType<typeof createClient>,
  user: SeedUser,
): Promise<string> {
  const usersResult = await supabase.auth.admin.listUsers();
  if (usersResult.error) throw new Error(usersResult.error.message);

  const existing = usersResult.data.users.find((entry) => entry.email?.toLowerCase() === user.email);
  if (existing) {
    return existing.id;
  }

  const created = await supabase.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: {
      first_name: user.firstName,
      last_name: user.lastName,
      role: 'citizen',
    },
  });

  if (created.error || !created.data.user) {
    throw new Error(created.error?.message ?? `Failed creating ${user.email}`);
  }

  return created.data.user.id;
}

async function run(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const userIds: string[] = [];

  for (const user of USERS) {
    const userId = await ensureUser(supabase, user);
    userIds.push(userId);

    const { error: profileError } = await supabase.from('user_profiles').upsert(
      {
        auth_user_id: userId,
        first_name: user.firstName,
        last_name: user.lastName,
        role: 'citizen',
        status: 'active',
      },
      { onConflict: 'auth_user_id' },
    );

    if (profileError) throw new Error(profileError.message);

    const { error: citizenError } = await supabase.from('register_citizens').upsert(
      {
        user_id: userId,
        full_name: `${user.firstName} ${user.lastName}`,
        registration_type: user.registrationType,
        qr_code_id: user.qrCodeId,
      },
      { onConflict: 'user_id' },
    );

    if (citizenError) throw new Error(citizenError.message);
  }

  const headUserId = userIds[0];
  const memberUserId = userIds[1];

  const existingGroup = await supabase
    .from('family_groups')
    .select('id')
    .eq('family_qr_code_id', FAMILY_QR)
    .maybeSingle();

  if (existingGroup.error) throw new Error(existingGroup.error.message);

  let groupId = existingGroup.data?.id as string | undefined;

  if (!groupId) {
    const createdGroup = await supabase
      .from('family_groups')
      .insert({
        family_qr_code_id: FAMILY_QR,
        head_user_id: headUserId,
        family_name: FAMILY_NAME,
      })
      .select('id')
      .single();

    if (createdGroup.error || !createdGroup.data) {
      throw new Error(createdGroup.error?.message ?? 'Failed creating family group');
    }

    groupId = createdGroup.data.id;
  }

  const { error: memberError } = await supabase.from('family_group_members').upsert(
    {
      family_group_id: groupId,
      citizen_qr_code_id: USERS[1].qrCodeId,
      member_user_id: memberUserId,
      member_full_name: `${USERS[1].firstName} ${USERS[1].lastName}`,
      relationship: 'Sibling',
    },
    { onConflict: 'family_group_id,citizen_qr_code_id' },
  );

  if (memberError) throw new Error(memberError.message);

  console.log('Seeded demo users and family group successfully.');
  console.log(`Family QR: ${FAMILY_QR}`);
  for (const user of USERS) {
    console.log(`User: ${user.email} | Password: ${user.password} | QR: ${user.qrCodeId}`);
  }
}

try {
  await run();
} catch (error) {
  console.error('Seed failed:', error instanceof Error ? error.message : error);
  process.exit(1);
}
