# Fifa GBI Data Extraction Assistant - **MVP PRD (Scaffold-First, No Auth)**

> Version: 0.9 (MVP)  
> Date: 2025-10-24  
> Scope: **Scaffolding + core functionality**, **ignore auth** for now (single dev user/session).  
> Source schema: **FIFA GBI Data Extraction Sheet .xlsx** (see tabs/columns below).  
> File size rule: PDFs must be **≤ 20 MB**.  
> Name: **Fifa GBI Data Extraction Assistant**.

---

## 1) MVP Goals (what we deliver now)

- A working **scaffold** you can run locally and deploy:
  - Frontend app with **PDF viewer** (paginate/search) and **right-pane forms**.
  - Data layer (DB + storage) with tables for **papers, files, extractions, notes, flags, exports, audit_log**.
  - **Upload → dedupe** pipeline (≤ 20 MB; exact + fuzzy checks; DOI if present).
  - **Auto-extract** (server-side) for **first 4 tabs** of the Excel (AI-suggested until confirmed).
  - **Exports** (CSV/JSON) in **canonical Excel column order** (all tabs; blank when missing).
  - **OCR fallback** only if **no text layer** detected.

- **Out of scope (now):** proper auth/roles, second-review workflow, advanced dashboards, email/SSO.

**Why ignore auth now?** To unblock the build; we’ll use a **single dev user** in code and lock all secrets server-side. We’ll add local-auth later.

---

## 2) Success Criteria (MVP)

- Upload works and **blocks duplicates** deterministically.  
- First 4 tabs auto-extract end-to-end with **AI-suggested** labels.  
- CSV/JSON export **matches Excel column order** exactly.  
- Audit log shows who/what/when (single dev user for now).  
- Typical 10–15 page PDF auto-extract completes in **≤ 30 s** on clean text-layer PDFs.

---
## 3) Source Schema (cleaned - no 'Unnamed')

**Auto-extract fields** = **Tabs 1–4** (listed in order).
**Export order** = **All tabs in the workbook** (top to bottom), **every column included**.

### Tab 1: Study Details
- Study ID
- Lead Author
- Title
- Year of Publication
- Journal
- DOI
- Study Design

### Tab 2: Participant Characteristics 
- Study ID
- FIFA Discipline
- Country
- Level of Play
- Sex
- Age Category
- Mean age (±SD) or age range
- Sample Size (players)
- Number of teams/clubs
- Study period (years)
- Observation duration

### Tab 3: Definition & Data Collection 
- Study ID
- Injury Definition
- Ilness Definition
- Mental Health Problem Definition
- Incidence Definition
- Burden Definitioon
- Severity Definition
- Recurrence Definition
- Mechanism of Injury Reporting

### Tab 4: Exposure Data
- Study ID
- Length of season/tournament (weeks)
- Number of seasons
- Exposure Measurement (unit)
- Total Exposure
- Match Exposure
- Training Exposure

### Tab 5: Injury Outcome
- Study ID
- Total number of injuries
- Number of match injuries
- Number of training injuries
- Injury incidence (overall)
- Match injury incidence
- Training injury incidence
- Injury incidence 95% CI
- Adjusted Injury incidence (overall)
- Confounders
- Total Time-Loss due to Injury
- Median Time-loss
- Mean Time-Loss
- Injury Burden
- Injury Burden 95% CI
- Most common injury diagnosis
- Most common injury type
- Most common injury location
- Miost Common Injury Severity Class
- Mode of Onset - Repetitive Gradual
- Mode of Onset - Repetitive Sudden
- Mode of Onset - Acute Sudden
- Contact
- Non-Contact
- Cumalative (Repititive)
- Median injury duration
- Mean injury duration (±SD)
- Total recurrent injuries
- Recurrence rate (%)

### Tab 6: Illness Outcome
- Study ID
- Total number of Illnesses
- Number of match Illnesses
- Number of training Illnesses
- Illnesses incidence (overall)
- Match Illnesses incidence
- Training Illnesses incidence
- Illnesses incidence 95% CI
- Total Time-Loss due to Illnesses
- Median Time-loss
- Mean Time-Loss
- Illness Burden
- Illness Burden 95% CI
- Most Common Organ System/Region for Illnesses
- Most Common Etiology of Illnesses
- Miost Common Illness Severity Class
- Mode of Onset - Gradual
- Mode of Onset - Sudden
- Median Illness duration
- Mean Illness duration (±SD)

### Tab 7: Mental Health Outcomes
- Study ID
- Total number of Mental Health (MH) Problems
- MH Problems incidence (overall)
- Method of Reporting MH Problems
- Total Time-Loss due to MH Problems
- Median Time-loss
- Mean Time-Loss
- MH Problems Burden
- Most Common MH Symptoms
- Most Common MH Disorder
- Most Common MH Severity Class
- Mode of Onset - Gradual
- Mode of Onset - Acute
- Mode of Onset - Mixed
- Mode of Onset - Unknown
- Median Illness duration
- Mean Illness duration (±SD)
- Total recurrent MH Problems
- Recurrence rate (%)

