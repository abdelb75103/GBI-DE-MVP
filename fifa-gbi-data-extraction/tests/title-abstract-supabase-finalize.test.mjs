import assert from 'node:assert/strict';
import test from 'node:test';

import { finalizeTitleAbstractRecommendation } from '../../skills/fifa-title-abstract-screening-review/scripts/title_abstract_supabase_finalize.mjs';

class FakeSupabaseQuery {
  constructor(db, table) {
    this.db = db;
    this.table = table;
    this.filters = [];
    this.payload = null;
    this.operation = 'select';
  }

  select() {
    return this;
  }

  eq(column, value) {
    this.filters.push({ column, value });
    return this;
  }

  update(payload) {
    if (!this.db.updateHookCalled && this.db.beforeFirstUpdate) {
      this.db.updateHookCalled = true;
      this.db.beforeFirstUpdate(this.db.screening_records);
    }
    this.operation = 'update';
    this.payload = payload;
    return this;
  }

  insert(payload) {
    this.operation = 'insert';
    this.payload = payload;
    return this;
  }

  maybeSingle() {
    const record = this.findRecord();
    return Promise.resolve({ data: record ? structuredClone(record) : null, error: null });
  }

  single() {
    if (this.operation === 'insert') {
      const record = {
        id: `inserted-${this.db.screening_records.length + 1}`,
        ...this.payload,
      };
      this.db.screening_records.push(record);
      return Promise.resolve({ data: record, error: null });
    }

    if (this.operation === 'update') {
      const record = this.findRecord();
      if (!record) return Promise.resolve({ data: null, error: { message: 'not found' } });
      Object.assign(record, this.payload);
      return Promise.resolve({ data: record, error: null });
    }

    const record = this.findRecord();
    return Promise.resolve({ data: record ?? null, error: record ? null : { message: 'not found' } });
  }

  then(resolve, reject) {
    if (this.operation === 'update') {
      const record = this.findRecord();
      if (!record) return Promise.resolve({ data: null, error: { message: 'not found' } }).then(resolve, reject);
      Object.assign(record, this.payload);
      return Promise.resolve({ data: null, error: null }).then(resolve, reject);
    }
    return Promise.resolve({ data: null, error: null }).then(resolve, reject);
  }

  findRecord() {
    return this.db[this.table].find((record) =>
      this.filters.every(({ column, value }) => record[column] === value)
    );
  }
}

const fakeSupabase = (records, options = {}) => ({
  db: {
    screening_records: records,
    beforeFirstUpdate: options.beforeFirstUpdate ?? null,
    updateHookCalled: false,
  },
  from(table) {
    return new FakeSupabaseQuery(this.db, table);
  },
});

const humanVote = (decision) => ({
  reviewerProfileId: 'reviewer-1',
  reviewerName: 'Reviewer One',
  decision,
  decidedAt: '2026-06-03T12:00:00.000Z',
  action: 'reviewer_vote',
});

test('finalizeTitleAbstractRecommendation promotes AI-human include matches to full-text screening', async () => {
  const originalDecision = humanVote('include');
  const supabase = fakeSupabase([{
    id: 'title-abstract-1',
    stage: 'title_abstract',
    assigned_study_id: 'S001',
    title: 'Injury surveillance in football',
    abstract: 'A surveillance study.',
    lead_author: 'Smith',
    journal: 'Journal',
    year: '2026',
    doi: '10.1/example',
    normalized_doi: '10.1/example',
    source_label: 'second-search',
    source_record_id: 'source-1',
    ai_status: 'completed',
    ai_suggested_decision: 'include',
    manual_decided_by: 'reviewer-1',
    manual_decided_at: '2026-06-03T12:00:00.000Z',
    created_by: 'reviewer-1',
    updated_at: '2026-06-04T12:00:00.000Z',
    metadata: {
      titleAbstractDecisions: [originalDecision],
    },
  }]);

  const result = await finalizeTitleAbstractRecommendation(supabase, 'title-abstract-1', { quiet: true });

  const titleAbstractRecord = supabase.db.screening_records.find((record) => record.id === 'title-abstract-1');
  const fullTextRecord = supabase.db.screening_records.find((record) => record.stage === 'full_text');

  assert.equal(result.resolution, 'promoted_to_full_text');
  assert.equal(result.promoted, true);
  assert.equal(titleAbstractRecord.manual_decision, 'include');
  assert.equal(titleAbstractRecord.manual_decided_by, 'reviewer-1');
  assert.equal(titleAbstractRecord.manual_decided_at, originalDecision.decidedAt);
  assert.deepEqual(titleAbstractRecord.metadata.titleAbstractDecisions, [originalDecision]);
  assert.equal(titleAbstractRecord.metadata.titleAbstractResolution, 'ready_for_full_text');
  assert.equal(titleAbstractRecord.metadata.titleAbstractPromotedRecordId, fullTextRecord.id);
  assert.equal(fullTextRecord.assigned_study_id, 'S001');
  assert.equal(fullTextRecord.metadata.awaitingFullTextPdf, true);
  assert.equal(fullTextRecord.metadata.titleAbstractRecordId, 'title-abstract-1');
});

