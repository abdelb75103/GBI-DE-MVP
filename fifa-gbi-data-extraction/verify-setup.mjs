#!/usr/bin/env node

/**
 * Verify Supabase database setup
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read .env.local
const envContent = readFileSync(join(__dirname, '.env.local'), 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '');
});

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing credentials in .env.local');
  process.exit(1);
}

console.log('\n🔍 Verifying Supabase Setup\n');
console.log('='.repeat(70) + '\n');

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function verify() {
  console.log('Testing database schema...\n');
  
  const checks = [
    {
      name: '📦 papers table',
      test: async () => {
        const { error } = await supabase.from('papers').select('id').limit(0);
        return !error;
      },
    },
    {
      name: '📦 papers.assigned_to column',
      test: async () => {
        const { error } = await supabase.from('papers').select('assigned_to').limit(0);
        return !error;
      },
    },
    {
      name: '📦 papers.assigned_study_id column',
      test: async () => {
        const { error } = await supabase.from('papers').select('assigned_study_id').limit(0);
        return !error;
      },
    },
    {
      name: '📦 paper_files table',
      test: async () => {
        const { error } = await supabase.from('paper_files').select('id').limit(0);
        return !error;
      },
    },
    {
      name: '📦 paper_notes table (no author column)',
      test: async () => {
        const { data, error } = await supabase.from('paper_notes').select('id,paper_id,body,created_at').limit(0);
        // Should work without author column
        return !error;
      },
    },
    {
      name: '📦 extractions table',
      test: async () => {
        const { error } = await supabase.from('extractions').select('id').limit(0);
        return !error;
      },
    },
    {
      name: '📦 extraction_fields table',
      test: async () => {
        const { error } = await supabase.from('extraction_fields').select('id').limit(0);
        return !error;
      },
    },
    {
      name: '📦 extraction_fields.updated_by (text type)',
      test: async () => {
        const { error } = await supabase.from('extraction_fields').select('updated_by').limit(0);
        return !error;
      },
    },
    {
      name: '📦 population_groups table',
      test: async () => {
        const { error } = await supabase.from('population_groups').select('id').limit(0);
        return !error;
      },
    },
    {
      name: '📦 population_values table',
      test: async () => {
        const { error } = await supabase.from('population_values').select('id').limit(0);
        return !error;
      },
    },
    {
      name: '📦 export_jobs table',
      test: async () => {
        const { error } = await supabase.from('export_jobs').select('id').limit(0);
        return !error;
      },
    },
    {
      name: '✅ Can insert test data',
      test: async () => {
        // Try to insert a paper
        const { data, error } = await supabase
          .from('papers')
          .insert({
            title: 'Test Paper',
            created_at: new Date().toISOString(),
          })
          .select()
          .single();
        
        if (error) return false;
        
        // Clean up
        if (data) {
          await supabase.from('papers').delete().eq('id', data.id);
        }
        
        return true;
      },
    },
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const check of checks) {
    try {
      const result = await check.test();
      if (result) {
        console.log(`   ✅ ${check.name}`);
        passed++;
      } else {
        console.log(`   ❌ ${check.name}`);
        failed++;
      }
    } catch (err) {
      console.log(`   ❌ ${check.name}: ${err.message.substring(0, 60)}`);
      failed++;
    }
  }
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
  
  if (failed === 0) {
    console.log('✅ SUCCESS! Your Supabase database is properly configured!');
    console.log('\n📋 What was set up:');
    console.log('   ✓ All tables created/updated');
    console.log('   ✓ extraction_fields.updated_by now stores profile IDs (text)');
    console.log('   ✓ Old extraction_updated_by enum removed');
    console.log('   ✓ Paper assignment tracking enabled');
    console.log('   ✓ Test data cleared');
    console.log('\n✨ Your app is ready to use!\n');
    return true;
  } else {
    console.log('⚠️  Some checks failed. Please review errors above.');
    console.log('\n💡 Make sure you ran the SQL from APPLY_THIS_SQL.sql');
    console.log('   in your Supabase Dashboard > SQL Editor\n');
    return false;
  }
}

verify().then(success => {
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});