### Tab 8: Injury Tissue & Type
- Study ID
- Muscle/Tendon
- Muscle Injury
- Muscle Contusion
- Muscel Compartment Syndrome
- Tendinopathy
- Tendon Rupture
- Nervous
- Brain/Spinal Cord Injury
- Peripheral nerve injury
- Bone
- Fracture
- Bone Stress Injury
- Bone Contusion
- Avascular necrosis
- Physis Injury
- Cartilage/synovium/bursa
- Cartilage Injury
- Arthrirtis
- Synovitis/capsulitis
- Bursitis
- Ligament/joint capsule
- Joint Sprain
- Chronic Instabality
- Superficial tissues/skin
- Contusion (superficial)
- Laceration
- Abrasion
- Vessels
- Stump
- Internal Organs

### Tab 9: Injury Location
- Study ID
- Head and Neck
- Head
- Neck
- Upper Limb
- Shoulder
- Upper Arm
- Elbow
- Forearm
- Wrist
- Hand
- Trunk
- Chest
- Thoracic Spine
- Lumboscaral
- Abdomen
- Lower Limb
- Hip
- Groin
- Thigh
- Knee
- Lower Leg
- Ankle
- Foot
- Unspecified
- Multiple
- Side - Left
- Side- Right
- Side - Centre
- Side- Bilateral
- Position - Goalkeeper
- Position- Defender
- Position - Midfielder
- Position-Attacker

### Tab 10: Illness Region
- Study ID
- Cardiovascular
- Dermatological
- Dental
- Endocrinological
- Gastrointestinal
- Genitourinary
- Hematological
- Musculoskeletal
- Neurological
- Ophthalmological
- Otological
- Psychiatric/psychological
- Respiratory
- Thermoregulatory
- Multiple systems
- Unknown or not specified

### Tab 11: Illness Etiology
- Study ID
- Allergic
- Environmental (exercise related)
- Environmental (nonexercise)
- Immunological/inflammatory
- Infection
- Neoplasm
- Metabolic/nutritional
- Thrombotic/hemorrhagic
- Degenerative or chronic condition
- Developmental anomaly
- Drug-related/poisoning
- Multiple
- Unknown or not specified

### Tab 12: Mental Health Symtoms&Disorders
- Study ID
- Symtoms
- Distress
- Anxiety
- Depression
- Sleep Disturbance
- Disordered Eating
- Alcohol Misuse
- Drug Misuse
- Disorders
- Depressive disorders
- Anxiety disorders
- Specific phobias
- Panic disorder
- Somatisation
- Eating disorders
- Sleep disorders
- Gambling or betting disorder
- Obsessive–compulsive disorders
- Bipolar disorders
- Alcohol and other substance misuse