test('finalizeTitleAbstractRecommendation links an existing full-text placeholder for include matches', async () => {
  const supabase = fakeSupabase([
    {
      id: 'title-abstract-1',
      stage: 'title_abstract',
      assigned_study_id: 'S001',
      title: 'Injury surveillance in football',
      abstract: 'A surveillance study.',
      lead_author: 'Smith',
      journal: 'Journal',
      year: '2026',
      doi: '10.1/example',
      normalized_doi: '10.1/example',
      source_label: 'second-search',
      source_record_id: 'source-1',
      ai_status: 'completed',
      ai_suggested_decision: 'include',
      manual_decided_by: null,
      manual_decided_at: null,
      created_by: 'reviewer-1',
      updated_at: '2026-06-04T12:00:00.000Z',
      metadata: {
        titleAbstractDecisions: [humanVote('include')],
      },
    },
    {
      id: 'full-text-existing',
      stage: 'full_text',
      assigned_study_id: 'S001',
      title: 'Injury surveillance in football',
      metadata: {
        awaitingFullTextPdf: true,
      },
    },
  ]);

  const result = await finalizeTitleAbstractRecommendation(supabase, 'title-abstract-1', { quiet: true });

  const titleAbstractRecord = supabase.db.screening_records.find((record) => record.id === 'title-abstract-1');
  const fullTextRecords = supabase.db.screening_records.filter((record) => record.stage === 'full_text');

  assert.equal(result.resolution, 'promoted_to_full_text');
  assert.equal(result.promoted, false);
  assert.equal(result.fullTextRecordId, 'full-text-existing');
  assert.equal(fullTextRecords.length, 1);
  assert.equal(titleAbstractRecord.manual_decided_at, '2026-06-03T12:00:00.000Z');
  assert.equal(titleAbstractRecord.metadata.titleAbstractPromotedRecordId, 'full-text-existing');
});

test('finalizeTitleAbstractRecommendation refuses to overwrite a concurrently changed source record', async () => {
  const originalDecision = humanVote('include');
  const supabase = fakeSupabase([{
    id: 'title-abstract-1',
    stage: 'title_abstract',
    assigned_study_id: 'S001',
    title: 'Injury surveillance in football',
    abstract: 'A surveillance study.',
    lead_author: 'Smith',
    journal: 'Journal',
    year: '2026',
    doi: '10.1/example',
    normalized_doi: '10.1/example',
    source_label: 'second-search',
    source_record_id: 'source-1',
    ai_status: 'completed',
    ai_suggested_decision: 'include',
    manual_decided_by: 'reviewer-1',
    manual_decided_at: originalDecision.decidedAt,
    created_by: 'reviewer-1',
    updated_at: '2026-06-04T12:00:00.000Z',
    metadata: {
      titleAbstractDecisions: [originalDecision],
    },
  }], {
    beforeFirstUpdate(records) {
      records[0].updated_at = '2026-06-04T12:01:00.000Z';
      records[0].metadata = {
        ...records[0].metadata,
        concurrentMarker: true,
      };
    },
  });

  await assert.rejects(
    finalizeTitleAbstractRecommendation(supabase, 'title-abstract-1', { quiet: true }),
    /Failed to update S001 final title\/abstract resolution: not found/,
  );

  const titleAbstractRecord = supabase.db.screening_records.find((record) => record.id === 'title-abstract-1');
  assert.equal(titleAbstractRecord.metadata.concurrentMarker, true);
  assert.deepEqual(titleAbstractRecord.metadata.titleAbstractDecisions, [originalDecision]);
  assert.equal(supabase.db.screening_records.filter((record) => record.stage === 'full_text').length, 0);
});
