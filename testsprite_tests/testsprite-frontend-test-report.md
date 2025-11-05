# TestSprite AI Frontend Testing Report(MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** GBI-DE-MVP
- **Date:** 2025-11-05
- **Prepared by:** TestSprite AI Team
- **Test Type:** Frontend

---

## 2️⃣ Requirement Validation Summary

### Requirement: Paper Upload and File Management
- **Description:** System should support uploading PDF files (≤20MB) with metadata through the frontend interface.

#### Test TC001
- **Test Name:** Upload PDF file with valid size and metadata
- **Test Code:** [TC001_Upload_PDF_file_with_valid_size_and_metadata.py](./TC001_Upload_PDF_file_with_valid_size_and_metadata.py)
- **Test Error:** Stopped testing due to missing upload functionality on the 'Review uploads' page. Unable to proceed with PDF upload and metadata verification as required by the task.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/6026ba21-9964-49a8-ae49-7565b6b28af5/58b5fe62-0577-4431-89be-537218359815
- **Status:** ❌ Failed
- **Severity:** HIGH
- **Analysis / Findings:** The upload page does not have a functional file upload interface. The test could not locate or interact with file upload elements. Additionally, there are critical Next.js errors in the console: `cookies().get` is being used synchronously but needs to be awaited in Next.js 15+. This is causing server-side errors that prevent the dashboard from loading properly. The `/api/session/profile` endpoint is returning 500 errors, which blocks user authentication and profile selection needed for testing.

---

#### Test TC002
- **Test Name:** Reject PDF upload larger than 20MB
- **Test Code:** [TC002_Reject_PDF_upload_larger_than_20MB.py](./TC002_Reject_PDF_upload_larger_than_20MB.py)
- **Test Error:** The test to verify rejection of PDF files larger than 20MB could not be completed due to a client-side Runtime ChunkLoadError on the profile selection page, which blocked login and navigation to the upload page.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/6026ba21-9964-49a8-ae49-7565b6b28af5/20d1eb8a-9155-4c0e-bb32-c75e92860d47
- **Status:** ❌ Failed
- **Severity:** HIGH
- **Analysis / Findings:** A critical runtime error (`ERR_EMPTY_RESPONSE`) occurred when trying to load `/profiles/select/page.js`, preventing the profile selection page from loading. This is a Next.js chunk loading error that indicates either: (1) the build is incomplete or corrupted, (2) there's a routing issue, or (3) the file doesn't exist. This blocks all frontend testing that requires authentication/profile selection.

---

### Requirement: Duplicate Detection
- **Description:** System should detect duplicate papers by DOI and fuzzy title matching during upload.

#### Test TC003
- **Test Name:** Duplicate detection for exact DOI and normalized title/author/year
- **Test Code:** [TC003_Duplicate_detection_for_exact_DOI_and_normalized_titleauthoryear.py](./TC003_Duplicate_detection_for_exact_DOI_and_normalized_titleauthoryear.py)
- **Test Error:** Stopped testing due to inability to upload PDF files for duplicate detection testing. The system does not support file upload action in the current environment.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/6026ba21-9964-49a8-ae49-7565b6b28af5/4c3d2d48-ab9c-4290-a71f-1c646f1e6134
- **Status:** ❌ Failed
- **Severity:** HIGH
- **Analysis / Findings:** Cannot test duplicate detection functionality because file upload is not working. The same underlying issues (missing upload UI, chunk loading errors, session/profile errors) prevent this test from proceeding.

---

#### Test TC004
- **Test Name:** Fuzzy title matching duplicate detection threshold behaviors
- **Test Code:** [TC004_Fuzzy_title_matching_duplicate_detection_threshold_behaviors.py](./TC004_Fuzzy_title_matching_duplicate_detection_threshold_behaviors.py)
- **Test Error:** The system correctly blocks upload attempts when no file is selected, showing the message 'Select at least one PDF to upload.' However, due to limitations in the testing environment, I was unable to simulate file selection for uploading PDFs with different title similarity percentages.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/6026ba21-9964-49a8-ae49-7565b6b28af5/[test-id]
- **Status:** ❌ Failed
- **Severity:** HIGH
- **Analysis / Findings:** The upload validation (checking for file selection) works correctly, but the actual file upload functionality cannot be tested. The test environment limitations prevent file selection simulation. This suggests the file input element may not be properly configured for automated testing, or the upload component needs to be refactored to support programmatic file selection.

---

