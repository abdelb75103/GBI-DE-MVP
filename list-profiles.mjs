#!/usr/bin/env node

/**
 * List all profiles from Supabase
 * This helps identify which profiles need auth.users entries
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try to read .env.local from the project root or fifa-gbi-data-extraction directory
let env = {};
const envPaths = [
  join(__dirname, '.env.local'),
  join(__dirname, 'fifa-gbi-data-extraction', '.env.local'),
];

for (const envPath of envPaths) {
  try {
    const envContent = readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([A-Z_]+)=(.*)$/);
      if (match) {
        env[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
    });
    break;
  } catch (err) {
    // Continue to next path
  }
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials');
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  console.error('   Set them in .env.local or as environment variables\n');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function listProfiles() {
  console.log('\n📋 Listing all profiles from database\n');
  console.log('='.repeat(70) + '\n');

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .order('full_name', { ascending: true });

  if (error) {
    console.error('❌ Error fetching profiles:', error.message);
    process.exit(1);
  }

  if (!profiles || profiles.length === 0) {
    console.log('⚠️  No profiles found in database.\n');
    return;
  }

  console.log(`Found ${profiles.length} profile(s):\n`);

  profiles.forEach((profile, index) => {
    console.log(`${index + 1}. ${profile.full_name}`);
    console.log(`   ID: ${profile.id}`);
    console.log(`   Role: ${profile.role}`);
    console.log('');
  });

  // Check which profiles have auth.users entries
  console.log('Checking auth.users entries...\n');

  const profileIds = profiles.map(p => p.id);
  const { data: authUsers, error: authError } = await supabase
    .from('auth.users')
    .select('id, email')
    .in('id', profileIds);

  if (authError) {
    console.log('⚠️  Could not check auth.users (may need to query directly in Supabase Dashboard)');
  } else {
    const authUserIds = new Set((authUsers || []).map(u => u.id));
    
    console.log('Profiles with auth.users entries:');
    profiles.forEach(profile => {
      const hasAuth = authUserIds.has(profile.id);
      console.log(`   ${hasAuth ? '✅' : '❌'} ${profile.full_name} (${profile.id})`);
    });
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n✅ Profile listing complete\n');
}

listProfiles()
  .then(() => {
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Error:', err.message);
    console.error(err);
    process.exit(1);
  });















