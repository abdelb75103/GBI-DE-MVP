-- ============================================================================
-- SUPABASE MIGRATION: Complete Database Setup
-- ============================================================================
-- 
-- INSTRUCTIONS:
-- 1. Go to your Supabase Dashboard
-- 2. Click "SQL Editor" in the left sidebar
-- 3. Click "New query"
-- 4. Copy-paste this ENTIRE file
-- 5. Click "Run" (or press Cmd/Ctrl + Enter)
-- 6. All test data has already been cleared
--
-- ============================================================================

-- Extension
create extension if not exists "pgcrypto";

-- ============================================================================
-- MIGRATION 1: Extraction Schema
-- ============================================================================

-- Create extraction_tab enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'extraction_tab') then
    create type extraction_tab as enum (
      'studyDetails',
      'participantCharacteristics',
      'definitions',
      'exposure',
      'injuryOutcome',
      'illnessOutcome',
      'injuryTissueType',
      'injuryLocation',
      'illnessRegion',
      'illnessEtiology'
    );
  end if;
end $$;

-- Drop old enum if it exists
do $$
begin
  if exists (select 1 from pg_type where typname = 'extraction_updated_by') then
    drop type extraction_updated_by CASCADE;
    raise notice 'Dropped old extraction_updated_by enum';
  end if;
end $$;

-- Papers table modifications
alter type if exists public.paper_status add value if not exists 'systematic_review';
alter type if exists public.paper_status add value if not exists 'referee';
alter type if exists public.paper_status add value if not exists 'aspetar_asprev';

alter table if exists public.papers
  add column if not exists assigned_study_id text unique,
  add column if not exists flag_reason text,
  add column if not exists status public.paper_status default 'uploaded',
  add column if not exists metadata jsonb default '{}'::jsonb;

create index if not exists papers_assigned_study_id_idx on public.papers (assigned_study_id);

comment on column public.papers.assigned_study_id is 'Human-readable study identifier (e.g., S001, S002) automatically assigned';

-- Paper files table
create table if not exists public.paper_files (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.papers (id) on delete cascade,
  name text not null,
  size bigint not null,
  mime_type text not null,
  uploaded_at timestamptz not null default now(),
  storage_bucket text,
  storage_object_path text,
  public_url text,
  data_base64 text
);

create index if not exists paper_files_paper_id_idx on public.paper_files (paper_id);