**Machine-safe mapping for Cursor codegen**
```json
{
  "Study Details": [
    {
      "label": "Study ID",
      "key": "study_id"
    },
    {
      "label": "Lead Author",
      "key": "lead_author"
    },
    {
      "label": "Title",
      "key": "title"
    },
    {
      "label": "Year of Publication",
      "key": "year_of_publication"
    },
    {
      "label": "Journal",
      "key": "journal"
    },
    {
      "label": "DOI",
      "key": "doi"
    },
    {
      "label": "Study Design",
      "key": "study_design"
    }
  ],
  "Participant Characteristics ": [
    {
      "label": "Study ID",
      "key": "study_id"
    },
    {
      "label": "FIFA Discipline",
      "key": "fifa_discipline"
    },
    {
      "label": "Country",
      "key": "country"
    },
    {
      "label": "Level of Play",
      "key": "level_of_play"
    },
    {
      "label": "Sex",
      "key": "sex"
    },
    {
      "label": "Age Category",
      "key": "age_category"
    },
    {
      "label": "Mean age (\u00b1SD) or age range",
      "key": "mean_age_sd_or_age_range"
    },
    {
      "label": "Sample Size (players)",
      "key": "sample_size_players"
    },
    {
      "label": "Number of teams/clubs",
      "key": "number_of_teams_clubs"
    },
    {
      "label": "Study period (years)",
      "key": "study_period_years"
    },
    {
      "label": "Observation duration",
      "key": "observation_duration"
    }
  ],
  "Definition & Data Collection ": [
    {
      "label": "Study ID",
      "key": "study_id"
    },
    {
      "label": "Injury Definition",
      "key": "injury_definition"
    },
    {
      "label": "Ilness Definition",
      "key": "ilness_definition"
    },
    {
      "label": "Mental Health Problem Definition",
      "key": "mental_health_problem_definition"
    },
    {
      "label": "Incidence Definition",
      "key": "incidence_definition"
    },
    {
      "label": "Burden Definitioon",
      "key": "burden_definitioon"
    },
    {
      "label": "Severity Definition",
      "key": "severity_definition"
    },
    {
      "label": "Recurrence Definition",
      "key": "recurrence_definition"
    },
    {
      "label": "Mechanism of Injury Reporting",
      "key": "mechanism_of_injury_reporting"
    }
  ],
  "Exposure Data": [
    {
      "label": "Study ID",
      "key": "study_id"
    },
    {
      "label": "Length of season/tournament (weeks)",
      "key": "length_of_season_tournament_weeks"
    },
    {
      "label": "Number of seasons",
      "key": "number_of_seasons"
    },
    {
      "label": "Exposure Measurement (unit)",
      "key": "exposure_measurement_unit"
    },
    {
      "label": "Total Exposure",
      "key": "total_exposure"
    },
    {
      "label": "Match Exposure",
      "key": "match_exposure"
    },
    {
      "label": "Training Exposure",
      "key": "training_exposure"
    }
  ],
  "Injury Outcome": [
    {
      "label": "Study ID",
      "key": "study_id"
    },
    {
      "label": "Total number of injuries",
      "key": "total_number_of_injuries"
    },
    {
      "label": "Number of match injuries",
      "key": "number_of_match_injuries"
    },
    {
      "label": "Number of training injuries",
      "key": "number_of_training_injuries"
    },
    {
      "label": "Injury incidence (overall)",
      "key": "injury_incidence_overall"
    },
    {
      "label": "Match injury incidence",
      "key": "match_injury_incidence"
    },
    {
      "label": "Training injury incidence",
      "key": "training_injury_incidence"
    },
    {
      "label": "Injury incidence 95% CI",
      "key": "injury_incidence_95_ci"
    },
    {
      "label": "Adjusted Injury incidence (overall)",
      "key": "adjusted_injury_incidence_overall"
    },
    {
      "label": "Confounders",
      "key": "confounders"
    },
    {
      "label": "Total Time-Loss due to Injury",
      "key": "total_timeloss_due_to_injury"
    },
    {
      "label": "Median Time-loss",
      "key": "median_timeloss"
    },
    {
      "label": "Mean Time-Loss",
      "key": "mean_timeloss"
    },
    {
      "label": "Injury Burden",
      "key": "injury_burden"
    },
    {
      "label": "Injury Burden 95% CI",
      "key": "injury_burden_95_ci"
    },
    {
      "label": "Most common injury diagnosis",
      "key": "most_common_injury_diagnosis"
    },
    {
      "label": "Most common injury type",
      "key": "most_common_injury_type"
    },
    {
      "label": "Most common injury location",
      "key": "most_common_injury_location"
    },
    {
      "label": "Miost Common Injury Severity Class",
      "key": "miost_common_injury_severity_class"
    },
    {
      "label": "Mode of Onset - Repetitive Gradual",
      "key": "mode_of_onset_repetitive_gradual"
    },
    {
      "label": "Mode of Onset - Repetitive Sudden",
      "key": "mode_of_onset_repetitive_sudden"
    },
    {
      "label": "Mode of Onset - Acute Sudden",
      "key": "mode_of_onset_acute_sudden"
    },
    {
      "label": "Contact",
      "key": "contact"
    },
    {
      "label": "Non-Contact",
      "key": "noncontact"
    },
    {
      "label": "Cumalative (Repititive)",
      "key": "cumalative_repititive"
    },
    {
      "label": "Median injury duration",
      "key": "median_injury_duration"
    },
    {
      "label": "Mean injury duration (\u00b1SD)",
      "key": "mean_injury_duration_sd"
    },
    {
      "label": "Total recurrent injuries",
      "key": "total_recurrent_injuries"
    },
    {
      "label": "Recurrence rate (%)",
      "key": "recurrence_rate"
    }
  ],
  "Illness Outcome": [
    {
      "label": "Study ID",
      "key": "study_id"
    },
    {
      "label": "Total number of Illnesses",
      "key": "total_number_of_illnesses"
    },
    {
      "label": "Number of match Illnesses",
      "key": "number_of_match_illnesses"
    },
    {
      "label": "Number of training Illnesses",
      "key": "number_of_training_illnesses"
    },
    {
      "label": "Illnesses incidence (overall)",
      "key": "illnesses_incidence_overall"
    },
    {
      "label": "Match Illnesses incidence",
      "key": "match_illnesses_incidence"
    },
    {
      "label": "Training Illnesses incidence",
      "key": "training_illnesses_incidence"
    },
    {
      "label": "Illnesses incidence 95% CI",
      "key": "illnesses_incidence_95_ci"
    },
    {
      "label": "Total Time-Loss due to Illnesses",
      "key": "total_timeloss_due_to_illnesses"
    },
    {
      "label": "Median Time-loss",
      "key": "median_timeloss"
    },
    {
      "label": "Mean Time-Loss",
      "key": "mean_timeloss"
    },
    {
      "label": "Illness Burden",
      "key": "illness_burden"
    },
    {
      "label": "Illness Burden 95% CI",
      "key": "illness_burden_95_ci"
    },
    {
      "label": "Most Common Organ System/Region for Illnesses",
      "key": "most_common_organ_system_region_for_illnesses"
    },
    {
      "label": "Most Common Etiology of Illnesses",
      "key": "most_common_etiology_of_illnesses"
    },
    {
      "label": "Miost Common Illness Severity Class",
      "key": "miost_common_illness_severity_class"
    },
    {
      "label": "Mode of Onset - Gradual",
      "key": "mode_of_onset_gradual"
    },
    {
      "label": "Mode of Onset - Sudden",
      "key": "mode_of_onset_sudden"
    },
    {
      "label": "Median Illness duration",
      "key": "median_illness_duration"
    },
    {
      "label": "Mean Illness duration (\u00b1SD)",
      "key": "mean_illness_duration_sd"
    }
  ],
  "Mental Health Outcomes": [
    {
      "label": "Study ID",
      "key": "study_id"
    },
    {
      "label": "Total number of Mental Health (MH) Problems",
      "key": "total_number_of_mental_health_mh_problems"
    },
    {
      "label": "MH Problems incidence (overall)",
      "key": "mh_problems_incidence_overall"
    },
    {
      "label": "Method of Reporting MH Problems",
      "key": "method_of_reporting_mh_problems"
    },
    {
      "label": "Total Time-Loss due to MH Problems",
      "key": "total_timeloss_due_to_mh_problems"
    },
    {
      "label": "Median Time-loss",
      "key": "median_timeloss"
    },
    {
      "label": "Mean Time-Loss",
      "key": "mean_timeloss"
    },
    {
      "label": "MH Problems Burden",
      "key": "mh_problems_burden"
    },
    {
      "label": "Most Common MH Symptoms",
      "key": "most_common_mh_symptoms"
    },
    {
      "label": "Most Common MH Disorder",
      "key": "most_common_mh_disorder"
    },
    {
      "label": "Most Common MH Severity Class",
      "key": "most_common_mh_severity_class"
    },
    {
      "label": "Mode of Onset - Gradual",
      "key": "mode_of_onset_gradual"
    },
    {
      "label": "Mode of Onset - Acute",
      "key": "mode_of_onset_acute"
    },
    {
      "label": "Mode of Onset - Mixed",
      "key": "mode_of_onset_mixed"
    },
    {
      "label": "Mode of Onset - Unknown",
      "key": "mode_of_onset_unknown"
    },
    {
      "label": "Median Illness duration",
      "key": "median_illness_duration"
    },
    {
      "label": "Mean Illness duration (\u00b1SD)",
      "key": "mean_illness_duration_sd"
    },
    {
      "label": "Total recurrent MH Problems",
      "key": "total_recurrent_mh_problems"
    },
    {
      "label": "Recurrence rate (%)",
      "key": "recurrence_rate"
    }
  ],
  "Injury Tissue & Type": [
    {
      "label": "Study ID",
      "key": "study_id"
    },
    {
      "label": "Muscle/Tendon",
      "key": "muscle_tendon"
    },
    {
      "label": "Muscle Injury",
      "key": "muscle_injury"
    },
    {
      "label": "Muscle Contusion",
      "key": "muscle_contusion"
    },
    {
      "label": "Muscel Compartment Syndrome",
      "key": "muscel_compartment_syndrome"
    },
    {
      "label": "Tendinopathy",
      "key": "tendinopathy"
    },
    {
      "label": "Tendon Rupture",
      "key": "tendon_rupture"
    },
    {
      "label": "Nervous",
      "key": "nervous"
    },
    {
      "label": "Brain/Spinal Cord Injury",
      "key": "brain_spinal_cord_injury"
    },
    {
      "label": "Peripheral nerve injury",
      "key": "peripheral_nerve_injury"
    },
    {
      "label": "Bone",
      "key": "bone"
    },
    {
      "label": "Fracture",
      "key": "fracture"
    },
    {
      "label": "Bone Stress Injury",
      "key": "bone_stress_injury"
    },
    {
      "label": "Bone Contusion",
      "key": "bone_contusion"
    },
    {
      "label": "Avascular necrosis",
      "key": "avascular_necrosis"
    },
    {
      "label": "Physis Injury",
      "key": "physis_injury"
    },
    {
      "label": "Cartilage/synovium/bursa",
      "key": "cartilage_synovium_bursa"
    },
    {
      "label": "Cartilage Injury",
      "key": "cartilage_injury"
    },
    {
      "label": "Arthrirtis",
      "key": "arthrirtis"
    },
    {
      "label": "Synovitis/capsulitis",
      "key": "synovitis_capsulitis"
    },
    {
      "label": "Bursitis",
      "key": "bursitis"
    },
    {
      "label": "Ligament/joint capsule",
      "key": "ligament_joint_capsule"
    },
    {
      "label": "Joint Sprain",
      "key": "joint_sprain"
    },
    {
      "label": "Chronic Instabality",
      "key": "chronic_instabality"
    },
    {
      "label": "Superficial tissues/skin",
      "key": "superficial_tissues_skin"
    },
    {
      "label": "Contusion (superficial)",
      "key": "contusion_superficial"
    },
    {
      "label": "Laceration",
      "key": "laceration"
    },
    {
      "label": "Abrasion",
      "key": "abrasion"
    },
    {
      "label": "Vessels",
      "key": "vessels"
    },
    {
      "label": "Stump",
      "key": "stump"
    },
    {
      "label": "Internal Organs",
      "key": "internal_organs"
    }
  ],
  "Injury Location": [
    {
      "label": "Study ID",
      "key": "study_id"
    },
    {
      "label": "Head and Neck",
      "key": "head_and_neck"
    },
    {
      "label": "Head",
      "key": "head"
    },
    {
      "label": "Neck",
      "key": "neck"
    },
    {
      "label": "Upper Limb",
      "key": "upper_limb"
    },
    {
      "label": "Shoulder",
      "key": "shoulder"
    },
    {
      "label": "Upper Arm",
      "key": "upper_arm"
    },
    {
      "label": "Elbow",
      "key": "elbow"
    },
    {
      "label": "Forearm",
      "key": "forearm"
    },
    {
      "label": "Wrist",
      "key": "wrist"
    },
    {
      "label": "Hand",
      "key": "hand"
    },
    {
      "label": "Trunk",
      "key": "trunk"
    },
    {
      "label": "Chest",
      "key": "chest"
    },
    {
      "label": "Thoracic Spine",
      "key": "thoracic_spine"
    },
    {
      "label": "Lumboscaral",
      "key": "lumboscaral"
    },
    {
      "label": "Abdomen",
      "key": "abdomen"
    },
    {
      "label": "Lower Limb",
      "key": "lower_limb"
    },
    {
      "label": "Hip",
      "key": "hip"
    },
    {
      "label": "Groin",
      "key": "groin"
    },
    {
      "label": "Thigh",
      "key": "thigh"
    },
    {
      "label": "Knee",
      "key": "knee"
    },
    {
      "label": "Lower Leg",
      "key": "lower_leg"
    },
    {
      "label": "Ankle",
      "key": "ankle"
    },
    {
      "label": "Foot",
      "key": "foot"
    },
    {
      "label": "Unspecified",
      "key": "unspecified"
    },
    {
      "label": "Multiple",
      "key": "multiple"
    },
    {
      "label": "Side - Left",
      "key": "side_left"
    },
    {
      "label": "Side- Right",
      "key": "side_right"
    },
    {
      "label": "Side - Centre",
      "key": "side_centre"
    },
    {
      "label": "Side- Bilateral",
      "key": "side_bilateral"
    },
    {
      "label": "Position - Goalkeeper",
      "key": "position_goalkeeper"
    },
    {
      "label": "Position- Defender",
      "key": "position_defender"
    },
    {
      "label": "Position - Midfielder",
      "key": "position_midfielder"
    },
    {
      "label": "Position-Attacker",
      "key": "positionattacker"
    }
  ],
  "Illness Region": [
    {
      "label": "Study ID",
      "key": "study_id"
    },
    {
      "label": "Cardiovascular",
      "key": "cardiovascular"
    },
    {
      "label": "Dermatological",
      "key": "dermatological"
    },
    {
      "label": "Dental",
      "key": "dental"
    },
    {
      "label": "Endocrinological",
      "key": "endocrinological"
    },
    {
      "label": "Gastrointestinal",
      "key": "gastrointestinal"
    },
    {
      "label": "Genitourinary",
      "key": "genitourinary"
    },
    {
      "label": "Hematological",
      "key": "hematological"
    },
    {
      "label": "Musculoskeletal",
      "key": "musculoskeletal"
    },
    {
      "label": "Neurological",
      "key": "neurological"
    },
    {
      "label": "Ophthalmological",
      "key": "ophthalmological"
    },
    {
      "label": "Otological",
      "key": "otological"
    },
    {
      "label": "Psychiatric/psychological",
      "key": "psychiatric_psychological"
    },
    {
      "label": "Respiratory",
      "key": "respiratory"
    },
    {
      "label": "Thermoregulatory",
      "key": "thermoregulatory"
    },
    {
      "label": "Multiple systems",
      "key": "multiple_systems"
    },
    {
      "label": "Unknown or not specified",
      "key": "unknown_or_not_specified"
    }
  ],
  "Illness Etiology": [
    {
      "label": "Study ID",
      "key": "study_id"
    },
    {
      "label": "Allergic",
      "key": "allergic"
    },
    {
      "label": "Environmental (exercise related)",
      "key": "environmental_exercise_related"
    },
    {
      "label": "Environmental (nonexercise)",
      "key": "environmental_nonexercise"
    },
    {
      "label": "Immunological/inflammatory",
      "key": "immunological_inflammatory"
    },
    {
      "label": "Infection",
      "key": "infection"
    },
    {
      "label": "Neoplasm",
      "key": "neoplasm"
    },
    {
      "label": "Metabolic/nutritional",
      "key": "metabolic_nutritional"
    },
    {
      "label": "Thrombotic/hemorrhagic",
      "key": "thrombotic_hemorrhagic"
    },
    {
      "label": "Degenerative or chronic condition",
      "key": "degenerative_or_chronic_condition"
    },
    {
      "label": "Developmental anomaly",
      "key": "developmental_anomaly"
    },
    {
      "label": "Drug-related/poisoning",
      "key": "drugrelated_poisoning"
    },
    {
      "label": "Multiple",
      "key": "multiple"
    },
    {
      "label": "Unknown or not specified",
      "key": "unknown_or_not_specified"
    }
  ],
  "Mental Health Symtoms&Disorders": [
    {
      "label": "Study ID",
      "key": "study_id"
    },
    {
      "label": "Symtoms",
      "key": "symtoms"
    },
    {
      "label": "Distress",
      "key": "distress"
    },
    {
      "label": "Anxiety",
      "key": "anxiety"
    },
    {
      "label": "Depression",
      "key": "depression"
    },
    {
      "label": "Sleep Disturbance",
      "key": "sleep_disturbance"
    },
    {
      "label": "Disordered Eating",
      "key": "disordered_eating"
    },
    {
      "label": "Alcohol Misuse",
      "key": "alcohol_misuse"
    },
    {
      "label": "Drug Misuse",
      "key": "drug_misuse"
    },
    {
      "label": "Disorders",
      "key": "disorders"
    },
    {
      "label": "Depressive disorders",
      "key": "depressive_disorders"
    },
    {
      "label": "Anxiety disorders",
      "key": "anxiety_disorders"
    },
    {
      "label": "Specific phobias",
      "key": "specific_phobias"
    },
    {
      "label": "Panic disorder",
      "key": "panic_disorder"
    },
    {
      "label": "Somatisation",
      "key": "somatisation"
    },
    {
      "label": "Eating disorders",
      "key": "eating_disorders"
    },
    {
      "label": "Sleep disorders",
      "key": "sleep_disorders"
    },
    {
      "label": "Gambling or betting disorder",
      "key": "gambling_or_betting_disorder"
    },
    {
      "label": "Obsessive\u2013compulsive disorders",
      "key": "obsessivecompulsive_disorders"
    },
    {
      "label": "Bipolar disorders",
      "key": "bipolar_disorders"
    },
    {
      "label": "Alcohol and other substance misuse",
      "key": "alcohol_and_other_substance_misuse"
    }
  ]
}
```

