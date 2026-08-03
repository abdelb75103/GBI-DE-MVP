import fs from 'node:fs';
import path from 'node:path';

const repositoryRoot = '/Users/abdelbabiker/Desktop/GBI-DE-MVP-main';
const baseDirectory = path.join(
  repositoryRoot,
  'fifa-gbi-data-extraction/data/full-text-pdf-retrieval/promoted-title-abstract-2026-07-30',
);
const followupDirectory = path.join(
  baseDirectory,
  'ucd-user-download-followup-2026-07-30',
);
const filesDirectory = path.join(followupDirectory, 'files');
const baseManifestPath = path.join(
  baseDirectory,
  'ucd-second-pass-2026-07-30/final-manifest-2026-07-30T14-53-49-385Z.json',
);
const outputPath = path.join(followupDirectory, 'retrieval-manifest.json');
const base = JSON.parse(fs.readFileSync(baseManifestPath, 'utf8'));

const accepted = {
  S3098: {
    sourceUrl:
      'https://www.turkiyeklinikleri.com/pdf/?pdf=b7835a7b4c4f6d57ad95deede4a998a0',
    sha256: '9bb23cef9ad04afb6324e2c58364c3eb1b3c507f0d100fe5c419d68a5f823c9d',
    documentType: 'full_paper',
    pages: 9,
    legalAccessType: 'publisher PDF downloaded through authorised user access',
    identityEvidence: [
      'PDF first page gives the exact Turkish and English titles for the acute:chronic workload, running imbalance and professional-football injury study.',
      'The PDF prints DOI 10.5336/sportsci.2024-104874, names Selçuk Tarakcı and co-authors, and contains the complete methods, results, discussion and references.',
    ],
    provenanceUrls: [
      'https://www.turkiyeklinikleri.com/article/en-acute-chronic-workload-ratio-running-imbalance-and-injury-paradox-for-professional-footballers-a-descriptive-research-110837.html',
      'https://www.turkiyeklinikleri.com/pdf/?pdf=b7835a7b4c4f6d57ad95deede4a998a0',
    ],
  },
  S3493: {
    sourceUrl:
      'https://go-gale-com.ucd.idm.oclc.org/ps/i.do?p=AONE&u=dublin&id=GALE%7CA793260136&v=2.1&it=r&sid=summon',
    sha256: '6d4b90db244bb08b48429bd112d1d8f7f891ec7893afc373153c12e7faa00ec2',
    documentType: 'full_paper',
    pages: 6,
    legalAccessType: 'UCD institutional Gale full-text PDF',
    identityEvidence: [
      'Gale PDF title is “LESOES NA REGIAO DO JOELHO EM JOGADORES DE FUTEBOL / Injuries in the knee region in football players”.',
      'The PDF names Wellington Danilo Soares, Iasmym Souza Bastos, Karen Cangussu Coelho and Jomar Luiz Santos de Almeida, identifies Revista Brasileira de Futsal e Futebol volume 16 issue 64, and contains the full 31-player article with tables and references.',
    ],
    provenanceUrls: [
      'https://ucd-summon-serialssolutions-com.ucd.idm.oclc.org/#!/search?pn=1&ho=t&include.ft.matches=f&l=en&q=%22LES%C3%95ES%20NA%20REGI%C3%83O%20DO%20JOELHO%20EM%20JOGADORES%20DE%20FUTEBOL%22',
      'https://go-gale-com.ucd.idm.oclc.org/ps/i.do?p=AONE&u=dublin&id=GALE%7CA793260136&v=2.1&it=r&sid=summon',
    ],
  },
  S3592: {
    sourceUrl:
      'https://www-ovid-com.ucd.idm.oclc.org/jnls/acsm-msse/pdf/10.1249/01.mss.0001160372.12141.14~risk-factors-for-mental-health-and-quality-of-life-in-elite',
    sha256: '0785b09e6a8a0d2a8d23d6f5f7f27594f3cdb8a62661b111081471de77d67b55',
    documentType: 'conference_abstract',
    pages: 1,
    legalAccessType: 'UCD institutional Ovid conference-supplement PDF',
    identityEvidence: [
      'The one-page supplement PDF contains abstract 1961 with the exact title “Risk Factors For Mental Health And Quality Of Life In Elite Adolescent Athletes”.',
      'The exact abstract names Sakar Gupta and co-authors and reports the 668 elite adolescent soccer-athlete survey; it is accurately classified as a conference abstract rather than a full paper.',
    ],
    provenanceUrls: [
      'https://www-ovid-com.ucd.idm.oclc.org/jnls/acsm-msse/fulltext/10.1249/01.mss.0001160372.12141.14~risk-factors-for-mental-health-and-quality-of-life-in-elite',
      'https://www-ovid-com.ucd.idm.oclc.org/jnls/acsm-msse/pdf/10.1249/01.mss.0001160372.12141.14~risk-factors-for-mental-health-and-quality-of-life-in-elite',
    ],
  },
  S3713: {
    sourceUrl:
      'https://www-ovid-com.ucd.idm.oclc.org/jnls/acsm-msse/pdf/10.1249/01.mss.0001158736.15512.b7~incidence-and-burden-of-injury-at-the-accra-2023-first',
    sha256: 'fe1c391cbbd6d6faddccb9049034b4b4ac574807748dee24055372ba6b401dcc',
    documentType: 'conference_abstract',
    pages: 2,
    legalAccessType: 'UCD institutional Ovid conference-supplement PDF',
    identityEvidence: [
      'The two-page supplement bundle contains abstract 1519 on page two with the exact title “Incidence And Burden Of Injury At The Accra 2023 First African Paralympic Games”.',
      'The target abstract names Abena Tannor and co-authors and reports the three-sport 337-athlete surveillance; the first page is adjacent abstract 1517, so this is accurately classified as a conference-abstract bundle.',
    ],
    provenanceUrls: [
      'https://www-ovid-com.ucd.idm.oclc.org/jnls/acsm-msse/fulltext/10.1249/01.mss.0001158736.15512.b7~incidence-and-burden-of-injury-at-the-accra-2023-first',
      'https://www-ovid-com.ucd.idm.oclc.org/jnls/acsm-msse/pdf/10.1249/01.mss.0001158736.15512.b7~incidence-and-burden-of-injury-at-the-accra-2023-first',
    ],
  },
  S3776: {
    sourceUrl:
      'https://www-ovid-com.ucd.idm.oclc.org/jnls/acsm-msse/pdf/10.1249/01.mss.0001158728.83087.5c~injury-incidence-in-ncaa-sports-during-the-covid-19-pandemic',
    sha256: '6f7d83ac9c7883d88933236f0d93d40e6f54a0d68f54f6ea5157094cc664a0d9',
    documentType: 'conference_abstract',
    pages: 1,
    legalAccessType: 'UCD institutional Ovid conference-supplement PDF',
    identityEvidence: [
      'The one-page PDF contains abstract 1517 with the exact title “Injury Incidence In NCAA Sports During The Covid-19 Pandemic: Findings From Injury Surveillance”.',
      'The abstract names Avinash Chandran, Adrian J. Boltz and co-authors and reports NCAA Injury Surveillance Program methods and results; it is accurately classified as a conference abstract.',
    ],
    provenanceUrls: [
      'https://www-ovid-com.ucd.idm.oclc.org/jnls/acsm-msse/fulltext/10.1249/01.mss.0001158728.83087.5c~injury-incidence-in-ncaa-sports-during-the-covid-19-pandemic',
      'https://www-ovid-com.ucd.idm.oclc.org/jnls/acsm-msse/pdf/10.1249/01.mss.0001158728.83087.5c~injury-incidence-in-ncaa-sports-during-the-covid-19-pandemic',
    ],
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
        doiMatch: record.doi ? true : null,
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
  if (record.studyId !== 'S845') return record;
  return {
    ...record,
    error:
      'The user-downloaded main.pdf is HTML rather than a PDF, so no identity-verifiable full text is available for upload.',
    manualNextStep:
      'Obtain the actual Ovid PDF for DOI 10.1097/JSM.0000000000001240; do not upload the HTML response saved as main.pdf.',
    validation: {
      ...(record.validation ?? {}),
      failureEvidence: [
        ...new Set([
          ...(record.validation?.failureEvidence ?? []),
          'Downloads/main.pdf has MIME type text/html and SHA-256 881407f4ca61259d1401eb759506cdf90b38884063fb976e7d98eec2d6e0326f.',
        ]),
      ],
    },
  };
});

const payload = {
  scope:
    'Exact 27 promoted full-text records after validating user downloads and retrieving S3493 through UCD Gale',
  generatedAt: new Date().toISOString(),
  baseManifestPath,
  followup: {
    acceptedStudyIds: Object.keys(accepted),
    unresolvedStudyIds: ['S845', 'S1503', 'S1521'],
    rejectedDownloads: [
      {
        path: '/Users/abdelbabiker/Downloads/main.pdf',
        reason: 'HTML response, not a PDF',
        sha256: '881407f4ca61259d1401eb759506cdf90b38884063fb976e7d98eec2d6e0326f',
      },
      {
        path:
          '/Users/abdelbabiker/Downloads/incidence-and-burden-of-injury-at-the-accra-2023-first (1).pdf',
        reason: 'Exact duplicate of the accepted S3713 conference-supplement bundle',
        sha256: 'fe1c391cbbd6d6faddccb9049034b4b4ac574807748dee24055372ba6b401dcc',
      },
    ],
  },
  records,
};

fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ outputPath, records: records.length }, null, 2));
