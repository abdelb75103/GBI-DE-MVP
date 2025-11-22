AI-Assisted Data Extraction Web App for FIFA
GBI – Product Requirements Document
1. One-Page Summary
Problem: The FIFA Global Burden of Injury & Illness (GBI) project needs a faster, more consistent way to
extract data from hundreds of published studies on football (soccer) injuries and illnesses. Manual data
extraction from PDFs is time-consuming and error-prone 1
. Inconsistent injury definitions and
reporting formats across studies make it difficult to aggregate results 2
. We risk missing critical data
or introducing errors without a structured, auditable extraction process.
Target Users: This tool serves a research Extraction Team (sports medicine researchers and assistants
extracting data), Reviewers (senior epidemiologists verifying data quality), and an Admin (project
manager or data steward overseeing the process). All users are internal to the FIFA GBI project and
require a simple web interface (no coding required) to manage data extraction collaboratively.
Value Proposition: The web app (“AIDE” – AI Data Extraction tool) will accelerate data extraction by
using AI (LLM “Gemini 2.5 – Flash”) to pre-fill structured forms with study details and results. Human
extractors remain in control – they review and correct AI suggestions. This hybrid approach maintains
methodological rigor and academic defensibility (no unchecked AI output) while reducing workload.
The tool enforces standardized data coding (using IOC consensus definitions, OSIICS/SMDCS
classifications 3
) to ensure consistency across studies. An integrated PDF viewer and definitions
sidebar help users cross-check data directly against sources, leaving a full audit trail of all decisions.
Ultimately, AIDE will produce a clean, analysis-ready dataset (in CSV/JSON) that is fully traceable back to
4
each source – supporting FIFA’s open-science and reproducibility commitments .
Success Criteria: Quantitative targets for success include:
•
•
•
•
•
50% reduction in extraction time per paper (e.g. from ~2 hours manually to ~1 hour with AI
assistance) as measured in the pilot phase.
100% of required fields captured for each study, with zero critical errors in the final dataset
(verified by independent cross-check on a sample).
High user adoption and satisfaction: >90% of extractors report that the tool made their work
easier and would be used in future reviews (via survey).
Audit completeness: for every data point, the source location (page/paragraph) and user
verification status are logged, ensuring any number in the output can be traced back
(supporting transparency and reproducibility).
No methodological deviations: All extracted data align with standardized definitions (time-loss
injury, severity classes, etc.) – e.g. no inconsistent injury categories 2 5
– as confirmed by the
reviewer and project leads.
2. Personas & Roles
•
Extractor (Research Assistant): Typically a junior researcher or clinician responsible for pulling
data from papers. Extractors log into AIDE to upload PDFs and fill out the structured extraction
1
form. They rely on AI suggestions to speed up work but must verify each field against the PDF.
Their goals are to extract data accurately and quickly, without missing details. They need the
interface to be intuitive, with helpful prompts (e.g. highlighting where in the text an AI-
suggested number came from) and easy ways to note uncertainties. They appreciate features
like auto-fill for bibliographic info (title, authors) and standardized pick-lists for categories (so
they don’t have to recall codes). Pain points: tedious manual copying from PDFs, worrying about
inconsistencies or forgetting a field. Key needs: speed, guidance (definitions), and the ability to
flag issues for the reviewer.
•
Reviewer (Senior Epidemiologist): A subject-matter expert who validates and approves
extracted data. Reviewers may double-extract a subset of studies or review what extractors
entered 6
. Their focus is quality control: ensuring definitions used by the study are noted, data
makes sense, and any AI errors are caught. They use AIDE to see each study’s data alongside the
source PDF and any notes. They can compare two extractors’ entries if double data entry was
done for that paper (blinded extraction) and resolve discrepancies (the tool should support side-
by-side comparisons similar to Rayyan’s conflict resolution view 7
). Pain points: ambiguity in
papers (e.g. non-standard terms), and ensuring consistency across dozens of studies. Key
needs: a clear view of each field with context, the ability to mark data as verified or flag for
discussion, and an audit log to see who entered what. Ultimately, the reviewer “signs off” on
each study’s data.
•
Admin (Project Manager/Data Steward): Oversees the entire extraction project. Likely a team
lead or data manager. They are responsible for user management (creating local user accounts
since no email login), project settings (e.g. entering the API key for the AI), and monitoring
progress. The Admin uses a dashboard to see all studies, their status (not started, in progress,
completed, reviewed), and any flagged issues. They might assign studies to extractors (e.g. split
workload among the team) and ensure deadlines (pilot extraction in June 2025, full extraction by
Aug 2025) are met 8 6
. They also handle exporting the final dataset and ensuring it matches
the required schema (per the Excel template) for analysis. Pain points: keeping track of dozens
of PDFs, ensuring consistency and that nothing falls through the cracks. Key needs: user
management controls, a bird’s-eye view of project progress, and confidence that the tool’s
outputs are complete and high-quality. The Admin also cares about compliance (data is secure,
no GDPR issues, and proper audit trails exist).
(Note: In a small team, one person may play multiple roles – e.g. an extractor might also do reviews on
others’ papers – so the app should allow a user to have both extraction and review capabilities as
needed.)
3. Competitive Teardown – AIDE vs. Covidence vs. Rayyan
To ground our design, we compare features of AIDE with two existing systematic review tools:
Covidence (widely used, Cochrane-endorsed) and Rayyan (free ML-assisted reviewer). Covidence and
Rayyan cover the entire SR workflow (screening to extraction), whereas AIDE is purpose-built for data
extraction and coding in our use-case. Below is a feature comparison, with notes on what AIDE will
adopt, adapt, or avoid:
2
Feature
Covidence (SR
platform) Rayyan (SR platform) AIDE (Our tool)
Workflow
Coverage
End-to-end SR
workflow with
prescribed phases
9 10
(import,
deduplicate, screen,
full text, extract, risk
of bias, PRISMA
diagram). Designed
to enforce
methodology at
10
each step .
Originally focused on
screening (fast
inclusion/exclusion
11
with ML) . Added
data extraction
12
module in 2025 ,
now moving toward
full workflow. More
flexible but less
structured process
(user decides
13
workflow) .
Focused only on Data
Extraction phase (assumes
screening done). We avoid
reimplementing screening
(Rayyan already used for that
14
in our project ). Instead,
AIDE integrates after screening:
users upload included study
PDFs, then extract & review
data.
Deduplication
of References
Has an integrated
deduplication on
import, but can
miss some
duplicates
(Cochrane
recommends
dedupe in reference
15
manager too) .
UI groups
suspected
duplicates for
manual
confirmation.
Rayyan supports
deduplication when
importing references
(and highlights
potential dups).
Emphasizes using
clean input or manual
checks (less
automated than
15 13
Covidence) .
AIDE will adopt automated
deduping on PDF upload:
hashing title+author+year for
exact matches and fuzzy title
matching for variants.
Suspected duplicates prompt
the user to confirm removal or
merge. We improve on
Covidence by using stronger
fuzzy logic (to catch minor title
differences) and by warning if
a PDF’s DOI matches an
existing study. Why: Ensures
no duplicate data extraction
(as duplicates were largely
removed earlier in Rayyan 14
but this is a safety net for new
or missed entries).
3
,
Feature
User Interface –
Data Extraction
Covidence (SR
platform) Rayyan (SR platform) AIDE (Our tool)
Covidence’s
extraction interface
is structured by
sections (PICO
elements for
intervention
studies) and offers
a form to fill for
each included study
16
. It supports
basic text fields and
single-choice
entries in forms.
PDF access is
available (download
or view in-browser),
but not tightly
integrated side-by-
side in early
versions. Conflict
resolution for
extraction is manual
(compare exports
or on-screen form)
– Covidence
emphasizes a single
consensus form per
study rather than
side-by-side entry.
Rayyan’s new
extraction UI (2025)
features a side-by-
side PDF viewer and
17
extraction form .
Users can zoom,
rotate, and highlight
within Rayyan,
keeping the source
and form in one view
17
. It has a flexible
form builder: add
custom fields (text or
numeric), group them
into sections, and
mark required fields
18
. Rayyan supports
blinded dual
extraction: two
reviewers can extract
independently, then
Rayyan shows a side-
by-side comparison
highlighting
differences for
7
resolution .
Progress tracking by
status (Not started, In-
progress, Completed)
19
is built-in .
AIDE will adopt the best of
both: We use a structured
form UI tailored to the GBI
data schema (pre-set fields
from the codebook, so no
need for users to design
forms). We embed a PDF
viewer next to the form, so
extractors can scroll the paper
and input data simultaneously
– similar to Rayyan’s approach
17
. We also include status
indicators per study and per
field: e.g. fields auto-filled by
AI but not yet confirmed are
highlighted (yellow),
confirmed fields are green,
missing/flagged ones red –
giving a quick visual like
19
Rayyan’s completion filter .
AIDE will support an optional
dual extraction mode for
quality: if two extractors work
independently, the reviewer
can see both entries side-by-
side (highlighting conflicts)
and choose the final value
(akin to Rayyan’s conflict
7
resolution) . If resources
are limited, the default will be
one extractor + one reviewer
verification (still logged).
4
Feature
AI &
Automation
Covidence (SR
platform) Rayyan (SR platform) AIDE (Our tool)
Covidence does not
use AI assistance
in screening or
extraction (as of
2023) – it’s a guided
manual process.
This ensures rigor
but can be slower
20
.
Rayyan pioneered
using ML for
screening: it uses
relevance prediction to
suggest which
references to include/
exclude after enough
21
decisions . For
extraction, Rayyan
announced phases of
AI integration:
currently AI-assisted
extraction is in pilot
(Rayyan ResearchPilot
can pre-fill some
fields) and future
fully-automated
extraction is planned
22
. These AI features
are in early access for
23
enterprise users ,
not broadly available
yet.
AIDE’s core innovation is AI-
assisted data extraction
from day one. We adopt the
idea of AI pre-fill (like Rayyan’s
phase 2 22
) but focused on
our domain: when a PDF is
uploaded, the system can run
LLM prompts to extract key
fields (Study details,
Participant characteristics,
etc.), saving the extractor
time. Unlike Rayyan’s generic
tool, we adapt the AI to use
the specific coding frames and
prompts based on our
codebook (e.g. asking for
“total sample size of players”
or “injury definition used”,
etc.). We will not fully
automate without oversight
(we avoid fully hands-off
extraction) – every AI entry
must be human-verified
(maintaining academic
defensibility). Over time, we
can incorporate more
automation in suggesting
values or flagging missing
info, but always with human in
the loop.
5
Feature
Collaboration &
Roles
Covidence (SR
platform) Rayyan (SR platform) AIDE (Our tool)
Covidence supports
multiple users per
project with defined
roles. It has built-in
workflows for two
reviewers (e.g. two
votes required to
include an article)
and a mechanism
for a third reviewer
to resolve conflicts
24
. For data
extraction,
Covidence typically
has one person
enter data and a
second person can
validate (or each
extracts different
studies). The
system keeps track
of who did what,
but direct
simultaneous
editing of one form
is not a typical use-
case (it’s more
sequential).
Rayyan allows large
teams. For screening,
it offers blind
independent decisions
and labels, but
coordination was
manual (assigning
articles) in early
25
versions . In the
new extraction,
Rayyan supports
blinded double
extraction and then
an “unblind” to merge
7
results . Team
members can be
assigned roles like
owner, collaborator,
etc. However, Rayyan
being flexible also
means less enforced
structure in free
version – teams rely
on internal protocols
for who does what
11
when .
AIDE will allow multiple user
roles: Admin, Extractor,
Reviewer (as described in
Personas). We adopt
Covidence’s idea of a
designated tie-breaker role –
in our case, the Reviewer or
Admin can make final calls on
conflicts. Work assignment
can be done by Admin (e.g.,
tag each study with an
extractor and reviewer). We
plan to adapt the
collaboration model to our
smaller team: likely each study
is assigned to one extractor
and one reviewer to check,
rather than two full
extractions for all studies
(though AIDE can support
double entries if needed on a
26
subset ). The system will
log each user’s contributions
(who extracted each field, who
confirmed it) for
accountability. Real-time
simultaneous editing of the
same field by two users is not
allowed (to avoid overwriting)
– if an extractor is actively
editing a study, the reviewer
sees a “read-only” mode until
it’s marked ready for review.
This controlled collaboration
protects data integrity (similar
spirit to Covidence’s structured
10
approach ).
6
Feature
Data Coding &
Standardization
Covidence (SR
platform) Rayyan (SR platform) AIDE (Our tool)
Covidence offers
free-text form fields
by default, meaning
consistency
depends on the
user. Reviewers
must ensure
common
terminology
(Covidence doesn’t
enforce a
vocabulary out of
the box). However,
Covidence does
allow creating a
template with
predefined options
for some fields
(e.g., dropdowns for
study design, etc.)
16
, which can
enforce some
consistency if set
up.
Rayyan’s form builder
lets you define field
types and options
(e.g., you can make a
dropdown with set
choices, or a numeric
18
field with units) . By
design it’s flexible to
any review, so it
doesn’t provide a built-
in ontology for injuries
or illnesses – the onus
is on the researchers
to enter consistent
values. No automatic
synonym mapping is
provided in Rayyan as
of now.
AIDE adopts a strict
codebook approach: the
extraction fields and allowed
values are configured in
advance (from the FIFA GBI
codebook Excel). Many fields
will be dropdowns or multi-
selects with canonical
values. For example, Level of
Play will have fixed options
(Youth, Amateur, Elite, etc.),
Sex is Male/Female, Injury type
categories per OSIICS, etc.
This ensures standardized
coding across studies.
Additionally, we will adapt by
implementing a synonym
mapping layer: if the AI or
user enters a non-standard
term (e.g. “semi-professional”),
the system can suggest or
auto-map it to the nearest
canonical category (e.g. “Sub-
elite/Amateur”), with the
reviewer’s approval. This goes
beyond both Covidence and
Rayyan by actively enforcing
taxonomy alignment
(addressing the known
challenge of variable
definitions across studies
2
5
).
7
Feature
Notes and
Annotations
Covidence (SR
platform) Rayyan (SR platform) AIDE (Our tool)
Covidence allows
adding notes at
study level and
marking reasons for
exclusion, etc. For
extraction,
Covidence doesn’t
provide field-level
annotation in the
output, but you can
leave comments for
the team within the
platform.
Rayyan supports notes
and comments on
references (during
screening and
extraction). It also
highlights keywords
(in screening) to aid
decisions. For
extraction, one can
include a “notes” field
in the form if desired.
AIDE will provide a Notes
feature: each study will have a
general notes section for any
qualitative comments (e.g.,
“This paper combined men &
women in sample – split not
reported” or “Injury definition
deviates from standard IOC
definition”). Additionally, at a
field level, if something is
unclear or needs justification,
the extractor/reviewer can
attach a short comment.
These notes will be preserved
in the audit log and optionally
exportable (or at least
viewable to justify decisions).
This helps ensure context is
not lost – aligning with
reproducibility and
transparency (e.g.,
documenting why a certain
value was entered if not
straightforward).
8
Feature
Export and
Reporting
Covidence (SR
platform) Rayyan (SR platform) AIDE (Our tool)
Covidence can
export extracted
data to CSV and
also to formats like
RevMan or JSON for
27
analysis . It
automatically
produces a PRISMA
flow diagram for
27
the review .
Covidence’s CSV
export can include
study details and all
extracted fields, but
requires post-
processing to meet
custom schema.
Rayyan exports a
comprehensive CSV
that includes all
references and
decisions, labels, etc.,
and now extracted
28
data columns . It
emphasizes one-click
export of a “clean,
analysis-ready CSV”
29
sent to your email .
JSON export is not
mentioned in Rayyan,
but the CSV contains
all info including any
custom fields. No
automatic PRISMA
diagram (Rayyan
focuses on data rather
than reporting
graphics).
AIDE will support CSV and
JSON exports of the extracted
dataset. We will adopt
Rayyan’s one-click export
approach: an Export button
on the dashboard compiles all
studies’ data into a CSV (with
columns in the canonical
order matching the Excel
template provided). We’ll
include all tabs/sections in one
flat file (Study Details,
Participant info, Outcomes,
etc.), or offer separate CSVs
per section if needed. JSON
export will capture the same
data plus metadata (e.g.,
including provenance like
which page a data point came
from, or who entered it).
PRISMA flow diagrams are out
of scope for AIDE (screening
flow was handled in Rayyan
earlier). Instead, AIDE’s
contribution is the complete
dataset of extracted
variables ready for analysis.
We will also ensure the export
includes any fields needed for
open-science compliance –
e.g. a study ID, and maybe a
flag if data was auto-extracted
or manual – so that external
readers know how data was
obtained.
9
Feature
Covidence (SR
platform) Rayyan (SR platform) AIDE (Our tool)
Audit Trail &
Reproducibility
Covidence keeps an
internal log of
actions (votes, data
changes) but this is
not all exposed to
end users except
via the PRISMA flow
and conflict
resolution steps. It
is geared toward
ensuring
methodology (e.g.,
requiring conflict
resolution) rather
than providing a full
change history to
the user.
Rayyan emphasizes
being audit-ready –
all decisions and data
are kept in one place
30
. The combined
CSV export from
Rayyan includes a
“trail” of inclusion
decisions, labels, etc.
For extraction, it logs
which users
completed each
extraction (and
presumably can show
differences in a
conflict resolution
view). The integrated
platform thus provides
traceability back to the
source PDFs for each
extracted data point
(since PDFs remain
accessible in the app)
30
.
AIDE will adopt an open audit
philosophy aligned with FIFA’s
4
open-science mandate .
Every change in the
extraction form will be logged
(user, timestamp, field, old vs
new value). The Admin can
access an audit log report. For
each data point, the app can
show “source info” – e.g.,
which page of the PDF or
snippet of text the AI or
extractor took it from, if
recorded. We plan to surface
the audit trail to users in a
friendly way: e.g., a reviewer
clicking a field can see a note
“Extracted by Alice on
2025-07-10 from PDF p.3,
verified by Bob on
2025-07-12”. This is more
transparent than Covidence.
In exports, we will include
minimal provenance (perhaps
additional columns like
“Extractor” and “Reviewer” for
each study, or a separate log
file) so that the review’s data is
fully traceable. This adapts
Rayyan’s audit-ready approach
30
by adding per-field
traceability critical for
academic defensibility.
Summary of Adoption/Adaptation: In short, AIDE will adopt the structured workflow and data
integrity focus of Covidence (enforcing roles, conflict resolution, single-source-of-truth data) while
avoiding Covidence’s rigidity where it hinders speed (we allow AI assistance and some flexibility). We
embrace Rayyan’s user-friendly UI (PDF + form together, progress tracking, easy export) and extend
it with domain-specific AI and standardization features that neither competitor offers out-of-the-box.
By analyzing Covidence and Rayyan, we ensure AIDE keeps proven effective elements (like duplicate
checks, status tracking, blinded review) and avoids pitfalls (e.g., Covidence’s sometimes clunky
interface and missed duplicates 15 25
, or Rayyan’s lack of enforcement of consistency ) – delivering a
tool finely tuned for the GBI project’s needs.
4. User Journeys
Journey 1: First Login and API Key Setup
Scenario: An extractor is invited to use AIDE for the first time.
10
Steps: The user navigates to the AIDE web app and sees a login screen (since accounts are local, the
Admin has created a username for them). They enter their username and password and log in
successfully. On first login, because the AI services require an API key, the app directs them to the “API
Settings” page. Here, they paste the provided Gemini 2.5 API key (from Google/Vertex AI) into a secure
field. They hit “Save” – the app validates the key by making a test request (e.g., a small prompt) to
ensure it’s working. On success, they are redirected to the Dashboard. (Edge case: If the key is missing
or invalid, the user sees a clear error “API key not valid or API unreachable” and cannot use AI features
until fixed. The user can skip entering a key, but then any attempt to auto-extract will prompt the
settings again. The key is stored encrypted in the database tied to the user account for future sessions.)
Journey 2: Uploading PDFs and Duplicate Check
Scenario: The extractor is ready to add the first batch of studies (the included papers from screening).
Steps: On the Dashboard, they click “Upload Studies”. An upload dialog appears where they can drag-
and-drop or select PDF files from their computer. The user selects, say, 10 PDF files and confirms
upload. The system shows an upload progress bar for each file. Once uploaded, the app automatically
performs a deduplication check: for each new PDF, it extracts a fingerprint (e.g., reads the title and
first author from the PDF text or metadata). Suppose two of the PDFs actually correspond to the same
article (maybe one is a pre-print version and one the published version, or the user accidentally added
one twice). The system flags: “Possible duplicate detected: Smith et al. 2019 appears to be uploaded
twice.” This appears in a modal with options to “Keep both” or “Remove duplicates.” The extractor chooses
“Remove duplicates,” and the second file is not added to the study list. For each unique PDF, the system
creates a new Paper record in the database, assigning it a unique Study ID. The dashboard now lists
the 9 unique studies with basic info (filename or extracted title if possible).
(Edge cases: If a PDF is larger than 20 MB, the upload is rejected with a message “File exceeds 20MB –
please reduce file size.” If a PDF is password-protected or cannot be opened, the app flags it as “Failed
to parse – needs attention.” The user can see a warning icon next to that file and can click to try re-
upload (after removing password manually) or mark it for manual handling. If the dedupe algorithm
finds a near match (e.g., titles 90% similar), it might ask the user “These two titles look similar, are they
the same study?” – if the user says “No, they are different,” the system will remember to not flag those
again.)
Journey 3: AI-Assisted Extraction Process
Scenario: The extractor now begins extracting data from a study using AI assistance.
Steps: On the Dashboard, they click on a study entry (e.g., “Smith et al. 2019 – Injury Rates in Elite Youth
Football”). This opens the Paper Workspace for that study. The screen splits into two main panels: on
the left, the PDF document is displayed (page thumbnails and a main viewer for the current page); on
the right, the structured extraction form is shown, organized into collapsible sections: Study Details,
Participant Characteristics, Definitions, Exposure, Injury Outcomes, Illness Outcomes, Mental Health
Outcomes, etc. (matching our codebook). At the top of the form there’s an “Auto-Extract” button (with
maybe a Gemini icon) – since this is the first time opening this study, the extractor clicks “Auto-Extract
All.” The system now gathers the PDF text (it uses an internal PDF text extractor to get the raw text; if
the PDF is scanned image and no text is found, see OCR journey below). It then sends several prompt
requests to the LLM: for example, one prompt might ask: “Extract the following information from the
study’s text: Lead author last name, full title, publication year, journal name, DOI, and study design.” Another
prompt (or series) asks for participant details (e.g., sample size, sex, age, etc.), another for definitions
(injury definition, severity definition, etc.), and so on. The app might break the PDF text into relevant
sections or use smart prompts with few-shot examples for each field to guide the AI. Within a few
seconds, the AI returns suggestions for these fields. The form on the right populates automatically: e.g.,
Lead Author field now shows “Smith”, Title shows the full title (maybe truncated if long, with a tooltip),
Year = 2019, Journal = “BMJ Open Sport…”, DOI = some value, Study Design = “Prospective Cohort” (the
AI recognized the methods as a prospective cohort study). Each AI-filled field is highlighted in yellow
11
(meaning “AI suggestion – needs confirmation”). For numeric fields, e.g., Sample Size might now show
“120 (players)” in yellow. The extractor can click on that field and see a small tooltip or highlight – the
PDF on the left automatically scrolls to the page/paragraph where “120 players” was mentioned (the
tool extracted source context). This helps the extractor quickly verify. The extractor reads the
corresponding PDF section to confirm it indeed says 120 players. If correct, they click a checkmark next
to the field, marking it confirmed – the field turns green. They proceed field by field: some fields the AI
got right (they just confirm), some it got wrong or left blank. For example, “Illness Definition” the AI
left blank (maybe the paper didn’t study illnesses, or it missed it). The extractor sees it’s blank; if the
study is only about injuries, they might mark it “Not applicable” or leave it blank but flag it. Another
field, “Injury incidence (overall)”, the AI filled “8.5 per 1000 player-hours” with 95% CI “5.0–12.0” in one
field. The extractor double-checks in the results section of the PDF – suppose it actually was 8.4, not 8.5,
due to a rounding nuance. The extractor corrects the value to “8.4” in the field. The field, initially yellow,
now is edited by the human, so it still needs confirmation – once they’re satisfied, they mark it
confirmed (green). If any field is unclear, the extractor can leave it unconfirmed (yellow) or explicitly flag
it red by clicking a flag icon (e.g., “I’m not sure about this value” or “data not reported clearly”). They can
add a note like “The paper reports injuries per season, not per 1000h – need to calculate or check with
supervisor.” They continue this process until they have addressed all sections. The Definitions Panel is
accessible via a sidebar tab or info icon – at any time, the extractor can click “Definitions” to see
reference text like “Time-loss injury: any physical complaint resulting in inability to participate in ≥1
subsequent match or training 31
” or severity category definitions, etc., to interpret the study properly.
This helps them decide how to categorize certain data. (For example, if the paper says “injury = any
absence from training or match”, the extractor checks the definitions panel and sees that matches the
standard time-loss definition; they then select “Time-loss” from a dropdown in the Injury Definition
field rather than typing free text.) After filling all fields as best as possible, the extractor clicks “Mark as
Extracted” (or “Ready for Review”). The study’s status changes from “In Progress” to “Extracted/Pending
Review”. They return to the dashboard for the next paper.
(Edge cases: If the AI service fails (e.g. network error or API rate limit) when “Auto-Extract” is clicked, the
user sees an error alert “AI extraction failed, please try again or fill manually.” The extractor can retry or
proceed to manual entry. If the PDF text is very large, the AI might time-out or give partial info – the tool
might then automatically switch to a field-by-field extraction mode, e.g., fill what it got in first pass and
highlight sections that need manual input. The extractor might also use a per-field auto button – e.g.,
next to each field or section, a small “AI” icon that they can click to attempt extraction just for that item,
especially useful if they add a PDF later or want to re-run AI on a specific part. The journey assumes one
comprehensive auto-extract, but the tool supports iterative AI calls if needed.)
Journey 4: OCR Fallback for a Scanned PDF
Scenario: One of the uploaded studies is an old PDF or scanned document with no embedded text (e.g.,
a historical study or a scan of a print journal).
Steps: When the extractor opens this study in the workspace and clicks “Auto-Extract”, the system
attempts to get text but realizes the PDF is image-based. It then prompts: “This PDF appears to be
scanned or has no text. Do you want to run OCR (Optical Character Recognition)?” The extractor clicks
“Yes, OCR.” A loading indicator appears (since OCR may take e.g. 30 seconds for a long paper). The
backend uses an OCR engine (e.g., Tesseract or Google Vision API) to extract text from each page image.
Once done, the text is available (though possibly with recognition errors). The app then continues with
the normal LLM extraction using this OCR text. The suggestions appear in the form, but the tool flags
them with an OCR icon or note “OCR used – double-check for accuracy.” The extractor indeed finds
some odd characters (OCR misread a “0” as “8” in one incidence rate). Thanks to the PDF viewer (which
still shows the actual scan), the user can visually confirm and correct these fields. This journey ensures
even non-digital PDFs can be handled, albeit with extra human diligence. (If OCR fails badly – e.g., very
poor quality fax copy – the system will inform the user that auto-extraction is not reliable. The extractor may
then manually type values while reading the PDF on screen, using zoom and contrast tools to decipher text.
12
The tool in such a case might allow the user to highlight a region on the PDF image and manually trigger OCR
on just that area, or enter data with no AI assistance. The key is the user is never blocked – they can always
enter data manually if automation fails.)
Journey 5: Reviewer Quality Check and Approval
Scenario: A reviewer logs in to review extracted data for studies assigned to them.
Steps: The reviewer uses the Dashboard filters to see all studies marked “Pending Review” (yellow
status). They click the first study. In the workspace, they see the form filled by the extractor. All fields
that were confirmed by the extractor are green; any that extractor was unsure of are yellow or red. The
reviewer also sees an “Extraction History” toggle – enabling it shows the audit trail inline: e.g., for a
field, “Auto-filled by AI, edited by Alice on 2025-07-10”. The reviewer goes through each field, cross-
checking a sample of critical ones against the PDF. For instance, they double-check the Injury
Definition: the extractor selected “Time-loss” – the reviewer scrolls the PDF (or uses a search function in
the PDF viewer for “injury definition”) and finds that yes, the paper specifically said “...any injury causing
absence from play...” which indeed is time-loss. Good. They mark that field as reviewed. Next, they see a
note on Exposure Data: the extractor noted “Training exposure not reported” and flagged it. The
reviewer verifies in the paper that indeed only total exposure was given, no breakdown by training vs
match. The reviewer is satisfied and maybe adds a comment “Confirmed: authors only reported total
exposure.” For a numeric outcome, say Injury incidence, the reviewer recalculates quickly: they see
total injuries and total exposure in the paper, does the incidence match? If something seems off (maybe
the incidence reported doesn’t match the given numerator/denominator), the reviewer might flag it or
add a note. Assuming most is fine, the reviewer then toggles a switch “Mark as Reviewed – Complete”.
This locks the record (no further editing by extractors) and turns the study status green (Completed) on
the dashboard. If the reviewer found a serious discrepancy, they could also mark “Requires Re-
extraction” which would send it back to the extractor (status red or back to grey) with a note on what to
fix. In our case, the study passes review. The reviewer repeats this for all studies.
(Edge cases: If two extractors did this study independently (blinded), the reviewer’s view would show a
comparison mode: e.g., a split of Field – Extractor1’s value vs Extractor2’s value, highlighting
differences. The reviewer then chooses which value to keep (or can edit the final value if both got it
wrong). For instance, Extractor A noted sample size 120, Extractor B wrote 122 – the reviewer checks
PDF, sees it’s 120, and selects that. The final form is then saved. This resolves conflicts systematically
7
. Another edge: If a field is outside expected range (say an incidence of “850 per 1000h” which is
likely a typo for 8.50), the system could flag it automatically. The reviewer would see a warning on that
field and correct it before approval.)
Journey 6: Exporting the Data
Scenario: After all studies are reviewed, the Admin/exporter wants to generate the final dataset.
Steps: On the Dashboard, the Admin clicks “Export Data”. An Export Modal appears with options:
choose format (CSV or JSON) and scope (e.g., “All completed studies” by default; they could also filter
e.g. export just injury-related fields or just a specific subset, but in our case we want everything). The
Admin selects CSV, All studies, All fields. They click “Export”. The system compiles the data: it joins all
the fields for each study into a flat table. It uses the predefined canonical column order that matches
the Excel sheets (Study Details first, Participant info next, etc., exactly as columns appear in the
template). The CSV is generated; the user can download it directly. The first row is headers: e.g., Study
ID, Lead Author, Title, Year, Journal, DOI, Study Design, FIFA Discipline, Country, Level of Play, Sex, Age
Category, ... all the way to the last outcomes. Each subsequent row is one study’s data. If a study didn’t
have data for a field (e.g., no illness outcomes), that cell is blank or “NA”. Additionally, because the
Admin might want to double-check or archive provenance, the modal also had a checkbox “Include
provenance/notes columns”. If they enabled it, the CSV would include extra columns for certain fields,
for example: after “Injury incidence 95% CI” there might be an “Injury incidence Source (page)” column
or “Injury incidence noted by” column. In JSON format, the output would be an array of study objects,
13
each containing all fields and possibly sub-objects for provenance (structured neatly, but this is mainly
for programmatic use). The Admin downloads the CSV. They open it in Excel to spot-check: the order of
columns matches the original data extraction sheet (this makes it easy to compare or even copy into
that template if needed). The Admin sees that all 50 studies have full rows of data. They also see
“Extractor” and “Reviewer” columns at the far right (we include who was responsible, as part of
provenance). Satisfied, they will later share this CSV with the analysis team or upload to FIFA’s
32
SharePoint/OSF for transparency.
(Edge case: If the Admin attempts export while some studies are still pending review or flagged (not
green), the system warns “5 studies are not yet completed. Include them anyway?” The Admin can
choose to include all (with a note that those might have unconfirmed data) or cancel and finish the
review first. This prevents accidentally analyzing incomplete data.)
Journey 7: Handling Updates and Errata (Ongoing use-case in a living review)
Scenario: Months later, a new study is identified to include, or a mistake is found in extracted data.
Steps: A new PDF is uploaded (maybe via the same upload process) and goes through extraction and
review as above, joining the dataset. Because this is a living systematic review, the tool might be used
continuously. If a reviewer finds a mistake in an already “completed” study (for example, they realize an
injury count was entered incorrectly), they (as Admin or with permission) can unlock that study’s form
(change status back to “in progress” or a special “amend” status). They then edit the field (the change is
logged in audit trail as a correction) and mark it reviewed again. The dataset can be re-exported. In this
way, the tool supports iterative updates, with full version history of data changes. The Master Export
always reflects the latest data, but an audit log can show past values if needed (to see what changed
since the original publication, etc.).
Through these user journeys, we ensure the app handles everything from onboarding and
configuration, through the core extraction/review workflow (including special cases like OCR), all the
way to final output and updates. Each step maintains human oversight (users confirm AI outputs) and
an audit trail (logs of actions), fulfilling the requirement that automation never undermines
30
methodological soundness or transparency .
5. Functional Requirements (FR)
Authentication & User Accounts
1. Local Account Login: The system shall allow users to log in with a username and password (no
email required), as this tool is internal and does not use third-party login. Passwords must be stored
securely (hashed). A new user account can be created by an Admin through an “Add User” interface
(with username, temporary password, and role). Test: Attempt login with correct vs. incorrect
credentials; verify that only correct credentials allow access, and that password is not stored in
plaintext.
2. User Roles and Permissions: The system shall support at least three roles – Admin, Extractor,
Reviewer – with permission differences. Extractors can upload PDFs and perform data extraction but
cannot manage users. Reviewers can view/edit extracted data and mark it reviewed but cannot manage
users. Admins can do everything (user management, change any data, configure system settings). Test:
Verify that a logged-in Extractor cannot access admin-only pages (like user management) – e.g., by
direct URL – and that an Admin can. Check that a Reviewer can mark a study as complete but an
Extractor cannot mark as reviewed.
3. No External Auth Dependencies: The app shall not require email verification or external OAuth – all
authentication happens via the internal database. (However, an Admin can manually reset a password
or set a new one for a user if needed, since no “forgot password” email flow exists.) Test: Ensure that the
Admin can update a user’s password in the DB or via interface and that the user can then log in with the
new password.
14
API Key Management
4. API Key Storage: The application shall provide a secure interface for entering and storing the Gemini
2.5 API key (or relevant LLM API key). The key is stored encrypted (or at least not in plaintext in the
database or config accessible to front-end). Only Admin or the user who set it can view/update it. Test:
Enter a dummy API key and ensure it’s accepted and saved. Check the database to confirm the key is
encrypted (or not easily readable). Ensure that if the key is invalid, an error is returned on test request.
5. Per-User or Global API Key: (Decision needed) Ideally, each user can use their own API key (so the
burden is on them), but the tool may allow one global key. In either case, the Settings page should
reflect the model’s status: e.g., “Connected to Gemini API” if the key works. Test: Remove or invalidate
the API key and confirm that any AI extraction function prompts for a key or gives a clear error “No API
key configured.”
PDF Upload & Document Management
6. PDF Upload (Single & Batch): Users with extraction privileges shall be able to upload PDF files via an
Upload dialog. The system must accept PDF files up to 20 MB in size (as per requirement) and reject
larger files with an informative message. Multiple files can be selected in one go (batch upload). Test: Try
uploading a 1 MB PDF – should succeed. Try a 25 MB PDF – the UI should refuse or the server should
return an error “File too large” promptly. Try selecting 5 PDFs at once – all should be processed in
parallel or sequence with progress indicators.
7. PDF Storage: Uploaded PDFs shall be stored on the server or cloud storage (e.g., Firebase Storage or
a database blob) in a secure manner. Each stored PDF is linked to a Paper record in the database. The
file name or a generated ID is kept, and the original file can be retrieved for viewing. Test: After upload,
verify the file is accessible via the app’s viewer and not publicly accessible via an unsecured URL. Ensure
filenames with special characters are handled (the system might sanitize the name or generate its own).
8. Duplicate Detection: Upon uploading new PDFs, the system shall automatically detect potential
duplicate studies. It will compare the new files’ metadata or content against existing entries. The
primary method: extract Title, First author, Year (if available) from the PDF and compare to existing
records (exact match or fuzzy). A secondary method: if DOI or other unique IDs are found in the PDF
text, use those for duplicate check. If a duplicate is found, the user is alerted and given the choice to
skip adding the duplicate. Test: Upload the same PDF twice: on the second upload, expect a prompt
“Duplicate detected” and an option to cancel adding it. Upload two different PDFs of the same title/year:
also expect a warning. Upload two completely different PDFs: both should be added with no warnings.
9. Paper Record Creation: For each successfully uploaded PDF, the system shall create a Paper record
with a unique identifier (Study ID). It should attempt to populate basic metadata (like title, year, etc.)
either via file name or initial text scan, to display on the dashboard. If metadata cannot be auto-
extracted, it can just use the file name until extraction occurs. Test: After uploading, check that the
Dashboard list shows an entry for each PDF (with at least the filename or title). If the PDF has a title in
its text, see if the record shows that title.
PDF Text Extraction & OCR
10. Text Parsing: The system shall be able to extract text from a PDF for use in AI prompts. For PDFs
that are text-based (not scans), it should use a PDF parsing library to get readable text (maintaining at
least paragraph breaks or some structure if possible). This should handle common encodings and multi-
column layouts reasonably (though exact layout preservation is not required – plain text is fine). Test:
Open a known text PDF (with multi-column layout) in the tool and trigger auto-extraction. Verify that the
content fed to the AI (could be checked via logs or by intentionally prompting the AI to output a certain
known phrase) indicates text was read correctly.
11. OCR for Scans: If a PDF has no extractable text (the parser returns essentially empty or nonsense),
the system shall automatically offer or perform OCR on it. OCR can be done page by page. The text
result from OCR should then be treated like normal extracted text for AI processing. OCR might be
toggled by the user if automatic OCR is turned off by default (for performance reasons). Test: Use a
15
scanned PDF (image-only) and attempt auto-extract. Confirm that the app either auto-runs OCR or
prompts to run it. After OCR, verify that extracted text is present (maybe expose it in a debug mode or
see that AI managed to get some info out). Check that OCR doesn’t block the UI indefinitely – e.g., a
progress indicator is shown during OCR.
Workspace Viewer & Form UI
12. Integrated PDF Viewer: The system shall display the PDF within the application (no need for
external PDF reader). Users should be able to scroll pages, zoom in/out, and if possible, search text
within the PDF viewer. Test: Open a PDF in the app, scroll to page 5 – verify it renders. Use the zoom
controls – text becomes larger/smaller accordingly. Use a search bar (if provided) to find a keyword – the
viewer jumps to the page with that word highlighted.
13. Structured Extraction Form: The system shall present a form with fields organized into sections
corresponding to the data schema. The first four sections (Study Details, Participant Characteristics,
Definitions & Data Collection, Exposure Data) are considered auto-extractable – the form fields here
should accept AI input. All remaining sections (Injury Outcomes, Illness Outcomes, etc.) are also present
for completeness and can receive AI suggestions, but many of these are complex numeric results that
might require manual entry or careful checking. The form must support different field types: text (for
titles, definitions), numbers (for sample size, incidence rates), selection lists (for categorical data like Sex
or Injury type), and multi-select or checkboxes (for categories like injury location breakdown). Test:
Navigate through the form sections – ensure all expected fields from the Excel schema are present. Try
entering data in each type of field manually to verify validation (e.g., numeric fields should only accept
digits or a specific format like “8.4” for rates; dropdowns restrict to predefined options). Check that
required fields (if any are marked as such) cannot be left blank on finalization (or at least warn).
14. AI Auto-Fill All Fields: There shall be an “Auto-Extract” or “AI Fill” action that triggers the LLM to
populate suggestions for multiple fields at once. The system will orchestrate prompts to the LLM to get
values for all key fields in the first four sections (and possibly beyond). The returned data is then placed
into the form. All AI-derived content should be visibly indicated (e.g., yellow highlight or an “AI” label)
until reviewed by a human. Test: Click the auto-fill button on a study. After processing, verify that
multiple fields now have content that was previously empty. Ensure the content is plausible (e.g., not a
hallucinated value that clearly isn’t in the PDF). Fields should indeed be highlighted or marked as
pending review.
15. AI Assistance per Field: In addition to filling all at once, the system shall allow AI assistance on a
per-field or per-section basis. For example, next to each field (or group of fields), an “Ask AI” button
can be present. Clicking it will send a targeted prompt (including relevant context from the PDF) to fill
that field. This is useful for fields not filled in the first pass or if a user wants to redo a specific field
extraction. Test: Leave one field blank (e.g., “Mean age”) and click its AI button. See that the model
returns a value for just that field. Also test overriding: if a field already has manual text, clicking AI might
warn “This will overwrite current value – proceed?” to avoid accidental override.
16. Confidence and Uncertainty Indication: If the AI is unsure or the data is not found, the system
should indicate that. For instance, if the LLM response includes words like “not reported” or “could not
find”, the tool should leave the field blank but maybe annotate it as “Not found by AI”. Alternatively, the
AI could be instructed to output a confidence score (e.g., high/medium/low) for each field. The system
shall interpret low confidence by highlighting the field in a different color (e.g., orange) or adding a “?”
icon. Test: If a field truly isn’t in the PDF (e.g., no illness data in an injury-only study), see that the AI
doesn’t just make something up – the field remains blank or marked “Not reported.” Check that such
fields are flagged for user attention. If the AI output includes a confidence indicator (assuming our
prompts ask for it), verify the UI reflects it (like shading the field according to confidence).
17. Manual Editing & Override: Users (extractors or reviewers) must be able to edit any field
manually regardless of AI input. Any manual edit should overwrite the AI suggestion. The system
should then treat it as unverified until the user marks it done. If a user deletes an AI-suggested value to
blank, that’s allowed. Test: After AI fill, click into a field (say, DOI) and change the value – ensure the new
16
text is saved and the AI highlight is removed (or changed to an “edited” state). Ensure no further AI
auto-run overrides this unless explicitly triggered.
18. Field Confirmation & Status Colors: The tool shall implement a mechanism for field status: e.g.,
Not started (gray), AI-suggested (yellow), Confirmed (green), Flagged (red). Initially all fields are “not
started” (or blank). When AI populates them, they become “suggested” (yellow). When a user confirms
it’s correct, they mark it and it turns green. If a user is unsure or finds an issue, they can mark it with a
flag (red). The status is visible on each field and roll-up to study level. Test: Start with a new study – see
fields gray. Auto-fill – see them turn yellow. Mark a few as confirmed – they turn green. Click a “flag” icon
on a problematic field – it turns red. On the dashboard, the study entry might show an overall color
(perhaps the worst-case status or percentage completed). Confirm that these status changes persist on
save and are visible to the reviewer as well.
19. Definitions & Help Panel: There shall be a readily accessible panel or popup that contains key
definitions, coding rules, and examples (from the IOC consensus, OSIICS, etc.) to guide users. This is
essentially the “codebook” reference. For example, definitions of injury, illness, severity classes, etc., and
lists of OSIICS categories (like what counts as “Muscle injury” vs “Tendon rupture”). Users can open this
while extracting data to check how to categorize something. Test: Click on a “Definitions” button – verify
a sidebar or modal opens with content. Scroll through and see sections for “Injury Definition”, “Severity
classes”, “OSIICS categories list”, etc. Check that this content matches official sources (maybe
abbreviated) 33 5
. Ensure it does not disappear while the user is still looking (maybe it can remain
open as they type).
20. Synonym Recognition: When entering or reviewing data, the system shall recognize common
synonyms and either auto-correct them to the canonical term or suggest the mapping. For example, if
an extractor types “M” in the Sex field, the app might auto-complete to “Male”. If the AI extracted
“prospective cohort study” as Study Design, the system can map that to the canonical term “Prospective
cohort”. If the AI outputs “semi-professional” for Level of Play, the system knows to map to “Sub-elite/
Amateur” category (with confirmation). This can be done via an internal dictionary of synonyms. Test: In
the Level of Play field (expected options: Youth, Amateur, Elite, etc.), type “professional” – on blur, see it
changes or flags “Elite (Professional)” as the value. For Sex, try “women” – it should convert or
dropdown-select “Female”. For Injury Type, if the AI returns “ACL tear”, the system should either prompt
“Map ‘ACL tear’ to ‘Joint Sprain (ligament injury)’?” or automatically fill that category and note the
mapping.
21. Autosave Progress: As the user edits fields, the system shall autosave the data in the background
(e.g., every few seconds or when a field is changed). This prevents data loss if the user’s session is
interrupted. There should also be a manual “Save” button for reassurance, but autosave ensures even if
they forget, the data is stored. Test: Edit a value, wait 5 seconds, then refresh the page without manually
saving – verify that the change was not lost (the field still has the edited value after reload). Simulate a
crash or logout and login – the in-progress data should persist.
22. Mark as Complete (Extraction): An extractor shall be able to mark a study as “Extraction
Complete” (ready for review) once they have filled all they can. This action will lock the form from further
editing by that extractor (to prevent accidental changes), and notify the assigned reviewer (maybe via a
status update). The extractor can still add notes after marking complete, but not change values unless
the reviewer toggles it back. Test: Click “Mark as Complete” on a filled study. Ensure the UI indicates it’s
now awaiting review (perhaps fields become read-only for extractor). Log in as reviewer or admin –
ensure they can still edit if needed (since they have higher privilege). If an extractor marks complete but
then realizes they missed something, perhaps they can “unsubmit” if the reviewer hasn’t started yet –
but this is a nice-to-have, not core.
Review & Approval Workflow
23. Reviewer Access and Edit: A Reviewer shall be able to open any study (especially those in “Pending
Review” status) and view all extracted data. They must be able to edit any field (correct mistakes) and
add/edit notes. Reviewers can also change a field’s status (e.g., remove a flag if they resolved it, or flag
17
something they disagree with). Test: As a Reviewer user, open a completed extraction. Try changing a
numeric value – it should allow edit (and probably mark it as edited by reviewer). Add a note – it saves.
Remove a red flag from a field – it turns normal. These changes should be logged.
24. Dual Extraction Comparison: If a study has two extraction entries (because two different users
entered data independently), the system shall provide a comparison view for the reviewer. This can
manifest as side-by-side columns for Extractor A vs Extractor B for each field, or a merged view where
fields with disagreements are highlighted. The reviewer should easily see where values differ. The
reviewer can then pick which value to accept or manually input a new one. Once resolved, the final
single set of data is saved as that study’s extraction. Test: (This is complex to test manually, but simulate
by having two entries for the same study in the DB or a feature toggle.) Ensure that if “blinded
extraction mode” is on for a project, when a reviewer opens a study that two people extracted, the UI
shows two sets. Change one field’s value in one of them to create a discrepancy; confirm it’s detected.
Then use the UI to accept one – verify that final data now uses that value and the conflict is cleared.
25. Audit Log & Versioning: The system shall maintain an audit log of all changes, especially for
review. This includes who initially extracted a field and who modified it on review. The Reviewer should
be able to see this history in the interface (e.g., an icon to expand history for a field). The Admin should
have access to a full audit trail (perhaps an exportable log or at least a database table) listing events:
timestamp, user, action, field, old value -> new value. Test: As a reviewer, view a field that was changed –
confirm you can see that “Extractor X set it to 5 on July 1, Reviewer Y changed it to 6 on July 3”. As
Admin, access an audit report (maybe a page or raw log) and see entries for various events (login events
might also be logged, but at least data changes).
26. Approval (Mark as Reviewed): A Reviewer shall be able to mark a study as “Reviewed/Completed.”
This signals that extraction is final. Once marked reviewed, the study’s data is locked to everyone except
Admin (to prevent accidental modifications). The status on dashboard turns green (or a checkmark
appears). Test: As Reviewer, mark a study as reviewed. The UI should reflect that (status updated). Try to
edit a field afterwards as a non-admin – it should be read-only. The Admin could still override in case of
late corrections. Also test that all required fields must be filled or explicitly marked N/A before allowing
final mark (if that rule is enforced – likely we ensure no critical field is blank unless justified).
Data Export
27. CSV Export (Full Dataset): The system shall allow exporting all extracted data to a CSV file. The CSV
must include all columns as per the defined schema (first four tabs auto-extract fields, plus all other
tabs) in a consistent order. The first row is column headers with clear names matching those in the
template. Each subsequent row is one study. Fields that were not applicable or not reported should be
blank or use a consistent placeholder (e.g., “NA” or just empty). Test: Perform an export after inputting
sample data for 2 studies. Verify that the CSV has the columns in the expected order (compare with
Excel’s columns). Check that numeric values, text, etc., appear correctly. If any field had commas or
special characters, ensure they are properly quoted in CSV.
28. JSON Export: The system shall also support exporting data in JSON format. The JSON structure
should be an array of objects, each object containing all data for one study, keyed by field name. Nested
structures can be used for logically grouped fields or provenance info if needed (e.g., a “provenance”
sub-object with sources). Test: Export as JSON and parse it. Check that it’s valid JSON and that all studies
and fields are present. Example: [{ "StudyID": 1, "LeadAuthor": "Smith", ...,
"InjuryOutcome": { "TotalInjuries": 10, "Incidence": 8.4, ... } }, ...] – or flat
keys.
29. Canonical Column Order: The export module shall ensure that columns in CSV (and keys in JSON if
not nested) follow the canonical order given by the project’s codebook (matching the Excel sheet
order). This means Study Details fields first, then Participant Characteristics, then Definitions, Exposure,
Injury outcomes, etc. This order is predefined and should not change between exports. Test: Check the
CSV header sequence against the Excel’s columns – they should align exactly. e.g., verify “Study ID, Lead
Author, Title, Year, Journal, DOI, Study Design” are the first columns, etc. If a field is missing for a study,
18
the column still exists (just empty cell).
30. Provenance and Metadata in Export: The system shall include important metadata in exports. At
minimum: each row has the Study ID (and possibly citation info like author/year for reference).
Additionally, optionally include who extracted/reviewed it (e.g., columns “ExtractedBy” and
“ReviewedBy”) and possibly a “Notes” column if any general notes were added. If “include provenance”
is selected, the CSV might append columns like “<FieldName>_Source” with page numbers or
“Confidence” values. The JSON could contain these as fields or as part of an object. Test: Enable
provenance and export. See that additional columns are present – e.g., a “Notes” column containing any
free-text notes for that study, and maybe “SampleSize_Source” = “p.3” if we tracked it. If no provenance
tracking was opted, verify the export is clean with just data.
31. Export Integrity: The export function must only include approved data (by default). That is, by
default it should exclude studies not marked as completed/reviewed (or clearly label them). This
prevents incomplete data from sneaking into analysis. Admin can override by explicitly exporting all
including incomplete (with flags). Test: If 5 studies are done and 2 are still in progress, do an export in
default mode – verify only 5 appear. If the admin chooses “include all”, verify those 2 appear but
perhaps with some marker (maybe their fields are partially empty – which is fine as long as known).
Miscellaneous Functional
32. User Assignment (Optional): The system should allow an Admin to assign each study to an
extractor and/or reviewer (perhaps via dropdowns on the dashboard or an assignment page). This is
mainly to help coordinate who is responsible for which paper. The app doesn’t strictly need this for
functionality, but it can filter dashboard view (“My assignments”). Test: Assign Study A to Alice (extractor)
and Bob (reviewer). Log in as Charlie – Study A should appear read-only or not at all if not assigned
(depending on policy). Log in as Alice – she clearly sees Study A is assigned to her (maybe a filter
“Assigned to me”). This ensures clarity in multi-user scenario.
33. Notifications: (If applicable) When certain events happen, the system may notify users. For
example, when an extractor marks a study complete, the assigned reviewer could get an email or in-app
notification “Study X is ready for review.” Since the requirement is not explicit about email (and system
may not have email at all), in-app indicators suffice (like a badge or status filter). Test: After marking a
study complete, log in as reviewer – that study should be highlighted or easily found (e.g., a counter “1
study awaiting your review”).
34. Search and Filter Studies: The Dashboard shall provide basic search (by title, author, or keywords)
and filtering (by status, by assigned user, by year, etc.). This helps manage a large number of studies.
Test: If 50 studies are listed, use the search box with an author name – the list should filter to those
matching. Filter by “Not started” status – see only those. This ensures usability at scale.
6. Non-Functional Requirements (NFR)
Performance & Scalability:
1. PDF Processing Speed: The system should parse a typical PDF (10 pages, text-based) and perform AI
extraction in a reasonable time to not hinder user flow. Target: initial AI suggestions within ~30 seconds
for a standard paper. For longer papers (e.g. 30–50 pages) or slower AI responses, the system should
inform the user (“Extracting data, please wait…”) and perhaps load partial results as they come.
Acceptance: Test with a 15-page PDF: time the auto-extraction. If it returns suggestions in under 30s,
passes. For a 50-page document, ensure it’s under e.g. 90s. If the process will take long, a progress
indicator or at least a spinner with reassuring text is shown.
2. Max PDF Size Handling: The app must handle up to 20 MB PDFs as promised (which could be ~200+
pages with images). For such large PDFs, memory management is important. We may implement
chunked processing (reading in segments) so as not to block the browser or server. Acceptance: Upload
a ~19MB PDF and attempt extraction. The system should not crash or hang indefinitely. Even if AI
extraction might skip extremely large text (if beyond model limits), the UI should remain responsive and
19
allow manual extraction in worst case.
3. Throughput & Concurrency: The system should support multiple users extracting simultaneously
(e.g., 3–5 extractors and reviewers working at once) without significant slowdown. The backend should
queue API calls appropriately to avoid hitting rate limits (maybe one paper’s fields sequentially rather
than all parallel if needed). Acceptance: Simulate 3 users each triggering AI extraction at the same time –
the system should handle it (maybe slightly queued, but all get results). The database and storage
should handle on the order of 50–100 PDFs and associated data with no issues (this scale is small, so
primarily ensure no N+1 query issues or such).
Reliability & Robustness:
4. Autosave and Crash Recovery: The app should autosave frequently such that a browser crash or
network drop causes at most a couple minutes of work loss. Partial inputs should be saved as draft.
Acceptance: Begin filling a form, then simulate a browser refresh mid-way. After re-login, the previously
entered values are still populated. If the server goes down mid-edit, once up, the data last saved is
present (maybe losing at most the last field if typed very recently).
5. Error Handling: The system shall gracefully handle errors from the AI API or OCR engine. If the AI
returns an error (timeout, service unavailable), the UI should catch it and show a user-friendly message
(“The AI service is taking too long. Please try again later or fill this field manually.”). Exceptions in
backend processes should be caught so that they do not crash the whole app or leave a spinner stuck.
Acceptance: Force an AI timeout (perhaps by using a dummy key or disconnecting network after request)
– verify the UI shows a clear error and allows user to retry or continue manually. Induce an OCR error
(e.g., by using a corrupt image) – ensure the error is caught and user is informed “OCR failed on page
X.” No raw stack traces or crashes shown to user.
6. Data Integrity: The system must maintain consistency of data. E.g., once a study is marked
completed, it shouldn’t revert to incomplete unless explicitly intended. Two users should not override
each other’s data silently. We might implement optimistic locking or at least warnings if a record was
updated by someone else while open. Acceptance: Have User A and User B open the same study
concurrently. User A changes a field and saves; User B then also changes and saves. The system should
either: a) prevent User B because data changed (notify and refresh needed), or b) allow it but record
both changes in audit (last one wins but audit shows conflict). Ideally, if role-based, extractors wouldn’t
collide like this often, but testers ensure no silent data loss.
7. Backup & Export Reliability: The app should allow the Admin to export data at any time and that
export serves as a backup. The database itself should be regularly backed up (especially if using cloud
Firestore or a relational DB, use provided backup solutions). Acceptance: Simulate a scenario where the
web UI is not accessible (maybe a downtime) but ensure data is not lost – e.g., verify backup files or the
ability to get data from the DB. (This may be more of an operational concern, but included for
completeness.)
Security & Privacy:
8. Access Control: Ensure that data is only accessible to authenticated users. No one should be able to
fetch study data or PDFs without logging in. Use secure direct-download URLs for PDFs (expiring links or
via backend proxy). Acceptance: Try accessing a PDF file URL directly in an incognito session – it should
prompt for login or deny. Try API endpoints (if any) without auth – should be denied.
9. Sensitive Data: The content here is published research, not personal private data, so privacy risk is
low. However, user accounts (username, actions) and any notes should be kept internal. The system
should comply with GDPR basics if any personal data (like user names or perhaps study author names
considered personal) are stored – e.g., ability to delete a user if needed. Acceptance: Check that deleting
a user or removing data can be done by Admin if required (e.g., if a user requests removal, their account
can be deleted, though the extracted data remains as it’s project data). Ensure we’re not storing
anything beyond necessity (no personal reader notes that are out of scope).
10. Encryption in Transit and Storage: The app will be served over HTTPS so that data in transit
20
(credentials, API key, content) is encrypted. Sensitive fields like passwords and API keys are encrypted at
rest. Acceptance: Access the site and ensure it loads via https. Inspect network calls to confirm no
passwords or keys appear in plaintext. If using Firestore, verify security rules to ensure keys aren’t
exposed.
11. Audit Trail (Security): As part of ethics, any changes are logged (as per functional reqs). This also
serves security – if an unauthorized change happens, we can trace which account did it. The Admin
should periodically review logs for any anomalies (like a user editing data not assigned to them, etc.).
Acceptance: Check that audit log captures user identity for each data change and key actions (login,
export).
Usability & Accessibility:
12. Ease of Use: The interface should be clean and not overwhelming. Use clear labels (matching terms
in codebook). Keep paragraphs short in help text (the UI help or definitions should be scannable – likely
not an issue in-app). The flow from uploading to extraction to review should be intuitive (with maybe
small tooltips or a quick tutorial overlay for first-time users). Acceptance: Perform a user testing scenario
with a new extractor: can they figure out how to upload and start extraction without training?
(Qualitative, but measure by whether they get stuck). If any confusion arises, add UI hints (like a “What’s
this?” next to AI button explaining it).
13. Accessibility (A11y): The app should use color coding (yellow/green/red) plus icons or text to
ensure color-blind users can differentiate statuses. It should allow keyboard navigation (tab through
fields, press space to check checkboxes, etc.). Non-text content (images, icons) should have alt text or
tooltips. Acceptance: Use a color-blind simulator or at least verify that the status icons have shape or
letter indicators (e.g., a checkmark icon for confirmed (green), an exclamation for flagged (red)). Try to
navigate the form using only keyboard – should be able to fill fields without a mouse. Use screen reader
to read a form field – ensure it announces field label and any value. (Given it’s an internal tool, full
WCAG compliance is ideal but can be iterative. At minimum, no major barriers for partially sighted
users.)
14. Responsiveness: The app is primarily desktop-web oriented (since extracting data from PDFs on
mobile is impractical). It should support common desktop resolutions. If possible, design so it also
works on tablets (for portability). Acceptance: Open the app in a typical laptop resolution (~1366x768)
and a larger monitor (1920x1080) – ensure layout scales (more whitespace on big screen, but still usable
on smaller). On a narrow screen or tablet portrait, maybe hide the PDF or form (could degrade to
sequential view if needed).
15. Language and Internationalization: The interface language will be English (as the team operates
in English), which is fine. The content (papers) might be in other languages occasionally – we rely on AI
model’s multi-lingual abilities if needed. For now, we do not require full i18n of the UI. However, ensure
that special characters (accents, non-Latin text) in PDFs are handled (e.g., author names with accents,
titles in German, etc.). Acceptance: Extract from a PDF in Spanish – see if the model returns Spanish text
for definitions. The UI should allow that text (even if UI labels are English). If needed, user can translate
outside the tool.
Maintainability & Observability:
16. Logging and Monitoring: The system (especially backend) should have logging for key events and
errors (with stack traces) to aid debugging. Use a logging framework or cloud monitor (like Firebase
logs or custom server logs). We should also track usage metrics (how many AI calls, how long each took)
to identify performance issues or cost issues. Acceptance: Intentionally cause a minor error (like load a
malformed PDF) and check that an error log is recorded server-side with details. Ensure API usage
metrics can be retrieved (could be manual if not a requirement, but recommended to watch e.g. how
many tokens used on AI, to manage cost).
17. Modularity: The code should be structured so that components (PDF parsing, AI prompting, UI
form) are separable for updates. For example, if we switch from Gemini to another model, that should
21
require changing the integration module, not the whole app. Or if the schema updates (adding a field),
it should be straightforward to add in the form and database. Acceptance: Code review (by development
team) ensuring separation of concerns (e.g., a service for LLM calls, a config defining the fields list, etc.).
Also test adding a dummy field in dev – does it require changes in many places or just one config? Aim
to centralize schema definition.
18. Scalability (Future-proofing): While currently for one project (maybe ~50-100 studies), consider if
the tool might be reused for others or expanded to thousands of records. The chosen database and
architecture should handle more data by adding indexing and possibly pagination on the dashboard.
Using Firebase/NoSQL is fine for this scale; if using relational, ensure indexing on key search fields.
Acceptance: Not easily testable now, but consider performance if 1000 studies were present – ensure
queries (like search or listing) are indexed. For Firestore, that means composite indexes if needed for
certain queries. For SQL, ensure proper primary keys and indexes on things like title (for dedup) and ID
(for relations).
Compatibility:
19. Browser Support: The app should work on modern browsers (Chrome, Firefox, Edge, Safari) –
primarily Chrome is expected in this context. We should use standard web technologies to avoid issues.
Acceptance: Open the app in at least Chrome and Firefox – ensure all features (PDF viewer, form, etc.)
work similarly. Check Edge as well. Safari (on Mac) should be checked for any PDF rendering quirks.
20. Integration with Existing Systems: If needed, ensure the export aligns with where it’s going: e.g.,
the plan is to store data in FIFA’s SharePoint or OSF 32
. So CSV should be easily uploadable there. Also,
if the team uses Rayyan for screening, maybe provide an import of included study list from Rayyan
(Rayyan can export included references). Not a requirement, but nice: e.g., import a CSV of citations to
pre-create records. Acceptance: (Optional) Test importing a reference list: if implemented, ensure it
creates empty Paper entries for each citation that can be later attached to PDFs. Otherwise, at least
confirm that our export covers all they need to then do analysis or share data.
By meeting these NFRs, we ensure the AIDE tool is not only functional but also reliable, secure, and
pleasant to use, aligning with the high standards of an academic research environment.
7. AI/ML Design
Model Choice – Gemini 2.5 (Palm API): We will use Google’s Gemini 2.5 (Flash) LLM as the default
engine for AI assistance. This model is chosen for its strong multi-lingual capabilities and fast response
(“Flash” version) which suits interactive use. It can handle the context of scientific text and is less likely
to run into the 2021 knowledge cutoff issue that ChatGPT had (we presume it’s updated and fine-tuned
for such tasks, given 2025 context). If Gemini is not available or for backup, we can allow switching to an
alternative (OpenAI GPT-4 or similar) via settings, but our primary integration and testing will be with
Gemini.
Prompt Strategy: We will design field-specific prompts to extract information in a structured way.
Instead of naively feeding the entire PDF text and asking for everything (which could overflow context
and produce errors), we break down the task:
•
Bibliographic fields: We can often parse these without AI. But to be safe, we’ll use prompts like:
“Provide the study’s title, authors, year, journal, and DOI.” (We may give it the text of the title page
or use PDF metadata if available). Gemini should accurately pull the title (even if long) and
authors. We will post-process to get just the first author’s last name for the “Lead Author” field.
Example Prompt: “The following is the beginning of a research paper. Extract: Lead author last
name; Full title; Year of publication; Journal name; DOI. If any item is missing, say 'Not available'.
22
\n\n[TEXT: 'International Journal of Sports Medicine, 2019... Title: Injury Rates in Youth Football...
Authors: John Smith, ... DOI: 10.xxxx']” – We expect a JSON or list answer which we parse. We will
instruct the model to output in a structured format (like Title: ...; LeadAuthor: ...;
Year: ...; Journal: ...; DOI: ... ). This makes parsing easier.
•
Participant Characteristics: We will prompt with something like: “From the methods section, extract:
country (if given), level of play (elite/professional, amateur, youth, etc.), sex (male/female/both), age
category or mean age, sample size (number of players), number of teams, study period (years
covered), and observation duration (follow-up length).” We’ll supply the model with the text of the
“Participants” or “Methods” section (using a heuristic to find it, e.g., look for “Participants” or
“Methods” heading in the text). If the paper is structured differently, we might just give the
whole methods text. The model should return these fields. We’ll likely have to parse a narrative
answer. Alternatively, we can instruct: “Output as CSV: Country, Level, Sex, AgeCategory, MeanAge,
SampleSize, Teams, StudyPeriod, ObservationDuration.”
We must be cautious: some papers might not state country explicitly (if single-country, maybe obvious
from context or author affiliation). Level of play might be in introduction or methods. We might need to
search keywords (like “professional”, “elite”, “university”) and feed those contexts. We can do simple
keyword scanning in code and append relevant sentences to the prompt.
•
Definitions & Data Collection: We have fields like Injury definition, Illness definition, etc. Usually,
papers have a section or statements like “Injury was defined as…” per IOC consensus. We can
search the text for “defined as” or keywords “injury definition”, “illness definition”. We will
prompt: “Extract the definitions the study used for ‘injury’, ‘illness’, ‘mental health problem’, as well as
how they defined incidence, burden, severity, recurrence. Provide the text or summary for each if
available.” This likely results in a somewhat verbose answer. The reviewer will later map it to
standard categories. Possibly we only need to capture if they adhered to standard definitions or
not. However, to be thorough, we’ll capture the exact phrasing in a notes or definition field (for
documentation). We might further ask the model to categorize the injury definition: e.g., does it
match “time-loss” (yes/no)? But that’s advanced. Alternatively, we can manually map during
review. Initially, just get the text.
•
Exposure Data: Fields like “Length of season (weeks)”, “Number of seasons”, “Exposure
measurement unit (player-hours, etc.)”, “Total exposure, match exposure, training exposure”.
Likely these are in methods/results. We search for “exposure” or “hours”. We prompt: “Extract the
exposure data: how long was the study period (e.g., one season of 40 weeks, or 2 seasons), and what
exposure metrics were reported. Specifically: total exposure (in player-hours or matches), match
exposure, training exposure. Also note the unit (e.g., 1000 player-hours).” The model should find if
the paper says “We recorded 10,000 player-hours of exposure (8,000 in matches, 2,000 in
training)” or similar. We then fill the fields accordingly (10000 total, etc.). If the model gives a
narrative, our code can parse numbers. We should instruct it to output numbers directly if
possible.
•
Injury Outcomes: Many fields here – total injuries, match injuries, training injuries, incidence
overall, incidence in matches, in training, 95% CIs, adjusted incidence (and confounders if
reported), total time-loss days, mean/median time-loss, burden (incidence * time loss), burden
CI, most common injury type/location/severity, mode of onset counts (repetitive gradual, etc.),
contact vs non-contact counts, median/mean injury duration, total recurrent injuries, recurrence
rate. This is a lot of detail. Not all studies report all of these, but our form has them. We should
decide how to get these: Possibly break it into chunks:
23
•
•
•
•
Basic counts and incidences,
time-loss metrics,
“most common” fields,
breakdown of acute vs overuse vs contact, etc.
The model can handle numeric data, but we must ensure it doesn’t hallucinate. A plan: find where in the
text the results are (maybe a table or text stating “incidence was X”). Possibly better: use a combination
of regex/logic to extract numbers. But to rely on AI, we can prompt: “Summarize the injury occurrence
results: total number of injuries, number in matches vs training (if given), the overall injury incidence (per
what unit?), and its 95% confidence interval, and any reported breakdown (match incidence, training
incidence). Also note if an adjusted incidence was reported and for what confounders. Then list the total time-
loss (maybe total days lost) and average injury severity (mean/median days). Provide the injury burden
(injuries * severity per 1000h) and CI if given.” This is a heavy prompt, but Gemini should handle it if given
the results section. We might need to pass the entire results section or the specific part (the model
might identify it from the word "injury incidence" etc.). The output might be narrative, which we then
parse or the user reads and fills. Ideally, we want structured output, but training the model to output all
fields perfectly structured might be error-prone. We could instead have the model output a JSON like:
{"TotalInjuries": X, "MatchInjuries": Y, "TrainingInjuries": Z,
"IncidenceOverall": A, "IncidenceOverallCI": "[C-D]", ... } But expecting the model
to fill all keys might lead it to guess missing ones. Alternatively, we query one sub-group at a time: -
Prompt A: “How many injuries in total? How many were match injuries and how many training injuries?
What is the overall injury incidence (with unit) and its 95% CI?” - Prompt B: “What is the match injury
incidence and training injury incidence (with CI if reported)?” - Prompt C: “Did they report an adjusted
incidence? If so, what is it and what factors were adjusted for?” - Prompt D: “What is the total time-loss
due to injuries (e.g., total days or matches lost)? What is the mean and median time-loss per injury (with
SD if given)?” - Prompt E: “What is the injury burden (incidence * severity, e.g., days lost per 1000h) and
its CI?” - Prompt F: “What was the most common injury type, most common injury location, and most
common injury severity category reported?” - Prompt G: “If reported, how many injuries were of each
mode of onset: repetitive gradual, repetitive sudden, acute sudden? How many were contact vs non-
contact vs overuse?” - Prompt H: “How many injuries were recurrences, and what recurrence rate (%) did
they give?”
This is a lot of prompts, but we can group some if careful. We must be mindful of token usage – but
given at most ~50 studies, even multiple prompts per study is fine. We also might skip some if data
obviously not present.
The advantage of multi-step prompting is we get more targeted answers and can fill incrementally.
•
Illness Outcomes / MH Outcomes: Similar approach but fewer fields. Illness: total illnesses, maybe
breakdown by match/training (if any), incidence, time-loss, burden, most common organ system,
most common etiology, severity class, onset (gradual vs sudden for illnesses), durations. Mental
health: total problems, incidence, method (self-report vs diagnosed?), time-loss, burden, most
common symptom, disorder, severity, onset modes (gradual/acute/mixed/unknown), durations,
recurrences. We will prompt similarly in pieces focusing on those areas.
Chunking PDF Text: If the PDF text is extremely long (like 15k words), feeding it whole is not feasible.
But we likely can identify relevant sections: - Use simple heuristics: find the Introduction/Background
end, Methods, Results, etc. Many papers have headings (if not, we find key phrases). - We can cut the
text into chunks (say 2000 tokens each) and possibly use a retrieval approach: for each prompt, select
the chunk that likely contains the answer. E.g., for Methods questions, feed chunks from Methods; for
results, feed from Results; for conclusions, maybe not needed.
24
Alternatively, use an approach: first, have the model generate a structured summary of the paper (like
an outline of sections and key findings) – but that might be as hard as extraction itself. Perhaps not
needed given known structure of research articles.
We might not have to be extremely fancy because we have human in loop. If the model misses
something, the human will catch it. The AI’s role is to assist, not to be 100% correct on its own.
Confidence & Validation: We will instruct the LLM to indicate if it’s unsure. For instance, end each
answer with a bracketed note like “[confidence: low]” if it’s guessing. Or we ask it to answer "or say 'Not
reported' if the paper does not provide that data." If the model explicitly says "Not reported", that’s fine
and we highlight that for user to verify. We can also have it output a confidence score (some of OpenAI
models do that via logit, but since we treat it as black-box, we rely on self-reported cues).
Another strategy: after the model provides an answer, we could run a quick check. E.g., if it gave a
number for incidence, we can verify if that number appears in the text (string search). If not, maybe it's
hallucinated. For critical numeric fields, we might do this cross-check automatically: - If model says "8.4
per 1000h", search the PDF text for "8.4" or "8.4 " – if found near "1000", likely correct. If not found, flag
that output as suspect.
For fields like "most common injury type: hamstring strain", we can check if "hamstring" appears in text.
The model might hallucinate plausible injuries if none stated; hopefully not if instructed to say "Not
reported" if absent.
Error Handling in ML: If the model returns an answer that doesn’t parse (e.g., it returns a paragraph
with multiple sentences where we expected a single number), our code can handle it by either: -
Attempting to parse (like use regex to find a number). - Or display the raw AI answer in the UI for the
human to interpret.
We will design the parsing to be forgiving: e.g., if expecting "95% CI", the model might give it as "(5.0–
12.0)" or "5.0 to 12.0". We’ll handle both.
If the model outputs combined info, we split it. The UI form might have multi-part fields (like incidence
and CI separate columns), so if AI gives "8.4 (95% CI 5.0–12.0)", we parse into incidence=8.4, CI=5.0–
12.0.
We also ensure no unit confusion: incidence unit must be captured. If one study reports per 1000 hours,
another per 1000 athlete exposures, we store exactly what they reported (maybe in a “unit” field or
note). The “Exposure Measurement (unit)” field likely covers that – we capture e.g. “per 1000 player-
hours” there.
Evaluation Plan for AI Extraction: Before wide use, we will do a pilot on a subset of papers (as per
project timeline, pilot extraction June 2025) 8
. In that pilot: - We will perform extraction with AIDE for,
say, 5 studies that the team has already extracted manually as a test. - Compare each field from AI-
assisted extraction vs the known correct values. Measure accuracy: e.g., out of X fields, how many did AI
get right without human correction. - Specifically check critical fields: sample size, total injuries,
incidence – these must be accurate. - Identify patterns of errors: does the AI struggle with certain fields
(perhaps “Number of teams” or “adjusted incidence” might be tricky if rarely reported). - Then refine
prompts or mapping rules accordingly. For example, if we see it tends to confuse “incidence per 1000h”
vs “per 1000 player-games” we might adjust by explicitly asking for units or splitting queries. - Also
evaluate time saved: measure how long it took human with AI vs manual for those pilot studies (to
25
ensure we meet that 50% time reduction target). - Continually, as more papers are extracted, keep an
eye on AI performance. The app could have a built-in evaluation mode where after review, it notes if the
final value differed from initial AI suggestion (this can be logged). If many differences on a field, that
field’s extraction prompt might need improvement.
We will maintain a small validation set of known correct data to test the AI integration whenever we
update the prompt logic (regression testing).
Model Usage Optimization: To control costs and latency: - We’ll use the “Flash” version of Gemini 2.5
for quick responses, assuming slightly lower quality than a larger version but speed is crucial for
interactive use. If quality suffers, we might allow switching to a slower but more accurate model for
specific fields (maybe an option “Try detailed extraction with larger model” for stubborn cases). - We’ll
limit context length: ideally, keep prompts + context under the model’s limit (which might be e.g. 8000
tokens). For chunking, maybe feed ~2000 tokens at a time. - Perhaps implement a simple retrieval: e.g.,
use keyword search on the PDF text to find relevant paragraphs for each prompt. That way we don’t
send entire text. For example, to get injury counts, find paragraphs with “injur” or digits followed by
“injur”. Use that as context. This could improve accuracy and reduce tokens. - However, given time
constraints, we might first attempt a simpler approach (just sections as known) and refine if needed.
Error and Bias Considerations: The model might occasionally “fill in” likely values if not found (due to
training on lots of similar papers). E.g., if an outcome isn’t reported, it might hallucinate a typical value.
Our instructions explicitly tell it to say “Not reported” if not found. We must verify it follows that. Also
ensure it doesn’t leak any knowledge beyond the paper (like citing an external source) – likely not, since
we confine prompt to the text.
Fallback for AI: If Gemini API is down or if the user has no key, the system should still function with
manual extraction. So every field can be filled by user. Possibly we can integrate a local model or offline
method for minimal help (probably not needed if internet required anyway). In any case, AI is an
enhancement, not a dependency for success (except timeline-wise).
Training Data & Privacy: We are using a pre-trained model via API. We must ensure we handle the
content appropriately – these PDFs are presumably copyrighted articles. By sending text to the LLM API,
we should consider terms of service and privacy. Likely okay under research use (and the data is not
personal info). We might include in compliance that any AI service used will not store the content (some
APIs have options to not log data). We will enable “no log” if available for the API to protect the content.
Summary of AI Pipeline: For each paper: - Extract raw text (with OCR if needed). - Pre-process into
segments (by section or by search). - For each field or field group, prepare prompt with relevant text. -
Call LLM, get response. - Parse response to field values. - Apply mapping to canonical forms (synonyms).
- Present suggestions for user to confirm.
This design uses AI to automate what is safe (extracting descriptive info and copying numbers), but
leaves interpretation and final confirmation to humans, aligning with the requirement that humans
remain in control and the process is defensible.
26
8. Standardisation & Coding Frames
A key goal is to standardise the extracted data so that outputs from different studies are comparable
2 5
. We will enforce standard definitions and coding frames at every step:
•
•
•
•
•
•
•
•
•
IOC Consensus Definitions: We adopt the 2020 IOC consensus definitions for injury & illness
surveillance (including the football-specific 2023 extension 34 35
). The tool’s definitions panel
will list these to guide extractors. For example:
Injury: “Any physical complaint sustained during football training or match that results in a player
being unable to participate fully in the next planned session or match (time-loss)” – that’s the time-
loss definition 31
. Also mention if the study uses a broader “any medical attention” definition.
Our extractor will record exactly which definition was used by ticking standardized options:
(“Time-loss”, “Medical-attention”, “All complaints”, etc.) rather than writing free text.
Illness: similarly, likely “Any physical or psychological complaint not related to injury.” (We will
provide any standard phrasing available; the IOC 2020 statement covers illness as any health
complaint).
Severity: We use standard severity classes: Minimal (1–3 days), Mild (4–7 days), Moderate (8–28
days), Severe (>28 days), Career-ending 36
. The coding frame will have these categories. If a
study says “minor/moderate/severe” we map to these (with “minor” likely meaning mild or
minimal – need context).
Recurrence: Standard definition is an injury of the same type/location after return to play. We’ll
capture if they mention “re-injury definition” (like within 2 months of return etc.). We likely just
mark Yes/No if they defined it, and if so possibly note if it aligns with standard (most use same-
season recurrence etc., but we’ll store text if variant).
Incidence: Typically defined as number of events per exposure unit (often per 1000 player-hours)
37
. If a study defines differently (per 1000 player-matches), we record that in “Incidence
Definition” or as part of “Exposure Measurement unit”. Our standard output will assume per
1000 player-hours for comparisons, but we won’t convert values (to avoid introducing error).
Instead we will note the unit. We could later convert if needed, but out-of-scope for extraction
phase.
Burden: Standard burden = incidence * average severity (often expressed as days lost per 1000h).
We will ensure burden is recorded in common terms (days lost per 1000h with CI). If a study
doesn’t follow that definition (e.g. some might just report total days lost), we note that.
Mechanism categories: We use IOC categories: Contact vs Non-contact, and also acute vs overuse
(gradual). The extension mentions “Mode of onset” – we have fields for Repetitive gradual,
Repetitive sudden, Acute sudden. Interpretation: “Repetitive gradual” = classic overuse with
gradual onset (e.g., tendinopathy developing over time), “Repetitive sudden” = overuse injury
that presents suddenly (like stress fracture that suddenly causes pain), “Acute sudden” = acute
traumatic. Many studies might not differentiate repetitive-sudden vs acute, but if they follow
2020 IOC, they might. We will store counts if given. Also we have “Cumulative (repetitive)” field
which likely corresponds to overuse count. We need to ensure mapping: If a study just says
“overuse injuries = X” and “acute injuries = Y”, we would put X in “Cumulative (Repetitive)” and Y
presumably as (maybe “Acute sudden”), while leaving repetitive sudden/gradual breakdown
blank because not detailed.
Contact: Contact vs Non-contact are straightforward (if provided). “Contact” means caused by
collision or external force, “Non-contact” like muscle strains, and “Unknown” or “NA” if not
classified. If a study only says percentage contact, we can fill those and compute complement for
non-contact if needed.
27
•
OSIICS & SMDCS Coding: The Orchard Sports Injury and Illness Classification System (OSIICS,
formerly OSICS-10) and the Sports Medicine Diagnostic Coding System (SMDCS) are
recommended coding frames 38
. In our data extraction:
•
•
•
We are not coding each injury with OSIICS codes (that would be too granular and not asked).
Instead, our extraction forms have summary categories that mirror the OSIICS classification
dimensions:
◦
Injury Tissue/Type: (from the “Injury Tissue & Type” sheet) includes categories like Muscle
injury, Muscle contusion, Tendinopathy, Fracture, etc. These categories correspond to
OSIICS diagnoses groups. We expect the study to report something like “60% of injuries
were muscle strains, 20% ligament sprains, etc.” We likely won’t capture every
percentage, but at least what the study highlights as most common. We have a field
“Most common injury type” – that would be one of those categories (e.g., “Muscle/tendon
injury”). If we can, we also have the breakdown table where a user could input counts for
each category if available. For MVP, we might not fill the whole table automatically (that
would be too detailed for AI), but a user could manually fill it based on a table in the
paper. Possibly we mark presence or count in major categories.
◦
Injury Location: (sheet lists body parts head to foot and also position of player) – likely
based on OSIICS location codes. We have “Most common injury location” field – one value
(e.g., “Knee”). And a breakdown table (with columns for each body part) where if a study
provided the distribution of injuries by location, the user can fill counts. Similarly with
“Side” (left/right/center/bilateral) and “Position” (Goalkeeper, Defender, etc.) columns in
that sheet – they likely remain blank unless a study specifically looked at differences by
position (some studies might report GK injuries separately). We have those columns, but
many studies won’t report them; we’ll leave blank or not applicable as needed. But by
having them, we encourage standardized entry if they are reported.
◦
Illness Region & Etiology: The illness coding frame given (organ system categories like
Cardiovascular, Respiratory, etc. and etiologies like Infection, Allergy, etc.) comes from
OSIICS/ICD categorization of illnesses. We have “Most common organ system for
illnesses” and “Most common illness etiology” fields. Those will be dropdown choices
from those lists (like Respiratory, or Infection). We also have breakdown tables Illness
Region and Illness Etiology to possibly tick multiple that occurred. Standardization: if a
study says “We found mostly respiratory illnesses (e.g., flu) and some GI illnesses”, we
would mark Respiratory as most common organ system, infection as likely etiology, and
also indicate GI happened.
◦
Mental Health Symptoms & Disorders: Similarly, we have a list of symptom categories
(distress, anxiety, sleep disturbance, etc.) and disorder categories (depressive disorders,
anxiety disorders, etc.) based on ICD or DSM categories. We capture “Most common MH
symptom” and “Most common MH disorder” if reported. Many studies may not have
mental health data at all, so these will often be N/A.
The tool will include a mapping table or cheat sheet (possibly in definitions panel or a separate
reference) showing OSIICS categories and examples. E.g., “Muscle injury (OSICS code starts with
‘MUS’) includes strains, tears; Tendinopathy (Tendon overuse injuries, OSICS ‘TEN’) includes
Achilles tendinitis etc.” – so if a paper uses a term like “tendinitis of Achilles” the extractor knows
to classify under Tendinopathy.
We ensure consistent terminology: e.g., one paper might say “thigh muscle strain” and another
“hamstring tear” – both are Muscle injuries, location Thigh. Our fields would capture that
uniformly (Type = Muscle, Location = Thigh).
28
•
SMDCS is another coding system (diagnosis-based). We may not explicitly code in SMDCS codes
since we are focusing on categories; but since OSIICS and SMDCS were given in objectives
39
40
, we ensure our categories align with those consensus categories.
•
Standard Units & Formats:
•
•
•
•
•
All incidence rates will be recorded as numeric value plus an implied unit (with separate field
indicating unit if needed). If unit is per 1000 player-hours by default, and if a study uses a
different unit, we will record the value and note the unit explicitly in “Exposure Measurement
(unit)” (e.g., “per 1000 player-matches”). We won’t convert units automatically, but during
analysis, they’ll notice that and can convert if needed.
Time (durations): if a study reports mean injury duration as “3 weeks”, we should convert to days
(21 days) to be consistent with others typically reporting days. Or at least record “21 days” in our
numeric field. If they said “mean absence 3 weeks (we assume they mean ~21 days)”, maybe we
record 21. If uncertain, put note “approx 21 days”. For consistency, we prefer days for time-loss.
We will mention in definitions: severity categories use days.
Age: For age category, we have specific bins (Youth, Adult, etc.). If a study says “U-17 players”,
that maps to Youth (since under-18). If they give a mean age, we store that separately (Mean age
field). Age Category likely will be dropdown (Youth, Senior, etc., or specific like U-17, U-20 if
needed).
Level of Play: We define categories like Elite (top professional, national teams, etc.), Sub-elite/
Amateur, Youth, etc. We will create a small mapping: e.g., if a study is college soccer players,
that might count as sub-elite or amateur (depending on context, but likely amateur). We might
include “Collegiate” as an option or map it to Amateur.
Country: Use standardized country names or FIFA country codes possibly. If multiple countries,
they might just say “Multinational”; we can list all or say “Multi-country (list)”.
•
Mapping Table of Synonyms to Canonical Values: We will maintain a mapping dictionary that
the system uses to auto-correct or suggest the standard term. Below is an example (12+ entries
as required):
Term or Phrase (as found) Mapped to Canonical Field/Category
“soccer”, “association football” Football (Soccer) FIFA Discipline (Sport)
“futsal” (or same spelling) Futsal FIFA Discipline (Sport)
“professional”, “elite”, “Top
division” Elite (Professional) Level of Play
“semi-professional”, “amateur”,
“non-elite”, “sub-elite” Amateur (Sub-elite) Level of Play
“youth”, “U-17”, “high-school”,
“junior” Youth (Development) Level of Play
“male”, “males”, “men” Male Sex
“female”, “females”, “women” Female Sex
“both sexes”, “mixed” Mixed (Male & Female) Sex
29
Term or Phrase (as found) Mapped to Canonical Field/Category
“prospective cohort”, “cohort
study” Prospective cohort study Study Design
“retrospective” (if allowed
though we exclude
retrospectives generally)
Retrospective design Study Design (would flag
exclude)
“case-control” Case-control study (excluded per
criteria) Study Design (Note)
or tables) “NR”, “not reported” (in papers
Not reported (leave blank or “N/R”) Any numeric field lacking
data
*“0” or “zero” when used to
indicate none occurred 0 (explicit zero) Numeric fields (count)
“n/a”, “NA” in paper Not applicable We will leave blank or mark
N/A in output
“injury incidence per 1000
player-hours”, “injury rate (per
1000 hours)”
per 1000 player-hours Exposure Measurement
(Unit)
“per 1000 player-games”, “per
1000 matches” per 1000 player-matches Exposure Measurement
(Unit)
“per 1000 player-seasons” per player-season Exposure Measurement
(Unit)
“overall incidence”, “crude
incidence” Overall incidence Label (we treat synonyms
same)
“adjusted incidence (age-
adjusted)” Adjusted incidence (age) Label for adjusted
incidence note
“ACL tear”, “ACL rupture” Knee ligament sprain/rupture (ACL) Injury Type = Joint Sprain
(with note ACL)
“MCL sprain” Knee ligament sprain (MCL) Injury Type = Joint Sprain
“hamstring strain”, “hamstring
tear” Thigh muscle strain Injury Type = Muscle Injury
“groin strain” Groin muscle/tendon injury
Injury Type = Muscle Injury
(if muscle) or Tendinopathy
if chronic
“concussion”, “mild TBI” Concussion (brain injury) Injury Type = Brain/Head
Injury (Nervous system)
“tendinitis”, “tendonitis” Tendinopathy Injury Type = Tendinopathy
“tendon rupture”, “Achilles
tear” Tendon rupture Injury Type = Tendon
Rupture
30
Term or Phrase (as found) Mapped to Canonical Field/Category
“stress fracture” Bone Stress Injury Injury Type = Bone Stress
Injury
“sprained ankle” Ankle joint sprain Injury Type = Joint Sprain
(at Ankle), Location = Ankle
“ACL reconstruction” (surgery
mention)
(Not an acute injury type; likely
indicates a previous ACL – not
directly extracted)
(We’d note as context, not
in our fields directly)
“upper respiratory infection
(flu)”
Respiratory (Organ system),
Infection (Etiology) Illness categories
“gastroenteritis” (stomach flu) Gastrointestinal, Infection Illness categories
“heat stroke”, “heat illness” Thermoregulatory, Environmental
(exercise-related) Illness categories
“COVID-19”, “coronavirus” Respiratory, Infection Illness categories
“depression symptoms” Depression (symptom), possibly
Depressive disorders (if diagnosed) MH Symptom/Disorder
“insomnia”, “poor sleep” Sleep Disturbance MH Symptom
“anxiety disorder” Anxiety disorders MH Disorder
“OCD” (if mentioned) Obsessive–compulsive disorders MH Disorder
“burnout”, “stress”
(psychological) Distress MH Symptom
“alcohol abuse”, “alcohol use
disorder”
Alcohol and other substance
misuse MH Disorder (substance)
(The above table provides examples of how various terms will be normalized. The mapping will be
implemented in code for auto-suggestions and also provided to users in documentation so they use consistent
terms.)
In addition, formatting rules include: - Use consistent units (days for time, hours for exposure unless
otherwise). - Use decimal points uniformly (e.g., one decimal place for incidence rates if that’s
common, or as given). - For confidence intervals, store them in a standard “X–Y” format (en dash
between numbers) or as two separate fields if easier (lower CI, upper CI). - For percentages (like
recurrence rate), ensure we store as a number (e.g., 20%) and likely without the % sign in numeric field
(or with it in string field, but better numeric 20 and a separate “%” in header). - All categorical fields have
pre-set allowed values (with possibly an “Other” option or text if something unexpected). -
Capitalization: we will use Title Case or Sentence case consistently for text entries (e.g., “Male” not
“male”). The app can auto-capitalize inputs where appropriate.
Coding Frames (IOC Extended): We specifically incorporate the football-specific extension to IOC
consensus (Waldén et al. 2023) which presumably emphasizes including new categories like mental
health and perhaps specifics like differentiating training vs match injuries, tournament vs league, etc.
Our fields already capture match vs training injuries, and we have fields for whether the setting was
tournament vs season (though not explicitly separate fields, maybe "Study type" can note if it's a
31
tournament). We should mention in definitions if the study is a tournament study vs season – but no
dedicated field except “Study period (years)” might indicate short (like 0.2 year for a tournament). We
might allow a note for tournament vs league.
Quality Control on Standardization: During review, if a user entered a non-standard term by mistake,
the reviewer should catch it (because fields are mostly dropdowns – they shouldn’t be able to put a
wrong one). For free text fields (like “Title” or “Mean age range”), not as critical to standardize since they
are what they are. But for e.g. “Journal name”, we just store it as is (no need to standardize journal,
that’s not needed for analysis).
Example application: If one study defined injury as “any physical complaint (medical attention or not)”,
that’s a non-standard definition compared to IOC. The extractor will copy that definition text into “Injury
Definition” field (or note it). But they should also check a box that indicates it’s “Other (all complaints)”
since the standard categories likely are: Time-loss, Medical-Attention, All/Any, Other. So later analysis
can filter those that used time-loss vs others. This way we standardize categorization of definitions, even
if we record their exact wording.
Standardization of Output Layout: We will output consistent column names (matching the provided
template) and use the same units/codings for each column across all studies. That means if a study
deviated, we still map it to our column. For example, if a study didn’t provide total training exposure, we
leave that column blank rather than putting “N/A”, because blank is our chosen representation of not
reported.
Codebook & Code Frames: All the categories from the Excel’s later tabs (Injury Type, Injury Location,
etc.) essentially serve as our code frames for classification. The UI will present these either as multi-
select checklists (for breakdown tables) or as dropdowns for “most common” fields. This ensures
extractors only pick from allowed values.
The provided Excel terms (like “Muscle Injury”, “Muscle Contusion”, etc.) come from OSIICS. We should
double-check for typos in them (“Muscel” should be “Muscle”, “Arthrirtis” -> “Arthritis”, etc. – the PRD
should note that we will correct obvious typos in the schema). For consistency, we’ll fix those in the
implementation.
In summary, every field that can be standardized will be: - Controlled vocabularies for categorical
fields. - Numeric fields with uniform units and formats. - Guidance in the UI (definitions panel) so
extractors categorize things correctly (thus academically defensible: using accepted classifications 5
).
By following these standardization rules, our dataset will be ready for robust analysis such as pooling
incidence rates or comparing distributions, without needing extensive cleaning afterwards 26
(the app
itself acts as the cleaning step, applying the coding frame at data entry).
9. Data Model
We propose a relational-style data model (even if using Firestore, we can conceptualize collections
similarly) to organize users, studies, extraction data, and logs. Below are the main tables (or collections)
and their fields, along with relationships:
•
•
•
Users – stores user accounts and roles.
UserID (primary key, unique)
Username (unique login)
32
•
•
•
•
PasswordHash (securely hashed password)
Role (enum: Admin, Reviewer, Extractor)
CreatedAt, LastLogin (timestamps for audit)
APIKey (encrypted, optional, if storing per user; or this might be in a separate config table if one
global key)
•
Studies – represents a study/paper. One record per included paper.
•
•
•
•
•
•
•
•
•
•
•
•
•
StudyID (PK, unique, can be numeric or a generated code)
Title
LeadAuthor (maybe last name of first author)
Year
Journal
DOI
StudyDesign
PDFFilePath (link to the stored PDF file in storage)
AssignedToExtractor (UserID, nullable)
AssignedToReviewer (UserID, nullable)
Status (enum: Not Started, In Progress, Extracted, Reviewed, etc.) – we can map colors: e.g.,
0=gray,1=yellow,...
CreatedBy (UserID who uploaded)
CreatedAt, UpdatedAt
(Note: We could also split bibliographic info into a separate table, but it’s fine here. Many of these fields
will be filled via extraction anyway, not at upload.)
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
ExtractionData – stores all the extracted fields for each study. This could be organized as one
wide table with many columns (mirroring the Excel), or normalized into multiple tables (one per
section). For simplicity (and since the number of columns ~200 is manageable), we consider one
table keyed by StudyID. Each column corresponds to a field in the schema:
StudyID (PK or FK referencing Studies table 1-to-1)
FIFA_Discipline
Country
LevelOfPlay
Sex
AgeCategory
MeanAge (and SD or range – perhaps store as text like “24±3” or separate MeanAgeValue
numeric and AgeSD numeric if needed)
SampleSize
NumberOfTeams
StudyPeriod (years or months, maybe stored as “2010–2014” string or number of years = 4)
ObservationDuration (e.g., “1 season” or “2 years”; might store numeric length and unit separate
if needed, but likely string since varied)
InjuryDefinition (text or selected category)
IllnessDefinition (text)
MHDefinition (text)
IncidenceDefinition (text or maybe one of standard like “per 1000h”)
BurdenDefinition (text)
SeverityDefinition (text)
RecurrenceDefinition (text)
33
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
MechanismReporting (yes/no text if they reported mechanism detail)
LengthOfSeasonWeeks (numeric)
NumberOfSeasons (numeric)
ExposureUnit (text, e.g., “player-hours”)
TotalExposure (numeric)
MatchExposure
TrainingExposure
TotalInjuries
MatchInjuries
TrainingInjuries
InjuryIncidenceOverall (numeric)
InjuryIncidenceUnit (implicitly per 1000h likely, but if needed store unit if deviates)
MatchInjuryIncidence
TrainingInjuryIncidence
InjuryIncidenceCI (text like “5.0–12.0” or two fields InjuryIncidenceCI_Low and High)
AdjustedInjuryIncidence (numeric if given)
AdjustedIncidenceConfounders (text listing factors adjusted for)
TotalTimeLossInjuries (total days lost to injury)
MedianTimeLoss_Injury (days)
MeanTimeLoss_Injury (days ± SD – maybe store two fields: MeanInjuryDuration and
SDInjuryDuration)
InjuryBurden (e.g., 50 days lost per 1000h – store numeric and maybe let unit be understood or
store as days/1000h)
InjuryBurdenCI (text or two fields)
MostCommonInjuryType (dropdown value from injury type list, e.g., “Muscle injury”)
MostCommonInjuryLocation (dropdown e.g., “Thigh”)
MostCommonInjurySeverity (dropdown e.g., “Moderate”)
Onset_RepetitiveGradual (integer count or % if given)
Onset_RepetitiveSudden
Onset_AcuteSudden
ContactInjuries (count or %)
NonContactInjuries
OveruseInjuries (cumulative repetitive – count)
MedianInjuryDuration (days, if reported separately from time-loss? Possibly redundant with
median time-loss above if they considered “injury duration” vs “time-loss” synonyms. The sheet
had both “Median time-loss” and “Median injury duration” which might be duplicate concepts;
perhaps one meant median absence per injury, the other overall? It might be a mistake or meant
something else. We’ll clarify with stakeholders or treat them same.)
MeanInjuryDuration (days ±SD, similarly possibly same as mean time-loss)
TotalRecurrentInjuries (count)
RecurrenceRate (%, numeric)
TotalIllnesses
MatchIllnesses
34
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
TrainingIllnesses
IllnessIncidenceOverall (num)
IllnessIncidenceUnit (if different)
MatchIllnessIncidence
TrainingIllnessIncidence
IllnessIncidenceCI
TotalTimeLossIllness (days)
MedianTimeLossIllness
MeanTimeLossIllness (±SD)
IllnessBurden
IllnessBurdenCI
MostCommonIllnessOrganSystem (dropdown from organ systems list, e.g., “Respiratory”)
MostCommonIllnessEtiology (dropdown e.g., “Infection”)
MostCommonIllnessSeverity (if they classify illness severity; often injuries have severity, not sure
if illnesses do. The sheet lists severity class for illness as well, presumably same categories.)
IllnessOnsetGradual (count, if reported)
IllnessOnsetSudden (count)
MedianIllnessDuration
•
MeanIllnessDuration (±SD)
•
TotalMHProblems
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
MHIncidenceOverall
MHIncidenceUnit (if any incidence measure for MH)
MHReportingMethod (text: e.g., “Questionnaire OSTRC” or “Psych eval”)
TotalTimeLossMH (days lost if any; mental health might not be time-loss in same sense, but field
exists)
MedianTimeLossMH
MeanTimeLossMH
MHBurden
MostCommonMHSymptom (dropdown from symptoms list, e.g., “Sleep Disturbance”)
MostCommonMHDisorder (dropdown e.g., “Depressive disorders”)
MostCommonMHSeverity (if they classify severity e.g., mild/moderate depression – but likely not,
we have it for completeness)
MHOnsetGradual (count of gradual onset MH issues if concept applicable)
MHOnsetAcute (count)
MHOnsetMixed (count)
MHOnsetUnknown (count)
MedianMHDuration
MeanMHDuration (±SD)
TotalRecurrentMH (count if they track recurrence of e.g., depressive episodes)
MHRecurrenceRate (%)
Whew, that’s the full set of fields. It’s quite wide but we can manage in a single table or logically
separate into: - Study (with ID and bibliographic fields) - ParticipantCharacteristics (StudyID, discipline,
country, etc.) - Definitions (StudyID, injuriesDef, illnessDef, etc.) - Exposure (StudyID, exposures) -
InjuryOutcome (StudyID, all injury fields) - IllnessOutcome (StudyID, fields) - MHOutcome (StudyID,
fields) - (InjuryTypeBreakdown, InjuryLocationBreakdown, etc. potentially separate tables for
breakdown counts)
35
However, storing breakdown counts in separate tables might be better: For example, InjuryTypeCounts
table: - StudyID (FK) - MuscleInjuryCount - MuscleContusionCount - CompartmentSyndromeCount -
TendinopathyCount - TendonRuptureCount - NervousSystemCount - BrainSpinalCount -
PeripheralNerveCount - BoneCount - FractureCount - StressFractureCount - BoneContusionCount -
AvascularNecrosisCount - PhysisInjuryCount - CartilageSynoviumCount (and so on for all categories
listed)
Given many columns, but if we did separate, it's still similar complexity, just separated logically. Could
also represent such breakdowns as key-value pairs in a related table (like one row per category for each
study). That might be overkill for now and not as straightforward for output. Perhaps easier for output
to keep them as columns, since the final CSV likely expects that format.
Yes, the final Excel likely expects each category as a column (like in the sheet it is columns). So likely one
wide table is fine and we can generate the CSV directly.
•
•
•
•
•
•
•
Notes/Flags – a table for any qualitative notes or flags per study:
NoteID (PK)
StudyID (FK)
Author (UserID who wrote note)
NoteText (text)
NoteType (e.g., “Issue” or “General” or field-specific if we tag it)
CreatedAt Possibly, we might embed notes in the ExtractionData as additional columns, but
better to have a separate structure. For example, an extractor may write a note “Only combined
data for men & women” – we store it in Notes table. We might also allow field-level notes, but
that’s too granular to separate; instead, user could mention field in the text (“Level of play: they
included pro and youth together”).
•
AuditLog – each log entry for actions:
•
•
•
•
•
•
•
•
LogID (PK)
StudyID (FK, nullable if not specific to study e.g., login event)
UserID
Action (string or enum: “FIELD_UPDATE”, “STATUS_CHANGE”, “LOGIN”, etc.)
Description (text: e.g., “Changed InjuryIncidence from 5.0 to 5.4” or “Marked study as Reviewed”)
Timestamp
Possibly OldValue, NewValue, FieldName separate columns for data changes for easier analysis.
We will generate these entries in the backend whenever a significant action occurs.
•
Attachments (maybe not needed now, but if we allow attaching images or supplemental files
from study – likely not needed; or storing the text extracted from PDF possibly in a table for
debugging but not needed in final system beyond runtime use).
Relationships & Constraints:
- Studies to ExtractionData is 1-to-1. StudyID is primary key of ExtractionData as well (or at least
unique). We can merge them conceptually but splitting keeps things organized. If using Firestore, we
might store extraction data as sub-document of study or in the same document – either way logically
one-to-one. - Users can be linked in Studies (AssignedTo fields, CreatedBy, etc.) – those are optional
foreign keys (should correspond to actual user IDs). - Studies to Notes is 1-to-many (a study can have
many notes). - Studies to AuditLog also 1-to-many (many log entries per study). - Possibly Users to
36
AuditLog one-to-many (one user triggers many logs). - If we had a separate table like
InjuryTypeCounts, it’s 1-to-1 with Study as well (just split for organization). - We might implement Row-
Level Security (RLS) if using a relational DB like PostgreSQL to ensure that: - Regular users (Extractors/
Reviewers) can only access rows of data for the project(s) they are in. If this is single-project, maybe not
multi-tenant scenario. But if in future multiple projects use the same tool, we’d have a ProjectID to
segregate data. RLS could then restrict based on project membership. For now, maybe not needed (all
internal to one project). - Another aspect: ensure e.g., one extractor shouldn’t see studies not assigned
to them? But likely all extractors can see all, it’s collaborative. We can restrict if desired, but probably
open within project. - At minimum, RLS might ensure non-admins cannot see user table or other admin
data.
•
•
•
•
•
Indexes:
On Studies: index on Title (for searching), Year, maybe an index on (LeadAuthor, Year) for
duplicate detection (or an expression index for a normalized key).
On ExtractionData: since primarily accessed via StudyID, that’s primary key. If we do searching
by any fields (maybe filter by sex = female studies etc.), indexes might be needed if large, but not
crucial for <100 studies.
On AuditLog: index by StudyID (to fetch log for a study quickly) and by UserID (if we ever want to
see all actions by a user).
On Users: unique index on Username.
If using Firestore (NoSQL): - We’d have a collection “studies” with docID = StudyID, containing fields and
possibly subcollections “notes” and “logs”. - We’d enforce through security rules that only authorized
roles can write certain fields (e.g., only reviewers can change status to reviewed). - We’d also implement
something akin to RLS in rules (like only logged-in can read, and maybe restrict some info like API keys
to only owners).
ER Diagram Description: (If we were to draw an ERD: we'd have boxes for Users, Studies,
ExtractionData, Notes, AuditLog. Users --< (0..) AuditLog (each log has one user). Studies --< (0..) Notes.
Studies --< (0..*) AuditLog. Studies -- (1--1) ExtractionData. Perhaps Studies also has relationships to
Users via assigned roles (which is like a self-relationship but with role context).
Row-Level Security Use: If using Postgres, we would enable RLS on the tables and create policies: -
E.g., on Studies: USING (true) for all authenticated (since one project, all can read), but for write,
maybe: - Extractor can update ExtractionData fields if Status not completed or if assigned to them, -
Reviewer can update if assigned or if general, - Only Admin can delete or change assignments. These
rules get complex. Possibly simpler: rely on application logic rather than DB enforcement for now. If
multi-tenant, RLS would restrict by project ID.
Given the constraint "must use a DB", we will likely pick a specific DB: - If in Firebase context, Firestore is
fine (NoSQL doc DB). - But Firestore doesn’t natively do RLS (it has security rules though). - If using a
relational via e.g. Cloud SQL, Postgres with RLS is possible. That might be more heavy to set up but
doable. We might suggest using PostgreSQL for robust relational needs (especially if expecting more
complex querying or multi-tenancy). But since the text emphasizes Firebase Studio + Cursor, perhaps
the intention is a Firebase (Firestore) solution. We can still mention RLS conceptually (maybe the DB they
choose could be something like Supabase, which is Postgres with RLS, bridging the gap of Firebase vs
relational).
Recommendation on Database: Given the requirement and familiarity with Firebase in question, we
might recommend Firestore for ease of integration with a Firebase web app (keeping realtime sync for
the form fields, etc.). But Firestore has limits (document size limit ~1MB, but our data per study likely fits
37
as it’s not huge text mostly numbers; should be fine). Alternatively, if using Supabase (Postgres), that
can integrate with a Next.js or similar stack with ease too, and give SQL power.
We’ll mention both and lean which fits best: - If using Firebase Studio (maybe they meant Firebase +
some UI builder?), Firestore might be the expected DB. - If using Cursor (a code environment), maybe a
developer would prefer Postgres for flexibility.
We will highlight differences: Firestore is schema-less (harder to do complex queries, but real-time and
simpler to start), whereas Postgres is structured (ensures schema, can enforce data types, do joins, and
easily do that RLS).
Given the output needed (CSV, heavy data analysis), using a structured relational DB might be more
comfortable (we can do SQL queries if needed to aggregate, etc.). But either can produce the data
needed.
We’ll propose likely using a PostgreSQL database (maybe via Supabase for ease, which gives auto APIs
and UI for auth if we needed but we skip email auth anyway) – because RLS and complex queries can be
beneficial. But we’ll also note that Firebase Firestore can be used if we want tight Firebase integration,
with some trade-offs (lack of true RLS but security rules can suffice for our simple case).
Indices for Duplicate Detection: One approach: create a normalized key e.g., DupKey =
lower(trim(Title)) || "_" || lower(firstAuthor) || "_" || Year . Then index that. When
uploading a new study, compute its DupKey and check if any existing record has same key (or fuzzy
match by checking similarity of Title). We might not implement fuzzy matching in DB (that’s more code
side) but at least exact key match catches obvious duplicates.
Data Volume: We expect maybe ~100 studies (the initial search up to 2018 had ~80 included in previous
reviews, now adding newer – maybe ~100-150). The DB can easily handle that. We should design with
possible growth if this becomes an ongoing living review (new studies added each year, maybe 10-20
per year, over a decade could accumulate ~200-300 total). Still trivial for any DB.
Integration with Reporting Tools: By storing data in a structured DB, we can easily generate the
outputs or even hook to an online dashboard later (they mentioned an online reporting tool 2026). If we
use Firestore, integration with e.g. Google Data Studio might require some plumbing. If we have
Postgres, we could directly query it from analysis scripts. But since final output is static CSV/JSON, either
is okay.
Conclusion on Data Model: We have clearly defined tables for all logical entities and ensure that each
field from the Excel has a place in the ExtractionData schema. The one-to-one nature of study and
extraction record simplifies retrieval (one query fetches all data for a study or for all studies to export).
The audit log and notes tables ensure we keep track of changes and additional info without cluttering
the main record.
This structure will help maintain data integrity and support the workflow (e.g., status and assignment in
Studies table helps manage process flow, and log provides accountability).
38
10. Duplicate Detection Specification
Effective duplicate detection is essential to avoid extracting the same study twice (some references
might appear in searches multiple times or have multiple versions). Our approach combines
deterministic and fuzzy methods:
•
Deterministic Key (Hash): For each new reference/PDF uploaded, the system will generate a
duplicate key. We define it as:
DupKey = LOWER(Title without punctuation) + "_" +
LOWER(FirstAuthorLastName) + "_" + Year.
Example: Title "Injury Rates in Elite Youth Football: A Cohort Study", First author "Smith", Year
2019 -> DupKey = "injuryratesineliteyouthfootballacohortstudy_smith_2019".
We will store this DupKey for each study (e.g., as a field in Studies or a separate index table). On
uploading a new study, we compute its DupKey and do a lookup: if an existing DupKey matches
exactly, that is a strong indication of a duplicate. (Minor differences in punctuation/case are
normalized out by this key.)
Note: If a study’s title is very long, we might truncate for key, but collisions are unlikely at our
scale.
•
DOI Check: If the PDF text contains a DOI (we can regex search for “doi:” or the pattern 10. ),
we extract it. DOI is unique to a publication. If an extracted DOI from a new PDF matches a DOI
in the database, that’s a definite duplicate. The system will flag it: “This PDF has the same DOI as
Study X (Smith 2019).” In such case, the user should probably not extract it again. (Perhaps the
second PDF could be a better copy, but then they should replace the first’s PDF rather than have
two records.)
•
Fuzzy Title Matching: Some duplicates might not be exact (e.g., one might have a minor subtitle
difference, or a spelling variant). We will implement a simple fuzzy logic:
•
•
•
Compute an edit distance or similarity score between the new title and all existing titles in the
database (after lowercasing and removing stopwords). For efficiency, we can use trigram
similarity or a library if available. Because number of records is small, even a brute-force check is
fine. If the best match has > 0.9 similarity (or Levenshtein distance within e.g. 5 characters
difference for a 100 char title), and year and author also match, we consider it a duplicate.
Additionally, if first author and year match exactly, and titles have some small difference (like
plural vs singular, British vs American spelling), likely the same study (or possibly a conference
abstract vs full paper, which we probably treat as same study for extraction purposes).
We can also cross-check by author list: if first author, last author and journal are same and year
within 1, could be a duplicate or possibly an erratum or secondary analysis. We’ll rely mainly on
title for duplicates, but these clues help.
•
User Confirmation: Whenever a potential duplicate is identified, the system will not
automatically discard the entry. Instead, it will prompt the user (Extractor or Admin) with
something like: “Possible duplicate detected: Study ‘Smith 2019 – Injury Rates in Elite Youth Football’
seems to match the uploaded file. [View existing record] [Continue anyway] [Cancel upload].” The user
can then decide:
•
If indeed it’s the same study, they should cancel the new one. Or if the new PDF is a better
version, perhaps replace the old PDF.
39
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
If it’s not actually a duplicate (for example, two different studies by same author in same year
with similar titles), the user can proceed but should double-check.
Merging duplicates: If a duplicate is confirmed, we won’t allow two separate extraction entries.
If user says “Yes, this is duplicate”, we can offer to merge:
If the original study doesn’t have a PDF (maybe it was just a citation added), we could attach this
PDF to it.
Or if both have some data extracted (rare if detection is at upload, it’s early), we might allow
merging data fields (but better to avoid ever double extracting).
Simpler: we just don’t create a new record. We might log an event “User attempted to upload
duplicate of StudyID X, action cancelled.”
Edge Cases:
Different publications of the same dataset: e.g., one study might appear in a conference abstract
and then a full journal article. Ideally, we would include only the full article. If both appear in
references, they’re duplicates in content. Our detection may catch them if titles very similar. The
user should exclude one. If both got through screening, at extraction they’ll realize it’s same
data. We rely on user to make that call, but we can note if two included studies have identical
sample size, location, etc. (that's advanced; out-of-scope for automated detection, but a reviewer
might notice).
Same title, different sport or population (less likely with specific titles): Usually won’t happen with
narrow topics. If it does, the year or author should differ. If by chance title+year are same but
authors different, probably not duplicate (our check includes author in key).
Supplements or errata: If an erratum for a study is found as a separate DOI, it might have same
title with “Erratum” in it. We should probably treat errata not as separate study, but as note. We
can detect “erratum” in title or journal and alert user, then they might attach the erratum info as
a note to the original study rather than extract separately.
During Data Entry: If somehow a duplicate wasn’t caught at upload, and an extractor tries to
input a study that’s already in the system (maybe via manual entry or copy-paste of citation), we
could have a search function. But since we primarily rely on PDF upload, it should be caught
upfront.
Rate Limit Consideration: If we had thousands of records, fuzzy matching could be heavy. But
with ~100, it’s fine. We’ll just ensure an index on normalized title in DB to speed exact or near-
exact queries.
Testing Duplicate Logic: We will test with known duplicates:
Upload exact same PDF twice (should catch by title or DOI).
Upload two PDFs of the same study with slightly different metadata (like one has a subtitle). See
if fuzzy catches it.
Upload two different studies with similar titles (should either not flag or say “possible duplicate,
but have a closer look”). The user can override in that case.
Ensure that if user overrides, the second entry is allowed and given a distinct StudyID.
40
•
Manual Merge Tool: (Not a must for MVP, but consider) If later they discover two entries are
duplicates (maybe they didn’t catch at upload and extracted both), the Admin should be able to
merge them. This could involve deleting one and maybe transferring any notes if needed. But
ideally, avoid reaching that point. We might note this as out-of-scope if it complicates UI.
Instead, rely on early detection.
Covidence’s integrated dedupe sometimes missed things 15
, so our approach uses multiple keys to
minimize misses: By combining DOI and fuzzy title/author match, we should catch nearly all duplicates.
Rayyan was used for dedup in our search process already 14
, so duplicates should be minimal by
extraction stage, but our system provides an extra safety net to ensure data extraction efforts aren’t
wasted on duplicates.
11. Screens & UX Wireframes (Descriptions)
We outline the key screens/pages of the app and their expected user interface components.
(Wireframes would normally be drawn; here we describe them in detail.)
1. Login Screen:
A simple login form. Header: Project title or logo (e.g., “FIFA GBI Data Extraction”). Fields: Username,
Password, and a “Login” button. Possibly a link to a brief “About this tool” or help in case credentials
issues (since no self-signup). The style is clean, FIFA or medical theme colors (blue/white). After
successful login, user lands on Dashboard.
2. API Settings Page:
This page appears on first login or accessible via a top-right “Settings” gear icon for later changes.
Content: A field labeled “API Key for AI Extraction” with a text input (or password field to hide the key)
and a “Save” button. Possibly instructions: “Enter your Google/Vertex AI API key (for Gemini model)
here. This will be used to auto-extract data.” A test button could be present to verify the key. Once
saved, maybe show a green check “Connected” if successful. If the key is already set and valid, this page
might show “API Status: ✔ Connected to Gemini 2.5” and allow update. It should also remind user to
keep it secret. The UI is minimal here. (Admins might see this globally; if only one key is used, an Admin
could set it and others don’t need to worry – in that case, regular users might not even see this page
except a note “AI is configured by admin”.)
3. Dashboard (Main Project Dashboard):
This is the central hub listing all studies and their statuses. It can be a table or card list. Likely a table
with columns: - Study ID (or #), - Title (Lead author + year could suffice as short label), - Status (with
colored dot or label: e.g., grey “Not started”, yellow “Extracting”, green “Completed”, etc.), - Extractor
(name if assigned), - Reviewer (if assigned), - maybe a Progress indicator (like X of Y fields filled if we
want granular progress).
Above the table, there are controls: - Upload button (“Add Studies”) to upload PDFs, - Filter dropdowns
(by status, by assigned to me, etc.), - Search bar to search titles/authors.
The Admin (or all users) also sees an Export button here to export data. Possibly an “Export” dropdown
with options (CSV, JSON). Or it could be a separate Admin panel; but likely simpler on dashboard.
Each row (study) is clickable to open the extraction workspace. Possibly also an icon to view the PDF
directly or to delete (only admin can remove a study if mistakenly added).
41
The Dashboard should also highlight if any studies are flagged (maybe an icon in status if flagged fields
exist, e.g., a red flag if something unresolved).
For extractors, the “Assigned to me” filter will show their workload. For reviewers, a filter “Needs review”
shows those pending their action.
If the list is long, maybe pagination or infinite scroll.
4. Upload Dialog:
When clicking Upload, a modal appears titled “Upload PDFs”. It has a file input (could use drag-drop
area with an icon). The user selects files. The dialog then likely shows a list of selected files with an
“Upload” button. On upload, a progress bar for each file. As each finishes, it might do duplicate check: -
If no duplicate found, maybe mark with a green check “Ready”. - If duplicate suspected, highlight that
file in red or orange with a message “Duplicate of [Study X]?” and options. The UI might allow the user
to click “View existing study” (open it in a new tab or highlight row on dashboard) or “Ignore and add
anyway” or “Cancel”.
After all processed, the dialog either automatically closes or has a “Done” button. The new studies
appear in the Dashboard list (maybe highlighted briefly as new).
5. Paper Workspace (Extraction Form View):
This is the most important screen. It likely occupies most of the window. We have two main panels:
•
Left Panel: PDF Viewer. On top of it, a toolbar: controls for zoom (+/–), page navigation (page
up/down or a dropdown of page number, and total pages), perhaps a search icon. Possibly a
rotate button (for scanned pages if needed). The PDF content is shown; the user can scroll
normally. If the user clicks a search result or if a field highlight is triggered, the viewer can scroll/
jump to that portion (some coordination needed).
•
Right Panel: Extraction Form. This can be a scrollable form subdivided by section headings.
Each section from the schema:
•
•
•
•
•
Study Details – fields: Lead Author, Title, Year, Journal, DOI, Study Design.
Participant Characteristics – fields: Discipline, Country, Level of Play, Sex, Age Category, Mean Age
(±SD or range), Sample Size, Number of Teams, Study Period, Observation Duration.
Definitions & Data Collection – fields: Injury Definition, Illness Definition, Mental Health Definition,
Incidence Definition, Burden Definition, Severity Definition, Recurrence Definition, Mechanism
Reporting (Yes/No or short text if they mention contact classification etc).
Exposure Data – fields: Length of season (weeks), Number of seasons, Exposure measurement
unit, Total Exposure, Match Exposure, Training Exposure.
Injury Outcome – this might be a collapsible subsection because it’s long. Within, maybe
subgroups or at least grouping visually:
◦
Counts & Incidences: Total # injuries, # match, # training; incidence overall, match
incidence, training incidence, 95% CI, adjusted incidence, confounders.
◦
Severity & Burden: total time-loss, median, mean time-loss, injury burden, burden 95% CI.
◦
Most common & Breakdown: Most common injury diagnosis (dropdown), type, location, severity.
◦
Mechanism breakdown: mode of onset (fields for repetitive gradual/sudden, acute),
contact vs non-contact vs overuse.
◦
Recurrent: median injury duration (maybe same as time-loss? but it’s listed, we include it),
mean injury duration, total recurrent injuries, recurrence rate.
42
•
•
Illness Outcome – similar structure but fewer fields. (No contact fields likely, only onset grad vs
sudden, etc.)
Mental Health Outcomes – fields accordingly.
Each field likely has: - A label (possibly with a tooltip “Definition of this field” if needed). - An input
control: text box, number field, or dropdown. - If AI has suggested a value, that value is filled in the
control and highlighted (maybe the background tinted yellow). Also maybe an “AI” icon next to it. - If the
field is empty or not started, maybe a gray dashed border or something. - If flagged, maybe a red flag
icon next to it and red border. - If confirmed, maybe a small green checkmark icon appears.
For fields that are numeric with units, we might have the unit shown to the right (like “[per 1000h]” fixed
if known, or in Exposure unit case, a drop-down of units).
AI Tools in Form: - Possibly an “Auto-Fill All” button at top of form (which we triggered in journey). - Or
at section headers, a smaller “Auto-fill section” button. e.g., next to “Participant Characteristics” heading,
an AI icon which fills those fields. - Or at each field, a small "wand" icon to fill that field via AI. We need
to avoid clutter. Perhaps an "Auto-Extract All" at top for initial use, and then individual icons at fields for
re-query if needed.
We also provide feedback on AI confidence if available: maybe fields with low confidence get an orange
dot icon or italic text "AI unsure". This might be too much detail though; a simpler approach is highlight
and the user can judge.
Notes & Comments: Possibly at the bottom or top of the form, a “Notes” text area for general notes
about the study. Or each field might have a comment icon to attach note to that field. Might be
advanced for MVP. More likely a single note box per study.
Definitions Panel: On this workspace, perhaps on the far right or as a modal: - There might be a sticky
sidebar collapsed as “Definitions »”. Clicking it slides out a panel (taking over right side or overlay) listing
all the standard definitions and coding guidelines. For example, headings like “Injury Definition
(IOC): ...”, “Severity Categories: ... list ...”, “OSIICS Categories: ... list of injury type and examples ...”,
“Illness Organ Systems categories: ... list ...”, etc. Possibly search within definitions. - Alternatively, a
modal that pops up with scrollable content.
The extractor can refer to it. It should not obscure the main content too much, or be easily closed.
Color Coding (from design rules): - Gray fields: untouched. - Yellow fields: AI-suggested, awaiting
confirmation. - Green fields: confirmed by human. - Red fields: flagged issues.
We will have a color legend maybe at the top or bottom of form, or at least tooltips e.g. on a colored
status dot in corner "Yellow = AI suggestion pending review".
Action Buttons on Workspace: - Perhaps at top or bottom: “Save” (though autosave, but might
comfort users). - “Mark as Complete” (for extractor to indicate done). - If user is reviewer and viewing,
perhaps “Mark as Reviewed” or “Send Back to Extractor” if issues. - Navigation: a back arrow to go back
to Dashboard.
We might also have a drop-down to jump between sections in the form (because it's long). Or at least
collapsible sections that can be toggled to reduce scrolling (especially injury outcomes section is large).
43
Also, maybe at top a summary of the study (title, author, year) to remind which one this is.
6. Conflict Resolution View: (If dual extraction) - If two sets of data exist, when reviewer opens the
study, the form might display each field with two side-by-side values (e.g., a two-column layout under
each field label: one column "Extractor A" value, second "Extractor B"). Differences highlighted (maybe
background red on the ones that differ). - The reviewer can click on a value to accept it (maybe a radio
button for A vs B for each field, or a global toggle to pick one extractor’s entire set and then adjust
specific fields). - Alternatively, we could merge by taking one set as base and indicating differences. -
Possibly an easier UI: a toggle at top “Show differences” that highlights fields that differ and a
mechanism for reviewer to pick which to keep (like an accept button on each differing field to accept the
currently shown value or switch to the other). - Since designing this is complex, for MVP we may decide
to not implement a full side-by-side in UI, but rather instruct if double extraction used, the second one
is stored in log or separate, and reviewer manually checks. But since Rayyan and Covidence have these
features, we aim to incorporate it if possible.
7. Master Export Modal: - When clicking Export (on dashboard), a small modal pops up: - Options:
Format (CSV or JSON, likely as radio buttons or drop-down). - Maybe a checkbox “Include notes and
provenance” for extended output. - Possibly filter by status (e.g., default Completed only, or include all).
- Then an “Export” button. Possibly mention that a file will download. If large, maybe asynchronous with
a link provided (but for 100 records, direct download is fine). - After clicking Export, the modal can close
and trigger browser download of the file.
8. Admin User Management Page: (if needed) - Admin may have a page listing users, with ability to
add user (username, password, role) and edit or remove. Could be simple. Possibly integrated into
settings or a separate "Admin" section. Might not require a full page if only a few users; even a CLI
approach could do, but better to have UI. We can include it: - A table of users (username, role, last
login). - Buttons to reset password or delete user for each. - Form to add new user.
9. Notifications/Indicators: - If an extractor has something assigned, the Dashboard might show a
badge like “2 new studies assigned to you”. - If a reviewer has pending reviews, maybe a section at top:
“Pending your review: 3 studies” with quick links. - Could highlight in dashboard rows: maybe italicize
ones assigned to the logged user or use an icon.
Visual Style: - Keep it professional and clean. Possibly color scheme in line with FIFA or medical context
(blues/greens). Use color primarily for status (as described). - Use icons: e.g., a flag icon (for issues), a
check mark (for confirmed), a magic wand or robot icon for AI suggestions, a download icon for export,
etc., to enhance intuitiveness.
We won’t have fancy graphics; functionality is the priority. But a small FIFA logo or project name could
be in header.
10. Definitions Panel content (examples): At least include: - Explanation of each field (e.g., what
“Observation duration” means). - Standard definitions (Time-loss injury etc. as above). - Severity
category definitions: Minimal (1–3 days), etc. - Example of OSIICS categories like: - Muscle/Tendon
injuries: strains, tears, contusions (with OSIICS codes MUS, etc.) - Ligament injuries: sprains, etc. -
Overuse vs acute delineation. - Illness categories definitions (e.g., what counts as Environmental –
exercise related vs non). - Mental health categories definitions (maybe define distress vs disorder). This
is basically the codebook in text form.
44
This panel helps ensure the extractor and reviewer interpret things uniformly, addressing the challenge
2
of varying definitions .
In summary, the UX is designed to make it easy to perform the complex task of data extraction: view the
source, fill the form (with AI help), and track the status. The color cues and structured layout help users
focus on what needs attention, and the consistent design across studies ensures they spend time
thinking about content, not how to use the interface.
(No images were explicitly provided to embed, but if a UI screenshot was available, we would show e.g. a
partial form with PDF. For instance, Rayyan’s extraction UI shows PDF on left and form on right
for reference.)
Example UI – A PDF on the left and structured extraction form on the right (Rayyan’s Data Extraction interface
shown). AIDE will use a similar side-by-side layout for efficient data extraction.
45
12. Exports Specification
The system will produce two primary export formats – CSV and JSON – containing all extracted data.
These exports are designed to mirror the columns and structure of the project’s codebook (the provided
Excel sheets), ensuring that the analysis team can easily use the output without re-formatting.
CSV Export:
•
The CSV will have a header row with column names exactly matching the agreed schema. We
will use a canonical order for columns that aligns with the Excel’s layout (sheet by sheet from left
to right). For example:
•
Study Details Columns: Study ID, Lead Author, Title, Year of Publication, Journal, DOI, Study
Design.
•
•
•
•
•
•
Participant Characteristics Columns: FIFA Discipline, Country, Level of Play, Sex, Age Category,
Mean age (±SD) or age range, Sample Size (players), Number of teams/clubs, Study period
(years), Observation duration.
Definitions Columns: Injury Definition, Illness Definition, Mental Health Problem Definition,
Incidence Definition, Burden Definition, Severity Definition, Recurrence Definition, Mechanism of
Injury Reporting.
Exposure Data Columns: Length of season/tournament (weeks), Number of seasons, Exposure
Measurement (unit), Total Exposure, Match Exposure, Training Exposure.
Injury Outcome Columns: Total number of injuries, Number of match injuries, Number of
training injuries, Injury incidence (overall), Match injury incidence, Training injury incidence,
Injury incidence 95% CI, Adjusted Injury incidence (overall), Confounders (for adjusted
incidence), Total Time-Loss due to Injury (days), Median Time-loss (days), Mean Time-Loss (days),
Injury Burden (days lost per 1000h), Injury Burden 95% CI, Most common injury diagnosis, Most
common injury type, Most common injury location, Most common injury severity class, Mode of Onset – Repetitive Gradual
(# injuries), Mode of Onset – Repetitive Sudden, Mode of Onset – Acute Sudden, Contact (#),
Non-Contact (#), Cumulative (Repetitive) (#), Median injury duration (days), Mean injury duration
(±SD), Total recurrent injuries, Recurrence rate (%).
Illness Outcome Columns: Total number of illnesses, Number of match illnesses, Number of
training illnesses, Illness incidence (overall), Match illness incidence, Training illness incidence,
Illness incidence 95% CI, Total Time-Loss due to Illness (days), Median Time-loss (days), Mean
Time-Loss (days), Illness Burden (days lost per 1000h), Illness Burden 95% CI, Most common
organ system for illnesses, Most common etiology of illnesses, Most common illness severity
class, Mode of Onset – Gradual (# illnesses), Mode of Onset – Sudden, Median illness duration
(days), Mean illness duration (±SD).
Mental Health Outcome Columns: Total number of mental health problems, Mental health
problems incidence (overall), Method of Reporting MH Problems, Total Time-Loss due to MH
Problems (days), Median Time-loss (days), Mean Time-Loss (days), MH Problems Burden (days
lost per 1000h), Most common MH symptoms, Most common MH disorder, Most common MH
severity class, Mode of Onset – Gradual (# MH issues), Mode of Onset – Acute, Mode of Onset –
Mixed, Mode of Onset – Unknown, Median MH problem duration (days), Mean MH problem
duration (±SD), Total recurrent MH problems, Recurrence rate (%).
•
Injury Type Breakdown Columns: Muscle/Tendon injuries (#), Muscle Injury (#), Muscle
Contusion (#), Muscle Compartment Syndrome (#), Tendinopathy (#), Tendon Rupture (#),
Nervous system injuries (#), Brain/Spinal Cord Injury (#), Peripheral nerve injury (#), Bone injuries
46
•
•
•
•
•
•
•
•
•
(#), Fracture (#), Bone Stress Injury (#), Bone Contusion (#), Avascular necrosis (#), Physis injury
(#), Cartilage/Synovium/Bursa injuries (#), Cartilage Injury (#), Arthritis (#), Synovitis/capsulitis
(#), Bursitis (#), Ligament/Joint capsule injuries (#), Joint Sprain (#), Chronic Instability (#),
Superficial tissue/skin injuries (#), Contusion (superficial) (#), Laceration (#), Abrasion (#), Vessel
injuries (#), Stump (for amputee, likely always 0 for our data), Internal Organs (injuries to
internal organs, likely 0).
Injury Location Breakdown Columns: Head and Neck (#), Head (#), Neck (#), Upper Limb (#),
Shoulder (#), Upper Arm (#), Elbow (#), Forearm (#), Wrist (#), Hand (#), Trunk (#), Chest (#),
Thoracic Spine (#), Lumbosacral (#), Abdomen (#), Lower Limb (#), Hip (#), Groin (#), Thigh (#),
Knee (#), Lower Leg (#), Ankle (#), Foot (#), Unspecified (#), Multiple (#), Side – Left (#), Side –
Right (#), Side – Centre (#), Side – Bilateral (#), Position – Goalkeeper (#), Position – Defender (#),
Position – Midfielder (#), Position – Attacker (#).
Illness Organ System Breakdown Columns: Cardiovascular (#), Dermatological (#), Dental (#),
Endocrinological (#), Gastrointestinal (#), Genitourinary (#), Hematological (#), Musculoskeletal
(#), Neurological (#), Ophthalmological (#), Otological (#), Psychiatric/psychological (#),
Respiratory (#), Thermoregulatory (#), Multiple systems (#), Unknown or not specified (#).
Illness Etiology Breakdown Columns: Allergic (#), Environmental (exercise) (#), Environmental
(non-exercise) (#), Immunological/inflammatory (#), Infection (#), Neoplasm (#), Metabolic/
nutritional (#), Thrombotic/hemorrhagic (#), Degenerative/chronic condition (#), Developmental
anomaly (#), Drug-related/poisoning (#), Multiple (#), Unknown/not specified (#).
Mental Health Symptoms & Disorders Breakdown Columns: Symptoms – Distress (#), Anxiety
(#), Depression (#), Sleep Disturbance (#), Disordered Eating (#), Alcohol Misuse (#), Drug Misuse
(#); Disorders – Depressive disorders (#), Anxiety disorders (#), Specific phobias (#), Panic
disorder (#), Somatisation (#), Eating disorders (#), Sleep disorders (#), Gambling/betting
disorder (#), Obsessive–compulsive disorders (#), Bipolar disorders (#), Alcohol and other
substance misuse (#).
This full set of columns will be present in the master CSV export (some columns may remain
empty for many studies if data wasn’t reported – that’s expected). The canonical order is
important for consistency: it follows the logical grouping above (which mirrors the Excel tab
order: Study Details first, etc.). The tool will have the column ordering defined explicitly to avoid
any accidental reordering (especially if using a dictionary in code, we will sort by a predefined
list).
Value formatting in CSV:
All numeric values are plain numbers (no thousand separators or formatting). If a value is not an
integer (like incidence 8.4), it will appear as 8.4 (with dot as decimal separator).
Percentages will be numeric or at most with a % sign in header but not in value (e.g., Recurrence
rate might just be 12 meaning 12%). We could also output as 12% but that becomes string;
better to keep numeric (12.0) and let documentation note that it’s percentage.
Confidence intervals likely as a string range in one field (e.g., "5.0–12.0"). Or we may split into
two columns “Injury incidence CI lower” and “CI upper”. The Excel had one column for CI, but
splitting might be easier for analysis. However, to stick to schema, we’ll put it in one column
separated by en-dash (or “to”). The same for burden CI.
47
•
•
•
•
•
•
•
•
•
•
“Not reported” data: we will leave blank rather than writing "NR" or "NA", to avoid confusion with
legitimate values. Blank cells indicate either not applicable or not reported. We might include an
appendix in documentation that blank = not reported or not applicable. If needed, the team can
fill "0" where truly zero occurred vs blank meaning unknown. (We should ensure zero vs blank
distinction: e.g., if a study had 0 illnesses, we will put 0, not blank. Blank implies it wasn’t
mentioned. This is important.)
Text fields (definitions, notes): if we were to export them, we have to handle commas/newlines
properly. We'll quote any field that contains a comma or newline. But likely definitions are short
or we might not include the entire definition text in main CSV, maybe only categories. Possibly
we include them as is (the definitions fields might contain sentences; CSV can handle it if
quoted). It's fine.
Multi-select categories breakdown are numerical, representing counts of events in each
category. If the study didn’t report breakdown, these may be blank or zero. We should
differentiate: If nothing reported, perhaps leave blank. If explicitly reported 0 occurrences in that
category, put 0. But often breakdown will sum to total injuries. If we have total injuries and some
categories, we might fill 0 for categories that clearly had none (like if “Multiple injuries” category
is not mentioned, we leave blank because we don’t know if any were multiple; but likely they'd
say if any).
We ensure all columns exist even if empty for all studies (the schema is fixed). This matches how
the Excel had full set of columns.
Additional metadata in CSV: We will include a first column “Study ID” as a key (even if not
originally in Excel, we add it). This helps to join with any audit logs if needed and is useful as an
internal reference. Lead Author and Year are also there, which typically uniquely identify the
study in context, but Study ID (an index number or code) makes it easier to refer to in
communication and perhaps in audit logs.
We might also include columns like “ExtractedBy” and “ReviewedBy” at the end. The prompt said
"provenance fields" – listing who did extraction and review is part of provenance. We'll also
include “DateExtracted” and “DateReviewed” if we track them. This can help later for audit/trust
(and is nice for open science to show it was double-checked).
If “Include notes” was selected, a column “Notes” could be appended, containing any general
notes about the study (this might contain commas/newlines so would be quoted in CSV).
If “Include sources” selected, we might add columns for certain fields like "Title_SourcePage" or
"Incidence_Source" indicating where the data came from (e.g., "p5, Table 2"). However, that level
might clutter the main CSV. We might instead provide an auxiliary CSV or log for sources if
needed. But since asked, maybe we do minimal: e.g., a column “Provenance” that lists "AI-
assisted; values verified by reviewer; PDF pages referenced in log." – not very quantifiable
though.
Possibly “Confidence” fields if we had model confidence, but probably not needed in export after
review.
The output CSV will use UTF-8 encoding to preserve characters (especially since titles or author
names may have accents). It will likely use comma “,” as delimiter. If Excel in a locale expects
semicolon, that’s user’s Excel setting, not our output.
48
JSON Export:
•
The JSON format will contain the same data but structured as objects. Likely we will have an
array where each element is a study’s data. Example:
[
{
"StudyID": 1,
"LeadAuthor": "Smith",
"Title": "Injury Rates in Elite Youth Football: A Cohort Study",
"Year": 2019,
"Journal": "BMJ Open Sport Exerc Med",
"DOI": "10.1136/bmjsem-2019-000123",
"StudyDesign": "Prospective cohort",
"FIFADiscipline": "Football",
"Country": "USA",
"LevelOfPlay": "Youth",
"Sex": "Male",
"AgeCategory": "U-17",
"MeanAge": "16.5 ± 1.0",
"SampleSize": 120,
"NumberOfTeams": 4,
"StudyPeriodYears": "2017-2018 (2 seasons)",
"ObservationDuration": "1 year",
"InjuryDefinition": "Time-loss (≥1 day absence)",
"IllnessDefinition": "N/R",
"MHDefinition": "N/R",
"IncidenceDefinition": "Per 1000 player-hours",
"BurdenDefinition": "Days lost per 1000h",
"SeverityDefinition": "IOC 2020 standard",
"RecurrenceDefinition": "Same injury after return",
"MechanismReporting": "Yes (contact/non-contact)",
"SeasonLengthWeeks": 40,
"NumSeasons": 2,
"ExposureUnit": "player-hours",
"TotalExposure": 10000,
"MatchExposure": 3000,
"TrainingExposure": 7000,
"TotalInjuries": 50,
"MatchInjuries": 30,
"TrainingInjuries": 20,
"InjuryIncidenceOverall": 5.0,
"MatchInjuryIncidence": 10.0,
"TrainingInjuryIncidence": 3.0,
"InjuryIncidence95CI": "3.5–6.5",
"AdjustedInjuryIncidence": null,
"Confounders": null,
"TotalTimeLossInjuries": 750,
"MedianTimeLoss": 14,
"MeanTimeLoss": "15 ± 5",
"InjuryBurden": 375,
49
"InjuryBurden95CI": "250–500",
"MostCommonInjuryType": "Muscle Injury",
"MostCommonInjuryLocation": "Thigh",
"MostCommonInjurySeverity": "Moderate",
"Onset_RepetitiveGradual": 10,
"Onset_RepetitiveSudden": 5,
"Onset_AcuteSudden": 35,
"Contact": 20,
"NonContact": 30,
"CumulativeRepetitive": 10,
"MedianInjuryDuration": 14,
"MeanInjuryDuration": "15 ± 5",
"TotalRecurrentInjuries": 5,
"RecurrenceRate": 10,
"TotalIllnesses": 5,
"... etc ...": "...",
"MuscleInjuryCount": 25,
"MuscleContusionCount": 5,
"...": "...",
"HeadCount": 2,
"NeckCount": 0,
"...": "...",
"RespiratoryIllnessCount": 3,
"GastrointestinalIllnessCount": 2,
"...": "...",
"Illness_InfectionCount": 5,
"...": "...",
"MH_DistressCount": 0,
"MH_AnxietyCount": 0,
"... etc ...": "...",
"ExtractedBy": "Alice",
"ReviewedBy": "Bob",
"Notes": "None"
},
... (next study) ...
]
This is illustrative. The keys are basically column names in camelCase or similar. We might keep them
exactly as header but JSON usually no spaces, so maybe we’ll remove spaces or use CamelCase as
above. It might be fine to use the column identifiers but since they have spaces and special chars, better
to use a simplified key (like remove units and parentheses). We will document the mapping of JSON keys
to the codebook names.
•
The JSON can include nested objects to group fields: For example, we could nest breakdowns:
"InjuryTypeCounts": { "MuscleInjury": 25, "MuscleContusion": 5, ... } . Or
group injury outcomes vs illness outcomes: "InjuryOutcome": { "TotalInjuries":
50, ... } . However, to keep it straightforward, we might output a flat structure (like the above
example) because that directly corresponds to CSV columns and is easier for any downstream
consumer to parse without needing to reconstruct.
50
•
Null vs missing: Fields not applicable or not reported could be null or omitted in JSON. But if
we want a consistent schema, we should include them with null. Perhaps better to include with
null (or "" empty string) to explicitly show it’s there but no value. In above example, I used
null for adjusted incidence not reported.
•
The JSON will be UTF-8, easily machine-readable. It could be quite verbose but fine for our scale.
Provenance and Audit in Exports:
The question specifically says “provenance fields.” As noted, we plan to include who extracted and who
reviewed (user initials or names) as provenance metadata. Additionally, each output could have: - A field
“AuditTrail” or similar if we wanted to embed, but that might be too detailed. Instead, we keep audit
separate (perhaps in a log file not in primary export). - Optionally, fields for "Source pages": e.g.
InjuryIncidence_source = "Results section, pg 5". However, unless automated, this would rely on the
extractor manually noting pages, which we are not systematically doing. We could attempt to capture
where in text the AI found it, but that’s complicated to output nicely. Given timeline, we might not
implement output of source page for each field. Instead, we rely on the fact that any number can be
traced by manually checking the PDF and that there's a log if needed.
Given that “audit trail, reproducibility” is a priority 30
, we might supply an Audit Log Export as well
(maybe separate from main data): - Possibly a CSV with columns: StudyID, Field, OldValue, NewValue,
User, Timestamp for each change. That’s for internal use mostly. - Or at least keep it in the system for
scrutiny if needed.
But since the user requested PRD includes acceptance tests likely focusing on the main data export,
we’ll mention the audit log exists and could be exported by admin if needed.
Export of All Tabs vs Partial: The instructions say “all tabs = full export schema” – so yes, we include
every tab’s fields. If one only wanted the first 4 (auto fields), they could drop others later. The default is
full.
We’ll ensure the column order matches exactly the Excel to facilitate cross-check: e.g., if someone
wants to copy-paste our CSV into the Excel template, columns align. (Though likely we’ll just use CSV
directly for analysis in R/Python.)
Master Export (Aggregated): By default, we export all studies in one file. We might also allow
exporting a single study’s data (maybe as JSON for an API or something, but not required; the UI is
mostly for full dataset). The “Master Export” phrase suggests a combined file with everything, which we
are providing.
Example of CSV Row:
For clarity, here’s a snippet of one row (in CSV form):
Study ID,Lead Author,Title,Year of Publication,Journal,DOI,Study Design,FIFA
Discipline,Country,Level of Play,Sex,Age Category,Mean age (±SD) or age
range,Sample Size (players),Number of teams/clubs,Study period
(years),Observation duration,Injury Definition,Illness Definition,Mental
Health Problem Definition,Incidence Definition,Burden Definition,Severity
Definition,Recurrence Definition,Mechanism of Injury Reporting,Length of
season/tournament (weeks),Number of seasons,Exposure Measurement (unit),Total
51
Exposure,Match Exposure,Training Exposure,Total number of injuries,Number of
match injuries,Number of training injuries,Injury incidence (overall),Match
injury incidence,Training injury incidence,Injury incidence 95% CI,Adjusted
Injury incidence (overall),Confounders,Total Time-Loss due to Injury,Median
Time-loss,Mean Time-Loss,Injury Burden,Injury Burden 95% CI,Most common
injury diagnosis,Most common injury type,Most common injury location,Most common injury severity
class,Mode of Onset - Repetitive Gradual,Mode of Onset - Repetitive
Sudden,Mode of Onset - Acute Sudden,Contact,Non-Contact,Cumulative
(Repetitive),Median injury duration,Mean injury duration (±SD),Total
recurrent injuries,Recurrence rate (%), ... [illness fields] ..., ... [MH
fields] ..., ... [breakdown fields] ..., ExtractedBy,ReviewedBy,Notes
Then a row under it for each study. (It's very wide, but that’s okay.)
We will verify through tests that: - All required columns are present in order. - Numeric values are
correctly output (no quotes around numbers unless necessary). - Text fields with commas are quoted. -
Blank vs 0 is used appropriately.
Provenance example in CSV: Suppose "ExtractedBy" = Alice, "ReviewedBy" = Bob. If desired, we could
also output "ExtractionDate" = 2025-07-12 etc., but not asked.
Data Provenance Explanation: To be academically defensible, one might want to know where each
number came from. We aren't embedding that fully in export, but the presence of audit trail and the
ability to cross-check with original PDFs (which we keep references to by StudyID) is our approach. We
will document that the "Study ID" in the export corresponds to internal records and one can retrieve the
source PDF and logs if needed.
Finally, we ensure compliance with any preferred formatting the analysis team might have (the Excel
sheet is likely what they want to see, and our CSV will basically replicate it with maybe a few extra fields
like IDs and user info). This meets the requirement of canonical column order and including all variables
of interest for further analysis.
13. Compliance & Ethics
This project operates in a research context, so compliance with ethical standards, data protection, and
scientific integrity is paramount. Our tool is designed to uphold these principles in the following ways:
•
Audit Trail & Transparency: Every action in the extraction process is logged, creating a
comprehensive audit trail 30
. This means one can reconstruct who extracted each data point,
who verified it, and when. For example, if a value in the dataset is questioned, we can trace it
back: the log might show “Study 25 – ‘Injury incidence’ field set by user Alice on 2025-07-10 based on
PDF p.5; reviewed and confirmed by Bob on 2025-07-12”. This level of detail ensures reproducibility
of the data extraction – anyone could, in theory, follow the logs and verify each number against
the source PDF. Maintaining this audit trail aligns with open-science commitments to
4
transparency .
•
Reproducibility of Results: By standardizing data and keeping careful logs, the tool ensures
that the resulting database is academically defensible. If a third-party wanted to reproduce our
systematic review, they could use our exported data and, thanks to our logs and notes,
understand how each value was obtained. This addresses potential skepticism about AI use –
52
•
•
•
•
•
•
•
since human verifiers are in control and everything is documented, the final data can be trusted
similarly to fully manual extraction (with the added benefit of logs that manual processes often
lack). We will also encourage storing the final dataset and logs in an open repository (like OSF) as
32
indicated in the plan .
Alignment with Standard Definitions: Ethically, we must ensure we don’t misrepresent studies
by forcing them into categories incorrectly. The definitions panel and enforced coding scheme
serve as a check: extractors are reminded to interpret studies using accepted definitions (IOC
consensus) 34
. If a study deviates (e.g., uses a looser injury definition), we do not conceal that –
we record it in the definition fields. This way, our review can later discuss such heterogeneity.
Ethically, this is important for honesty in reporting: we are not altering the meaning of data, just
classifying it for comparison. The tool's design encourages flagging of any definition ambiguity
or unusual methodologies (with notes and flags), ensuring such issues are brought to reviewers’
attention rather than swept under the rug.
Human-in-Control Principle: The tool strictly adheres to the policy that AI suggestions are just
that – suggestions. Humans have control and final say over what data enters the record. This
is critical ethically because it means responsibility for data quality remains with the researchers,
and the AI is not making unchecked decisions. We explicitly instruct users to verify AI outputs,
and the UI (yellow highlights, etc.) makes it clear what hasn’t been human-validated. This
mitigates the risk of AI errors causing false data in our review. It’s also aligned with emerging
best practices on using AI in research – maintain human oversight to avoid biased or incorrect AI
content from propagating into scientific conclusions.
Data Privacy: Our dataset primarily consists of published study data – which are not personal
data (they’re aggregated injury counts, etc.). Therefore, GDPR concerns are minimal for the
extracted data. However, we do store user information (usernames, maybe their real names if
used, and email if it were used but it's not). We will treat user account info as confidential and
only accessible to Admins. Passwords are hashed for security. We ensure the platform itself is
secure (authenticated access only) so no unauthorized person can view the data or PDFs. As
noted, no ethical approval is needed for the content since it’s secondary analysis of published
data 41
, but we still commit to confidentiality of any sensitive info. For example, if a PDF
includes an author’s email or an appendix with potentially sensitive info, we won’t expose that
unnecessarily.
Intellectual Property & Fair Use: PDFs are likely copyrighted articles. We must ensure we use
them in compliance with copyright law. Our use (data extraction for a literature review) is
generally fair use / fair dealing in academic context. We don’t redistribute the full text, only
extracted data. The audit trail might quote small fragments (like a definition sentence) – that’s
allowable as it’s factual or very short quotes for scholarly purpose. To be safe, we won’t expose
large text chunks externally. When we store PDFs on the server, we ensure they are accessible
only to project members (not publicly). This respects publisher copyrights and our usage falls
under research usage rights.
Ethical Use of AI (Avoiding Bias): We are aware that AI models can have biases or generate
incorrect information. To address this:
We instruct the model to stick to the paper’s content and say "not found" if unsure, reducing
hallucination risk.
We include a step where the reviewer (a human) checks and corrects the data. This means any
AI-introduced bias (like consistently rounding up incidences or misinterpreting female data
53
•
perhaps) will be caught and corrected by humans. We do not solely rely on the model for any
subjective judgments – it’s mostly extracting numeric or factual data.
Additionally, as mentioned in compliance, if the AI did somehow introduce a trend of bias
(maybe systematically misreads certain types of studies), the team can detect that by comparing
with actual PDFs thanks to our logs and do an iterative improvement or at least report that
limitation.
•
Quality Assurance and Methodological Rigor: The PRD has built-in features for quality control
(like double extraction, conflict resolution) which ensure the data’s integrity. This aligns with the
project’s method plan of robust validation checks (double data entry, validation against sources)
26
. Our tool facilitates those exact practices: the double extraction mode implements “two
independent reviewers extract data” and the conflict resolution fosters consensus – a process
recommended to minimize bias and error in systematic reviews. By implementing those, we
ensure the resulting dataset can be audited and is methodologically sound.
•
Ethical Approval Considerations: The plan noted no formal ethical approval needed as it’s
secondary research 41
. However, we still operate under general research ethics. We ensure no
personal health information is in our data (since source studies are aggregated anyway). If any
study did contain identifiable info (unlikely, but say a case report – which wouldn’t be included
per criteria anyway), we would handle it carefully and likely exclude such data per our criteria
(we exclude single case studies etc., per protocol).
•
Conflict of Interest and Bias Mitigation: The tool by itself doesn’t handle COIs, but by having
multiple reviewers and logs, it reduces individual bias. For example, an extractor might
unconsciously not extract something that conflicts with hypothesis; but the reviewer and audit
logs create accountability. Everything is visible to the team, reducing risk of cherry-picking data.
The tool enforces that even unwanted results must be recorded if present, because leaving a
field blank stands out. This encourages completeness and honesty.
•
Adherence to Inclusion/Exclusion Criteria: Our screening happened outside this tool, but if
any doubt arises at extraction stage (like a paper might violate an inclusion criterion), the
extractor can flag it to Admin. Not exactly a feature, but a note: we have a flag mechanism that
could be used to mark “Maybe this study should be excluded (e.g., it’s actually retrospective)” so
the team can review and decide. This ensures we don’t incorporate data from studies that
shouldn’t be in the review, maintaining methodological purity.
•
Open Science & Data Sharing: We will make the final extracted dataset available, likely as
supplementary files with the publication or on an open platform. The structure and auditability
of our data via this tool supports that – it’s formatted and ready to share. We’ll also share the list
of definitions and coding frames we used, to allow others to replicate or critique our approach.
This openness contributes to ethical research practices (no hidden data dredging – everything is
explicit).
In conclusion, our tool is built to maintain ethical standards and scientific integrity: It does not
fabricate or obfuscate data, it enhances accountability (through logs), respects privacy and IP, and
follows agreed-upon definitions to ensure comparability of results 5
. By doing so, it helps produce a
systematic review that is trustworthy and reproducible, which is the ultimate ethical goal in research
synthesis.
54
14. Innovation & Automation Opportunities
Beyond the current feature set, there are numerous avenues to introduce further automation and
smart assistance, while still keeping humans in the loop. These forward-looking ideas could improve
efficiency and insight:
•
Auto-Assignment of Work: We can streamline team collaboration by automating the
assignment of studies to extractors and reviewers. For example, upon upload of 50 new studies,
the system could automatically distribute them among available extractors (round-robin or
based on workload). An Admin could input team members and how many studies each should
do, and the system assigns accordingly. Similarly, when an extractor marks a study complete, the
system could auto-notify the designated reviewer. This reduces the coordination overhead on the
project manager.
•
Prioritization Hints: The tool could analyze the content of PDFs to guess complexity and
suggest an order (e.g., “This paper is long/complex; maybe assign to a more experienced
extractor or schedule more time”). It could flag studies that likely have lots of outcomes (maybe
the model can estimate number of injuries from abstract) so the team knows which ones are
heavy. This is more of a stretch but possible with AI.
•
Model-Guided “Missing Data” Hunt: The AI could do more than just fill fields – it could also
highlight potential data points in the text that the extractor might have missed. For instance,
after extraction, run a prompt: “Scan the text to see if there are any relevant results that were not
captured in the form fields (like subgroup analyses, specific injury diagnoses mentioned) and list
them.” If the model finds, say, “There was a subgroup analysis by gender in the paper” that we
don’t capture in our form, it could alert the extractor. While our extraction scope is predefined,
this ensures nothing critical in a study is overlooked (like maybe a major finding not fitting our
form, which could be noted qualitatively). This feature could be like a “AI QA” button that says
“The model did/did not find any additional data points or anomalies.”
•
Background Quality Assurance (QA) Checks: Implement automated logic checks on the data:
•
•
•
Ensure consistency, e.g., if match injuries + training injuries ≠ total injuries, flag it. Or if
incidence is far off expected given numerator/denominator, flag.
Check if severity categories sum to total injuries if provided (if not, maybe data missing).
Check for outliers (if one study’s incidence is 10x others, maybe highlight for reviewer to verify
correctness). These QA rules can run after data entry or on demand, producing a report or list of
warnings (e.g., “Study 12: Sum of match+training (50) != total injuries (45). Please verify.”). This
acts as a safeguard that human and AI both didn’t introduce errors. It also aligns with the plan’s
mention of “validation checks… cross-validation with primary sources, and using Python scripts
for consistency” 26
– we can incorporate those scripts into the tool itself.
•
Intelligent Conflict Resolution: If we have double extraction, we could use AI to assist in
resolving conflicts. For example, if Extractor A wrote “Mean age 24” and B wrote “23”, the system
could quickly highlight the exact mention in PDF that seems to contain age (maybe the AI can be
asked: “What is the mean age reported?” to adjudicate). However, final decision is human, but AI
could provide a quick second opinion in conflicts. This might be overkill since easier to just check
the PDF, but an idea.
55
•
•
•
•
•
•
•
Suggesting Likely Codes: When an extractor inputs a free text definition or notes an injury type,
the system could suggest standardized codes. E.g., if in “Most common injury type” the
extractor starts typing “ACL”, the tool might pop up “That is a ligament injury – select ‘Joint
Sprain’ (knee)”. We already map synonyms, but this could be more interactive with AI: the AI
might parse the whole text of results and automatically propose, “The three most common
diagnoses mentioned are: hamstring strain, concussion, ankle sprain” – it could then prompt the
extractor to ensure those appear in the fields (like did we capture those in our most common
type/location fields or in breakdown?). This helps ensure that if a result is described qualitatively,
it gets coded quantitatively.
Automated Narrative Summary: As a bonus, the tool could generate a brief summary of each
study’s key findings after extraction. E.g., “In Smith et al (2019), injury incidence was 5 per 1000h
(95%CI 3.5–6.5); muscle strains (particularly hamstrings) were the most common injury, and the
injury burden was 375 days/1000h 39
.” This isn’t required for data extraction, but could help
when writing the systematic review results (saves time collating outcomes). It uses the extracted
data to form a narrative (maybe via a template or AI). This would be an optional feature for users
to get quick insight or check if the numbers “make sense” in a narrative form.
Integration with Reference Management: We might integrate with tools like Rayyan or
Covidence via their APIs to import references of included studies directly, rather than manually
uploading PDFs. Since we know the project used Rayyan for screening 42
, a possible innovation:
connect to Rayyan’s API to fetch final included list and maybe even any PDFs stored there. This
would automate the initial setup (no manual uploading needed if Rayyan had them). For MVP,
not needed, but for a refined product, definitely an integration point.
Continuous Learning System: Over time, as we extract more studies, we can fine-tune prompts
or even a custom model on our domain. For example, if we accumulate enough extracted
examples, we could train a smaller model or rules to extract common fields more precisely
(especially things the big model struggled with). Or use the data to refine the prompt logic. In a
living review scenario, we can progressively improve the AI’s accuracy. Also, if the same journals
or authors appear, the system might learn their report style and get faster/better.
Expansion to Other Data (like Risk of Bias): The tool could incorporate Phase 2 (the quality
assessment tool in development). In future, we might add a module where after extraction,
reviewers fill a checklist for study quality (which might be partly automatable too, e.g., scanning
if the study reported certain items). While out-of-scope now, designing the data model with that
possibility in mind could pay off (e.g., adding a QualityAssessment table). The innovation could
be using AI to pre-score some RoB criteria (e.g., detect if randomization mentioned, etc.), again
with human confirmation.
User Analytics and Efficiency Tracking: An internal feature could track how much time is spent
per study, which fields cause the most corrections, etc. This information could be fed back into
improving either the AI or training the team. For instance, if we see AI always fails on “Mean
time-loss” field, maybe we update the prompt for that. Or if one extractor is taking much longer,
perhaps they need assistance or training. This isn't a user feature but an admin analysis that can
drive innovation.
Predictive Highlighting: As the user reads the PDF in the viewer, the tool could highlight
important numbers or phrases (via an NLP algorithm) to draw attention. E.g., highlight all
percentages or incidence rates in text. Rayyan during screening highlights keywords; we could
similarly highlight terms like “incidence”, “per 1000”, “injury definition” so the extractor can
56
quickly find relevant passages. This uses NLP but not necessarily LLM (could use simpler pattern
matching). This is a relatively straightforward innovation that speeds up manual verification.
•
Voice or Chatbot Interface: For accessibility or convenience, consider allowing the user to ask a
question to the AI about the PDF in a chat-like interface. E.g., user could ask, “What was the total
exposure reported?” and the AI would answer. This is a different UI paradigm but might be
helpful for cross-checking without manually scanning text. It’s like ChatPDF integration. This
wouldn’t replace form filling but could assist the reviewer to query anything unclear. It's an
innovative assistive feature.
•
Scaling to Living Updates: The system could monitor literature feeds (as mentioned in plan:
automated Google Scholar alerts etc. 43
). A future integration: connect to an API to
automatically fetch new papers (when an alert triggers) and queue them in the system (maybe
mark as “New candidate studies”). This starts to integrate screening and extraction in a
continuous pipeline – an ultimate goal for a fully living systematic review platform. For now, just
an idea.
•
One-Click Report Generation: Beyond data export, the tool could compile summary statistics or
charts (like number of injuries by year, etc.) as a quick output. Essentially a mini-dashboard. This
might be more of the future “online reporting tool” they plan 44
, which likely is separate. But
our tool could provide the data endpoints for that. It's not extraction per se, but an innovation
for user – seeing preliminary aggregate results as data comes in might motivate or help catch
anomalies.
•
Machine Learning on collected data: Once we have the dataset, maybe run some
unsupervised analysis to find patterns (though that’s more analysis-phase, not extraction-phase;
out-of-scope for our tool’s current mission, but we could facilitate by easy export to analysis
environment).
In summary, while our MVP focuses on safe automation (AI suggestions) and leaving humans in charge,
these potential enhancements could further reduce manual tasks (like automatically dividing work or
highlighting issues) and improve the user experience (like quickly retrieving info via a chatbot or
summarizing findings). Each would be implemented with caution not to compromise the academic
rigor.
Crucially, any additional automation would still follow our core principle: automate what is safe to
automate, but always let users verify and override. For example, auto-assignment is low risk (just
task management), so fully automate that; predictive data extraction is higher risk, so keep it as
suggestions only. This way, we continually increase efficiency while maintaining control and quality.
15. Tech Stack & Hosting
We will implement the web app using modern, reliable technologies, considering the team’s
environment (Firebase Studio, Cursor) and the need for collaboration. Here are our recommendations
and notes:
Front-End: - We propose using a web application framework. Given Firebase integration, a good choice
is React (possibly with Next.js for easier deployment) or Vue.js. React is widely used and could work
well with Firebase’s real-time DB if needed (via libraries). Alternatively, since "Firebase Studio" is
mentioned (there isn’t a product literally called Firebase Studio to my knowledge; maybe they meant
57
using Firebase’s tools and a code editor called Cursor?), we likely will custom-code the front-end. - We
might consider Material-UI or similar component library to speed up building forms, tables, etc., giving
a clean look and built-in responsiveness. - If using Next.js, we can host on Vercel or Firebase Hosting
easily. Next.js also allows serverless API routes which could handle some backend tasks if needed (like
proxy calls to LLM API).
Back-End / Server: - If we use Firebase heavily, we might lean on Firebase Cloud Functions for
backend logic (like making the API calls to Gemini, performing file OCR, etc.). Cloud Functions can be
triggered by events (like file upload triggers a function to parse PDF and call AI, etc.). This would make
the architecture serverless and scalable. - Alternatively, a more traditional backend (Node.js/Express or
Python Flask) could be used if we want fine control. But given ease, Node.js with Firebase integration
might be simplest (especially if we want to use Firestore, the Node environment has good SDK). - For
the AI integration: We’ll call the Gemini API (likely via REST). This could be done directly from front-end
(but exposing key and hitting API from client is not secure and not allowed by browser if cross-domain
etc.). So we will do it server-side, either in a Cloud Function or server endpoint. The front-end will make
a request like /extract-fields with the PDF text or study ID, and the server function will then call
the AI API and return suggestions. - For OCR: We could use an API (Google Vision API, which integrates
with Firebase easily, or open-source Tesseract in a function). Using Google Vision via a Cloud Function is
straightforward and likely more accurate on handwriting (but we have print text, so Tesseract might
suffice if we want free solution; however Tesseract in a serverless environment could be tricky due to
binary dependencies). - Considering "Cursor" might refer to an AI pair-programming tool or
environment, but not sure if that implies anything for hosting. Possibly it means they’ll use an AI
assistant in coding; not relevant to end product.
Database: - We have two main choices: Cloud Firestore (NoSQL) or a SQL database (like Cloud SQL for
Postgres, or a Firebase extension like using the new Firebase Extensions for PostgreSQL, or using
Supabase). - Firestore Option: - Pros: Easy integration with Firebase Auth and security rules, real-time
updates (if we wanted, e.g., a reviewer sees fields as extractor fills them, which could be useful). Also, no
schema migrations needed if we tweak fields (though our schema is fixed). - Cons: Querying can be
clunky for complex queries (but we mostly retrieve by ID or list all, which Firestore can do). Firestore has
a 1MB per document limit – our extraction document might approach that if all fields stored as one doc?
Actually, text fields like definitions could be long, but likely under 1MB per study. 200 fields mostly
numeric, should be fine. - Another con: implementing join-like or RLS logic is via security rules. But our
scenario is one group of users all share data, so that’s fine (we allow read to all authenticated users). -
Firestore allows offline sync as a perk, but not needed here particularly. - SQL Option (PostgreSQL): -
Pros: Strong relational integrity, can use Row-Level Security to easily partition data if multi-project in
future (like project id field and policies). Postgres can handle our data easily, and writing export queries
is straightforward (maybe even easier than collating Firestore docs). - We can host Postgres via Cloud
SQL or use a service like Supabase (which gives an instant Postgres + API + Auth layering). - If we used
Supabase: it has built-in user auth with email, but we don’t want email login, so we might manage users
ourselves. Could still use it and bypass certain features. - Supabase also has a storage for files and could
handle the PDF upload well (with RLS controlling who can download). - The differences flagged: Using
Firebase vs Cursor (not sure what "Cursor" refers, possibly some environment that expects or works
better with a SQL DB? Or maybe "Cursor" is just the code editor and doesn't matter). - Another pro of
SQL: If in future we want to do meta-analysis computations or more advanced queries (like average
incidence across studies, etc.), having the data in SQL might allow direct queries. But we can also just
export and do in R. Not a deciding factor. - Considering the team has familiarity with Firebase (since
mention), and likely the developers might have planned to use Firebase’s new tools, I lean that
Firestore + Cloud Functions is a suitable stack for MVP. It speeds up dev (less worry about deploying a
full server). Real-time sync is nice if two people open the same study (we can lock editing though to
avoid collisions, but if allowed, they’d see changes live). - However, mention of RLS and indexes suggests
58
they expect a description of a relational model, which we provided, and they want to ensure we index
key fields. Possibly they want to highlight differences: In Firestore, you define composite indexes
differently (and no real RLS, just security rules). - We can “flag differences” by saying: with Firestore,
security is via rules, with relational (Postgres), you can use RLS to restrict data per user or project.
Firestore is schemaless (so adding new field doesn’t break things, but we must ensure front-end and
back-end agree on field names), whereas Postgres requires migration for new fields (ensuring all fields
from PRD are included). - Tech stack choice also might depend on developer comfort. If the team uses
Firebase Studio (which might be a misnomer, perhaps they meant Firebase Extensions or Google’s
AppSheet? Or maybe they meant they want to host on Firebase Hosting), we’ll assume a Firebase-
centric approach.
AI Integration (Gemini): - Google’s Gemini 2.5 presumably accessible via Google Cloud Vertex AI
endpoints. We’ll need the API key for that. Using it within Google Cloud environment (like from a Cloud
Function) is smooth. We just ensure to not expose the key publicly. - If Gemini is not yet public, perhaps
PaLM 2 (text-bison) is meant. Given timeline (Oct 2025), possibly Gemini is available on Vertex. We will
clarify that in code/config, but treat it as a REST call to an LLM API with certain model name. - We will
also incorporate usage of Google’s Document AI or PDF parsing if needed (though a simple open-
source PDF parser might do – e.g., PDF.js for client or PyPDF2 on server). - For OCR, if using Google
Vision API, that’s easily done with a Google Cloud project (just need to enable API and call from
function).
Authentication & Hosting: - Using Firebase means we can use Firebase Authentication for user login.
However, Firebase Auth strongly encourages email/password or OAuth. We don’t want email. But
Firebase Auth can allow anonymous or custom token auth. Possibly we can use Custom
Authentication: The admin could create user entries in our DB, and we generate a custom JWT for
them to log in. That is complex. Alternatively, we can cheat by using email field as username (like
alice@local with a known domain and not sending verification). Or use phone auth by treating
username as phone (also hacky). - Another approach: use a simple custom auth system (like a separate
user table and do session cookies or JWT manually). For small user count, that’s fine. If hosting on
Firebase Hosting with no server, we’d rely on Firebase Auth though. If we have our own server (Next.js
server or Node Express), we can do sessions. - Possibly simplest: use Firebase Auth with email/password
but not verify or use emails, just tell users to input their username as email (like "alice@example.com",
where example.com is dummy). This is slightly kludgy but workable. Or we can just manage a user
collection and have login form check against that (not very secure unless we properly hash and store). -
Given short timeline, we might just implement our own login page that checks credentials against a
Users collection (with hashed pass) – since user count is low and all internal, this is acceptable. It’s
straightforward in an Express or Cloud Function environment. - We will mention that there's no email
verification, and that’s intentional per requirement.
Hosting & Deployment: - Firebase Hosting can host our front-end (especially if it’s static or a single-
page app). If using Next.js, we could deploy to Vercel or use Firebase’s experimental support for SSR.
But likely a static SPA is fine. - The backend functions (for AI calls, OCR, etc.) can be deployed as
Firebase Cloud Functions (running on Node 18 or so). They will be triggered via HTTPS calls or
Firestore triggers. - If we go the Postgres route, we’d host that on Firebase Extensions (not sure if
available) or a separate server – more devops overhead. - Considering the environment “Cursor” –
maybe it’s an environment where they want to quickly iterate. Possibly they considered using
something like Retool or AppSheet (low-code) for parts, but our requirements are too custom for no-
code. - If hosting on Google Cloud, we ensure compliance: e.g., location of data (if GDPR relevant, keep
in EU datacenter if needed, but since data isn’t personal, not critical, could use US). - The tech stack
should also consider cost: Firestore is pay-per-use, which for <200 docs and some writes is negligible.
59
Cloud Functions calls to LLM and Vision are major cost (LLM usage cost primarily). We’ll integrate usage
monitoring.
Differences flagged: Firebase vs Others: - Database differences: Firestore is NoSQL, we can’t do
complex join queries easily (but we don’t need them much here). In Postgres, designing the schema
with multiple tables and foreign keys is beneficial if data grows or to enforce constraints. In Firestore,
we have to manage consistency manually (like if we had separate collections for breakdown counts
linked by StudyID, we must ensure to update them together – but transactions are possible for a single
doc or small batch). - Security differences: With Firestore, we’d define security rules such that only
logged in users can read/write certain paths. E.g., allow read/write on /studies if auth != null.
Possibly allow only admin to delete or edit user assignments by including role claims (we can set
custom claims on Firebase Auth user for roles). With Postgres, we’d rely on app logic or RLS policies. RLS
is robust but requires using an auth system that maps to DB roles. For instance, with Supabase, each
user could have a uid and RLS ensures study.project_id = user.project_id . In our single
project case, RLS might not be necessary because all users can see all data (just different actions). -
Real-time updates: If Firestore, we could do listeners (like if one user updates a field, others see it
immediately). That’s nice for two reviewers comparing concurrently. In Postgres (unless using
something like Postgres listen/notify and a socket, or using Supabase’s real-time channel), updates
aren’t pushed to clients by default. Might not need real-time though; a simple refresh or having user
click sync is fine in extraction scenario. - Indexing: Firestore requires setting up composite indexes for
certain queries. If we query by combination fields (like filter by status and assigned user), we need to
define that index in configuration. We’ll do that for any queries we use frequently. Postgres indexing we
would do as normal (like index on (status, assignedTo)). - Cursor environment: There’s a code editor/
IDE called Cursor AI that helps writing code. Maybe they intend to use that for development. Doesn’t
change stack, just note that code will be written possibly with assistance. Not a deployment factor.
Recommendation on DB: If the development team is comfortable with Firebase, using Firestore with
Cloud Functions is likely the fastest route. If they specifically mention RLS, it could be they are
considering Supabase (since Supabase touts RLS strongly). Supabase with Row Level Security and
Postgres would work too: - We can still host a React front-end (maybe on Netlify or Vercel or Supabase
itself). - Use Supabase client SDK for auth and queries. But customizing it to username/pw without
email might need a workaround (Supabase expects email normally; but we can use “email as username”
trick or just handle auth ourselves with a custom table and JWT). - Since timeline is short, and Firestore
covers our needs, I would lean to Firestore.
We will state the pros/cons of each approach and ultimately choose one: Proposed stack: - Frontend:
React (with possibly Next.js) + Material UI, deployed on Firebase Hosting or Vercel. - Auth: Custom (User
collection with hashed passwords) or Firebase Auth with email trick. - Backend: Firebase Cloud
Functions (Node.js) for AI calls and any heavy lifting like PDF parsing. - DB: Firestore for structured data
(Studies, etc.), and Firebase Storage for PDF files. - AI APIs: Google Vertex AI (Gemini model), Google
Vision API for OCR.
We also note using "Cursor" (if meaning the tool with that name) doesn’t affect the runtime stack; it’s
just used during coding for AI assistance.
Best practices references: - We will implement linting, etc., but more importantly: - Use environment
config for API keys (Gemini key stored securely, not hardcoded). - Use try/catch and exponential backoff
when calling AI API (to handle rate limits gracefully). - Ensure the system is containerized or easily
deployable (but on Firebase, just use their CLI to deploy functions and hosting). - If using Postgres,
ensure to parameterize queries to avoid injection (though internal, still best practice). - For Firestore,
60
ensure to batch writes if updating many fields at once (to reduce cost and ensure atomic updates if
needed). - Ensure images (like any embedded images in UI, e.g., logos) are optimized for web.
We mention differences flagged throughout: - We have flagged differences in approach, e.g., RLS vs
Firebase rules, schema enforcement vs flexible, etc.
Conclusion on recommended DB: Given no email login and small user base, a simple custom user
table might suffice. If using Firestore, user table can be another collection and we do manual login. For
password hashing on front-end (lack of salt?), better to do it on server.
Alternatively, we can use Firebase Auth with email/password but not verify – simplest hack: The
admin could create accounts like alice@fifa.com with password and share those credentials. The
email itself is just an identifier (not an actual working email). The team can log in with that. That
leverages Firebase Auth’s secure handling and UI maybe (but we can build our own form easily). Since
they said no email login, maybe they specifically wanted to avoid the overhead of email verification or
linking to email. But using email as username surrogate might be acceptable if we clarify “we won’t
send any emails, it’s just your username format”.
We will mention the approach: either custom or treat username as email in Firebase Auth. Given time
constraints, we lean to treating username plus a fixed domain (like username@local ) to satisfy
Firebase. The difference to user is minimal (they may wonder why an email-looking thing; we can hide
that by making the input label "Username" and append a domain behind scenes). This might be too
hacky; maybe better to just do custom auth with Firestore. But then you have to handle sessions which
is more code. Actually, we can use Firebase Auth Custom Token: We can create user records in
Firestore with hashed pass and on login attempt in our server, verify pass, then generate a Firebase
Auth custom JWT with admin.auth().createCustomToken(uid, {role: 'extractor'}) . Then
front-end uses that token to sign in. Then we can use Firebase’s client SDK with that token and security
rules for data. This is a clean solution: it leverages Firebase's client auth state management and security,
but using our own user store. It’s a bit advanced but doable.
However, implementing this might be an overkill for a handful of users. Simpler: just handle login via a
cloud function that returns a session cookie, etc. But session management outside Firebase Auth is
more to build.
Anyway, we’ll mention as possible solution.
Summation: We'll deliver the app likely on Firebase (which aligns with the team’s existing usage) and
keep the stack manageable: - No dedicated servers to maintain (just serverless functions). - A robust
database (Firestore) that scales and doesn't need manual scaling or patching. - This meets performance
needed for our scale easily and integrates well with other Google services (like the Vertex AI we want to
use).
We'll finalize by recommending the combination and stating differences: like "If using Firestore, ensure
to structure data as one document per study for atomic writes; if using Postgres, implement the tables
as designed and consider Supabase for quick setup. Both approaches can work – choose based on team
familiarity."
61
16. MVP Scope
To deliver a usable pilot within ~2–3 sprints (~4–6 weeks), we will focus on core must-have features. The
Minimum Viable Product (MVP) will include all components necessary for the extraction workflow to
function, but will defer more advanced or nice-to-have features. Below are the must-haves for the MVP:
•
User Management & Auth: Ability for users to log in with username/password and be assigned
roles (Admin, Extractor, Reviewer). For MVP, a simple solution (like pre-creating accounts and
sharing credentials manually) is acceptable. We won’t implement password resets via email or
SSO – just a basic secure login. (The Admin can manage user creation by directly editing a config
or via a rudimentary interface.)
•
Study Entry & Upload: The system can ingest study PDFs. MVP will support uploading PDF files
(single or batch). On upload, it creates study entries with minimal metadata (maybe just
filename/title placeholder). Duplicate checking will be implemented in a basic form: at least
exact duplicate detection by title/author/year or DOI to warn the user. (Fuzzy matching
duplicates could be simplified for MVP or just flagged later by manual check if we must cut
complexity, but ideally include at least exact match detection.)
•
PDF Viewer & Form UI: The core UI allowing an extractor to open a study and see the PDF
alongside the data entry form must be in place. The form will contain all fields from the first 4
sections (Study details, Participant info, Definitions, Exposure) as these are auto-extractable and
needed early. It will also contain fields for outcomes (injury, illness, MH) because those are part
of final data, but we might not enforce filling all in MVP if AI doesn’t handle them fully – the
extractor can input what is available. The layout with collapsible sections, color highlights for AI
suggestions (yellow) and confirmed (green), etc., should be done. If time is short, we might
simplify status indication (e.g., maybe just an icon or bold text “(AI)” for suggestions instead of
full background coloring – but coloring is not too hard with CSS, so likely keep it). The PDF viewer
should allow scrolling and ideally text selection (for copy-paste). If linking highlights between
form and PDF is too much for MVP, we can skip auto-scrolling to source; the user can manually
search in PDF.
•
AI Auto-Extraction (Gemini Integration): MVP will implement calling the AI model to assist
with at least the first 4 sections:
•
•
•
•
Fill Study details (Title, authors, etc. – though Title could come from PDF metadata or we allow
user to input manually if AI unreliable).
Participant characteristics (sample size, etc.).
Definitions if clearly stated.
Exposure data. This covers a lot of low-hanging fruit data that the AI can reliably extract from
methods. For outcome fields (incidences, counts), it’s more complex; we might attempt at least
total injuries and overall incidence via AI in MVP. But if short on time, the extractors might
manually enter the results with the PDF in view, and we add AI extraction for those in a later
iteration. However, since outcome fields are key, we aim to include them too if possible – maybe
have a basic prompt to get total injuries and incidence, leaving detailed breakdown to manual.
The AI integration will include error handling (if API fails, show message) but doesn’t need to be
fully optimized in MVP (like no caching of results or fancy prompt optimization initially – just get
it working).
62
•
•
•
•
•
•
•
•
•
•
Manual Editing & Confirmation: The user must be able to edit any field the AI filled, and mark
it as confirmed. For MVP, we could consider a field “confirmed” if the user changes it or moves
focus away after reviewing – or we explicitly provide a confirm checkbox. Possibly simpler: any
field that’s green means user edited or explicitly ticked it. MVP implementation might be: a
“Confirm” button that confirms all fields at once, or the act of toggling status individually. We can
simplify by saying: an AI-filled field is implicitly “pending” until the user either changes it or
leaves it and marks study complete, which in effect confirms it. But better to have an explicit
mark to differentiate something left unconfirmed. If time is limited, we might just rely on the
final review stage instead of individual field confirms by extractors (i.e., extractor fills all and
sends to reviewer, who then verifies – thus at least reviewer confirms globally rather than per
field). But the color-coded approach is quite helpful, so we try to implement it per field.
Saving Data: The form data should save either automatically or via a save button. MVP must
ensure no data loss – so we’ll have autosave on field blur or every few seconds. That’s essential
especially if large form – losing entries would be unacceptable.
Reviewer Workflow: The MVP should allow a reviewer to see completed extractions and mark
them reviewed. That means:
A reviewer can log in, see list of studies (maybe filter by “Needs review”).
They open a study and see the filled form (read-only or editable depending on decision).
They should be able to make corrections (editable fields for reviewer).
They then mark it as reviewed (complete). For MVP, we might not implement a fancy side-by-side
diff for double extraction – instead, we could require a single extractor per study for pilot. Or if
double extraction is required from day one, we handle it by having two separate forms and a
manual compare by reviewer. But given timeline, double extraction might not be enforced in
MVP; instead, do one extractor and one reviewer. (The plan was double for subset 26
, so initial
pilot can maybe do single extraction). So MVP: one person extracts, one person reviews that
same entry. No need for conflict reconciliation UI (that can come if needed after pilot).
Data Export (Basic): At least a way to export the collected data to CSV. MVP: an Admin can click
“Export CSV” and get a file. It can be done via a cloud function that queries all records and
composes CSV. Doesn’t have to be fancy formatting initially, but must include all fields so they
can start analysis. JSON export is secondary; CSV likely priority because Excel was provided. We
can include JSON export if easily done, but not strictly needed for pilot (analysis likely in R or
Excel, both fine with CSV).
Standardization & Controlled Vocabularies: The MVP should implement the dropdowns for
fields like Sex, Level of Play, etc., with the predetermined options. This ensures from the start
data is uniform. Mapping synonyms: at least for a few critical ones, we can hard-code some logic
(like if AI returns "Males", we transform to "Male" before putting in form). Full mapping table can
be expanded later, but MVP should handle obvious ones to avoid confusion (male/female, etc.).
The definitions panel with full content might not be fully fleshed out in MVP, but a simplified
version (like maybe just a static page or PDF of consensus definitions) could be linked. However,
including at least a text block of key definitions is highly desirable to avoid mistakes. If short on
time, we might skip building an interactive panel and instead supply a PDF of IOC consensus as
reference or a cheat sheet document outside the app. But since one-page of text definitions is
not too hard to embed, we can likely include it.
Performance Considerations for MVP: Ensure the app can handle typical PDF sizes. 20MB PDF
test perhaps not necessary by end of sprint 2, but we must design with that in mind (for pilot,
maybe they’ll test on smaller ones first). But we will commit that up to 20MB is supported
63
(maybe by splitting PDF text). If a really large PDF is uploaded and performance is slow, that’s
acceptable if rare, but the system shouldn’t crash.
•
OCR Fallback (Basic): This can be a stretch goal for MVP depending on how often they expect
scans. Possibly, we can integrate at least a simple OCR by calling an API for any PDF where text
extraction returns nothing. This is moderately complex but achievable within 2 sprints if using a
ready API. If pressed for time, we could instruct: “If a PDF is scanned, please manually run it
through OCR using an external tool and upload the text or a converted PDF.” However, since they
explicitly said occasional OCR fallback, we should try to include it. Perhaps we allocate a cloud
function to do OCR with Google Vision (quick if account set).
•
•
If not, at minimum, MVP should notify the user “This PDF has no text. Please obtain a text
version or click to OCR” (with a stub that maybe doesn’t fully function until later, or we rely on
user doing it offline for pilot).
But likely we include it.
•
Audit Logging (Minimal): Logging every field change is more of an internal feature. For MVP, we
may not need a UI for logs, but we should record them in background (or at least final values
with user stamps). However, not having a user stamp per field in UI is okay, because at least the
final review stamp indicates that data was verified. The plan’s timeline for pilot is June 2025 –
primarily to test the system on a subset. They will likely manually cross-check the data then, so
logs are helpful but not absolutely required for them to trust it (since they themselves are doing
it). Still, we can generate logs even if not exposed yet.
•
Possibly, MVP just logs at study level: e.g., store in each study record meta fields like
"ExtractedBy: Alice on date" and "ReviewedBy: Bob on date". That might be sufficient audit info
for pilot. Detailed per field log can be added later.
•
User Interface Polish: MVP does not need to be beautiful, but it should be clear and not overly
confusing. We’ll focus on functionality. E.g., the table in Dashboard can be basic HTML table style
(doesn’t need advanced filters initially, they can visually scan 50 entries). But we should
implement at least sorting or filtering by status to easily find those pending review. Maybe for
MVP, just separate lists: e.g., “To Do” vs “Completed”. If timeline tight, search bar can be omitted
or minimal.
•
The color-coding and status might not be fully automated in MVP – e.g., maybe fields don't
automatically turn green on confirm if that’s complex; we could have a simpler approach: mark
entire study as "completed by extractor" which then implicitly means all fields were done. We
then rely on reviewer to fix any issues rather than per field tracking. But the color approach is
very helpful to user; I'd include it if possible, but if implementing that bogs down the schedule,
we may drop per-field confirm and just use per-study status.
Summarizing the MVP must-haves: 1. User login system (with roles). 2. Upload PDFs, store them, list
them. 3. Open PDF + form side by side, with all required fields present for input. 4. AI integration to
auto-fill a good subset of fields (at least those in first 4 sections). 5. Ability for user to edit all fields and
save. 6. Mark extraction done and mark review done (with a simple mechanism). 7. Export all data to
CSV covering all fields. 8. Basic duplicate check and basic OCR fallback. 9. Enforce standardized values
via dropdowns for key fields. 10. Logging of who did extraction/review for accountability (even if just in
data fields).
64
Everything beyond this can be considered enhancements for later sprints: - e.g., dual extraction with
conflict UI, advanced filtering on dashboard, comprehensive definitions UI, sophisticated error checks,
etc. Those are not strictly needed to use the tool for initial data extraction. - They likely want to pilot in
June 2025 which implies get core functionality in place by then (which our MVP covers). - Non-core
things like “Master Export vs partial export”, JSON output, or a pretty UI for logs can wait.
We also clarify out-of-scope explicitly next.
17. Out-of-Scope
It’s important to define what features or aspects are not going to be part of the initial development,
either because they are not immediately needed, would over-complicate the MVP, or can be postponed
to a later phase. The following are out-of-scope for now (not included in the MVP):
•
Comprehensive OCR for Poor PDFs: While we will include basic OCR fallback, any extremely
complex OCR tasks (like heavily degraded scans, handwriting, or specialized tables) are out-of-
scope. If a PDF is of such low quality that automated OCR fails, handling it will fall back to
manual methods outside the system for now. We will not implement advanced image pre-
processing or manual zoning of OCR within this project’s timeline. (Deep OCR could be
considered later using specialized services or requiring manual transcription if such cases are
frequent, but we assume they are rare.)
•
Single Sign-On or External Authentication: Integration with institutional SSO (e.g., Google
OAuth or other providers) or multi-factor auth is out-of-scope. Users will use the simple local
auth we provide. Also, features like password recovery via email, or user self-registration, are not
included. Admin will manage accounts manually for the project’s team.
•
Screening and Citation Management Features: The tool will not replicate screening-phase
functionality (that was done in Rayyan/Covidence). There is no interface to screen titles/abstracts
or perform inclusion/exclusion here; we assume included studies are final. Similarly, we are not
managing citations or references (no integration with citation managers like EndNote, no
generation of reference lists). The focus is strictly on data extraction from full texts. (We import
references only to the extent needed to label studies; any search strategy or PRISMA flow is
outside our scope.)
•
PRISMA Diagram or Meta-Analysis Tools: The generation of PRISMA flow diagrams, forest
plots, or running meta-analyses is out-of-scope. Covidence can export to RevMan etc. 27
, but
AIDE will not do that. Our output is data; any analysis or visualization will be done outside (e.g.,
in statistical software or a planned Phase 3 reporting tool).
•
Risk of Bias/Quality Appraisal Module: Even though Phase 2 of the project involves a quality
assessment tool, we are not including a dedicated risk-of-bias assessment form in this extraction
tool for now. (We might link to a separate process or do it offline.) The system won’t have, say, a
built-in checklist like Newcastle-Ottawa or STROBE compliance calculator. We focus on data
extraction of results. Quality scores or ratings can be handled later or in a separate module once
the FIFA IISQA tool is developed.
•
Multi-Project or Multi-Tenant Support: The MVP is built for the FIFA GBI project specifically
(one “project” with one set of definitions). We will not initially support multiple concurrent
systematic reviews on the same instance, each with different schemas or user sets. If another
65
•
•
•
•
•
•
•
•
project wanted to use the tool, it would require a separate deployment or a future feature to
compartmentalize data. Row-level security for multi-tenant use (where users of one project
cannot see another’s data) will not be configured in MVP beyond what’s needed for our single
team.
Mobile App or Extensive Mobile Support: While the web app might be accessible on a tablet,
we are not optimizing the interface for small screens or building native mobile apps. Data
extraction is assumed to be done on desktop/laptop where screen space is available for PDF +
form. Mobile responsiveness is limited; certain pages may work on tablet, but a phone
experience is out-of-scope.
Manual Fine-Grained Conflict Resolution UI (for double extraction): At launch, we likely will
not have the full side-by-side comparison interface for two extractor inputs with merge
capabilities (like Rayyan’s blinding and conflict resolver). If double data extraction is desired in
pilot, the second extractor can simply fill the form after the first (overwriting or in a copy), or we
do one extraction per study as default and handle disagreements by discussion outside the
system. Building the whole conflict resolution workflow (with blinding and merging) is complex
and can be added later if the team decides to adopt full double extraction on all studies.
Automated Table Extraction or Deep Data Mining: We will not attempt to automatically parse
detailed data tables or figures from PDFs beyond what the LLM provides via text. For example, if
a paper has a table of injury counts by body part, our system will not automatically read that
entire table (unless the LLM does so partially when asked for most common injury, etc.).
Extractors will manually enter needed data from such tables. Similarly, image-based charts will
not be computer-read.
Extensive Image Embedding in UI: The tool’s UI won’t incorporate advanced image outputs
(like body diagrams to mark injuries, etc.). We considered maybe a body chart for location, but
out-of-scope for now – location is just textual categories. No dynamic infographics generation in
the extraction phase.
Granular Per-Field Permission Control: We won't implement complex role-based restrictions at
field level (e.g., an extractor can edit only certain fields, or a reviewer can only comment not edit;
we keep it simpler – either a user can edit the form or not based on status). Our workflow trust is
that extractors do initial fill and reviewers can edit anything during review. We won't lock
individual fields once filled or anything fancy like that in MVP.
Data Imputation or Synthesis: If data is missing in a study (e.g., they didn’t report something),
our system will not attempt to impute or calculate it (except trivial ones like we might derive
“total injuries” if not given but match+training given, but even that we likely leave blank to be
safe). Handling of missing data in analysis will be done outside our tool. We simply mark it not
reported.
Advanced Analytics or Visualizations in-app: As noted, no built-in analysis like pooling rates,
trends over time, interactive charts or dashboards. (Those will be part of a separate output tool
possibly in Phase 3 or the final reporting platform.)
Notifications via Email or External: The system will not send emails or texts (like "notify
reviewer via email when a study is ready"). All notifications are in-app (dashboard list). Since
users are in the app regularly during extraction, we assume that suffices. This keeps us from
66
needing email service configuration. (If team wants notifications, maybe a simple approach is
the Admin manually pings on Slack or so – not software-handled.)
•
Mass Editing or Bulk Operations: We won't implement features like “update all studies’ field X
with Y” or batch editing beyond the initial upload. Bulk deletion of studies or reordering fields
also not needed (we have fixed schema). If the schema needs adjusting, that’s a development
action, not UI.
•
Extremely Fine User Role Differences: We have basically three roles. We will not have sub-roles
or project-specific roles beyond these. E.g., no separate "Viewer-only" role or "Statistician" role
with read-only rights is planned. If a guest needed to see data, an admin can export and share
CSV; no guest login read-only mode at this time.
•
UI Localization or Multi-language UI: The interface will be English-only for now, since the team
operates in English. Handling other languages for UI or translation is out-of-scope (though the
content extraction handles other languages in PDFs to some extent, the UI labels and definitions
are in English).
•
Extensive Testing Framework (for delivered MVP): While we will test the system thoroughly,
building an automated test harness or performing formal user testing studies is beyond scope in
initial sprints. (We will rely on internal QA and the pilot itself will serve as user testing to iterate
improvements.)
•
Performance Optimization for Extreme Cases: We won’t initially optimize for thousands of
records or multiple simultaneous heavy users, because our use-case is moderate (a handful of
users, <200 studies). For example, real-time collaboration editing the same form by two people is
not supported to granular level (we’ll lock or avoid conflict rather than handle live merges
beyond what Firestore might do). That complexity (like Google Docs style simultaneous typing) is
out-of-scope.
•
Backup/Restore UI: We won’t provide a UI for data backup or version rollback. The data is
stored in the DB and we assume reliability; we’ll of course have means to get data (via export).
There’s no feature to revert a study to a prior state via UI, aside from manual corrections.
•
Platform differences in development: (like special handling if using Cursor vs standard IDE) –
not relevant to features, so not considered in functionality scope.
By clearly outlining these exclusions, we set proper expectations: the MVP will do the critical job of
enabling data extraction and standardization with AI assistance, but it will not cover every adjacent
feature of a full systematic review management platform. We focus on what’s needed to successfully
extract and prepare the data for the FIFA GBI review, and leave supplementary features for future work.
18. Acceptance Tests
To ensure each requirement and feature works as intended, we will define acceptance tests. These tests
can be executed at the end of development (and ideally automated in the future) to validate
67
functionality. Below are key test scenarios corresponding to our functional requirements and user
stories:
1.
Login/Authentication Test:
Given a set of valid user credentials (e.g., username “alice” and password “test123”) that have
been configured, when the user attempts to log in via the login form, then the user should be
authenticated and taken to the Dashboard.
And if the user enters an incorrect password, then an error message “Invalid credentials” should
be shown and access denied.
And if a user without an account tries to log in, then login fails (and perhaps no generic clue if
username or password was wrong, for security).
And ensure that after login, protected routes (like extraction pages) are accessible, whereas
without login they are not (simulate by direct URL access and expect redirect to login).
2.
PDF Upload and Duplicate Detection Test:
Given two PDF files representing the same study (e.g., identical content or same title/author) and
an empty database, when the user uploads the first PDF, then it should appear in the Dashboard
list with status “Not started.”
When the user uploads the second PDF (duplicate), then the system should detect the duplicate
and prompt the user. The acceptance criteria: the user sees a warning naming the existing study.
If the user chooses to cancel, then the second is not added to the list.
Also test uploading two different PDFs (different study): both should be added with no warning,
resulting in two entries.
Edge: Upload a PDF with a DOI that matches an existing one – ensure duplicate triggers in that
case too.
3.
Opening Study and Viewing PDF Test:
Given a study entry on the dashboard with an uploaded PDF, when the user clicks to open it, then
the Paper Workspace loads with the PDF rendered on the left.
Verify that the user can scroll through the PDF and read text. (We expect at least ~95% of text
pages to display correctly).
Test the search function: search for a common word in the PDF via a search box if provided – the
viewer should highlight or navigate to the instance (if search implemented). If not implemented
in MVP, skip.
If the PDF is a scanned image, then after a short moment the system should either display an
OCR output or inform the user OCR is needed (depending on implementation). E.g., check that
text becomes selectable or a message “Performing OCR…” appears. (If OCR is asynchronous, we
might test by uploading a known scanned PDF and see if eventually text appears in fields via AI
or at least a notification to user.)
4.
AI Auto-Extraction of Fields Test:
Given a PDF known to contain relevant data (we can use a sample study we know the numbers
for), when the extractor clicks “Auto-Extract” for that study, then the system should populate the
form fields with the AI’s suggestions.
Check correctness: e.g., Title field matches the actual title from PDF, sample size matches what’s in
the paper, etc. We expect high accuracy for straightforward fields.
Check formatting: e.g., Sex field should be one of {Male,Female} exactly (if the paper said “men
and women”, the AI or mapping should result in either “Mixed” or separate entries depending on
scheme; in any case should not output an unrecognized term).
Confidence and highlighting: all AI-filled fields should be visually distinct (highlighted yellow or
labeled as AI-derived).
68
5.
6.
7.
8.
9.
Also, intentionally test a field the model might be unsure about (like Illness Definition in a paper
that had none): the field should remain blank or say “Not reported” rather than a random guess.
Additionally, if the API key is missing or invalid, when user clicks Auto-Extract, then an error
message should inform them (so test by removing the API key config and triggering extraction –
expect a graceful error).
Manual Field Editing and Confirmation Test:
Given some fields have AI-filled values (yellow), when the user edits one (e.g., changes “5.0” to
“5.1”), then the field’s status should update (e.g., no longer marked as AI-pending; possibly turn
white or green indicating it’s now user-modified).
When the user marks a field or study as confirmed/done, then its status indicator should turn
green (for a field) or the study status becomes “Completed by Extractor.”
We will simulate an extractor verifying all fields: click confirm on each if required, or mark study
complete. After that, the Dashboard entry for that study should perhaps show a different icon
(like a check or color change to indicate done).
Also test that saving works: change a value, navigate away (to Dashboard) and back into the
study – the changed value should persist (autosave or saved on exit). This confirms no data loss.
Data Standardization Test:
For fields with controlled vocabularies, verify they only allow allowed options. For example:
Try to type an unsupported value in Sex field (if it’s a dropdown, you can’t, which is good; if it’s
text with auto-suggest, try “male” lowercase and see if it auto-corrects or at least stores as
“Male”).
If AI outputs “semi-professional” in Level of Play, check that the system either stored it as
“Amateur” or flagged it. (This is tricky to simulate exactly; perhaps we manually map one known
synonym as a test: feed the system an AI answer or direct input of “men” in Sex and see if on
saving it becomes “Male”). Essentially test a handful of synonyms mapping: “males” -> “Male”;
“Elite” vs “professional” -> unify to “Elite (Professional)” etc. Also test numeric formats: e.g., enter
“5,000” (with comma) in exposure – system might strip comma or not allow it. Or “5.0” vs “5” –
ensure it’s consistent (maybe stored as “5.0” if that’s how we decided to format floats). If the user
tries to leave a supposedly required field blank, ensure it can be blank (we might not enforce
required at UI, since not all fields apply to all studies, but ensure it's not crashing anything).
Reviewer Review and Edit Test:
Given a study marked as ready for review (extractor done), when a Reviewer user opens it, then
they should see all the extracted values. All fields might now be either locked for extractor and
editable for reviewer or just editable; anyway, the reviewer should be able to modify if needed.
Test that: the reviewer changes one or two values, e.g., corrects an incidence from 8.5 to 8.4, and
maybe adds a note “corrected rounding”. Save those changes. Then mark the study as Reviewed/
Completed. After marking reviewed, verify the study’s status on dashboard shows as completed
(green or labelled "Reviewed"). Also verify that now the extraction form perhaps is locked to
further editing (for extractors at least). Maybe log out and log in as extractor – ensure they
cannot edit a reviewed study (should be read-only if implemented). Additionally, if in the design
the reviewer is supposed to see differences from AI or from extractor suggestions, ensure any
flagged fields (red) got attention. If a field was flagged by extractor, verify that marking reviewed
automatically unflags it (assuming resolution). We should also test that the reviewer’s name is
recorded as having reviewed (perhaps by exporting or checking DB or UI element like “Reviewed
by Bob on date”).
69
10.
11.
12.
13.
14.
15.
16.
17.
18.
19.
20.
21.
22.
23.
Export Data Test (CSV):
After populating a few studies with test data, have an Admin or user click Export. Verify that a
CSV file downloads and that:
It contains a header row with all expected columns (compare to our list).
Each study’s data appears in one row under the correct columns. Specifically check a couple of
values from the UI against the CSV (e.g., sample size, total injuries, etc.) to ensure they are
placed correctly and formatted properly (no extra quotes except where needed, etc.).
Check that special characters (if any, e.g., author name with accent or an en-dash in CI) are
correctly represented (not garbled).
If a field was blank in UI, ensure it’s blank (i.e., ,, in CSV) and not some placeholder like "null".
If the export should exclude unreviewed studies by design, test that scenario: have one study still
in progress and others completed, export – verify whether the in-progress is included or not
based on spec (we decided probably include all or at least give option; if MVP default is all, then
okay). Also if any notes or provenance columns included, check they are present and populated
appropriately.
Security & Access Control Tests:
Ensure that a logged-in Extractor cannot access user management (if any) or admin functions.
For instance, try to use a REST endpoint that is admin-only (like account creation if exists) with
extractor credentials – should be rejected (maybe 403).
Ensure a Reviewer/Extractor cannot delete or alter another user’s data outside their purview (if
we had such restrictions; likely all can edit all studies in project, which is fine).
If we have role enforcement in UI (like only Admin sees “Export” or settings), verify that with non-
admin login those elements are hidden or disabled.
Try direct URL access to a study that is supposed to be restricted (in single-project it’s not
restricted by project, but if we had more roles maybe not applicable).
Also test session handling: e.g., log out and then try to access a study URL – should bounce to
login.
Passwords should not be logged or stored in plain text (this is internal to system, but an
acceptance check can be to inspect the database entries or use an Admin view to ensure they are
hashed).
Performance Basic Test:
◦
◦
◦
◦
Upload a relatively large PDF (~15MB, 100 pages) and measure how the app responds:
does it take long to load the PDF? (It might but should eventually load without crashing).
Try auto-extract on a larger text content to see if it times out. If the AI call might exceed
context or time, see if our system handles it (maybe splits text or returns error).
We don't need formal timing thresholds, but qualitatively ensure the UI doesn’t freeze
permanently. E.g., if auto-extract is working, maybe have a loading indicator and
eventually results. If it’s taking >60s, ensure at least the user knows it’s working.
We could simulate multiple users by opening two browsers (or two different logins) and
performing tasks to see if any concurrency issues (like both editing same study
concurrently). Possibly our design prevents that (only one should at a time or changes
override). But test scenario: Extractor A is editing when Reviewer opens the same study –
see what happens (should be either allowed and last save wins, or one gets locked out
gracefully).
70
24.
Edge Case Input Tests:
25.
◦
◦
◦
◦
◦
◦
Leave some optional fields blank and ensure export and UI handles that (blanks remain
blank, no “undefined”). E.g., Illness fields will be blank for many studies, that’s fine.
Put an extreme value: e.g., a very large number (2000000) in exposure, see it stores fine
and exports fine (no scientific notation weirdness).
If definitions fields allow long text, input a multi-line text (like copy a whole sentence).
Ensure it saves and exports (in CSV it should be quoted and on one line with newline
encoded).
Try fields with special characters: e.g., Title with a comma or quote. Ensure CSV escapes it
properly (should surround with quotes).
Try using the tool with a browser’s incognito or other – must require login each time (no
memory of session when closed).
If using Firestore or other, maybe simulate network offline and back – ensure no data
corruption (this is more of a robustness than acceptance test, but if using offline
persistence in Firestore, we could test that offline edits sync when online).
Compliance & Logging Tests:
◦
◦
◦
◦
Not all compliance aspects can be automatically tested, but we can do: perform a series
of actions (edit fields, etc.), then as admin query the audit logs (maybe via a db query or
log file) to see if entries exist for those actions. E.g., check that a log entry exists for the
reviewer marking study reviewed.
Check that storing an API key does not show it in plaintext in any client logs or network
calls (i.e., inspect browser dev tools to ensure key isn’t leaking in responses).
Verify that if a user tries to copy text from PDF and paste into a field, it works (especially
for definitions, one might copy definition text from PDF to our field).
Also ensure that when user logs out, their session is terminated and they need to login
again to access data (simulate by logging out and trying a protected route – should
redirect to login).
Each of these acceptance tests will be considered passed if the actual behavior matches the expected
behavior described. We will document any deviations and address them before finalizing the product.
This gives confidence that all functional requirements have been met and the tool performs reliably
under common usage scenarios.
19. Risks & Mitigations
Implementing an AI-assisted data extraction tool involves some uncertainties. We identify key risks,
their potential impact, and how we plan to mitigate them:
•
Risk: PDF Quality and Parsing Issues – Some PDFs might be scanned images or have unusual
formatting (two-column layouts, etc.), leading to incomplete or garbled text extraction. This could
cause the AI to miss data or the user to not find content.
Mitigation: We integrate an OCR fallback for scanned docs. For weird layouts, we will test the
PDF parsing on a variety of samples and consider using a robust parser or splitting by columns.
We allow users to see the PDF itself, so if AI misses something due to parse issues, the human
can still manually extract by reading the PDF. Additionally, if a particular paper is problematic,
the team can obtain a better copy (for instance, we can suggest using the publisher’s PDF
instead of a poor scan). We also include a note in the UI for extractors: “Verify all data with the
71
•
•
•
•
PDF, especially if the PDF text looks misaligned or incomplete.” This human oversight is our
safety net.
Risk: AI Model Limitations or Errors – The LLM might hallucinate values (make up numbers that
look plausible) or misinterpret context (like confusing injury incidence with injury count). It might also
struggle with unusual phrasing or tables.
Mitigation: We prompt the model to answer “not found” if unsure and keep humans in control
to verify. We highlight AI outputs so they are never accepted blindly. During the pilot phase, we
will evaluate the AI’s accuracy on a subset and adjust prompts. For example, if we notice
systematic errors (like always off by a factor of 10 in incidence due to percentage vs per 1000
confusion), we’ll explicitly clarify in prompts or post-process (maybe detect units). We also
instruct extractors and reviewers to be especially careful with AI-suggested numbers: cross-
check at least all critical values against the PDF. Over time, we can refine with those lessons. If
the AI proves unreliable for a certain field, we might turn off auto-fill for that field in future and
require manual entry (as an adjustment).
Risk: API Rate Limits or Downtime – The Gemini API or OCR API might have rate limits or could be
slow when multiple requests are made (e.g., auto-extract for 5 studies simultaneously) or might
experience downtime. This could slow down extraction or frustrate users if they have to wait.
Mitigation: We will implement basic rate limiting on our side: e.g., queue requests if a user
triggers many at once (though not likely with a small team). If the API returns an error or is
down, we catch it and show a user-friendly message: “AI service is currently unavailable, please
try again later.” The extractor can always proceed manually in that case. We’ll also log such
failures so we know if it’s frequent and possibly adjust usage or contact the provider.
Additionally, since each user has their own API key in our design, the usage is distributed – but if
it’s a common team key, we ensure it's a high-capacity one or manage usage carefully. For OCR,
we can also store OCR results so we don’t OCR the same page multiple times to avoid hitting
quotas.
Risk: Learning Curve and Misuse – Extractors might misuse or misunderstand the tool initially
(e.g., assume AI is always correct, or forget to fill certain fields). Being a new workflow, there’s a risk of
inconsistent usage.
Mitigation: We will include a short onboarding/training for users. Possibly a quick guide
document or even a demo session. The UI itself, via the definitions panel and tooltips, guides
correct usage. We use color cues to remind them what's verified vs not. The pilot itself is a
mitigation: by using the tool on a few studies initially (June 2025), the team will refine how they
use it and we’ll incorporate their feedback to make it more intuitive. For example, if we see users
forgetting to mark fields confirmed, we might tweak workflow such that marking study complete
auto-confirms all, etc. We also have the reviewer double-checking everything, which mitigates
any extractor mistakes or oversights in tool usage.
Risk: Timeline and Feature Creep – We have a lot of desired features (color coding, conflict
resolution, etc.). Trying to implement too much could delay delivery or introduce bugs.
Mitigation: We stick to the MVP scope for the pilot. We have clearly listed what's out-of-scope.
We will prioritize critical functionality first (upload, view PDF, extract data, export). Nice-to-haves
will only be done if time permits. By doing iterative sprints, we ensure a working core is ready
early, and additional features can be added incrementally. If something proves more difficult
than expected (e.g., live conflict resolution UI), we will defer it and find a simpler interim solution
(like manual highlighting of differences).
72
•
•
•
•
•
Risk: Data Loss or Save Failures – If autosave fails or there’s a bug in saving logic, users could lose
entered data (which is very demoralizing and time-wasting).
Mitigation: We will implement redundant save triggers (on field blur, on periodic interval, and
on navigating away ask “do you want to save?” if changes not saved). We’ll test those thoroughly
(see acceptance tests). Also, using a reliable DB (Firestore or Postgres with transactions) helps;
we ensure the front-end gets confirmation of save. Additionally, including an export function
means the team can frequently export the data as backup after a day’s work. The system itself
should also be backed up (Firebase has daily backups, or we can dump data periodically). We will
make sure to advise team to occasionally export a snapshot just in case, until confidence in
system is high.
Risk: Definitions Ambiguity and Incorrect Standardization – There’s a risk that an extractor
might misclassify something (e.g., mark "semi-professional league" as Elite when maybe the project
would consider it Amateur). Or they might not notice a study’s injury definition differs and assume
time-loss.
Mitigation: The presence of the Definitions panel and coded fields is a major mitigation – it
forces them to consciously choose a category. We’ll also hold a kickoff with extractors to clarify
these definitions. The Reviewer’s role includes catching such misclassifications. If a discrepancy
in interpretation arises (like one extractor coded something differently than another), the team
can discuss and we can update the definitions guidelines in the panel to clarify. Essentially,
communication and training plus the tool’s structure mitigate this risk. Also, the audit log can
flag if someone changes a definition field from default – that might alert if, say, someone picks
“All complaints” as injury definition for a study when most are time-loss, which the reviewer can
question.
Risk: Limited Testing on Various Data – The tool might perform well on typical studies but there
could be outlier cases (like a study that only reports incidence in a graph, not in text, or a study with
multiple sub-cohorts splitting data). The AI or even form might not handle multi-cohort easily.
Mitigation: For unusual data presentations, the tool might not auto-extract it, but the human
can still manually input aggregated numbers if possible. If a study truly doesn’t fit our extraction
schema (like it’s not fully compatible, e.g., it’s a combined men & women but we wanted separate
– the project might treat it specially or exclude it). We rely on the systematic review’s inclusion/
exclusion criteria to minimize such odd cases. If encountered, the team can adapt (maybe treat
two sub-cohorts as two entries or just note it qualitatively). The risk here is mostly completeness,
which is addressed by careful review: after all extractions, the team can cross-check each study’s
published results vs our data to ensure nothing major was missed (this is part of methodology
anyway). Our tool facilitates that by having a structured record to compare against the paper.
Risk: Ethical/Privacy Concern – Though minimal, storing data on cloud might raise some eyebrows
about data privacy or compliance.
Mitigation: As mentioned, this is published data, so it's not personal. But to be safe: all accounts
are internal, and the database will be access-restricted. We ensure compliance with data
management plan (the plan says data to be stored on FIFA’s SharePoint and OSF 32
eventually –
our tool will export to those). If required, we could deploy on a server under UCD or FIFA control.
But using reputable cloud services (Google) with strong security is generally fine. We also ensure
no sensitive personal data is included (the only personal-ish data could be author names in
citations, which is public info). So the risk is low. We'll document our security measures to
stakeholders to reassure them (like password hashing, limited access, etc.).
Risk: Team Adoption and Workflow Integration – The team might find the tool helpful or might
slip back to manual extraction if they encounter friction, especially if under time pressure.
73
Mitigation: Ensure the tool truly saves them time: we focus on the most time-consuming parts
(AI to extract numbers, standardized format). We’ll gather feedback in the pilot and quickly fix
any major pain points. By demonstrating in pilot that it improves speed, the team will be
motivated to adopt. We’ll also have an Admin (maybe a superuser from the team) monitor
progress via the dashboard to encourage consistent use. Proper training and demonstrating
successes (like “look, AI found these 10 values in seconds”) will mitigate the risk of non-use.
Essentially, user engagement is addressed by making it genuinely useful and easy.
In summary, while there are several potential risks, our strategy is to combine technology measures
(like double-checks, logs, error handling) with human oversight (reviews, training) to mitigate them. The
pilot phase itself is a mitigation, as it will expose any issues on a small scale, allowing course correction
45
before full-scale data extraction in July–August 2025 .
20. Open Questions
During the development of this PRD and the envisioned tool, a few decisions remain unsettled and
require input or clarification from stakeholders (project leads, end-users). We list these open questions
which should be resolved before or during implementation:
1.
Double Extraction or Single? – Should every study be extracted by two independent extractors
(blinded) with a formal reconciliation step, or is the plan to have one extractor and one verifier
(reviewer) per study? 6
Clarifying this will affect whether we need to implement the dual-entry
conflict comparison UI now or later. If double independent extraction is desired for all or a
subset, we should confirm how the assignment is done (will all studies be done by at least two
people or only a quality sample? The plan suggests double for subset as validation 26
).
2.
Extent of AI Usage Approval: Are stakeholders comfortable with the AI suggesting values for all
fields, including numeric outcomes? Or do they prefer AI only for textual fields and simple
counts, leaving critical outcome numbers to manual entry? While our design assumes AI for as
much as possible, we should confirm there's no objection (e.g., maybe they want incidence rates
manually verified anyway, then AI might be less needed there). Also, is Google’s Gemini 2.5 the
confirmed model to use, or should we consider alternatives (OpenAI, etc.) depending on
performance/cost? This might depend on budgeting for API calls and data governance (Gemini
being a Google product might be easier given likely Google Cloud integration).
3.
Data Schema Adjustments: The provided Excel is our blueprint. We should verify with the team
if any fields should be added/removed based on evolving project scope. For instance, Median
injury duration vs Median time-loss – are both needed or is that duplication? (The Excel had both;
is that a mistake or intentional?) Similarly, confirm if “Position – Attacker/Defender...” breakdown
is truly needed or can be dropped if most studies don’t report injuries by player position.
Removing unused fields could simplify the tool, but we don't want to omit something they
expect. So stakeholder input on each tab’s necessity would help tailor scope (especially those
breakdown categories that might rarely be filled).
4.
Output Format Details: The stakeholders should confirm the expected output format details:
do they strictly want the exact same column order and naming as the Excel for the final dataset?
(We assumed yes and planned accordingly.) Also, do they want separate CSVs per sheet or one
big CSV? We assumed one big CSV (with all fields). And should the first four tabs (auto-extracted
fields) perhaps be exportable separately at interim? Maybe not necessary, but if they plan to do
74
5.
6.
7.
8.
9.
10.
some analysis of just those initial fields early, we could enable partial export. Let's clarify if that’s
needed or if one final export at end is fine.
Provenance Documentation: What level of provenance documentation do they want to share
externally? The tool will log detailed info, but for the published review or OSF data, do they want
fields like “Extracted by” or “Page source” in the final dataset? This affects whether we include
those columns by default. They mentioned "alignment with definitions" and academically
defensible, but not necessarily that they'd publish who extracted each field. Likely not in journal,
but maybe on OSF. We should ask if they want an anonymized audit or none at all included in
outputs. We have it internally regardless.
User Account Management: Who will be the Admin managing user accounts? Likely one of the
project leads or a data manager. We should confirm the number of users and their roles. E.g.,
how many extractors vs reviewers? Are all PIs going to have reviewer access? This matters for
performance (not heavy) and for designing the assignment workflow. If it’s a small team,
perhaps formal assignment feature can be simpler. If many people, maybe needed to avoid
collisions. So confirm team size and roles distribution.
Handling of Multi-Population Studies: If a single paper reports results for, say, men and
women separately (but it's one paper), how do they want to capture that? Options: treat as one
study entry (with combined sample, etc., possibly losing some detail) or enter it twice (once for
each subgroup). The codebook doesn’t explicitly have fields for separate sexes in one study
entry. The plan did mention “studies that include both sexes will be included” and presumably
combined, but maybe they want to note somewhere if a study included both. We have "Sex:
Male/Female/Mixed" which covers that. If they need to extract separate rates for subgroups, our
schema might not directly accommodate it except as notes. Probably out-of-scope to fully handle
subgroups, but we should confirm approach to ensure our extraction captures what they need
(maybe they decided to focus on main overall outcomes per study only).
Updates and Maintenance: After initial data extraction (by Aug 2025), the living review will
continue with new studies beyond 2025. Do they envision continuing to use this tool for annual
updates? If so, we should plan for longevity (like making sure we can add new entries later, and
maybe a mechanism to import existing data for context or linking new to old). Also, if the Quality
Assessment tool (Phase 2) or Phase 3 analysis might be integrated, we should ask if they foresee
wanting the extraction tool to expand into those areas. Perhaps not now, but if yes, we might
design with extensibility (like leaving room for adding a Quality section later).
Hosting Preferences: Does the stakeholder (like UCD or FIFA) require the app to be hosted on a
particular server or under certain IT policies? Using Firebase/Google Cloud is likely fine, but if,
say, FIFA’s IT wants it on their infrastructure or behind a VPN, that could change approach. It's an
open question we should verify to avoid surprises in deployment. (Since project is unfunded and
likely using UCD resources, probably our approach is fine, but double-check if there's any
constraint about data not leaving EU etc., though with Google Cloud we can choose EU region).
FIFA SharePoint Integration: The plan says extracted data will be stored on FIFA’s SharePoint
and OSF 32
. Do they want our tool to automatically sync or push data to SharePoint/OSF, or will
that be a manual export and upload by the team? Likely manual is fine for MVP (they export CSV
and upload to OSF). Just confirming that we don't need any direct integration with those
platforms in this tool’s scope.
75
11.
Use of Rayyan’s Extraction vs AIDE: The team has started using Rayyan's new extraction?
Possibly not, since they’re asking for this custom tool (maybe because Rayyan’s isn't tailored for
this or they want more AI). It might be worth confirming they won't do extraction in Rayyan
(which they used for screening). Assuming not, but check if they want any data imported from
Rayyan, e.g., they might have labeled reasons for exclusion or some screening labels they'd like
to carry over into our system (less likely, we only care about included studies now).
12.
Sanctioning Manual Edits Post-Review: After a study is marked reviewed, what if an error is
found later? Should we allow reopening it? Perhaps Admin can do that. Clarify process: do they
want a "needs revision" status if reviewer finds issues for extractor to fix? Or will reviewer directly
fix everything? We assumed reviewer can directly edit. Confirm that’s acceptable (some
workflows require extractor to do changes to keep consistency, but given small team, probably
reviewer can just fix). If they want a formal back-and-forth, we might need a “send back” feature,
which is more complexity. So let's confirm their expected review flow.
13.
Mental Health Data Inclusion: The codebook has mental health outcomes, but is the plan
definitely to include mental health problems in the same review? If there's any chance they split
that off or decided to exclude mental health for now, we could simplify. The plan’s objectives do
mention mental health conditions 46
, so likely yes include. But double-check if we should fully
extract those or if they might treat them qualitatively. (We built fields anyway, but good to know
priority: if few studies report MH outcomes, maybe those fields are lower priority to implement
perfectly).
14.
Platform Choice for Implementation: We (development) lean towards Firebase. Does the
stakeholder’s IT have any concern or preference? If they've standardised on one or the other
(like maybe UCD has a preference to use Microsoft Azure services?), we should know. This likely
isn't an end-user question but a project oversight question.
Resolving these questions will ensure our implementation aligns exactly with user expectations and
project requirements. We will reach out to the project leads (e.g., Ben Clarsen, the principal investigator,
or Eamonn as local lead) for clarification on these points before final coding phases, so that the tool fits
smoothly into their workflow and needs.
21. Delivery Plan & Milestones
We propose an agile delivery approach with defined sprints and milestones to ensure the project is on
track for the needed timeline (pilot by June 2025, full extraction in July–Aug 2025 8 45
). Here is a high-
level sprint plan and milestone breakdown:
•
Sprint 0 (Initial Setup) – Duration: 1 week (Nov 2024)
Goal: Project setup, confirm requirements, and technical groundwork.
Tasks:
◦
◦
◦
◦
Finalize PRD sign-off with stakeholders (resolve open questions from Section 20).
Set up development environment (repository, choose Firebase vs others, etc.).
Create basic project structure (e.g., React app scaffolding, database instance creation).
Implement a simple "Hello World" that lists dummy studies from the DB to test the stack.
Milestone: Project Kickoff Complete – All stakeholders agree on scope; dev environment
ready; one test user can log in (even if hardcoded) and see a placeholder page.
76
•
•
•
Sprint 1 (Core Data Workflow) – Duration: 2 weeks
Goal: Implement the end-to-end flow for a basic extraction without AI, ensuring manual
functionality works.
Tasks:
◦
◦
◦
◦
◦
◦
◦
Implement user authentication (simple login page, user model, session handling).
Build Dashboard page listing studies (initially with dummy data or minimal fields).
Implement PDF upload functionality: allow file selection, store file (e.g., to Firebase
Storage or server directory), create study entry with meta (title/filename).
Implement study detail view with PDF renderer (using PDF.js or similar) and a basic form
for the first few fields (e.g., Title, Year, Sample Size as a test).
Autosave form data to DB.
Implement export of that data to CSV (even if just those fields for now).
Basic role handling: ensure only logged-in can access, etc. Milestone: Basic Manual
Extraction Pipeline – A user can log in, upload a PDF, manually enter a couple of data
points and save, and export them. No AI yet, but this proves the fundamental system (file
handling, data persistence, UI updates) works.
Sprint 2 (AI Integration & Full Schema) – Duration: 2 weeks
Goal: Expand the form to all fields and incorporate AI auto-extraction for key fields.
Tasks:
◦
◦
◦
◦
◦
◦
◦
◦
Define final schema in code (all extraction fields from Excel).
Build out the form UI sections for all these fields (with appropriate input types like
dropdowns for categorical fields, numeric inputs, etc.).
Implement the definitions panel (at least static content with definitions and guidelines).
Integrate the AI model: set up calls to Gemini API via a cloud function or server route.
Implement the “Auto-fill” button logic: gather PDF text (or relevant parts), send to API,
receive response, parse into field values.
Highlight AI-filled fields (yellow).
Implement basic error handling for AI (toast if fails).
Test on a couple of known papers to adjust prompts as needed. Milestone: AI-Assisted
Extraction Working – A user can click a button and see multiple fields populate from AI for
a sample study. The entire codebook fields are present in UI (though maybe not all auto-
filled by AI). The user can edit them and save. At this point, we could run a mini-pilot
internally on say 1–2 papers to see output.
Sprint 3 (Review & Quality Features) – Duration: 2 weeks
Goal: Implement review workflow and quality control elements (audit trail, flags, etc.).
Tasks:
◦
◦
◦
◦
◦
◦
Add “status” field for studies and UI indicators (Not started, In progress, Completed by
extractor, Reviewed).
Implement the “Mark as complete” for extractor and “Mark as reviewed” for reviewer.
Enforce role permissions: e.g., extractor can’t mark reviewed, etc.
Reviewer interface: allow editing fields and maybe mark changes (perhaps just editing is
fine).
If feasible, implement conflict resolution minimal: possibly allow two extracts and show
differences (or skip if doing single extraction for now; we decide based on Q1).
Add ability to flag fields (extractor can flag something uncertain – implement as a simple
checkbox or icon that turns field red and maybe requires reviewer attention).
77
•
◦
Implement audit logging of changes (maybe log to console or DB; if time, expose some in
◦
◦
UI for admin).
Add any remaining mapping rules (synonyms) needed for standardization after testing
from previous sprint.
Rigorously test autosave with multiple fields and edge cases. Milestone: Review Process
Implemented – Two users can use the system: one extracts, one reviews and finalizes. Data
changes by reviewer update the output. We have a clear way to identify reviewed vs not
reviewed data.
Sprint 4 (Pilot Testing & Feedback Iteration) – Duration: 1-2 weeks (maybe early Jun 2025)
Goal: Conduct pilot extraction on a subset of studies and refine the tool based on user feedback
and any discovered bugs or UI issues.
Tasks:
•
◦
◦
◦
◦
◦
Have actual extractors use the system for, say, 5 studies. Observe or collect issues.
Fix any critical bugs (e.g., a certain field not saving, or AI messing up a common pattern).
Tweak the UI for usability (maybe adjust layout, add a missing tooltip, etc., as per
feedback).
Improve prompt engineering if pilot reveals any consistent AI misinterpretation (fine-tune
as needed).
Ensure the CSV output aligns exactly with their master spreadsheet format (do a test
import of our CSV into their Excel to see if everything lines up). Milestone: Pilot Validated
– The tool is confirmed to capture data correctly and the team is comfortable using it. We
should have at least a small dataset output to double-check with manual ground truth
and it should pass.
Sprint 5 (Full Deployment Readiness) – Duration: 1 week (late June 2025)
Goal: Polish and prepare the system for full-scale use in July.
Tasks:
•
◦
◦
◦
◦
◦
◦
Implement any remaining minor features that were deferred but are easy wins (maybe a
search function on dashboard, or an image OCR improvement if needed, etc.).
Ensure all security measures are in place (review rules, remove any dev/test keys or data).
Write a short user manual or help notes for extractors (if not done already).
Set up regular backup of database (if using Firestore, ensure exports; if Postgres, ensure
backup schedule).
Performance check: if any optimization needed (but likely okay).
Finally, freeze changes aside from urgent fixes once team starts main extraction to avoid
disruptions. Milestone: Production Release (v1.0) – The system is fully ready for the team
to input all ~100 studies in July–Aug. All users have accounts created, and we provide
them with final instructions.
Maintenance & Update Sprints (Beyond v1.0):
If needed, we allocate some support during the extraction phase to quickly resolve any issues
that come up (likely done ad hoc). After initial extraction, we might have another sprint to
incorporate the Phase 2 QA tool or improvements for the living update process, but those are
future phases.
Milestone Summary:
•
•
M1: Requirements & Setup completed (PRD approved, environment ready).
M2: Basic flow working (upload -> manual data -> export).
78
•
•
•
•
M3: AI integration working on key fields.
M4: Review/Approve workflow in place.
M5: Pilot test done and tool refined.
M6: Full deployment ready by end of June 2025.
Each milestone will be reviewed with stakeholders to ensure acceptance before moving on. Specifically,
after Sprint 2 or 3, we should demo to the team so they can give early feedback (maybe an interactive
session where they try on one paper and see AI results – this could be valuable to adjust before official
pilot).
Finally, by adhering to this plan, we align deliverables with the project timeline: the team can do pilot
extraction in June, full extraction in July-Aug 2025 using the tool, leaving Sept-Oct for analysis as per
plan 45
. We'll remain available for any bug fixes during usage and then consider any extended features
(like continuing use for yearly updates or adding RoB tool) after initial launch.
1 22 23
Rayyan Data Extraction: From Manual to Fully Automated Insights – Rayyan Blog
https://blog.rayyan.ai/2025/08/25/rayyan-data-extraction-from-manual-to-fully-automated-insights/
2 3 4 5 6 8 14 26 31 32 33 34 35 36 37 38 39 40 41 42 43 44 45 46
FIFA GBI
Plan.docx
file://file-AwAVncrfzRRCJ3pm62Sx6d
7 12 17 18 19 28 29 30
Completing Data Extraction in Rayyan – Rayyan Blog
https://blog.rayyan.ai/2025/08/11/data-extraction-in-rayyan/
9 10 11 13 15 20 21 24 25 27
Covidence and Rayyan - PMC
https://pmc.ncbi.nlm.nih.gov/articles/PMC6148615/
16
Step 8: Data Extraction - Systematic Review - Subject Guides
https://libraryguides.binghamton.edu/c.php?g=1355723&p=10010046
79
