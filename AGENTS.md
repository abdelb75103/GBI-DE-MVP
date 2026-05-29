## User Preference: Local Dev Servers

Do not kill, stop, or restart local dev servers unless Abdel explicitly asks for that in the current request. If a local verification step needs a fresh server and one is already running, use the existing server when possible or report the stale-server limitation instead of terminating it.

## User Preference: External Plugin Actions

For any external plugin or connector action where other people could see the result or be affected, do not perform the action unless Abdel has explicitly reviewed and approved the exact action in the current request.

This includes, but is not limited to, sending emails or messages, posting comments, editing shared documents, creating or modifying calendar invites, granting or changing permissions, submitting forms, publishing content, merging pull requests, or making changes in systems used by other people.

Before taking one of these actions, present what will be changed or sent, who can see it or who is affected, and the exact target account, file, thread, recipient, or permission. Proceed only after Abdel clearly confirms approval.

## User Preference: Commits

Do not create, amend, rewrite, or push commits unless Abdel explicitly asks for commit or push work in the current request. Code edits, file changes, and verification do not imply permission to commit.

## User Preference: Small Cosmetic Changes

For very small cosmetic changes, such as font color, copy, spacing, labels, or similarly low-risk visual tweaks, do not run extended verification or deployment checks unless Abdel explicitly asks for verification. Make the focused edit and report the changed files so Abdel can review manually.

## User Preference: Spreadsheet Editing

Do not automatically open Excel or spreadsheet files after every workbook change unless Abdel explicitly asks to open the file in the current request. Make the edit, run only the necessary checks, and report the changed files.

## User Preference: Spreadsheet Subtitles

Do not add explanatory sublines, subtitles, helper text, or instructional text inside spreadsheet sheets unless Abdel explicitly asks for them in the current request.

## User Preference: AI Screening and Extraction Models

Do not use Gemini for AI screening, AI extraction, AI review, or other project AI functions unless Abdel explicitly asks for Gemini in the current request.

Run project AI functions locally from the current workspace and apply results to the database from that local workflow. Default to GPT-5.5 with medium reasoning when available. If that exact model is unavailable, use the closest suitable local Codex/OpenAI terminal model with explicit reasoning, record the model used, and explain the substitution before applying results.
