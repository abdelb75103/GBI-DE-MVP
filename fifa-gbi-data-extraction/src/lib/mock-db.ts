import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import type {
  ExportJob,
  ExtractionFieldMetric,
  ExtractionFieldResult,
  ExtractionResult,
  ExtractionTab,
  Flag,
  MockDatabase,
  Note,
  Paper,
  PaperStatus,
  StoredFile,
} from '@/lib/types';

type CreatePaperInput = {
  title: string;
  leadAuthor?: string;
  year?: string;
  journal?: string;
  doi?: string;
  status?: PaperStatus;
};

type CreateFileInput = {
  paperId: string;
  name: string;
  size: number;
  mimeType: string;
  dataBase64?: string;
  publicPath?: string;
};

type CreateNoteInput = {
  paperId: string;
  author: string;
  body: string;
};

const samplePdfFilename = '2016Hgglundetal.BJSMInjuryrecurrencesplayinglevels.pdf';
const samplePdfPublicPath = `/${samplePdfFilename}`;

const bootstrap = (): MockDatabase => ({
  papers: [],
  files: [],
  flags: [],
  notes: [],
  exports: [],
  extractions: [],
});

const globalForDb = globalThis as unknown as { __mockDb?: MockDatabase };

const db: MockDatabase = globalForDb.__mockDb ?? bootstrap();

if (!globalForDb.__mockDb) {
  globalForDb.__mockDb = db;
}

const now = () => new Date().toISOString();