**Canonical export header order (all tabs, left-to-right)**
```json
[
  "Study ID",
  "Lead Author",
  "Title",
  "Year of Publication",
  "Journal",
  "DOI",
  "Study Design",
  "Study ID",
  "FIFA Discipline",
  "Country",
  "Level of Play",
  "Sex",
  "Age Category",
  "Mean age (\u00b1SD) or age range",
  "Sample Size (players)",
  "Number of teams/clubs",
  "Study period (years)",
  "Observation duration",
  "Study ID",
  "Injury Definition",
  "Ilness Definition",
  "Mental Health Problem Definition",
  "Incidence Definition",
  "Burden Definitioon",
  "Severity Definition",
  "Recurrence Definition",
  "Mechanism of Injury Reporting",
  "Study ID",
  "Length of season/tournament (weeks)",
  "Number of seasons",
  "Exposure Measurement (unit)",
  "Total Exposure",
  "Match Exposure",
  "Training Exposure",
  "Study ID",
  "Total number of injuries",
  "Number of match injuries",
  "Number of training injuries",
  "Injury incidence (overall)",
  "Match injury incidence",
  "Training injury incidence",
  "Injury incidence 95% CI",
  "Adjusted Injury incidence (overall)",
  "Confounders",
  "Total Time-Loss due to Injury",
  "Median Time-loss",
  "Mean Time-Loss",
  "Injury Burden",
  "Injury Burden 95% CI",
  "Most common injury diagnosis",
  "Most common injury type",
  "Most common injury location",
  "Miost Common Injury Severity Class",
  "Mode of Onset - Repetitive Gradual",
  "Mode of Onset - Repetitive Sudden",
  "Mode of Onset - Acute Sudden",
  "Contact",
  "Non-Contact",
  "Cumalative (Repititive)",
  "Median injury duration",
  "Mean injury duration (\u00b1SD)",
  "Total recurrent injuries",
  "Recurrence rate (%)",
  "Study ID",
  "Total number of Illnesses",
  "Number of match Illnesses",
  "Number of training Illnesses",
  "Illnesses incidence (overall)",
  "Match Illnesses incidence",
  "Training Illnesses incidence",
  "Illnesses incidence 95% CI",
  "Total Time-Loss due to Illnesses",
  "Median Time-loss",
  "Mean Time-Loss",
  "Illness Burden",
  "Illness Burden 95% CI",
  "Most Common Organ System/Region for Illnesses",
  "Most Common Etiology of Illnesses",
  "Miost Common Illness Severity Class",
  "Mode of Onset - Gradual",
  "Mode of Onset - Sudden",
  "Median Illness duration",
  "Mean Illness duration (\u00b1SD)",
  "Study ID",
  "Total number of Mental Health (MH) Problems",
  "MH Problems incidence (overall)",
  "Method of Reporting MH Problems",
  "Total Time-Loss due to MH Problems",
  "Median Time-loss",
  "Mean Time-Loss",
  "MH Problems Burden",
  "Most Common MH Symptoms",
  "Most Common MH Disorder",
  "Most Common MH Severity Class",
  "Mode of Onset - Gradual",
  "Mode of Onset - Acute",
  "Mode of Onset - Mixed",
  "Mode of Onset - Unknown",
  "Median Illness duration",
  "Mean Illness duration (\u00b1SD)",
  "Total recurrent MH Problems",
  "Recurrence rate (%)",
  "Study ID",
  "Muscle/Tendon",
  "Muscle Injury",
  "Muscle Contusion",
  "Muscel Compartment Syndrome",
  "Tendinopathy",
  "Tendon Rupture",
  "Nervous",
  "Brain/Spinal Cord Injury",
  "Peripheral nerve injury",
  "Bone",
  "Fracture",
  "Bone Stress Injury",
  "Bone Contusion",
  "Avascular necrosis",
  "Physis Injury",
  "Cartilage/synovium/bursa",
  "Cartilage Injury",
  "Arthrirtis",
  "Synovitis/capsulitis",
  "Bursitis",
  "Ligament/joint capsule",
  "Joint Sprain",
  "Chronic Instabality",
  "Superficial tissues/skin",
  "Contusion (superficial)",
  "Laceration",
  "Abrasion",
  "Vessels",
  "Stump",
  "Internal Organs",
  "Study ID",
  "Head and Neck",
  "Head",
  "Neck",
  "Upper Limb",
  "Shoulder",
  "Upper Arm",
  "Elbow",
  "Forearm",
  "Wrist",
  "Hand",
  "Trunk",
  "Chest",
  "Thoracic Spine",
  "Lumboscaral",
  "Abdomen",
  "Lower Limb",
  "Hip",
  "Groin",
  "Thigh",
  "Knee",
  "Lower Leg",
  "Ankle",
  "Foot",
  "Unspecified",
  "Multiple",
  "Side - Left",
  "Side- Right",
  "Side - Centre",
  "Side- Bilateral",
  "Position - Goalkeeper",
  "Position- Defender",
  "Position - Midfielder",
  "Position-Attacker",
  "Study ID",
  "Cardiovascular",
  "Dermatological",
  "Dental",
  "Endocrinological",
  "Gastrointestinal",
  "Genitourinary",
  "Hematological",
  "Musculoskeletal",
  "Neurological",
  "Ophthalmological",
  "Otological",
  "Psychiatric/psychological",
  "Respiratory",
  "Thermoregulatory",
  "Multiple systems",
  "Unknown or not specified",
  "Study ID",
  "Allergic",
  "Environmental (exercise related)",
  "Environmental (nonexercise)",
  "Immunological/inflammatory",
  "Infection",
  "Neoplasm",
  "Metabolic/nutritional",
  "Thrombotic/hemorrhagic",
  "Degenerative or chronic condition",
  "Developmental anomaly",
  "Drug-related/poisoning",
  "Multiple",
  "Unknown or not specified",
  "Study ID",
  "Symtoms",
  "Distress",
  "Anxiety",
  "Depression",
  "Sleep Disturbance",
  "Disordered Eating",
  "Alcohol Misuse",
  "Drug Misuse",
  "Disorders",
  "Depressive disorders",
  "Anxiety disorders",
  "Specific phobias",
  "Panic disorder",
  "Somatisation",
  "Eating disorders",
  "Sleep disorders",
  "Gambling or betting disorder",
  "Obsessive\u2013compulsive disorders",
  "Bipolar disorders",
  "Alcohol and other substance misuse"
]
```