### Requirement: PDF Viewer Functionality
- **Description:** System should provide a functional PDF viewer with pagination, zoom, and search capabilities.

#### Test TC005
- **Test Name:** PDF viewer functionalities with pagination, zoom, and search
- **Test Code:** [TC005_PDF_viewer_functionalities_with_pagination_zoom_and_search.py](./TC005_PDF_viewer_functionalities_with_pagination_zoom_and_search.py)
- **Test Error:** The integrated PDF viewer in the Paper Workspace is currently not implemented or functional, as indicated by the 'PDF preview coming soon' placeholder.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/6026ba21-9964-49a8-ae49-7565b6b28af5/[test-id]
- **Status:** ❌ Failed
- **Severity:** HIGH
- **Analysis / Findings:** The PDF viewer is not implemented - only a placeholder message exists. This is a missing feature that needs to be developed. The PDF viewer is a core requirement for the MVP as users need to view papers while extracting data.

---

### Requirement: AI-Powered Extraction
- **Description:** System should provide AI-powered extraction that populates form fields with confidence scores and source quotes.

#### Test TC006
- **Test Name:** AI Auto-Extract fills form fields with confidence and source quotes
- **Test Code:** [TC006_AI_AutoExtract_fills_form_fields_with_confidence_and_source_quotes.py](./TC006_AI_AutoExtract_fills_form_fields_with_confidence_and_source_quotes.py)
- **Test Error:** The 'Auto-Extract' button to trigger AI-powered extraction is missing or not visible on the paper workspace page.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/6026ba21-9964-49a8-ae49-7565b6b28af5/[test-id]
- **Status:** ❌ Failed
- **Severity:** HIGH
- **Analysis / Findings:** The Auto-Extract button is missing from the UI. This is a critical feature for the MVP. The button should be visible and functional in the paper workspace to trigger AI extraction. This may be a UI implementation issue or the feature may not be fully implemented.

---

#### Test TC007
- **Test Name:** Manual field editing updates status and removes AI highlight
- **Test Code:** [TC007_Manual_field_editing_updates_status_and_removes_AI_highlight.py](./TC007_Manual_field_editing_updates_status_and_removes_AI_highlight.py)
- **Test Error:** Test stopped due to critical runtime JSON parsing error preventing save operation and field status update.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/6026ba21-9964-49a8-ae49-7565b6b28af5/[test-id]
- **Status:** ❌ Failed
- **Severity:** HIGH
- **Analysis / Findings:** There's a JSON parsing error when attempting to save field edits. This suggests the backend API is returning malformed JSON or the frontend is not properly handling the response. This prevents users from saving their manual edits to extraction fields, which is a critical workflow.

---

### Requirement: OCR Fallback
- **Description:** System should activate OCR for scanned PDFs without text layers.

#### Test TC008
- **Test Name:** OCR fallback activates correctly for scanned or image-only PDFs
- **Test Code:** [TC008_OCR_fallback_activates_correctly_for_scanned_or_imageonly_PDFs.py](./TC008_OCR_fallback_activates_correctly_for_scanned_or_imageonly_PDFs.py)
- **Test Error:** The task could not be fully completed because the file input element does not support direct text input for file upload, and no alternative file upload method was available.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/6026ba21-9964-49a8-ae49-7565b6b28af5/[test-id]
- **Status:** ❌ Failed
- **Severity:** MEDIUM
- **Analysis / Findings:** Cannot test OCR functionality because file upload is not working. The file input element configuration may need to be adjusted to support automated testing, or an alternative upload method needs to be provided.

---

### Requirement: Notes and Collaboration
- **Description:** System should support adding notes and flags at study and field levels.

#### Test TC009
- **Test Name:** Field-level notes and flagging functionalities
- **Test Code:** [TC009_Fieldlevel_notes_and_flagging_functionalities.py](./TC009_Fieldlevel_notes_and_flagging_functionalities.py)
- **Test Error:** Test cannot continue because the Paper Workspace page failed to load due to a client-side chunk load error.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/6026ba21-9964-49a8-ae49-7565b6b28af5/[test-id]
- **Status:** ❌ Failed
- **Severity:** MEDIUM
- **Analysis / Findings:** The Paper Workspace page is failing to load due to chunk loading errors. This is the same underlying issue affecting multiple tests - Next.js build/routing problems preventing pages from loading.

---

### Requirement: Role-Based Access Control
- **Description:** System should enforce role-based permissions for Extractor, Reviewer, and Admin roles.

