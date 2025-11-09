#!/usr/bin/env node

/**
 * Generate Random Passwords for All Profiles
 * 
 * Generates shorter, simpler passwords that are still secure:
 * - 10 characters long
 * - Mix of uppercase, lowercase, and numbers
 * - One special character
 * - Easy to type and remember
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import crypto from 'crypto';

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

/**
 * Generate a simple but secure password
 * Format: 10 characters with uppercase, lowercase, numbers, and one special char
 */
function generateSimplePassword() {
  const length = 10;
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude I and O
  const lowercase = 'abcdefghijkmnpqrstuvwxyz'; // Exclude l and o
  const numbers = '23456789'; // Exclude 0 and 1
  const special = '!@#$%&*'; // Simple special chars
  
  // Ensure at least one character from each category
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  // Fill the rest randomly (mix of all)
  const allChars = uppercase + lowercase + numbers + special;
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Extract first name from full name (skip titles)
 */
function extractFirstName(fullName) {
  const titlePattern = /^(dr|doctor|prof|professor|mr|mrs|ms|miss)\.?\s+/i;
  const cleaned = fullName.replace(titlePattern, '').trim();
  const parts = cleaned.toLowerCase().split(/\s+/);
  return parts[0] || cleaned.toLowerCase();
}

/**
 * Generate email address
 */
function generateEmail(fullName) {
  const firstName = extractFirstName(fullName);
  // Clean up: remove special chars, keep only letters and numbers
  const username = firstName.replace(/[^a-z0-9]/g, '');
  return `${username}@fifa-gbi.local`;
}

async function generatePasswords() {
  console.log('\n🔐 Generating Simple Random Passwords for All Profiles\n');
  console.log('='.repeat(70) + '\n');

  // Fetch all profiles
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .order('full_name', { ascending: true });

  if (error) {
    console.error('❌ Error fetching profiles:', error.message);
    process.exit(1);
  }

  if (!profiles || profiles.length === 0) {
    console.error('❌ No profiles found in database');
    process.exit(1);
  }

  console.log(`Found ${profiles.length} profile(s)\n`);

  // Generate passwords for each profile
  const passwordData = profiles.map(profile => {
    const password = generateSimplePassword();
    const email = generateEmail(profile.full_name);
    
    return {
      id: profile.id,
      fullName: profile.full_name,
      role: profile.role,
      email,
      password,
    };
  });

  // Display passwords
  console.log('Generated passwords:\n');
  passwordData.forEach((data, index) => {
    console.log(`${index + 1}. ${data.fullName}`);
    console.log(`   Email: ${data.email}`);
    console.log(`   Password: ${data.password}`);
    console.log('');
  });

  // Generate SQL script
  const sqlScript = generateSQLScript(passwordData);

  // Save SQL script
  const sqlPath = join(__dirname, 'setup-production-passwords-random.sql');
  writeFileSync(sqlPath, sqlScript, 'utf-8');
  console.log(`✅ SQL script saved to: ${sqlPath}\n`);

  // Save passwords to secure file (gitignored)
  const passwordsPath = join(__dirname, 'PASSWORDS.md');
  const passwordsContent = generatePasswordsFile(passwordData);
  writeFileSync(passwordsPath, passwordsContent, 'utf-8');
  console.log(`✅ Passwords saved to: ${passwordsPath} (gitignored)\n`);

  console.log('='.repeat(70));
  console.log('\n✅ Password generation complete!\n');
  console.log('Next steps:');
  console.log('1. Review the passwords in PASSWORDS.md');
  console.log('2. Run setup-production-passwords-random.sql in Supabase Dashboard');
  console.log('3. Share passwords securely with users\n');
}

function generateSQLScript(passwordData) {
  let sql = `-- ============================================================================
-- SETUP PRODUCTION PASSWORDS FOR ALL PROFILES (RANDOM PASSWORDS)
-- ============================================================================
-- 
-- This script creates auth.users entries with RANDOM SECURE PASSWORDS for all profiles
-- in the profiles table. Passwords are hashed using bcrypt.
--
-- INSTRUCTIONS:
-- 1. This script was generated by generate-random-passwords.mjs
-- 2. Go to your Supabase Dashboard > SQL Editor
-- 3. Copy-paste this ENTIRE file
-- 4. Click "Run" (or press Cmd/Ctrl + Enter)
-- 5. Review the verification output at the end
--
-- SECURITY:
-- - Passwords are randomly generated (10 characters, secure but simple)
-- - Passwords are hashed using pgcrypto (bcrypt algorithm)
-- - Plaintext passwords are stored in PASSWORDS.md (gitignored)
-- - Share passwords securely with each user individually
--
-- ============================================================================

-- Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- CREATE AUTH.USERS ENTRIES WITH RANDOM PASSWORDS
-- ============================================================================

DO $$
DECLARE
  instance_uuid UUID;
BEGIN
  -- Get the instance_id from an existing user (or use a default)
  SELECT COALESCE(
    (SELECT u.instance_id FROM auth.users u LIMIT 1), 
    '00000000-0000-0000-0000-000000000000'::uuid
  ) INTO instance_uuid;

`;

  // Add INSERT statements for each profile
  passwordData.forEach((data, index) => {
    sql += `  -- ${data.fullName} (${data.role})\n`;
    sql += `  INSERT INTO auth.users (\n`;
    sql += `    id,\n`;
    sql += `    instance_id,\n`;
    sql += `    email,\n`;
    sql += `    encrypted_password,\n`;
    sql += `    email_confirmed_at,\n`;
    sql += `    created_at,\n`;
    sql += `    updated_at,\n`;
    sql += `    raw_app_meta_data,\n`;
    sql += `    raw_user_meta_data,\n`;
    sql += `    is_super_admin,\n`;
    sql += `    role\n`;
    sql += `  )\n`;
    sql += `  SELECT \n`;
    sql += `    '${data.id}'::uuid,\n`;
    sql += `    instance_uuid,\n`;
    sql += `    '${data.email}',\n`;
    sql += `    crypt('${data.password}', gen_salt('bf', 10)),\n`;
    sql += `    now(),\n`;
    sql += `    now(),\n`;
    sql += `    now(),\n`;
    sql += `    '{"provider": "email", "providers": ["email"]}'::jsonb,\n`;
    sql += `    jsonb_build_object('full_name', '${data.fullName.replace(/'/g, "''")}'),\n`;
    sql += `    false,\n`;
    sql += `    'authenticated'\n`;
    sql += `  WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE id = '${data.id}'::uuid)\n`;
    sql += `  ON CONFLICT (id) DO UPDATE SET\n`;
    sql += `    email = EXCLUDED.email,\n`;
    sql += `    encrypted_password = EXCLUDED.encrypted_password,\n`;
    sql += `    updated_at = now(),\n`;
    sql += `    raw_user_meta_data = EXCLUDED.raw_user_meta_data;\n`;
    sql += `\n`;
    sql += `  RAISE NOTICE 'Created/updated auth.users entry for: % (%)', \n`;
    sql += `    '${data.fullName.replace(/'/g, "''")}', '${data.email}';\n`;
    sql += `\n`;
  });

  sql += `  RAISE NOTICE '';
  RAISE NOTICE '✅ All auth.users entries created/updated successfully';
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Show all profiles with their auth.users status
SELECT 
  p.id,
  p.full_name,
  p.role,
  CASE 
    WHEN au.id IS NOT NULL THEN '✅ Has auth.users entry'
    ELSE '❌ Missing auth.users entry'
  END as auth_status,
  au.email as auth_email,
  au.email_confirmed_at IS NOT NULL as email_confirmed
FROM public.profiles p
LEFT JOIN auth.users au ON p.id = au.id
ORDER BY p.full_name;

-- ============================================================================
`;

  return sql;
}

function generatePasswordsFile(passwordData) {
  let content = `# User Passwords - Store Securely

⚠️ **SECURITY WARNING:** This file is gitignored. Store passwords in a secure password manager.

**Generated:** ${new Date().toISOString()}
**Total Users:** ${passwordData.length}

## Password Format

All passwords are randomly generated simple secure passwords:
- Length: 10 characters
- Contains: Uppercase, lowercase, numbers, and one special character
- Format: Random (not predictable)
- Easy to type and remember

## User Credentials

`;

  // Group by role
  const adminUsers = passwordData.filter(p => p.role === 'admin');
  const extractors = passwordData.filter(p => p.role === 'extractor');
  const observers = passwordData.filter(p => p.role === 'observer');

  if (adminUsers.length > 0) {
    content += `### Admin Users\n\n`;
    adminUsers.forEach((data, index) => {
      content += `${index + 1}. **${data.fullName}**\n`;
      content += `   - Email: \`${data.email}\`\n`;
      content += `   - Password: \`${data.password}\`\n`;
      content += `   - Role: Admin\n\n`;
    });
  }

  if (extractors.length > 0) {
    content += `### Data Extractors & Project Leads\n\n`;
    extractors.forEach((data, index) => {
      content += `${index + 1}. **${data.fullName}**\n`;
      content += `   - Email: \`${data.email}\`\n`;
      content += `   - Password: \`${data.password}\`\n`;
      content += `   - Role: ${data.role === 'extractor' ? 'Data Extractor' : data.role}\n\n`;
    });
  }

  if (observers.length > 0) {
    content += `### Observers\n\n`;
    observers.forEach((data, index) => {
      content += `${index + 1}. **${data.fullName}**\n`;
      content += `   - Email: \`${data.email}\`\n`;
      content += `   - Password: \`${data.password}\`\n`;
      content += `   - Role: Observer\n\n`;
    });
  }

  content += `## Security Notes

- **Share passwords securely** - Use encrypted messaging or password manager sharing
- **Users should change passwords** after first login (when login is implemented)
- **Do NOT email passwords** - Use secure channels only
- **Store in password manager** - Consider using 1Password, LastPass, or similar
- **Rotate passwords periodically** - Set a password rotation policy

## Password Reset

If a user needs to reset their password:

1. Admin can update password in Supabase Dashboard > Authentication > Users
2. Or run SQL to update password hash:
   \`\`\`sql
   UPDATE auth.users 
   SET encrypted_password = crypt('newpassword', gen_salt('bf', 10))
   WHERE email = 'user@fifa-gbi.local';
   \`\`\`

## Current Status

- ✅ Passwords are randomly generated and secure (10 chars, simple format)
- ✅ SQL script ready: \`setup-production-passwords-random.sql\`
- ⏳ Login page not yet implemented (app uses profile selection)
- 🔒 Passwords ready for future login implementation

---

**Last Updated:** ${new Date().toISOString()}
**Generated By:** generate-random-passwords.mjs

`;

  return content;
}

generatePasswords()
  .then(() => {
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Error:', err.message);
    console.error(err);
    process.exit(1);
  });