## 4) Core User Stories (auth ignored)

1. **Upload PDF (≤ 20 MB) → dedupe gate**  
   - As a user, I drag-drop a PDF. If >20 MB, I see a clear error.  
   - The system extracts tentative `title/first_author/year/doi`, computes exact hash + fuzzy title; if duplicate, **block** and show link to the existing record.

2. **Open Workspace → PDF left, fields right**  
   - I can paginate, zoom, and search inside the PDF.  
   - Right pane shows **sections by tab**; AI-suggested values are visibly distinct; I can edit/confirm.

3. **Run Auto-Extract (first 4 tabs)**  
   - I click **Auto-Extract**; the server calls **Gemini 2.5 Flash** with chunked text; each field gets `{value, confidence, page_hint, source_quote}`.  
   - Low-confidence fields are highlighted; I can confirm or override.

4. **OCR fallback**  
   - If the PDF has no text layer, I’m prompted to **Run OCR**; results are flagged “OCR used-verify carefully”.

5. **Export**  
   - From the list, I export CSV/JSON for the current filter; columns appear in **exact Excel order** (all tabs).  
   - **Master Export** compiles all papers with provenance columns.

---

## 5) Dedupe Rules (MVP)

- **Normalize**: lower-case, strip punctuation, collapse spaces, Unicode NFKD, remove stopwords.  
- **Exact key**: `sha256(normalize(title)+'|'+normalize(first_author)+'|'+year)`  
- **DOI**: exact DOI match → duplicate.  
- **Fuzzy title**: token-set ratio  
  - ≥ 92 → **duplicate** (block; show link)  
  - 85–91 → **possible duplicate** (ask; store decision)  
  - < 85 → accept