#### Test TC010
- **Test Name:** Role-based permissions enforce access and actions
- **Test Code:** [TC010_Rolebased_permissions_enforce_access_and_actions.py](./TC010_Rolebased_permissions_enforce_access_and_actions.py)
- **Test Error:** The task cannot be fully completed due to a critical issue: inability to logout or switch user roles from the Admin dashboard.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/6026ba21-9964-49a8-ae49-7565b6b28af5/[test-id]
- **Status:** ❌ Failed
- **Severity:** HIGH
- **Analysis / Findings:** There's no logout functionality or role switching mechanism available in the UI. This prevents testing role-based permissions as the test cannot switch between different user roles. The logout feature needs to be implemented to support proper authentication testing.

---

### Requirement: Data Export
- **Description:** System should export data in CSV format with correct column order and formatting.

#### Test TC011
- **Test Name:** Export dataset as CSV with correct column order and data formatting
- **Test Code:** [TC011_Export_dataset_as_CSV_with_correct_column_order_and_data_formatting.py](./TC011_Export_dataset_as_CSV_with_correct_column_order_and_data_formatting.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/6026ba21-9964-49a8-ae49-7565b6b28af5/[test-id]
- **Status:** ✅ Passed
- **Severity:** HIGH
- **Analysis / Findings:** The CSV export functionality works correctly. The system successfully exports data in CSV format with proper column ordering and formatting. This is one of the few features that is working as expected.

---

### Requirement: Audit Logging
- **Description:** System should record all data changes with user identity, timestamps, and field changes.

#### Test TC012
- **Test Name:** Audit log records all data changes with details
- **Test Code:** [TC012_Audit_log_records_all_data_changes_with_details.py](./TC012_Audit_log_records_all_data_changes_with_details.py)
- **Test Error:** The application encountered a Runtime ChunkLoadError preventing the page from loading and blocking all interactions.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/6026ba21-9964-49a8-ae49-7565b6b28af5/[test-id]
- **Status:** ❌ Failed
- **Severity:** MEDIUM
- **Analysis / Findings:** Cannot test audit logging because pages are failing to load due to chunk loading errors. The underlying Next.js build/routing issues need to be resolved first.

---

### Requirement: Security and Authorization
- **Description:** System should prevent unauthorized access to protected endpoints and data.

#### Test TC013
- **Test Name:** Prevent unauthorized access to protected endpoints and data
- **Test Code:** [TC013_Prevent_unauthorized_access_to_protected_endpoints_and_data.py](./TC013_Prevent_unauthorized_access_to_protected_endpoints_and_data.py)
- **Test Error:** Testing stopped due to a critical runtime JSON parsing error encountered when saving a note as Extractor role.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/6026ba21-9964-49a8-ae49-7565b6b28af5/[test-id]
- **Status:** ❌ Failed
- **Severity:** HIGH
- **Analysis / Findings:** Partial success - unauthenticated API access was correctly denied, and Admin-only endpoints were inaccessible to Extractor role. However, a JSON parsing error when saving notes prevents full verification. The authorization checks appear to be working, but the JSON parsing issue needs to be fixed.

---

### Requirement: Autosave Functionality
- **Description:** System should automatically save user edits to prevent data loss.

#### Test TC014
- **Test Name:** Autosave mechanism preserves user edits on refresh or session loss
- **Test Code:** [TC014_Autosave_mechanism_preserves_user_edits_on_refresh_or_session_loss.py](./TC014_Autosave_mechanism_preserves_user_edits_on_refresh_or_session_loss.py)
- **Test Error:** Testing stopped due to critical runtime ChunkLoadError preventing access to extraction form fields.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/6026ba21-9964-49a8-ae49-7565b6b28af5/[test-id]
- **Status:** ❌ Failed
- **Severity:** MEDIUM
- **Analysis / Findings:** Cannot test autosave functionality because the extraction form cannot be accessed due to chunk loading errors.

---

### Requirement: Standardized Vocabulary
- **Description:** System should enforce standardized vocabularies and apply synonym mappings.

#### Test TC015
- **Test Name:** Standardized vocabulary enforcement for categorical fields with synonym mapping
- **Test Code:** [TC015_Standardized_vocabulary_enforcement_for_categorical_fields_with_synonym_mapping.py](./TC015_Standardized_vocabulary_enforcement_for_categorical_fields_with_synonym_mapping.py)
- **Test Error:** Testing stopped due to critical client-side error preventing page load and interaction.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/6026ba21-9964-49a8-ae49-7565b6b28af5/[test-id]
- **Status:** ❌ Failed
- **Severity:** MEDIUM
- **Analysis / Findings:** Cannot test vocabulary enforcement because pages are failing to load.

---

### Requirement: Review Workflow
- **Description:** System should allow Reviewers to lock studies and prevent Extractor edits after review.

#### Test TC016
- **Test Name:** Reviewer locks completed studies and changes status accordingly
- **Test Code:** [TC016_Reviewer_locks_completed_studies_and_changes_status_accordingly.py](./TC016_Reviewer_locks_completed_studies_and_changes_status_accordingly.py)
- **Test Error:** The study was successfully marked as 'Reviewed' by the Reviewer. However, when logging in as Extractor and attempting to edit the study, a client-side runtime error occurred due to malformed JSON response from the server during note save.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/6026ba21-9964-49a8-ae49-7565b6b28af5/[test-id]
- **Status:** ❌ Failed
- **Severity:** HIGH
- **Analysis / Findings:** Partial success - the Reviewer can mark studies as reviewed. However, the Extractor lock verification failed due to a JSON parsing error when saving notes. The review workflow appears to be partially working, but the JSON response issue needs to be fixed to fully verify the lock functionality.

---

### Requirement: Dashboard and Search
- **Description:** System should display studies with correct statuses and support filtering and searching.

#### Test TC017
- **Test Name:** Dashboard reflects study statuses and supports filtering and searching
- **Test Code:** [TC017_Dashboard_reflects_study_statuses_and_supports_filtering_and_searching.py](./TC017_Dashboard_reflects_study_statuses_and_supports_filtering_and_searching.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/6026ba21-9964-49a8-ae49-7565b6b28af5/[test-id]
- **Status:** ✅ Passed
- **Severity:** MEDIUM
- **Analysis / Findings:** The dashboard functionality works correctly. Studies are displayed with correct statuses, and filtering and search functionality work as expected. This is a core feature that is functioning properly.

---

### Requirement: Session Management
- **Description:** System should prevent concurrent editing conflicts through session management.

#### Test TC018
- **Test Name:** Session management prevents simultaneous conflicting edits
- **Test Code:** [TC018_Session_management_prevents_simultaneous_conflicting_edits.py](./TC018_Session_management_prevents_simultaneous_conflicting_edits.py)
- **Test Error:** Testing stopped due to critical issue: Logout page shows 404 error and no login options, preventing simulation of User B session.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/6026ba21-9964-49a8-ae49-7565b6b28af5/[test-id]
- **Status:** ❌ Failed
- **Severity:** HIGH
- **Analysis / Findings:** Cannot test session management/concurrency control because logout functionality is missing or broken (404 error). The test needs to be able to switch between users to verify that concurrent editing is prevented.

---

### Requirement: Definitions Panel
- **Description:** System should display IOC consensus and OSIICS classification references.

#### Test TC019
- **Test Name:** Definitions panel displays IOC consensus and OSIICS classification references
- **Test Code:** [TC019_Definitions_panel_displays_IOC_consensus_and_OSIICS_classification_references.py](./TC019_Definitions_panel_displays_IOC_consensus_and_OSIICS_classification_references.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/6026ba21-9964-49a8-ae49-7565b6b28af5/[test-id]
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** The definitions panel works correctly and displays IOC consensus definitions and OSIICS classification references as expected. This is a helpful reference feature that is functioning properly.

---

## 3️⃣ Coverage & Matching Metrics

- **15.79%** of tests passed (3 out of 19 tests)

| Requirement | Total Tests | ✅ Passed | ❌ Failed |
|-------------|-------------|-----------|-----------|
| Paper Upload and File Management | 2 | 0 | 2 |
| Duplicate Detection | 2 | 0 | 2 |
| PDF Viewer Functionality | 1 | 0 | 1 |
| AI-Powered Extraction | 2 | 0 | 2 |
| OCR Fallback | 1 | 0 | 1 |
| Notes and Collaboration | 1 | 0 | 1 |
| Role-Based Access Control | 1 | 0 | 1 |
| Data Export | 1 | 1 | 0 |
| Audit Logging | 1 | 0 | 1 |
| Security and Authorization | 1 | 0 | 1 |
| Autosave Functionality | 1 | 0 | 1 |
| Standardized Vocabulary | 1 | 0 | 1 |
| Review Workflow | 1 | 0 | 1 |
| Dashboard and Search | 1 | 1 | 0 |
| Session Management | 1 | 0 | 1 |
| Definitions Panel | 1 | 1 | 0 |

---

## 4️⃣ Key Gaps / Risks

### Critical Issues (Must Fix Immediately)

1. **Next.js Async Cookies Error:** The application is using `cookies().get()` synchronously, but Next.js 15+ requires it to be awaited. This is causing server-side errors in routes like `/dashboard` and `/api/session/profile`, preventing the application from loading properly. **Fix:** Update all `cookies().get()` calls to use `await cookies().get()` or use `React.use()` for cookies in server components.

2. **Runtime ChunkLoadError:** Multiple pages are failing to load with `ERR_EMPTY_RESPONSE` errors, particularly affecting `/profiles/select/page.js` and the Paper Workspace. This indicates either: (1) incomplete/corrupted Next.js build, (2) missing route files, or (3) routing configuration issues. **Fix:** Rebuild the Next.js application and verify all routes exist and are properly configured.

3. **Missing File Upload Functionality:** The upload page does not have a functional file upload interface that can be interacted with. The file input element may not be properly configured or the upload component needs to be implemented. **Fix:** Implement or fix the file upload component to support both user interaction and automated testing.

4. **Missing Auto-Extract Button:** The AI extraction button is not visible or not implemented in the Paper Workspace. This is a core MVP feature. **Fix:** Implement the Auto-Extract button in the UI and connect it to the extraction API.

5. **JSON Parsing Errors:** Multiple endpoints are returning malformed JSON responses, particularly when saving notes and field edits. This prevents users from saving their work. **Fix:** Debug and fix the backend API responses to ensure valid JSON is returned, and add proper error handling in the frontend.

6. **Missing Logout Functionality:** There's no logout feature or the logout page returns 404, preventing role switching and proper authentication testing. **Fix:** Implement logout functionality and ensure the logout route is properly configured.

### High Priority Issues

7. **PDF Viewer Not Implemented:** The PDF viewer is only showing a placeholder message. This is a critical feature for the MVP as users need to view papers while extracting data. **Fix:** Implement the PDF viewer with pagination, zoom, and search functionality.

8. **Review Workflow Partially Broken:** While Reviewers can mark studies as reviewed, the verification of locks fails due to JSON parsing errors. **Fix:** Fix the JSON parsing issue and ensure the lock mechanism works correctly.

9. **Session/Profile API Errors:** The `/api/session/profile` endpoint is returning 500 errors, blocking authentication and profile selection. **Fix:** Debug and fix the session/profile API endpoint.

### Medium Priority Issues

10. **File Upload Testing Limitations:** The file input element configuration may not support automated testing. Consider adding alternative upload methods or adjusting the file input to be more test-friendly.

11. **Multiple Pages Failing to Load:** Many features cannot be tested because pages are failing to load due to chunk errors. Fixing the Next.js build issues should resolve most of these.

### Working Features

- **CSV Export (TC011):** ✅ Working correctly
- **Dashboard Filtering and Search (TC017):** ✅ Working correctly  
- **Definitions Panel (TC019):** ✅ Working correctly

### Recommendations

1. **Immediate Actions:**
   - Fix the async cookies issue by updating all cookie access to use `await`
   - Rebuild the Next.js application to resolve chunk loading errors
   - Implement missing file upload functionality
   - Add the Auto-Extract button to the UI
   - Fix JSON parsing errors in API responses
   - Implement logout functionality

2. **Next Steps:**
   - Implement PDF viewer functionality
   - Fix session/profile API endpoint
   - Debug and fix all JSON response issues
   - Verify file upload works with automated testing tools
   - Test role switching and session management

3. **Testing Considerations:**
   - Many tests are failing due to infrastructure issues (chunk loading, cookies) rather than feature logic
   - Once infrastructure issues are fixed, many tests should be able to proceed further
   - Consider adding more robust error handling and loading states to improve user experience

---

**Overall Assessment:** The frontend has a very low pass rate (15.79%) primarily due to critical infrastructure issues:
- Next.js async cookies error preventing pages from loading
- Runtime chunk loading errors blocking navigation
- Missing core features (file upload, PDF viewer, Auto-Extract button)
- JSON parsing errors preventing data saving

The few features that are working (export, dashboard, definitions panel) suggest the application foundation is solid, but critical infrastructure fixes are needed before most functionality can be properly tested. Priority should be given to fixing the Next.js async cookies issue and rebuilding the application to resolve chunk loading errors, as these are blocking most other functionality.

