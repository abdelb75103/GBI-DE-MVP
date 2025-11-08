---
title: Football injury definitions and data collection procedures (Implementation notes)
source:
  title: "Consensus statement on injury definitions and data collection procedures in studies of football injuries"
  authors: "Fuller CW, Ekstrand J, Junge A, Andersen TE, Bahr R, Dvorak J, Hägglund M, McCrory P, Meeuwisse WH"
  journal: "Br J Sports Med"
  year: 2006
  doi: "10.1136/bjsm.2005.025270"
  local_pdf: "../sources/fuller-2006-bjsm-football-consensus.pdf"
last_updated: 2025-11-07
---

# Why this matters

This was the first football-specific standard for injury definitions, exposure, and reporting. It introduced the common definitions for **injury**, **recurrent injury**, **severity by days lost**, and **match vs training exposure** that underpin modern surveillance.

# Core definitions to adopt

- **Injury**: any physical complaint from match or training, whether or not medical attention or time-loss occurs.
- **Medical-attention injury** vs **Time-loss injury**: maintain both categories in capture.
- **Recurrent injury**: same type and site after return to full participation. Categorise early, late, delayed based on time since return.
- **Severity**: days from injury to full return to training and selection. Day of injury is day zero.
- **Exposure types**:
  - **Match exposure**: play between teams from different clubs.
  - **Training exposure**: team-based or individual work under team staff aimed at skills or conditioning.
- **Classification**: record location, type, side, mechanism, match vs training, contact vs non-contact. Use sport injury coding where possible.

# Design and reporting

- Prefer **prospective cohort** designs with exposure recorded.
- Use standard proformas for **baseline**, **injury event**, and **exposure logs**.
- Report match and training injury incidence separately. Clearly state denominators and severity distributions.

# Implementation checklist for our app

- Schema fields: `injury_definition`, `attention_type`, `time_loss_days`, `recurrent_flag`, `recurrent_window`, `location`, `type`, `side`, `mechanism`, `match_or_training`, `contact_type`.
- Exposure table with minutes at player level for match and training.
- Severity calculation treats day 0 as zero days lost.
- Allow multiple diagnoses under one event when applicable.

# Reference

Fuller CW et al. Br J Sports Med. 2006;40:193–201. doi:10.1136/bjsm.2005.025270.