Admin override path is stubbed (record a reason), to be secured when auth lands.

---

## 6) Standardisation (lightweight for MVP)

- **Lower-case** all free-text on save.  
- Minimal canonical JSON at `/config/canonical.json` (e.g., “soccer”→“football (soccer)”, “men”→“male”, “semi-pro”→“amateur (sub-elite)”).  
- Full IOC/OSIICS/SMDCS vocab later; keep the hook in place.

---

## 7) Architecture (MVP build)

- **Frontend**: Next.js + TypeScript + Tailwind; **PDF.js** viewer.  
- **Server**: Firebase **Cloud Functions** (or Supabase Edge Functions) - **all** Gemini calls here.  
- **DB/Storage**:  
  - Preferred: **Supabase (Postgres + RLS + Storage)**.  
  - Alt (Firebase-native): **Firestore + Cloud Storage** (strict Security Rules later).  
- **Secrets**: API keys in **Secret Manager / env config**; never shipped to client; never logged.  
- **Telemetry**: logs for extraction time, rate-limits, failures.

---

## 8) Data Model (MVP tables)

- `papers(id, title, first_author, year, journal, doi, status, duplicate_key, created_at, updated_at)`  
- `files(id, paper_id, path, size_bytes, sha256, ocr_used, mime, created_at)`  
- `extractions(id, paper_id, version, data_json, ai_confidence_json, created_at)`  
- `notes(id, paper_id, field_path, body, created_at)`  
- `flags(id, paper_id, field_path, reason, severity, created_at)`  
- `exports(id, kind, filter_json, path, checksum_sha256, row_count, created_at)`  
- `audit_log(id, paper_id, action, field_path, old_value, new_value, ts)`

