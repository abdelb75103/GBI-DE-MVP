---
title: Sports-generic injury and illness surveillance and STROBE-SIIS (Implementation notes)
source:
  title: "International Olympic Committee consensus statement: methods for recording and reporting of epidemiological data on injury and illness in sport 2020 (including STROBE-SIIS)"
  authors: "Bahr R, Clarsen B, Derman W, et al."
  journal: "Br J Sports Med"
  year: 2020
  doi: "10.1136/bjsports-2019-101969"
  local_pdf: "../sources/ioc-2020-injury-illness-consensus.pdf"
last_updated: 2025-11-07
---

# Why this matters

This is the current sports-generic standard that extends beyond injury to include illness and provides the **STROBE-SIIS** reporting checklist. It reframes injury within the broader **health problem** concept and clarifies mode of onset and subsequent event taxonomy.

# Core definitions to adopt

- **Health problem**: any condition that reduces normal physical, mental, or social well-being.
- **Injury**: tissue damage or derangement from rapid or repetitive transfer of kinetic energy.
- **Illness**: complaint or disorder not considered an injury.
- **Mode of onset**: acute, repetitive, or mixed mechanisms rather than a strict acute vs gradual dichotomy.
- **Subsequent events**: classify recurrences, exacerbations, local subsequent injuries, and different-site injuries using clear time order and unique participant IDs.

# Data items and reporting

- Maintain unique anonymised IDs, precise onset dates, laterality, diagnosis, and link multiple problems to index events.
- Capture exposure consistently and express risk with appropriate denominators.
- Implement **STROBE-SIIS** items in methods and results, including burden metrics, precision, and handling of censoring.

# Implementation checklist for our app

- Add `health_problem_type` with values `injury` or `illness`.
- Add `mode_of_onset` with `acute`, `repetitive`, `mixed` and `mechanism_contact` with `none`, `indirect_person`, `indirect_object`, `direct_person`, `direct_object` where applicable.
- Track subsequent events with linkage to index event and state `recurrence` vs `exacerbation` rules tied to return-to-play status.
- Include STROBE-SIIS checklist in study protocols and export templates.

# Reference

Bahr R et al. Br J Sports Med. 2020;54:372–389. doi:10.1136/bjsports-2019-101969.
