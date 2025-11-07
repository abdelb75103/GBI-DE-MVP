---
title: Project Context Pack
last_updated: 2025-11-07
purpose: "Give code assistants and contributors a concise, authoritative reference for injury and illness surveillance in football."
---

# Context overview

This pack provides concise, implementation-ready notes that align our data structures, terminology, and reporting with the leading consensus statements in sports epidemiology, with a football focus.

## What is included

- **papers/** summaries for:
  - Fuller et al. 2006 football injury definitions and methods (BJSportsMed).
  - IOC 2020 sports-generic injury and illness surveillance and STROBE-SIIS.
  - Football-specific extension 2023 aligning with IOC 2020.
- **sources/** the original PDFs for offline reference.
- This **README_CONTEXT.md** with usage guidance and a quick glossary.

## How to use in the repo

- Keep this folder in `docs/context/` or similar and pin it in your editor so code assistants read it first.
- Reference these terms in database schemas, validation, and UI copy.
- When adding new metrics or fields, update the relevant paper summary and the glossary to avoid drift.

## Quick glossary

- **Health problem**: umbrella term that includes injuries and illnesses, whether or not time-loss or medical attention occurs.
- **Injury**: tissue damage or derangement from rapid or repetitive transfer of kinetic energy.
- **Illness**: health complaint or disorder not considered an injury.
- **Time-loss**: unavailable for current or future full training or match.
- **Medical-attention**: requires assessment by a qualified practitioner.
- **Match exposure**: organised scheduled match play between opposing teams; internal matches count as training.
- **Training exposure**: team or individual football activities under staff guidance aimed at skills or conditioning; excludes rehabilitation sessions.

## File list

- `papers/fuller-2006-football-consensus.md`
- `papers/ioc-2020-injury-illness-consensus.md`
- `papers/football-2023-ioc-extension.md`
- `sources/` original PDFs

