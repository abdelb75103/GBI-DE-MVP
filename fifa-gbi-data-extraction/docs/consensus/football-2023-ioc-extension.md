---
title: Football-specific extension to IOC 2020 (Implementation notes)
source:
  title: "Football-specific extension of the IOC consensus statement: methods for recording and reporting of epidemiological data on injury and illness in sport 2020"
  authors: "Waldén M, Mountjoy M, McCall A, et al."
  journal: "Br J Sports Med"
  year: 2023
  doi: "10.1136/bjsports-2022-106405"
  local_pdf: "../sources/football-2023-ioc-extension.pdf"
last_updated: 2025-11-07
---

# Why this matters

Updates football terminology and adds sport-specific guidance, including return-to-football, refined severity bands, perimatch exposure handling, and football-specific contact categories.

# Football-specific refinements to adopt

- Use **player**, **football**, and **match** terminology consistently.
- **Return to football**: date when the player returns to full, unrestricted team training without modifications in duration or activities.
- **Severity bands**: 0 days, 1–3, 4–7, 8–28, 29–90, 91–180, more than 180 days.
- **Exposure**: match exposure is organised scheduled play between opposing teams; prematch warm-up as a separate training category; postmatch cool-down as other training; exclude rehabilitation from training exposure.
- **Mechanism details**: specify opponent, team-mate, match official, pitch invader, ball, goal post, pitch object, object from the crowd, or other object. Record fouls and cards where relevant.
- **Lower limb focus** in reporting tables and inclusion of hip and groin as a dedicated location category.

# Implementation checklist for our app

- Extend mechanism enums to the football-specific categories above.
- Add `return_to_football_date` for precise severity calculation and workflow gates.
- Represent prematch warm-up and postmatch cool-down as distinct training categories.
- Use the recommended severity bands in dashboards and reports.

# Reference

Waldén M et al. Br J Sports Med. 2023;57:1341–1350. doi:10.1136/bjsports-2022-106405.
