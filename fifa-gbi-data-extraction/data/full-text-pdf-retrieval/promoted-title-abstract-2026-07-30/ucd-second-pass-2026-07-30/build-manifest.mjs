import fs from 'node:fs';
import path from 'node:path';

const repositoryRoot = '/Users/abdelbabiker/Desktop/GBI-DE-MVP-main';
const baseDirectory = path.join(
  repositoryRoot,
  'fifa-gbi-data-extraction/data/full-text-pdf-retrieval/promoted-title-abstract-2026-07-30',
);
const secondPassDirectory = path.join(baseDirectory, 'ucd-second-pass-2026-07-30');
const filesDirectory = path.join(secondPassDirectory, 'files');
const baseManifestPath = path.join(
  baseDirectory,
  'final-manifest-2026-07-30T13-53-05-437Z.json',
);
const outputPath = path.join(secondPassDirectory, 'retrieval-manifest.json');

const base = JSON.parse(fs.readFileSync(baseManifestPath, 'utf8'));

const accepted = {
  S925: {
    sourceUrl:
      'https://thejns.org/focus/downloadpdf/view/journals/neurosurg-focus/57/1/article-pE3.pdf',
    sha256: '01e33240cb9a3aab32e13b713d852b6bee9cc5b5fdc1dd90418e3c1dc4c5b068',
    documentType: 'full_paper',
    pages: 9,
    legalAccessType: 'open-access publisher PDF',
    identityEvidence: [
      'PDF title is “Avenues for prevention using the epidemiology of sport-related concussion from a large high school surveillance study”.',
      'The PDF prints DOI 10.3171/2024.4.FOCUS24153 and contains the complete methods, results, discussion and references.',
    ],
    provenanceUrls: [
      'https://thejns.org/focus/view/journals/neurosurg-focus/57/1/article-pE3.xml',
      'https://thejns.org/focus/downloadpdf/view/journals/neurosurg-focus/57/1/article-pE3.pdf',
    ],
  },
  S1148: {
    sourceUrl:
      'https://bjsm-bmj-com.ucd.idm.oclc.org/content/bjsports/58/2/112.full.pdf',
    sha256: '50d60331ce6292b754372c1a2a4c51ce2b39ee0dab48601cf1d3983f1b7624de',
    documentType: 'editorial',
    pages: 2,
    legalAccessType: 'UCD institutional publisher PDF',
    identityEvidence: [
      'PDF metadata and first page give the exact title “Injuries in athletic club players: growth and maturation as potential risk factors (PhD Academy Award)”.',
      'The two-page BJSM PhD Academy Award item names Xabier Monasterio and prints DOI 10.1136/bjsports-2023-106702.',
    ],
    provenanceUrls: [
      'https://bjsm-bmj-com.ucd.idm.oclc.org/content/58/2/112',
      'https://bjsm-bmj-com.ucd.idm.oclc.org/content/bjsports/58/2/112.full.pdf',
    ],
  },
  S4111: {
    sourceUrl:
      'https://onlinelibrary-wiley-com.ucd.idm.oclc.org/doi/pdfdirect/10.1002/pmrj.70023',
    sha256: 'aa84977142bcd60e08663dba43711eb0a9b676a571e39df74f3063bc104bd46f',
    documentType: 'full_paper',
    pages: 11,
    legalAccessType: 'UCD institutional publisher PDF',
    identityEvidence: [
      'PDF metadata and first page give the exact title “Adductor-related groin injury: Prevalence and etiology during NCAA football games on artificial and natural grass surfaces”.',
      'The PDF names Jarrett L. Mitton and Michael C. Meyers, prints DOI 10.1002/pmrj.70023, and contains the complete methods, results, discussion and references.',
    ],
    provenanceUrls: [
      'https://onlinelibrary-wiley-com.ucd.idm.oclc.org/doi/10.1002/pmrj.70023',
      'https://onlinelibrary-wiley-com.ucd.idm.oclc.org/doi/pdfdirect/10.1002/pmrj.70023',
    ],
  },
  S4987: {
    sourceUrl:
      'https://esskajournals-onlinelibrary-wiley-com.ucd.idm.oclc.org/doi/pdfdirect/10.1002/ksa.70329',
    sha256: 'ffa28da69cba5bc248321d2896960e948da62309030d7982cb96e285facf1577',
    documentType: 'full_paper',
    pages: 12,
    legalAccessType: 'UCD institutional publisher PDF',
    identityEvidence: [
      'PDF metadata and first page give the exact title “ACL Denmark: A nationwide register-questionnaire study from 2000 to 2018 reporting stable ACL incidence rates but rising rates of reconstruction”.',
      'The PDF names Niels Christian Kaldau and co-authors, prints DOI 10.1002/ksa.70329, and contains the complete methods, results, discussion and references.',
    ],
    provenanceUrls: [
      'https://esskajournals-onlinelibrary-wiley-com.ucd.idm.oclc.org/doi/10.1002/ksa.70329',
      'https://esskajournals-onlinelibrary-wiley-com.ucd.idm.oclc.org/doi/pdfdirect/10.1002/ksa.70329',
    ],
  },
  S5148: {
    sourceUrl:
      'https://bjsm-bmj-com.ucd.idm.oclc.org/content/bjsports/60/7/554.full.pdf',
    sha256: 'ca664d143b59c4cad48f33056e005349685d1065393ad588a011ad110afa47fa',
    documentType: 'editorial',
    pages: 2,
    legalAccessType: 'UCD institutional publisher PDF',
    identityEvidence: [
      'PDF metadata and first page give the exact title “Epidemiology and prevention of football-related injuries in youth male football players: development of the ‘FUNBALL’ programme (PhD Academy Award)”.',
      'The two-page BJSM PhD Academy Award item names Rilind Obërtinca and prints DOI 10.1136/bjsports-2025-110557.',
    ],
    provenanceUrls: [
      'https://bjsm-bmj-com.ucd.idm.oclc.org/content/60/7/554',
      'https://bjsm-bmj-com.ucd.idm.oclc.org/content/bjsports/60/7/554.full.pdf',
    ],
  },
};

