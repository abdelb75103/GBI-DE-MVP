import crypto from 'node:crypto';

import type {
  ExportJob,
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
};

type CreateNoteInput = {
  paperId: string;
  author: string;
  body: string;
};

const bootstrap = (): MockDatabase => ({
  papers: [],
  files: [],
  flags: [],
  notes: [],
  exports: [],
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
    name: 'injury-patterns.pdf',
    size: 1_024_000,
    mimeType: 'application/pdf',
  });

  mockDb.addNote({
    paperId: seeded.id,
    author: 'dev-user',
    body: 'Initial data seeded for demo purposes.',
  });
};