export const mockDb = {
  listPapers(): Paper[] {
    return db.papers.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  getFile(id: string): StoredFile | undefined {
    return db.files.find((file) => file.id === id);
  },

  getPaper(id: string): Paper | undefined {
    return db.papers.find((paper) => paper.id === id);
  },

  createPaper(input: CreatePaperInput): Paper {
    const paper: Paper = {
      id: crypto.randomUUID(),
      title: input.title,
      leadAuthor: input.leadAuthor,
      year: input.year,
      journal: input.journal,
      doi: input.doi,
      status: input.status ?? 'uploaded',
      createdAt: now(),
      updatedAt: now(),
      fileId: '',
      noteIds: [],
    };

    db.papers.push(paper);

    return paper;
  },

  updatePaper(id: string, updates: Partial<Omit<Paper, 'id' | 'createdAt'>>): Paper | undefined {
    const paper = this.getPaper(id);
    if (!paper) {
      return undefined;
    }

    Object.assign(paper, updates, { updatedAt: now() });

    return paper;
  },

  attachFile(input: CreateFileInput): StoredFile {
    const file: StoredFile = {
      id: crypto.randomUUID(),
      paperId: input.paperId,
      name: input.name,
      size: input.size,
      mimeType: input.mimeType,
      uploadedAt: now(),
      dataBase64: input.dataBase64,
      publicPath: input.publicPath,
    };

    db.files.push(file);

    const paper = this.getPaper(input.paperId);
    if (paper) {
      paper.fileId = file.id;
      paper.updatedAt = now();
    }

    return file;
  },

  toggleFlag(paperId: string, reason: string): Flag | undefined {
    const existing = db.flags.find((flag) => flag.paperId === paperId);

    if (existing) {
      db.flags = db.flags.filter((flag) => flag.id !== existing.id);
      const paper = this.getPaper(paperId);
      if (paper) {
        delete paper.flagId;
        paper.status = 'uploaded';
        paper.updatedAt = now();
      }
      return undefined;
    }

    const flag: Flag = {
      id: crypto.randomUUID(),
      paperId,
      reason,
      createdAt: now(),
    };

    db.flags.push(flag);

    const paper = this.getPaper(paperId);
    if (paper) {
      paper.flagId = flag.id;
      paper.status = 'flagged';
      paper.updatedAt = now();
    }

    return flag;
  },

  listNotes(paperId: string): Note[] {
    return db.notes.filter((note) => note.paperId === paperId);
  },

  addNote(input: CreateNoteInput): Note {
    const note: Note = {
      id: crypto.randomUUID(),
      paperId: input.paperId,
      author: input.author,
      body: input.body,
      createdAt: now(),
    };

    db.notes.push(note);

    const paper = this.getPaper(input.paperId);
    if (paper) {
      paper.noteIds.push(note.id);
      paper.updatedAt = now();
    }

    return note;
  },

  listExports(): ExportJob[] {
    return db.exports.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  createExport(kind: ExportJob['kind'], paperIds: string[], downloadUrl: string): ExportJob {
    const job: ExportJob = {
      id: crypto.randomUUID(),
      kind,
      paperIds,
      status: 'ready',
      createdAt: now(),
      downloadUrl,
      checksumSha256: crypto.createHash('sha256').update(downloadUrl).digest('hex'),
    };

    db.exports.push(job);

    return job;
  },

  listExtractions(paperId: string): ExtractionResult[] {
    return db.extractions.filter((extraction) => extraction.paperId === paperId);
  },

  getExtraction(paperId: string, tab: ExtractionTab): ExtractionResult | undefined {
    return db.extractions
      .filter((extraction) => extraction.paperId === paperId && extraction.tab === tab)
      .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  },

  upsertExtraction(input: Omit<ExtractionResult, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): ExtractionResult {
    const existingIndex = input.id
      ? db.extractions.findIndex((extraction) => extraction.id === input.id)
      : db.extractions.findIndex(
          (extraction) => extraction.paperId === input.paperId && extraction.tab === input.tab,
        );

    const extraction: ExtractionResult = {
      id: input.id ?? crypto.randomUUID(),
      paperId: input.paperId,
      tab: input.tab,
      model: input.model,
      fields: input.fields,
      notes: input.notes,
      createdAt: existingIndex >= 0 ? db.extractions[existingIndex].createdAt : now(),
      updatedAt: now(),
    };

    if (existingIndex >= 0) {
      db.extractions.splice(existingIndex, 1, extraction);
    } else {
      db.extractions.push(extraction);
    }

    const paper = this.getPaper(input.paperId);
    if (paper && paper.status !== 'extracted') {
      paper.status = 'extracted';
      paper.updatedAt = now();
    }

    return extraction;
  },

  updateExtractionField(
    paperId: string,
    tab: ExtractionTab,
    fieldId: string,
    updates: Partial<Omit<ExtractionFieldResult, 'fieldId' | 'updatedAt' | 'updatedBy'>> & {
      status?: ExtractionFieldResult['status'];
      updatedBy?: ExtractionFieldResult['updatedBy'];
      model?: string;
      metric?: ExtractionFieldMetric;
    },
  ): ExtractionResult {
    const extraction = this.getExtraction(paperId, tab);
    if (!extraction) {
      const newExtraction: ExtractionResult = {
        id: crypto.randomUUID(),
        paperId,
        tab,
        model: updates.model ?? 'human-input',
        fields: [],
        createdAt: now(),
        updatedAt: now(),
      };
      db.extractions.push(newExtraction);
      return this.updateExtractionField(paperId, tab, fieldId, updates);
    }

    const field =
      extraction.fields.find((item) => item.fieldId === fieldId) ??
      (() => {
        const emptyField: ExtractionFieldResult = {
          fieldId,
          value: null,
          confidence: null,
          sourceQuote: undefined,
          pageHint: undefined,
          metric: undefined,
          status: 'not_reported',
          updatedAt: now(),
          updatedBy: 'human',
        };
        extraction.fields.push(emptyField);
        return emptyField;
      })();

    const { status, updatedBy, model, metric, ...rest } = updates;

    if ('value' in rest) {
      field.value = rest.value ?? null;
    }
    if ('confidence' in rest) {
      field.confidence = rest.confidence ?? null;
    }
    if ('sourceQuote' in rest) {
      field.sourceQuote = rest.sourceQuote;
    }
    if ('pageHint' in rest) {
      field.pageHint = rest.pageHint;
    }
    if (metric !== undefined) {
      field.metric = metric;
    }

    const trimmedValue = typeof field.value === 'string' ? field.value.trim() : '';
    field.value = trimmedValue.length > 0 ? trimmedValue : null;

    const computedStatus = status ?? (field.value ? 'reported' : 'not_reported');
    field.status = computedStatus;
    field.updatedAt = now();
    field.updatedBy = updatedBy ?? 'human';

    extraction.updatedAt = now();
    extraction.model = model ?? (field.updatedBy === 'ai' ? 'ai-generated' : 'human-edited');

    return extraction;
  },
};

export const seedIfEmpty = () => {
  if (db.papers.length > 0) {
    return;
  }

  const seeded = mockDb.createPaper({
    title: 'Injury patterns among professional footballers',
    leadAuthor: 'Doe, J.',
    year: '2023',
    journal: 'Sports Medicine Journal',
    status: 'extracted',
  });

  mockDb.attachFile({
    paperId: seeded.id,
    name: samplePdfFilename,
    size: getSamplePdfSize(),
    mimeType: 'application/pdf',
    publicPath: samplePdfPublicPath,
  });

  mockDb.addNote({
    paperId: seeded.id,
    author: 'dev-user',
    body: 'Initial data seeded for demo purposes.',
  });

  mockDb.upsertExtraction({
    paperId: seeded.id,
    tab: 'studyDetails',
    model: 'seed-data',
    fields: [
      {
        fieldId: 'studyId',
        value: 'SEED-001',
        confidence: 0.95,
        status: 'reported',
        updatedAt: now(),
        pageHint: 'p. 1',
        sourceQuote: 'Example seed data',
        updatedBy: 'ai',
      },
      {
        fieldId: 'leadAuthor',
        value: 'Doe, J.',
        confidence: 0.9,
        status: 'reported',
        updatedAt: now(),
        pageHint: 'p. 1',
        sourceQuote: 'Example seed data',
        updatedBy: 'ai',
      },
      {
        fieldId: 'title',
        value: 'Injury patterns among professional footballers',
        confidence: 0.98,
        status: 'reported',
        updatedAt: now(),
        pageHint: 'p. 1',
        sourceQuote: 'Example seed data',
        updatedBy: 'ai',
      },
      {
        fieldId: 'yearOfPublication',
        value: '2023',
        confidence: 0.9,
        status: 'reported',
        updatedAt: now(),
        pageHint: 'p. 1',
        sourceQuote: 'Example seed data',
        updatedBy: 'ai',
      },
      {
        fieldId: 'journal',
        value: 'Sports Medicine Journal',
        confidence: 0.85,
        status: 'reported',
        updatedAt: now(),
        pageHint: 'p. 1',
        sourceQuote: 'Example seed data',
        updatedBy: 'ai',
      },
      {
        fieldId: 'doi',
        value: '10.1234/seed-doi',
        confidence: 0.6,
        status: 'uncertain',
        updatedAt: now(),
        pageHint: 'p. 2',
        sourceQuote: 'Example seed data',
        updatedBy: 'ai',
      },
      {
        fieldId: 'studyDesign',
        value: 'Prospective cohort',
        confidence: 0.8,
        status: 'reported',
        updatedAt: now(),
        pageHint: 'p. 2',
        sourceQuote: 'Example seed data',
        updatedBy: 'ai',
      },
    ],
  });
};

function getSamplePdfSize() {
  const candidateRoots = [
    process.cwd(),
    path.join(process.cwd(), 'fifa-gbi-data-extraction'),
  ];

  for (const root of candidateRoots) {
    try {
      const absolutePath = path.join(root, 'public', samplePdfFilename);
      if (!fs.existsSync(absolutePath)) {
        continue;
      }
      return fs.statSync(absolutePath).size;
    } catch {
      // continue to the next candidate root
    }
  }

  return 0;
}