*(Auth tables omitted for MVP; a single “dev user” is implied server-side for audit attribution.)*

---

## 9) APIs (stub endpoints)

- `POST /api/upload` → validate size ≤ 20 MB → dedupe → create `paper` + `file`.  
- `POST /api/extract` → body: `paper_id`, `tabs:[1..4]` → run Gemini Flash, return structured JSON `{field_path: {value, confidence, page_hint, source_quote}}`.  
- `POST /api/ocr` → body: `paper_id` → run OCR only if no text layer.  
- `GET /api/papers` → list with filters: incomplete/completed/flagged; search by title/author/year.  
- `GET /api/paper/:id` / `PUT /api/paper/:id` → load/update extraction data; log to `audit_log`.  
- `POST /api/export` → CSV/JSON for current filter (canonical order).  
- `POST /api/export/master` → full export with provenance columns.

---

## 10) PDF & AI Pipeline (MVP)

1. **Extract text layer**; if empty → **OCR**.  
2. **Chunking**: split by headings/sections; pass relevant chunks per tab.  
3. **Prompt**: strict JSON schema per tab, include “not reported” handling.  
4. **Return**: `{value, confidence, source_quote, page_hint}` per field.  
5. **UI** marks fields **AI-suggested** until confirmed.

---

## 11) Exports (MVP)