const unresolved = {
  S845: {
    sourceUrl:
      'https://www-ovid-com.ucd.idm.oclc.org/jnls/cjsportsmed/abstract/10.1097/jsm.0000000000001240',
    error:
      'UCD reached the exact Ovid record, but Ovid still requires subscriber institutional authentication before the PDF can be downloaded.',
    manualNextStep:
      'Complete the Ovid institutional sign-in in the preserved S845 tab, then download and identity-check the exact DOI 10.1097/JSM.0000000000001240 PDF.',
  },
  S1503: {
    sourceUrl: 'https://clinicaltrials.gov/study/NCT06203379',
    error:
      'ClinicalTrials.gov still has no linked results publication or PDF, and the exact-title UCD OneSearch query returned zero results.',
    manualNextStep:
      'Monitor NCT06203379 for a posted results publication; do not screen the registry entry as if it were a full paper.',
  },
  S1521: {
    sourceUrl: 'https://clinicaltrials.gov/study/NCT06473883',
    error:
      'ClinicalTrials.gov still has no linked results publication or PDF, and the exact-title UCD OneSearch query returned zero results.',
    manualNextStep:
      'Monitor NCT06473883 for a posted results publication; do not screen the registry entry as if it were a full paper.',
  },
  S3098: {
    sourceUrl:
      'https://www.turkiyeklinikleri.com/pdf/?pdf=b7835a7b4c4f6d57ad95deede4a998a0',
    error:
      'The exact Türkiye Klinikleri article and PDF route were found, but the publisher requires an account sign-in and no PDF was delivered.',
    manualNextStep:
      'Complete the publisher or institutional sign-in in the preserved S3098 tab, then download and validate the exact professional-football article.',
  },
  S3493: {
    sourceUrl:
      'https://ucd-summon-serialssolutions-com.ucd.idm.oclc.org/#!/search?pn=1&ho=t&include.ft.matches=f&l=en&q=%22LES%C3%95ES%20NA%20REGI%C3%83O%20DO%20JOELHO%20EM%20JOGADORES%20DE%20FUTEBOL%22',
    error:
      'UCD OneSearch found two exact bibliographic matches and a seven-page Gale full-text route, but the route did not deliver a PDF in the controlled browser session.',
    manualNextStep:
      'Use the preserved S3493 OneSearch tab to complete the Gale full-text handoff, then verify the seven-page paper against Wellington Danilo Soares and co-authors.',
  },
  S3592: {
    sourceUrl:
      'https://www-ovid-com.ucd.idm.oclc.org/jnls/acsm-msse/pdf/10.1249/01.mss.0001160372.12141.14~risk-factors-for-mental-health-and-quality-of-life-in-elite',
    error:
      'UCD opened the exact Ovid PDF viewer for DOI 10.1249/01.MSS.0001160372.12141.14, but the viewer did not deliver a local PDF.',
    manualNextStep:
      'Use the preserved S3592 Ovid PDF-viewer tab to finish the institutional download; retain its conference-abstract classification.',
  },
  S3713: {
    sourceUrl:
      'https://www-ovid-com.ucd.idm.oclc.org/jnls/acsm-msse/pdf/10.1249/01.mss.0001158736.15512.b7~incidence-and-burden-of-injury-at-the-accra-2023-first',
    error:
      'UCD opened the exact Ovid PDF viewer for DOI 10.1249/01.MSS.0001158736.15512.B7, but the viewer did not deliver a local PDF.',
    manualNextStep:
      'Use the preserved S3713 Ovid PDF-viewer tab to finish the institutional download; retain its conference-abstract classification.',
  },
  S3776: {
    sourceUrl:
      'https://www-ovid-com.ucd.idm.oclc.org/jnls/acsm-msse/pdf/10.1249/01.mss.0001158728.83087.5c~injury-incidence-in-ncaa-sports-during-the-covid-19-pandemic',
    error:
      'UCD opened the exact Ovid PDF viewer for DOI 10.1249/01.MSS.0001158728.83087.5C, but the viewer did not deliver a local PDF.',
    manualNextStep:
      'Use the preserved S3776 Ovid PDF-viewer tab to finish the institutional download; retain its conference-abstract classification.',
  },
};

