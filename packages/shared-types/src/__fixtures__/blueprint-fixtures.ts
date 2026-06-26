import type { ExamPackageClusterRow, ExamPackagePaperRow } from '../exam-package';
import type { TnThptSubjectCode } from '../tn-thpt-catalog';
import { getDefaultStructure } from '../tn-thpt-catalog';

function mcq(id: string, subject: string, part: string, score = 0.25) {
  return {
    id,
    subject,
    type: 'mcq',
    part,
    difficulty: 'medium',
    content: { stem: `Câu ${id}`, options: ['A. 1', 'B. 2', 'C. 3', 'D. 4'] },
    correctKey: 'A',
    maxScore: score,
  };
}

function tf(id: string, subject: string, part: string, score = 1) {
  return {
    id,
    subject,
    type: 'true_false',
    part,
    difficulty: 'medium',
    content: {
      stem: `Câu ${id}`,
      statements: ['Mệnh đề 1', 'Mệnh đề 2', 'Mệnh đề 3', 'Mệnh đề 4'],
    },
    correctKey: [true, false, true, false],
    maxScore: score,
  };
}

function short(id: string, subject: string, part: string, score: number) {
  return {
    id,
    subject,
    type: 'short_answer',
    part,
    difficulty: 'medium',
    content: { stem: `Câu ${id}` },
    correctKey: '1',
    maxScore: score,
  };
}

function buildStandardPaper(subject: TnThptSubjectCode): ExamPackagePaperRow {
  const structure = getDefaultStructure(subject)!;
  const questions: Record<string, unknown>[] = [];

  if (subject === 'ENGLISH') {
    const clusters: ExamPackageClusterRow[] = [];
    const layout = structure.clusterLayout!.clusters;
    let qIdx = 0;
    for (const item of layout) {
      const clusterId = `cl-${item.subtype}`;
      const questionIds: string[] = [];
      for (let i = 0; i < item.count; i++) {
        const qid = `en-${qIdx++}`;
        questionIds.push(qid);
        questions.push({
          id: qid,
          subject: 'ENGLISH',
          type: 'cluster_mcq',
          part: 'part1_cluster_mcq',
          clusterId,
          clusterOrder: i + 1,
          difficulty: 'medium',
          content: {
            stem: `Question ${qid}`,
            options: ['A. 1', 'B. 2', 'C. 3', 'D. 4'],
          },
          correctKey: 'A',
          maxScore: 0.25,
        });
      }
      clusters.push({
        id: clusterId,
        subject: 'ENGLISH',
        clusterSubtype: item.subtype,
        passage: { text: `Passage for ${item.subtype}` },
        questionIds,
      });
    }
    return { title: 'Anh', subject, questions, difficultyMeta: { clusters } as unknown as Record<string, unknown> };
  }

  for (const [partKey, partCfg] of Object.entries(structure.parts)) {
    const count = partCfg.count ?? 0;
    for (let i = 0; i < count; i++) {
      const id = `${subject.toLowerCase()}-${partKey}-${i}`;
      if (partCfg.type === 'mcq') {
        questions.push(mcq(id, subject, partKey, partCfg.score_per_item ?? 0.25));
      } else if (partCfg.type === 'true_false') {
        let tfScore = 1;
        if (subject === 'INFORMATICS') {
          tfScore = 4 / 6;
        }
        questions.push(tf(id, subject, partKey, tfScore));
      } else if (partCfg.type === 'short_answer') {
        questions.push(short(id, subject, partKey, partCfg.score_per_item ?? 0.25));
      }
    }
  }

  return { title: subject, subject, questions };
}

export function buildValidEnglishClusters(): ExamPackageClusterRow[] {
  const paper = buildStandardPaper('ENGLISH');
  const meta = paper.difficultyMeta as { clusters?: ExamPackageClusterRow[] } | undefined;
  return meta?.clusters ?? [];
}

export const BLUEPRINT_FIXTURES: Record<TnThptSubjectCode, ExamPackagePaperRow> = {
  MATH: buildStandardPaper('MATH'),
  ENGLISH: buildStandardPaper('ENGLISH'),
  PHYSICS: buildStandardPaper('PHYSICS'),
  CHEMISTRY: buildStandardPaper('CHEMISTRY'),
  BIOLOGY: buildStandardPaper('BIOLOGY'),
  GEOGRAPHY: buildStandardPaper('GEOGRAPHY'),
  HISTORY: buildStandardPaper('HISTORY'),
  CIVIC_EDU: buildStandardPaper('CIVIC_EDU'),
  TECHNOLOGY: buildStandardPaper('TECHNOLOGY'),
  INFORMATICS: buildStandardPaper('INFORMATICS'),
};