- **CSV & JSON**.  
- **Header order** = exact order of **all Excel tabs** (top-to-bottom), include **every** column; blank if missing.  
- **Provenance columns** appended: `paper_id, created_at, updated_at, ai_confirmed_flags, ocr_used`.  
- **Checksum** (SHA-256) stored + shown.

---

## 12) Limits & Edge Cases

- PDFs hard limit **≤ 20 MB**.  
- Password-protected/corrupt → surface error; allow re-upload.  
- API rate-limits → retry/backoff; manual editing always available.  
- If Excel changes: re-run type generation; exports validate header order and fail fast if mismatch.

---

## 13) File/Folder Scaffold

```
/app
  /dashboard
  /paper/[id]
  /upload
  /components (pdf-viewer, form-field, ai-badge, status-pill)
  /lib (excel-schema.ts, canonical.ts, dedupe.ts, pdf.ts)
/api
  upload.ts
  extract.ts
  ocr.ts
  export.ts
  export-master.ts
/config
  canonical.json
  prompts/
      tab1.json
      tab2.json
      tab3.json
      tab4.json
/scripts
  gen-types-from-excel.ts
  scaffold.sh
  validate-export.ts
```

---

## 14) Commands (dev)

```bash
# scaffold
npm create next-app@latest fifa-gbi-data-extraction
cd fifa-gbi-data-extraction
npm i pdfjs-dist zod papaparse fast-csv axios
# if Supabase
npm i @supabase/supabase-js
# if Firebase
npm i firebase-admin firebase-functions
# dev
npm run dev
```

---

## 15) Acceptance Tests (MVP)

1. **Upload cap**: 21 MB file rejected with clear error.  
2. **Duplicate exact**: same title/author/year or DOI → blocked with link.  
3. **Duplicate fuzzy**: 93% match blocks; 88% prompts.  
4. **Auto-extract**: fields for Tabs 1–4 populate with AI-suggested styling.  
5. **Edit + confirm**: edit a field, confirm → status saved; audit log entry created.  
6. **Export**: CSV header order exactly matches workbook order; blanks for missing.  
7. **OCR**: no text layer → OCR path triggers; “OCR used” recorded.

---

## 16) Cursor/Codex Workflow (minimize approvals)

- Place this file at `/docs/MVP-PRD.md`.  
- Prompt:  
  > “Implement only the scaffold and endpoints from `/docs/MVP-PRD.md` sections 7–11.  
  > Create everything in **one PR** and **STOP** after generating files & tests.  
  > Also generate `/scripts/scaffold.sh` that writes boilerplate files so I can run it once.”

- You can then click **Apply All** once (single approval).  
- Or run `/scripts/scaffold.sh` to create files without multiple approval prompts.  
- For later stages, repeat: one big PR per stage.

---

## 17) Should I upload the full PRD?

**Yes.** Keep it at `/docs/PRD.md` for context. Use this MVP as the **current** build contract.

---

**End of MVP PRD**
