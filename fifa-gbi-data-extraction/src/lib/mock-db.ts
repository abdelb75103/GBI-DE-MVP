import {
  createPaper,
  deletePaper,
  endPaperSession,
  getPaper,
  heartbeatPaperSession,
  listPapers,
  startPaperSession,
  toggleFlag,
  updatePaper,
} from '@/lib/db/papers';
import { attachFile, getFile, getStorageSignedUrl, uploadFileToStorage } from '@/lib/db/files';
import { addNote, deleteNote, listNotes } from '@/lib/db/notes';
import { createExport, getExport, listExports } from '@/lib/db/exports';
import {
  getExtraction,
  listExtractions,
  listPopulationGroups,
  listPopulationValues,
  saveExtractionFields,
  updateExtractionField,
} from '@/lib/db/extractions';
import { clearProfileGeminiKey, getProfileGeminiKey, hasProfileGeminiKey, setProfileGeminiKey } from '@/lib/db/profiles';
import { PaperSessionConflictError } from '@/lib/db/shared';
import { listPaperDuplicates, resolvePaperDuplicate, scanForDuplicates } from '@/lib/db/duplicates';
import {
  queueUpload,
  listUploadQueueEntries,
  getUploadQueueEntries,
  markUploadQueueApproved,
  markUploadQueueRejected,
  countPendingUploadQueueEntries,
} from '@/lib/db/upload-queue';

export { PaperSessionConflictError };

export const mockDb = {
  listPapers,
  getPaper,
  createPaper,
  updatePaper,
  deletePaper,
  toggleFlag,
  startPaperSession,
  heartbeatPaperSession,
  endPaperSession,

  getFile,
  attachFile,
  uploadFileToStorage,
  getStorageSignedUrl,

  listNotes,
  addNote,
  deleteNote,

  listExports,
  createExport,
  getExport,

  listExtractions,
  getExtraction,
  updateExtractionField,
  saveExtractionFields,
  listPopulationGroups,
  listPopulationValues,

  getProfileGeminiKey,
  setProfileGeminiKey,
  clearProfileGeminiKey,
  hasProfileGeminiKey,

  listPaperDuplicates,
  scanForDuplicates,
  resolvePaperDuplicate,

  queueUpload,
  listUploadQueueEntries,
  getUploadQueueEntries,
  markUploadQueueApproved,
  markUploadQueueRejected,
  countPendingUploadQueueEntries,
};
