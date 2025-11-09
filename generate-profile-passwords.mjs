#!/usr/bin/env node

/**
 * Generate Random Passwords for Profile Password Protection
 * 
 * Generates random passwords and creates SQL script to update profiles.password_hash column.
 * This is for the new password protection system (not auth.users).
 * 
 * Password format:
 * - 10 characters long
 * - Mix of uppercase, lowercase, numbers, and special characters
 * - Randomly generated
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
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

async function generatePasswords() {
  console.log('\n🔐 Generating Random Passwords for Profile Protection\n');
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
    
    return {
      id: profile.id,
      fullName: profile.full_name,
      role: profile.role,
      password,
    };
  });

  // Display passwords
  console.log('Generated passwords:\n');
  passwordData.forEach((data, index) => {
    console.log(`${index + 1}. ${data.fullName}`);
    console.log(`   Password: ${data.password}`);
    console.log(`   Role: ${data.role}`);
    console.log('');
  });

  // Generate SQL script
  const sqlScript = generateSQLScript(passwordData);

  // Save SQL script
  const sqlPath = join(__dirname, 'setup-profile-passwords-generated.sql');
  writeFileSync(sqlPath, sqlScript, 'utf-8');
  console.log(`✅ SQL script saved to: ${sqlPath}\n`);

  // Save passwords to secure file
  const passwordsPath = join(__dirname, 'PROFILE_PASSWORDS.md');
  const passwordsContent = generatePasswordsFile(passwordData);
  writeFileSync(passwordsPath, passwordsContent, 'utf-8');
  console.log(`✅ Passwords saved to: ${passwordsPath}\n`);

  console.log('='.repeat(70));
  console.log('\n✅ Password generation complete!\n');
  console.log('Next steps:');
  console.log('1. Review the passwords in PROFILE_PASSWORDS.md');
  console.log('2. Run setup-profile-passwords-generated.sql in Supabase Dashboard');
  console.log('3. Share passwords securely with users\n');
}

function generateSQLScript(passwordData) {
  let sql = `-- ============================================================================
-- SETUP PROFILE PASSWORDS (GENERATED)
-- ============================================================================
-- 
-- This script was generated by generate-profile-passwords.mjs
-- It updates the password_hash column in the profiles table for all profiles.
--
-- INSTRUCTIONS:
-- 1. Make sure migration 20250215000000_add_profile_passwords.sql has been run
-- 2. Go to your Supabase Dashboard > SQL Editor
-- 3. Copy-paste this ENTIRE file
-- 4. Click "Run" (or press Cmd/Ctrl + Enter)
-- 5. Review the verification output at the end
--
-- SECURITY:
-- - Passwords are randomly generated (10 characters, secure format)
-- - Passwords are hashed using pgcrypto (bcrypt algorithm, 10 rounds)
-- - Plaintext passwords are stored in PROFILE_PASSWORDS.md
-- - Share passwords securely with each user individually
--
-- ============================================================================

-- Ensure pgcrypto extension is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- UPDATE PROFILE PASSWORDS
-- ============================================================================

`;

  // Add UPDATE statements for each profile
  passwordData.forEach((data) => {
    sql += `-- ${data.fullName} (${data.role})\n`;
    sql += `UPDATE public.profiles\n`;
    sql += `SET password_hash = crypt('${data.password.replace(/'/g, "''")}', gen_salt('bf', 10)),\n`;
    sql += `    updated_at = now()\n`;
    sql += `WHERE id = '${data.id}';\n`;
    sql += `\n`;
  });

  sql += `-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Show all profiles with password status
SELECT 
  id,
  full_name,
  role,
  CASE 
    WHEN password_hash IS NOT NULL AND password_hash != '' THEN '✅ Password set'
    ELSE '❌ No password'
  END as password_status
FROM public.profiles
ORDER BY full_name;

-- ============================================================================
`;

  return sql;
}

function generatePasswordsFile(passwordData) {
  let content = `# Profile Passwords - Store Securely

⚠️ **SECURITY WARNING:** Store passwords in a secure password manager. Do not commit this file to git.

**Generated:** ${new Date().toISOString()}
**Total Profiles:** ${passwordData.length}

## Password Format

All passwords are randomly generated secure passwords:
- Length: 10 characters
- Contains: Uppercase, lowercase, numbers, and one special character
- Format: Random (not predictable)

## Profile Credentials

`;

  // Group by role
  const adminUsers = passwordData.filter(p => p.role === 'admin');
  const extractors = passwordData.filter(p => p.role === 'extractor');
  const observers = passwordData.filter(p => p.role === 'observer');

  if (adminUsers.length > 0) {
    content += `### Admin Users\n\n`;
    adminUsers.forEach((data, index) => {
      content += `${index + 1}. **${data.fullName}**\n`;
      content += `   - Password: \`${data.password}\`\n`;
      content += `   - Role: Admin\n\n`;
    });
  }

  if (extractors.length > 0) {
    content += `### Data Extractors & Project Leads\n\n`;
    extractors.forEach((data, index) => {
      content += `${index + 1}. **${data.fullName}**\n`;
      content += `   - Password: \`${data.password}\`\n`;
      content += `   - Role: Data Extractor\n\n`;
    });
  }

  if (observers.length > 0) {
    content += `### Observers\n\n`;
    observers.forEach((data, index) => {
      content += `${index + 1}. **${data.fullName}**\n`;
      content += `   - Password: \`${data.password}\`\n`;
      content += `   - Role: Observer\n\n`;
    });
  }

  content += `## Security Notes

- **Share passwords securely** - Use encrypted messaging or password manager sharing
- **Do NOT email passwords** - Use secure channels only
- **Store in password manager** - Consider using 1Password, LastPass, or similar

## Password Reset

To reset a password for a profile:

\`\`\`sql
UPDATE public.profiles
SET password_hash = crypt('newpassword', gen_salt('bf', 10))
WHERE id = 'profile-uuid-here';
\`\`\`

---

**Last Updated:** ${new Date().toISOString()}
**Generated By:** generate-profile-passwords.mjs

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