const records = base.records.map((record) => {
  const success = accepted[record.studyId];
  if (success) {
    return {
      ...record,
      retrievalStatus: 'accepted',
      sourceUrl: success.sourceUrl,
      localPath: path.join(filesDirectory, `${record.studyId}.pdf`),
      validation: {
        pdfSignature: true,
        identityVerified: true,
        legalAccess: true,
        legalAccessType: success.legalAccessType,
        documentType: success.documentType,
        pages: success.pages,
        titleMatch: true,
        authorMatch: true,
        doiMatch: true,
        contentMatch: true,
        identityEvidence: success.identityEvidence,
        failureEvidence: [],
        provenanceUrls: success.provenanceUrls,
        confidence: 'high',
      },
      uploadStatus: 'pending',
      uploadHash: null,
      aiStatus: 'pending',
      aiDecision: null,
      aiReason: null,
      aiCriteria: null,
      aiModel: null,
      error: null,
      manualNextStep: null,
      sha256: success.sha256,
      storageObjectPath: null,
    };
  }

  const failure = unresolved[record.studyId];
  if (!failure) return record;
  return {
    ...record,
    sourceUrl: failure.sourceUrl,
    error: failure.error,
    manualNextStep: failure.manualNextStep,
    validation: {
      ...(record.validation ?? {}),
      failureEvidence: [
        ...new Set([
          ...(record.validation?.failureEvidence ?? []),
          failure.error,
        ]),
      ],
      provenanceUrls: [
        ...new Set([
          ...(record.validation?.provenanceUrls ?? []),
          failure.sourceUrl,
        ]),
      ],
    },
  };
});

const payload = {
  scope:
    'Exact 27 promoted full-text records after lawful UCD institutional second-pass retrieval',
  generatedAt: new Date().toISOString(),
  baseManifestPath,
  secondPass: {
    attemptedStudyIds: Object.keys({ ...accepted, ...unresolved }),
    acceptedStudyIds: Object.keys(accepted),
    unresolvedStudyIds: Object.keys(unresolved),
    rejectedFiles: [
      path.join(filesDirectory, 'S4111-rejected-html-response.html'),
      path.join(filesDirectory, 'S4987-rejected-html-response.html'),
    ],
  },
  records,
};

fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ outputPath, records: records.length }, null, 2));