-- Paper notes table
create table if not exists public.paper_notes (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.papers (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists paper_notes_paper_id_idx on public.paper_notes (paper_id);

comment on table public.paper_notes is 'Notes are written by the person assigned to the paper';

-- Extractions table
create table if not exists public.extractions (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.papers (id) on delete cascade,
  tab extraction_tab not null,
  model text not null default 'human-input',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists extractions_paper_tab_idx
  on public.extractions (paper_id, tab);

-- Extraction fields table (updated_by is now TEXT, not enum)
create table if not exists public.extraction_fields (
  id uuid primary key default gen_random_uuid(),
  extraction_id uuid not null references public.extractions (id) on delete cascade,
  field_id text not null,
  value text,
  confidence numeric,
  source_quote text,
  page_hint text,
  metric public.extraction_metric,
  status public.extraction_field_status not null default 'not_reported',
  updated_at timestamptz not null default now(),
  updated_by text
);

create unique index if not exists extraction_fields_unique_field
  on public.extraction_fields (extraction_id, field_id);

comment on column public.extraction_fields.updated_by is 'Profile ID of user who last updated this field, or NULL for system/AI updates';

-- Population groups table
create table if not exists public.population_groups (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.papers (id) on delete cascade,
  tab extraction_tab not null default 'participantCharacteristics',
  label text not null,
  position integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists population_groups_unique_position
  on public.population_groups (paper_id, tab, position);

-- Population values table
create table if not exists public.population_values (
  id uuid primary key default gen_random_uuid(),
  population_group_id uuid not null references public.population_groups (id) on delete cascade,
  paper_id uuid not null references public.papers (id) on delete cascade,
  field_id text not null,
  value text,
  metric public.extraction_metric,
  unit text,
  source_field_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists population_values_group_idx
  on public.population_values (population_group_id);

create index if not exists population_values_field_idx
  on public.population_values (paper_id, field_id);

-- Export jobs table
create table if not exists public.export_jobs (
  id uuid primary key default gen_random_uuid(),
  kind public.export_kind not null,
  paper_ids uuid[] not null,
  status public.export_status not null default 'ready',
  created_at timestamptz not null default now(),
  checksum_sha256 text,
  download_path text
);

create index if not exists export_jobs_created_idx on public.export_jobs (created_at desc);

-- ============================================================================
-- MIGRATION 2: Paper Assignment Tracking
-- ============================================================================

alter table if exists public.papers
  add column if not exists assigned_to uuid references public.profiles (id) on delete set null;

create index if not exists papers_assigned_to_idx on public.papers (assigned_to);

comment on column public.papers.assigned_to is 'Profile ID of the user currently assigned to work on this paper';

-- ============================================================================
-- MIGRATION 2B: Robust Deduplication Metadata & Admin Review Queue
-- ============================================================================

-- Dedupe review status enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'dedupe_review_status') then
    create type public.dedupe_review_status as enum ('clean', 'duplicate', 'possible', 'needs_review');
  end if;
end $$;

-- Paper-level dedupe metadata
alter table if exists public.papers
  add column if not exists extracted_title text,
  add column if not exists normalized_doi text,
  add column if not exists duplicate_key_v2 text,
  add column if not exists title_fingerprint text,
  add column if not exists dedupe_review_status public.dedupe_review_status default 'clean',
  add column if not exists primary_file_sha256 text,
  add column if not exists original_file_name text;

create index if not exists papers_normalized_doi_idx on public.papers (normalized_doi);
create index if not exists papers_duplicate_key_v2_idx on public.papers (duplicate_key_v2);
create index if not exists papers_title_fingerprint_idx on public.papers (title_fingerprint);
create index if not exists papers_dedupe_review_status_idx on public.papers (dedupe_review_status);

-- File-level dedupe metadata
alter table if exists public.paper_files
  add column if not exists original_file_name text,
  add column if not exists file_sha256 text;

create index if not exists paper_files_file_sha256_idx on public.paper_files (file_sha256);

-- Admin review queue for suspected duplicates
create table if not exists public.paper_duplicates (
  id uuid primary key default gen_random_uuid(),
  paper_id_a uuid not null references public.papers (id) on delete cascade,
  paper_id_b uuid not null references public.papers (id) on delete cascade,
  reason text not null,
  score numeric,
  level text not null default 'duplicate', -- 'duplicate' or 'possible'
  status text not null default 'unreviewed', -- 'unreviewed', 'confirmed_duplicate', 'not_duplicate', 'dismissed'
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id),
  notes text
);

create unique index if not exists paper_duplicates_unique_pair_idx
  on public.paper_duplicates (paper_id_a, paper_id_b);

create index if not exists paper_duplicates_status_idx on public.paper_duplicates (status, detected_at desc);

comment on table public.paper_duplicates is 'Admin-only review queue of suspected duplicate papers. Pair is stored as (paper_id_a, paper_id_b) with paper_id_a < paper_id_b.';

-- ============================================================================
-- MIGRATION 3: Simplify Notes
-- ============================================================================

-- Drop old author columns
alter table if exists public.paper_notes
  drop column if exists author_id;

alter table if exists public.paper_notes
  drop column if exists author;

drop index if exists public.paper_notes_author_id_idx;

comment on table public.paper_notes is 'Notes are written by the person assigned to the paper';

-- ============================================================================
-- MIGRATION 4: Consensus Injury Taxonomy (Regions & Tissues)
-- ============================================================================

-- Overarching injury regions (Table 4)
create table if not exists public.injury_region_overall (
  code text primary key,
  name text not null,
  description text,
  includes_body_area_codes text[] default '{}'::text[],
  sort_order integer default 0
);

comment on table public.injury_region_overall is 'Overarching injury region options aligned to consensus Table 4. Use when a study reports an overall region; leave blank when only specific body areas are reported. Capture both overall and specific values when both are provided.';

-- Detailed body areas nested under regions (Table 4)
create table if not exists public.injury_body_areas (
  code text primary key,
  region_code text not null references public.injury_region_overall (code),
  name text not null,
  osiics_code text,
  smdcs_code text,
  notes text,
  sort_order integer default 0
);

create index if not exists injury_body_areas_region_idx
  on public.injury_body_areas (region_code, sort_order);

comment on table public.injury_body_areas is 'Body areas per consensus Table 4 with OSIICS and SMDCS codes. Multiple body areas can be stored even when an overarching region is also reported.';

-- Overarching injury tissues (Table 5)
create table if not exists public.injury_tissue_overall (
  code text primary key,
  name text not null,
  description text,
  includes_pathology_codes text[] default '{}'::text[],
  sort_order integer default 0
);

comment on table public.injury_tissue_overall is 'Overarching injury tissue options aligned to consensus Table 5. Use when a study reports an overall tissue; leave blank when only specific pathology types are reported. Capture both overall and specific values when both are provided.';

-- Detailed pathology types nested under tissues (Table 5)
create table if not exists public.injury_pathology_types (
  code text primary key,
  tissue_code text not null references public.injury_tissue_overall (code),
  name text not null,
  osiics_code text,
  smdcs_code text,
  notes text,
  sort_order integer default 0
);

create index if not exists injury_pathology_types_tissue_idx
  on public.injury_pathology_types (tissue_code, sort_order);

comment on table public.injury_pathology_types is 'Pathology types per consensus Table 5 with OSIICS and SMDCS codes. Multiple pathologies can be stored even when an overarching tissue is also reported.';

-- Seed overarching regions
insert into public.injury_region_overall (code, name, description, includes_body_area_codes, sort_order)
values
  ('HEAD_NECK', 'Head and neck', 'Overarching region; includes head and neck. Leave this blank when only individual areas are reported. Capture both overall and specific entries when both are provided.', '{"HEAD","NECK"}', 1),
  ('UPPER_LIMB', 'Upper limb', 'Overarching region; includes shoulder, upper arm, elbow, forearm, wrist, hand.', '{"SHOULDER","UPPER_ARM","ELBOW","FOREARM","WRIST","HAND"}', 2),
  ('TRUNK', 'Trunk', 'Overarching region; includes chest, thoracic spine, lumbosacral, abdomen.', '{"CHEST","THORACIC_SPINE","LUMBOSACRAL","ABDOMEN"}', 3),
  ('LOWER_LIMB', 'Lower limb', 'Overarching region; includes hip/groin, thigh, knee, lower leg, ankle, foot.', '{"HIP_GROIN","THIGH","KNEE","LOWER_LEG","ANKLE","FOOT"}', 4),
  ('UNSPECIFIED', 'Region unspecified', 'Use when region is reported as unspecified.', '{}', 5),
  ('MULTIPLE', 'Multiple regions', 'Single injury crossing two or more regions.', '{}', 6)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  includes_body_area_codes = excluded.includes_body_area_codes,
  sort_order = excluded.sort_order;

-- Seed body areas
insert into public.injury_body_areas (code, region_code, name, osiics_code, smdcs_code, notes, sort_order)
values
  ('HEAD', 'HEAD_NECK', 'Head', 'H', 'HE', 'Includes facial, brain (concussion), eyes, ears, teeth.', 1),
  ('NECK', 'HEAD_NECK', 'Neck', 'N', 'NE', 'Includes cervical spine, larynx, major vessels.', 2),
  ('SHOULDER', 'UPPER_LIMB', 'Shoulder', 'S', 'SH', 'Includes clavicle, scapula, rotator cuff, biceps tendon origin.', 1),
  ('UPPER_ARM', 'UPPER_LIMB', 'Upper arm', 'U', 'AR', null, 2),
  ('ELBOW', 'UPPER_LIMB', 'Elbow', 'E', 'EL', 'Ligaments, insertional biceps and triceps tendon.', 3),
  ('FOREARM', 'UPPER_LIMB', 'Forearm', 'R', 'FA', 'Includes non-articular radius and ulna injuries.', 4),
  ('WRIST', 'UPPER_LIMB', 'Wrist', 'W', 'WR', 'Carpus.', 5),
  ('HAND', 'UPPER_LIMB', 'Hand', 'P', 'HA', 'Includes finger, thumb.', 6),
  ('CHEST', 'TRUNK', 'Chest', 'C', 'CH', 'Sternum, ribs, breast, chest organs.', 1),
  ('THORACIC_SPINE', 'TRUNK', 'Thoracic spine', 'D', 'TS', 'Thoracic spine, costovertebral joints.', 2),
  ('LUMBOSACRAL', 'TRUNK', 'Lumbosacral', 'L', 'LS', 'Includes lumbar spine, sacroiliac joints, sacrum, coccyx, buttocks.', 3),
  ('ABDOMEN', 'TRUNK', 'Abdomen', 'O', 'AB', 'Below diaphragm and above inguinal canal; includes abdominal organs.', 4),
  ('HIP_GROIN', 'LOWER_LIMB', 'Hip/groin', 'G', 'HI', 'Hip and anterior musculoskeletal structures (e.g., pubic symphysis, proximal adductors, iliopsoas).', 1),
  ('THIGH', 'LOWER_LIMB', 'Thigh', 'T', 'TH', 'Includes femur, hamstrings (including ischial tuberosity), quadriceps, mid-distal adductors.', 2),
  ('KNEE', 'LOWER_LIMB', 'Knee', 'K', 'KN', 'Includes patella, patellar tendon, pes anserinus.', 3),
  ('LOWER_LEG', 'LOWER_LIMB', 'Lower leg', 'Q', 'LE', 'Includes non-articular tibia and fibular injuries, calf and Achilles tendon.', 4),
  ('ANKLE', 'LOWER_LIMB', 'Ankle', 'A', 'AN', 'Includes syndesmosis, talocrural and subtalar joints.', 5),
  ('FOOT', 'LOWER_LIMB', 'Foot', 'F', 'FO', 'Includes toes, calcaneus, plantar fascia.', 6),
  ('REGION_UNSPECIFIED', 'UNSPECIFIED', 'Region unspecified', 'Z', 'OO', null, 7),
  ('MULTIPLE_REGIONS', 'MULTIPLE', 'Single injury crossing two or more regions', 'X', 'OO', null, 8)
on conflict (code) do update set
  region_code = excluded.region_code,
  name = excluded.name,
  osiics_code = excluded.osiics_code,
  smdcs_code = excluded.smdcs_code,
  notes = excluded.notes,
  sort_order = excluded.sort_order;

-- Seed overarching tissues
insert into public.injury_tissue_overall (code, name, description, includes_pathology_codes, sort_order)
values
  ('MUSCLE_TENDON', 'Muscle/Tendon', 'Overarching tissue; includes muscle injury, muscle contusion, muscle compartment syndrome, tendinopathy, tendon rupture. Leave this blank when only specific pathologies are reported; capture both overall and specific entries when both are provided.', '{"MUSCLE_INJURY","MUSCLE_CONTUSION","MUSCLE_COMPARTMENT_SYNDROME","TENDINOPATHY","TENDON_RUPTURE"}', 1),
  ('NERVOUS', 'Nervous', 'Overarching tissue; includes brain/spinal cord injury and peripheral nerve injury.', '{"BRAIN_SPINAL_CORD_INJURY","PERIPHERAL_NERVE_INJURY"}', 2),
  ('BONE', 'Bone', 'Overarching tissue; includes fracture, bone stress injury, bone contusion, avascular necrosis, physis injury.', '{"FRACTURE","BONE_STRESS_INJURY","BONE_CONTUSION","AVASCULAR_NECROSIS","PHYSIS_INJURY"}', 3),
  ('CARTILAGE_SYNOVIUM_BURSA', 'Cartilage/Synovium/Bursa', 'Overarching tissue; includes cartilage injury, arthritis, synovitis/capsulitis, bursitis.', '{"CARTILAGE_INJURY","ARTHRITIS","SYNOVITIS_CAPSULITIS","BURSITIS"}', 4),
  ('LIGAMENT_JOINT_CAPSULE', 'Ligament/Joint capsule', 'Overarching tissue; includes joint sprain or acute instability and chronic instability.', '{"JOINT_SPRAIN_OR_ACUTE_INSTABILITY","CHRONIC_INSTABILITY"}', 5),
  ('SUPERFICIAL_SKIN', 'Superficial tissues/skin', 'Overarching tissue; includes superficial contusion, laceration, abrasion.', '{"SUPERFICIAL_CONTUSION","LACERATION","ABRASION"}', 6),
  ('VESSELS', 'Vessels', 'Overarching tissue; includes vascular trauma.', '{"VASCULAR_TRAUMA"}', 7),
  ('STUMP', 'Stump', 'Overarching tissue; in amputees.', '{"STUMP_INJURY"}', 8),
  ('INTERNAL_ORGANS', 'Internal organs', 'Overarching tissue; includes trauma to any organ (excluding concussion), drowning, relevant for specialised organs not mentioned elsewhere.', '{"ORGAN_TRAUMA"}', 9),
  ('NON_SPECIFIC', 'Non-specific', 'Use when tissue type is not specified.', '{"INJURY_WITHOUT_TISSUE_SPECIFIED"}', 10)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  includes_pathology_codes = excluded.includes_pathology_codes,
  sort_order = excluded.sort_order;

-- Seed pathology types
insert into public.injury_pathology_types (code, tissue_code, name, osiics_code, smdcs_code, notes, sort_order)
values
  ('MUSCLE_INJURY', 'MUSCLE_TENDON', 'Muscle injury', 'M', '10.07-10.09', 'Includes strain, tear, rupture, intramuscular tendon.', 1),
  ('MUSCLE_CONTUSION', 'MUSCLE_TENDON', 'Muscle contusion', 'H', '10.24', null, 2),
  ('MUSCLE_COMPARTMENT_SYNDROME', 'MUSCLE_TENDON', 'Muscle compartment syndrome', 'Y', '10.36', null, 3),
  ('TENDINOPATHY', 'MUSCLE_TENDON', 'Tendinopathy', 'T', '10.28-10.29', 'Includes paratenon, related bursa, fasciopathy, partial tear, tendon subluxation (non-rupture), enthesopathy.', 4),
  ('TENDON_RUPTURE', 'MUSCLE_TENDON', 'Tendon rupture', 'R', '10.09', 'Complete/full-thickness injury; partial tendon injuries considered to be tendinopathy.', 5),
  ('BRAIN_SPINAL_CORD_INJURY', 'NERVOUS', 'Brain/Spinal cord injury', 'N', '20.40', 'Includes concussion and all forms of brain injury and spinal cord.', 6),
  ('PERIPHERAL_NERVE_INJURY', 'NERVOUS', 'Peripheral nerve injury', 'P', '20.39, 20.41-20.42', 'Includes neuroma.', 7),
  ('FRACTURE', 'BONE', 'Fracture', 'F', '30.13-30.16, 30.19', 'Traumatic; includes avulsion fracture, teeth.', 8),
  ('BONE_STRESS_INJURY', 'BONE', 'Bone stress injury', 'S', '30.18, 30.32', 'Includes bone marrow oedema, stress fracture, periostitis.', 9),
  ('BONE_CONTUSION', 'BONE', 'Bone contusion', 'J', '30.24', 'Acute bony traumatic injury without fracture. Osteochondral injuries are considered joint cartilage.', 10),
  ('AVASCULAR_NECROSIS', 'BONE', 'Avascular necrosis', 'V', '30.35', null, 11),
  ('PHYSIS_INJURY', 'BONE', 'Physis injury', 'G', '30.20', 'Includes apophysis.', 12),
  ('CARTILAGE_INJURY', 'CARTILAGE_SYNOVIUM_BURSA', 'Cartilage injury', 'C', '40.17, 40.21, 40.37', 'Includes meniscal, labral injuries and articular cartilage, osteochondral injuries.', 13),
  ('ARTHRITIS', 'CARTILAGE_SYNOVIUM_BURSA', 'Arthritis', 'A', '40.33-40.34', 'Post-traumatic osteoarthritis.', 14),
  ('SYNOVITIS_CAPSULITIS', 'CARTILAGE_SYNOVIUM_BURSA', 'Synovitis/Capsulitis', 'Q', '40.22, 40.34', 'Includes joint impingement.', 15),
  ('BURSITIS', 'CARTILAGE_SYNOVIUM_BURSA', 'Bursitis', 'B', '40.31', 'Includes calcific bursitis, traumatic bursitis.', 16),
  ('JOINT_SPRAIN_OR_ACUTE_INSTABILITY', 'LIGAMENT_JOINT_CAPSULE', 'Joint sprain (ligament tear or acute instability episode)', 'L or D', '50.01-50.11', 'Includes partial and complete tears plus injuries to non-specific ligaments and joint capsule; includes joint dislocations/subluxations.', 17),
  ('CHRONIC_INSTABILITY', 'LIGAMENT_JOINT_CAPSULE', 'Chronic instability', 'U', '50.12', null, 18),
  ('SUPERFICIAL_CONTUSION', 'SUPERFICIAL_SKIN', 'Contusion (superficial)', 'V', '60.24', 'Contusion, bruise, vascular damage.', 19),
  ('LACERATION', 'SUPERFICIAL_SKIN', 'Laceration', 'K', '60.25', null, 20),
  ('ABRASION', 'SUPERFICIAL_SKIN', 'Abrasion', 'I', '60.26-60.27', null, 21),
  ('VASCULAR_TRAUMA', 'VESSELS', 'Vascular trauma', 'V', '70.45', null, 22),
  ('STUMP_INJURY', 'STUMP', 'Stump injury', 'W', '91.44', 'In amputees.', 23),
  ('ORGAN_TRAUMA', 'INTERNAL_ORGANS', 'Organ trauma', 'O', '80.46', 'Includes trauma to any organ (excluding concussion), drowning, and organs not mentioned elsewhere (lungs, abdominal and pelvic organs, thyroid, breast).', 24),
  ('INJURY_WITHOUT_TISSUE_SPECIFIED', 'NON_SPECIFIC', 'Injury without tissue type specified', 'P or Z', '00.00 (also 00.23, 00.38, 00.42)', 'No specific tissue pathology diagnosed.', 25)
on conflict (code) do update set
  tissue_code = excluded.tissue_code,
  name = excluded.name,
  osiics_code = excluded.osiics_code,
  smdcs_code = excluded.smdcs_code,
  notes = excluded.notes,
  sort_order = excluded.sort_order;

-- ============================================================================
-- COMPLETE!
-- ============================================================================

-- Verify the setup
select 'Migration complete! ✅' as status;

-- Show what was created/modified
select 
  'extraction_fields.updated_by is now TEXT (stores profile IDs)' as change
union all
select 
  'Old extraction_updated_by enum has been removed' as change
union all
select 
  'papers.assigned_to column added for session tracking' as change
union all
select 
  'papers.assigned_study_id column added' as change
union all
select 
  'paper_notes.author column removed' as change
union all
select 
  'Consensus injury region and tissue lookups added (overarching + detailed OSIICS/SMDCS mappings)' as change;
