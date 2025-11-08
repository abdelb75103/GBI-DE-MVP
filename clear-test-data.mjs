#!/usr/bin/env node

/**
 * Clear all test data from Supabase
 * This script deletes all test data while preserving the schema and user profiles
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

// Also check process.env for environment variables
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials');
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  console.error('   Set them in .env.local or as environment variables\n');
  process.exit(1);
}

console.log('\n🧹 Clearing all test data from Supabase\n');
console.log('='.repeat(70) + '\n');

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function getCounts() {
  const [papers, exportJobs] = await Promise.all([
    supabase.from('papers').select('id', { count: 'exact', head: true }),
    supabase.from('export_jobs').select('id', { count: 'exact', head: true }),
  ]);

  return {
    papers: papers.count || 0,
    exportJobs: exportJobs.count || 0,
  };
}

async function clearTestData() {
  console.log('📊 Current data counts:\n');
  
  const beforeCounts = await getCounts();
  console.log(`   Papers: ${beforeCounts.papers}`);
  console.log(`   Export Jobs: ${beforeCounts.exportJobs}\n`);

  if (beforeCounts.papers === 0 && beforeCounts.exportJobs === 0) {
    console.log('✅ Database is already empty. Nothing to clear.\n');
    return;
  }

  console.log('🗑️  Deleting test data...\n');

  // Delete export jobs first (standalone table)
  if (beforeCounts.exportJobs > 0) {
    console.log('   Deleting export jobs...');
    const { error: exportError } = await supabase
      .from('export_jobs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (exportError) {
      console.error(`   ❌ Error deleting export_jobs: ${exportError.message}`);
    } else {
      console.log(`   ✅ Deleted ${beforeCounts.exportJobs} export job(s)`);
    }
  }

  // Delete papers (this will cascade delete all related data)
  if (beforeCounts.papers > 0) {
    console.log('   Deleting papers (and all related data)...');
    const { error: papersError } = await supabase
      .from('papers')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (papersError) {
      console.error(`   ❌ Error deleting papers: ${papersError.message}`);
    } else {
      console.log(`   ✅ Deleted ${beforeCounts.papers} paper(s) and all related data`);
    }
  }

  console.log('\n📊 Verifying deletion...\n');

  // Wait a moment for cascade deletes to complete
  await new Promise(resolve => setTimeout(resolve, 1000));

  const afterCounts = await getCounts();
  
  // Also check related tables
  const [paperFiles, paperNotes, extractions, extractionFields, populationGroups, populationValues] = await Promise.all([
    supabase.from('paper_files').select('id', { count: 'exact', head: true }),
    supabase.from('paper_notes').select('id', { count: 'exact', head: true }),
    supabase.from('extractions').select('id', { count: 'exact', head: true }),
    supabase.from('extraction_fields').select('id', { count: 'exact', head: true }),
    supabase.from('population_groups').select('id', { count: 'exact', head: true }),
    supabase.from('population_values').select('id', { count: 'exact', head: true }),
  ]);

  console.log('   Papers: ' + (afterCounts.papers === 0 ? '✅' : '❌') + ` ${afterCounts.papers}`);
  console.log('   Paper Files: ' + ((paperFiles.count || 0) === 0 ? '✅' : '❌') + ` ${paperFiles.count || 0}`);
  console.log('   Paper Notes: ' + ((paperNotes.count || 0) === 0 ? '✅' : '❌') + ` ${paperNotes.count || 0}`);
  console.log('   Extractions: ' + ((extractions.count || 0) === 0 ? '✅' : '❌') + ` ${extractions.count || 0}`);
  console.log('   Extraction Fields: ' + ((extractionFields.count || 0) === 0 ? '✅' : '❌') + ` ${extractionFields.count || 0}`);
  console.log('   Population Groups: ' + ((populationGroups.count || 0) === 0 ? '✅' : '❌') + ` ${populationGroups.count || 0}`);
  console.log('   Population Values: ' + ((populationValues.count || 0) === 0 ? '✅' : '❌') + ` ${populationValues.count || 0}`);
  console.log('   Export Jobs: ' + (afterCounts.exportJobs === 0 ? '✅' : '❌') + ` ${afterCounts.exportJobs}`);

  console.log('\n' + '='.repeat(70));

  if (afterCounts.papers === 0 && afterCounts.exportJobs === 0) {
    console.log('\n✅ SUCCESS: All test data has been cleared!');
    console.log('\n📋 Preserved data:');
    console.log('   ✓ User profiles (profiles table)');
    console.log('   ✓ Authentication users (auth.users)');
    console.log('   ✓ Database schema and structure\n');
    return true;
  } else {
    console.log('\n⚠️  WARNING: Some data still remains. Check the counts above.\n');
    return false;
  }
}

clearTestData()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('\n❌ Error:', err.message);
    console.error(err);
    process.exit(1);
  });

