# TestSprite AI Testing Report(MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** GBI-DE-MVP
- **Date:** 2025-11-05
- **Prepared by:** TestSprite AI Team

---

## 2️⃣ Requirement Validation Summary

### Requirement: Paper Upload and File Management
- **Description:** System should support uploading PDF files (≤20MB) with metadata and validate file size limits.

#### Test TC001
- **Test Name:** upload_pdf_file_with_metadata
- **Test Code:** [TC001_upload_pdf_file_with_metadata.py](./TC001_upload_pdf_file_with_metadata.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/9377c4a9-8b45-49c7-bac3-b1b4d2229af4/d969f5ab-bf5d-4703-a841-9c451e35414a
- **Status:** ✅ Passed
- **Severity:** HIGH
- **Analysis / Findings:** Upload functionality works correctly for valid PDF files within size limits. Paper records are created successfully with metadata (title, author, year, journal, DOI). The API correctly handles multipart form data and returns appropriate 201 status codes. This is a core functionality that is working as expected.

---

#### Test TC002
- **Test Name:** reject_pdf_upload_exceeding_size_limit
- **Test Code:** [TC002_reject_pdf_upload_exceeding_size_limit.py](./TC002_reject_pdf_upload_exceeding_size_limit.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 55, in <module>
  File "<string>", line 34, in test_reject_pdf_upload_exceeding_size_limit
AssertionError: Expected HTTP 400 for oversized PDF upload but got 500.

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/9377c4a9-8b45-49c7-bac3-b1b4d2229af4/3164a0b7-3bc0-4944-9f1d-5c46c90e8a16
- **Status:** ❌ Failed
- **Severity:** HIGH
- **Analysis / Findings:** The file size validation is still failing, returning a 500 Internal Server Error instead of the expected 400 Bad Request. This indicates that either: (1) the Next.js body size limit configuration is rejecting the request before it reaches the application handler, (2) the application's file size check is throwing an unhandled exception, or (3) there's a proxy/gateway issue. The error handling needs to be improved to catch this case and return a user-friendly 400 error message indicating the file exceeds the 20MB limit.

---

### Requirement: Paper Listing and Search
- **Description:** System should support listing papers with filtering and search capabilities.

#### Test TC003
- **Test Name:** list_all_papers_with_filters
- **Test Code:** [TC003_list_all_papers_with_filters.py](./TC003_list_all_papers_with_filters.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/9377c4a9-8b45-49c7-bac3-b1b4d2229af4/a4549b3f-ebb9-4a77-9e72-9dad000881cc
- **Status:** ✅ Passed
- **Severity:** MEDIUM
- **Analysis / Findings:** The paper listing and filtering functionality is now working correctly. The API successfully returns filtered results based on search criteria. This represents an improvement from previous test runs, indicating that search/filter functionality has been fixed or is working as expected in the current implementation.

---

### Requirement: Paper CRUD Operations
- **Description:** System should support creating, reading, and updating paper records with proper validation.

#### Test TC004
- **Test Name:** create_new_paper_with_required_fields
- **Test Code:** [TC004_create_new_paper_with_required_fields.py](./TC004_create_new_paper_with_required_fields.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/9377c4a9-8b45-49c7-bac3-b1b4d2229af4/1aa9cd39-2329-4306-be8e-d7a0d324b7ff
- **Status:** ✅ Passed
- **Severity:** HIGH
- **Analysis / Findings:** Paper creation works correctly with required fields. The API properly validates that title is required and rejects requests without it. Optional fields (leadAuthor, year, journal, DOI) are handled appropriately. The endpoint returns 201 Created status with the newly created paper object.

---

#### Test TC005
- **Test Name:** get_paper_by_id
- **Test Code:** [TC005_get_paper_by_id.py](./TC005_get_paper_by_id.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 64, in <module>
  File "<string>", line 50, in test_get_paper_by_id
AssertionError: Expected field 'id' missing in paper details

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/9377c4a9-8b45-49c7-bac3-b1b4d2229af4/11fb908c-35b6-490b-861a-9f6a1c54ebf7
- **Status:** ❌ Failed
- **Severity:** HIGH
- **Analysis / Findings:** The GET /api/papers/[paperId] endpoint is returning paper data but missing the 'id' field in the response. This is a data structure issue where the response object doesn't include the paper ID, which is critical for API consumers to identify the resource. The response should include all paper fields including the ID. This may be due to how the mock database returns data or how the response is serialized.

---

#### Test TC006
- **Test Name:** update_paper_metadata
- **Test Code:** [TC006_update_paper_metadata.py](./TC006_update_paper_metadata.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 64, in <module>
  File "<string>", line 52, in test_update_paper_metadata
AssertionError: Paper title not updated correctly: expected Updated Title, got None

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/9377c4a9-8b45-49c7-bac3-b1b4d2229af4/5c9a2734-2b6c-48f1-9eb7-984f5c2054aa
- **Status:** ❌ Failed
- **Severity:** HIGH
- **Analysis / Findings:** The PATCH /api/papers/[paperId] endpoint is not correctly updating paper metadata. When updating the title field, the response shows the title as None instead of the updated value. This suggests that either: (1) the update operation is not persisting changes correctly in the mock database, (2) the response is not returning the updated paper object, or (3) there's a field mapping issue. This is a critical functionality bug that prevents users from updating paper information.

---

### Requirement: AI-Powered Data Extraction
- **Description:** System should support AI-powered extraction of data from PDF papers using Google Gemini API.

#### Test TC007
- **Test Name:** ai_extract_data_from_paper
- **Test Code:** [TC007_ai_extract_data_from_paper.py](./TC007_ai_extract_data_from_paper.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 96, in <module>
  File "<string>", line 77, in test_ai_extract_data_from_paper
AssertionError

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/9377c4a9-8b45-49c7-bac3-b1b4d2229af4/777e9bb2-6e81-4d8c-a89d-6b2a31121064
- **Status:** ❌ Failed
- **Severity:** HIGH
- **Analysis / Findings:** The AI extraction endpoint is failing with an assertion error. The test is checking for successful extraction results, but the assertion is failing. This could be due to: (1) the AI extraction not returning expected data structure, (2) missing or invalid API key preventing extraction, (3) the extraction process timing out or erroring, or (4) the response format not matching expected schema. The AI extraction is a core feature and needs to be working correctly for the MVP.

---

### Requirement: Extraction Field Updates
- **Description:** System should support updating extraction field values, status, confidence, and metadata.

#### Test TC008
- **Test Name:** update_extraction_field_value_and_metadata
- **Test Code:** [TC008_update_extraction_field_value_and_metadata.py](./TC008_update_extraction_field_value_and_metadata.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 87, in <module>
  File "<string>", line 77, in test_update_extraction_field_value_and_metadata
AssertionError: Expected 404 for non-existent paperId, got 500

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/9377c4a9-8b45-49c7-bac3-b1b4d2229af4/bd4e9b7d-130b-427b-9eb8-08714b1018ed
- **Status:** ❌ Failed
- **Severity:** HIGH
- **Analysis / Findings:** The extraction field update endpoint is still returning 500 Internal Server Error instead of 404 Not Found when attempting to update a field for a non-existent paper. This is an error handling issue - the endpoint should check if the paper exists first and return a proper 404 response with an error message. The current behavior leaks internal error information and doesn't follow REST API conventions.

---

### Requirement: Extraction Results Persistence
- **Description:** System should support saving extraction results after AI extraction or manual editing.

#### Test TC009
- **Test Name:** save_extraction_results_for_paper
- **Test Code:** [TC009_save_extraction_results_for_paper.py](./TC009_save_extraction_results_for_paper.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 115, in <module>
  File "<string>", line 56, in test_save_extraction_results_for_paper
AssertionError: Valid save failed: {"error":"Select a profile before saving changes."}

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/9377c4a9-8b45-49c7-bac3-b1b4d2229af4/9c585b9a-d59c-4879-a375-b670d95d0aa3
- **Status:** ❌ Failed
- **Severity:** MEDIUM
- **Analysis / Findings:** The save extraction endpoint requires an active profile to be set in the session. The test is failing because no profile is selected before attempting to save. This is actually correct behavior from a security/authentication perspective, but the test needs to set up the profile session first. However, this reveals that the profile/session management system needs to be properly initialized or the test setup needs to include profile creation and session activation. For MVP, this might need to be documented or the test adjusted to include the prerequisite setup steps.

---

### Requirement: Paper Notes and Collaboration
- **Description:** System should support adding and retrieving notes for papers to enable collaboration.

#### Test TC010
- **Test Name:** add_and_retrieve_notes_for_paper
- **Test Code:** [TC010_add_and_retrieve_notes_for_paper.py](./TC010_add_and_retrieve_notes_for_paper.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 107, in <module>
  File "<string>", line 61, in test_add_and_retrieve_notes_for_paper
AssertionError: Expected 201 on note creation, got 500

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/9377c4a9-8b45-49c7-bac3-b1b4d2229af4/d4fd53d5-91a1-4e0b-aecd-4b30dbb3c15a
- **Status:** ❌ Failed
- **Severity:** MEDIUM
- **Analysis / Findings:** The notes creation endpoint is returning a 500 Internal Server Error instead of the expected 201 Created status. This suggests there's an unhandled exception in the POST /api/papers/[paperId]/notes endpoint. Possible causes include: (1) database/persistence error when saving the note, (2) validation error that's not being caught properly, (3) missing required fields or incorrect data format, or (4) an issue with the mock database implementation for notes. This needs to be debugged to identify the root cause.

---

## 3️⃣ Coverage & Matching Metrics

- **30.00%** of tests passed (3 out of 10 tests)

| Requirement | Total Tests | ✅ Passed | ❌ Failed |
|-------------|-------------|-----------|-----------|
| Paper Upload and File Management | 2 | 1 | 1 |
| Paper Listing and Search | 1 | 1 | 0 |
| Paper CRUD Operations | 3 | 1 | 2 |
| AI-Powered Data Extraction | 1 | 0 | 1 |
| Extraction Field Updates | 1 | 0 | 1 |
| Extraction Results Persistence | 1 | 0 | 1 |
| Paper Notes and Collaboration | 1 | 0 | 1 |

---

## 4️⃣ Key Gaps / Risks

### Critical Issues (Must Fix)

1. **Paper Update Functionality Broken:** The PATCH endpoint for updating papers is not persisting changes correctly. When updating paper metadata (like title), the response shows None values instead of the updated data. This is a critical bug that prevents users from editing paper information.

2. **Error Handling Inconsistencies:** Multiple endpoints (PUT /api/extract/field, POST /api/papers/[paperId]/notes) are returning 500 Internal Server Error instead of appropriate 4xx status codes (400, 404) when handling invalid requests or missing resources. This violates REST API best practices and makes debugging difficult.

3. **Missing Response Fields:** The GET /api/papers/[paperId] endpoint is not including the 'id' field in the response, which is essential for API consumers. This is a data structure/serialization issue.

4. **File Size Validation:** The file size limit validation is still failing at the proxy/application level, returning 500 instead of 400. This needs to be caught and handled gracefully with a user-friendly error message.

### High Priority Issues

5. **AI Extraction Not Working:** The AI extraction endpoint is failing assertions, indicating the extraction process is not completing successfully or returning data in the expected format. This is a core feature that needs to work for the MVP.

6. **Profile/Session Requirements:** The save extraction endpoint requires profile setup, which is correct behavior but needs proper test setup or documentation. The profile management system needs to be properly initialized for authenticated operations.

7. **Notes Functionality Broken:** The notes creation endpoint is returning 500 errors, preventing collaboration features from working. This needs debugging to identify the root cause.

### Improvements Noted

- **Search/Filter Fixed:** The paper listing and filtering functionality (TC003) is now working correctly, representing an improvement from previous test runs.

### Recommendations

1. **Fix Paper Update Logic:** Review the PATCH /api/papers/[paperId] endpoint implementation to ensure:
   - Updates are properly persisted in the database
   - The response includes the updated paper object with all fields
   - Field mapping is correct

2. **Implement Comprehensive Error Handling:** Add try-catch blocks and proper error handling across all API routes. Ensure all endpoints return appropriate HTTP status codes:
   - 400 for invalid requests/validation errors
   - 404 for not found resources
   - 500 only for unexpected server errors (with proper logging)

3. **Fix Response Serialization:** Ensure GET /api/papers/[paperId] includes all required fields including the 'id' field in the response.

4. **Improve File Size Validation:** Configure Next.js body size limits or implement proper error handling to catch oversized files and return 400 with a clear message.

5. **Debug AI Extraction:** Investigate why the AI extraction is failing:
   - Check API key configuration
   - Verify response format matches expected schema
   - Add proper error handling and logging
   - Ensure extraction service is properly initialized

6. **Fix Notes Endpoint:** Debug the POST /api/papers/[paperId]/notes endpoint to identify why it's returning 500 errors. Check:
   - Database/persistence implementation
   - Request validation
   - Data format requirements

7. **Document Session Requirements:** If profile/session is required for certain operations, ensure this is documented and test setup includes proper initialization.

### Test Coverage Gaps

The following features from the frontend test plan were not tested in this backend test run:
- PDF viewer functionality
- UI interactions and visual feedback
- Role-based access control
- Export functionality
- Audit logging
- OCR fallback
- Duplicate detection
- Session/concurrency control

These should be tested separately or in frontend test runs.

---

**Overall Assessment:** The test pass rate has improved to 30% (from 20% in previous runs), with search/filtering now working correctly. However, critical issues remain with paper updates, error handling, and several core features (AI extraction, notes). The core upload and paper creation functionality works, but substantial work is needed to make the API robust and production-ready. Priority should be given to fixing the paper update bug and improving error handling across all endpoints.
