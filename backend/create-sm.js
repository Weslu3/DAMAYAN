import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

async function createSiteManager() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const email = 'sitemanager@damayan.com';
  const password = 'password123';

  console.log('Creating auth user...');
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: 'Site',
      last_name: 'Manager',
      role: 'line_manager'
    }
  });

  if (authError) {
    if (authError.message.includes('already exists')) {
      console.log('User already exists. Approving the existing user...');
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers.users.find(u => u.email === email);
      if (existingUser) {
        await supabase
          .from('user_profiles')
          .update({ status: 'active', role: 'line_manager' })
          .eq('auth_user_id', existingUser.id);
        console.log('User approved! Login with:', email, 'password123');
      }
      return;
    }
    console.error('Error creating user:', authError);
    return;
  }

  const userId = authData.user.id;
  console.log('Auth user created. Creating profile...');

  const { error: profileError } = await supabase
    .from('user_profiles')
    .insert({
      auth_user_id: userId,
      first_name: 'Site',
      last_name: 'Manager',
      role: 'line_manager',
      status: 'active'
    });

  if (profileError) {
    console.error('Error creating profile:', profileError);
    // If it violates unique constraint because trigger created it, update it
    if (profileError.code === '23505') {
        await supabase
          .from('user_profiles')
          .update({ status: 'active', role: 'line_manager' })
          .eq('auth_user_id', userId);
        console.log('Profile updated to active.');
    }
  }

  console.log('Site Manager successfully created!');
  console.log('Email:', email);
  console.log('Password:', password);
}

createSiteManager();
