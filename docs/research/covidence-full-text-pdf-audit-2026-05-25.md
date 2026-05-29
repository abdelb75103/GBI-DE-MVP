# Covidence Full-Text PDF Audit - Vote-Required 23

Date checked: 2026-05-25

Review: Covidence `603597`

Page checked: `https://app.covidence.org/reviews/603597/review_studies/select?filter=vote_required_from`

Scope: audit of whether each vote-required record has an actual PDF visible in Covidence, not merely a full-text/catalog link.

No Covidence changes were made during this audit.

## Immediate Fix Targets

| Covidence # | Current Covidence state | Local PDF ready? | Action |
| --- | --- | --- | --- |
| `#716` | Link-only: COBISS record visible, no PDF upload visible | Yes: `downloads/covidence-vote-required-legal-pdfs-2026-05-25/Covidence_716_Kutnjak_2021.pdf` | Upload PDF |
| `#721` | Original PDF plus English translation already visible | Not needed | Do not upload |
| `#854` | English translation PDF visible, original article PDF not visible | Yes: `downloads/covidence-vote-required-legal-pdfs-2026-05-25/Covidence_854_PinheiroLima_2021.pdf` | Upload original PDF |

## Current PDF Status By Record

| Covidence # | Study | Current state | Needs actual PDF? | Evidence visible in Covidence |
| --- | --- | --- | --- | --- |
| `#368` | Volpi 2000 | Link-only | Yes | SafetyLit URL only |
| `#375` | GreenJr 1997 | Missing PDF | Yes | `Upload full text` shown |
| `#378` | Mackay 1996 | Missing PDF | Yes | `Upload full text` shown |
| `#549` | Kontos 2000 | Link-only | Yes | Sponet URL only |
| `#617` | Gamez 2006 | Missing PDF | Yes | `Upload full text` shown |
| `#622` | Vriend 2005 | Missing PDF | Yes | `Upload full text` shown |
| `#630` | Drogset 1990 | Missing PDF | Yes | `Upload full text` shown |
| `#633` | Lewerentz 1981 | Link-only | Yes | PubMed URL only |
| `#716` | Kutnjak 2021 | Link-only | Yes, local PDF ready | COBISS URL only |
| `#721` | doNascimento 2017 | PDF attached | No | `503-Article Text-2091-1-10-20170908.pdf` and `Covidence_721_English_translation.pdf` visible |
| `#724` | Ryngier 2002 | Missing PDF | Yes | `Upload full text` shown |
| `#727` | Ouyang 2001 | Link-only | Yes | BVS/WPR URL only |
| `#728` | Napravnik 1979 | Missing PDF | Yes | `Upload full text` shown |
| `#736` | Berbig 1997 | Missing PDF | Yes | `Upload full text` shown |
| `#737` | Gonzalez 1995 | Missing PDF | Yes | `Upload full text` shown |
| `#746` | Jacob 1976 | Missing PDF | Yes | `Upload full text` shown |
| `#747` | Marotti 1983 | Missing PDF | Yes | `Upload full text` shown |
| `#748` | Perdriel 1975 | Missing PDF | Yes | `Upload full text` shown |
| `#751` | Lorentzon 1984 | Link-only | Yes | PubMed URL only |
| `#854` | PinheiroLima 2021 | Translation PDF attached only | Yes, original PDF ready | `Covidence_854_English_translation.pdf` visible |
| `#859` | MTSHALI 2015 | Missing PDF | Yes | `Upload full text` shown |
| `#869` | Edama 2012 | PDF attached | No | `26575243_8385448110007966.pdf` visible |
| `#871` | LAFORGIA 1995 | Missing PDF | Yes | `Upload full text` shown |

## Counts

- Total vote-required records checked: `23`
- Already has original/full PDF visible: `2` (`#721`, `#869`)
- Needs PDF because link-only or missing original: `21`
- Local PDFs ready now: `2` (`#716`, `#854`)
- Remaining PDF sourcing targets after uploading ready files: `19`

## Remaining PDF Sourcing Targets After `#716` and `#854`

`#368`, `#375`, `#378`, `#549`, `#617`, `#622`, `#630`, `#633`, `#724`, `#727`, `#728`, `#736`, `#737`, `#746`, `#747`, `#748`, `#751`, `#859`, `#871`.
