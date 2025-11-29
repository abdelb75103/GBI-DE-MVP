-- Consensus injury taxonomy lookups (regions, body areas, tissues, pathology types)
-- Adds overarching options plus detailed OSIICS/SMDCS mappings from the consensus tables

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
