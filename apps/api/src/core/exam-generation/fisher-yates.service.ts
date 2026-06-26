import { Injectable } from '@nestjs/common';
import { Difficulty, QuestionType, CognitiveDistribution } from '@vnu/shared-types';
import { QuestionBank } from '../../database/entities/question-bank.entity';
import { QuestionCluster } from '../../database/entities/question-cluster.entity';
import { ExamStructureTemplate } from '../../database/entities/exam-structure-template.entity';
import { ExamPartConfig } from '@vnu/shared-types';

@Injectable()
export class FisherYatesService {
  shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  private pickByDifficulty(
    pool: QuestionBank[],
    count: number,
    distribution?: CognitiveDistribution | Record<string, number> | null,
  ): QuestionBank[] {
    const dist = distribution as CognitiveDistribution | undefined;
    if (!dist?.nhan_biet || pool.length <= count) {
      return this.shuffle(pool).slice(0, count);
    }

    const buckets: Record<Difficulty, QuestionBank[]> = {
      [Difficulty.LOW]: [],
      [Difficulty.MEDIUM]: [],
      [Difficulty.HIGH]: [],
    };
    for (const q of pool) buckets[q.difficulty].push(q);

    const lowCount = Math.round(count * dist.nhan_biet);
    const medCount = Math.round(count * dist.thong_hieu);
    const highCount = Math.max(0, count - lowCount - medCount);

    const selected = [
      ...this.shuffle(buckets[Difficulty.LOW]).slice(0, lowCount),
      ...this.shuffle(buckets[Difficulty.MEDIUM]).slice(0, medCount),
      ...this.shuffle(buckets[Difficulty.HIGH]).slice(0, highCount),
    ];

    if (selected.length < count) {
      const used = new Set(selected.map((q) => q.id));
      const rest = this.shuffle(pool.filter((q) => !used.has(q.id)));
      selected.push(...rest.slice(0, count - selected.length));
    }

    return this.shuffle(selected).slice(0, count);
  }

  generateFromTemplate(
    template: ExamStructureTemplate,
    questions: QuestionBank[],
    clusters: QuestionCluster[] = [],
  ): {
    selected: Array<
      QuestionBank & { partKey?: string; clusterId?: string | null; passage?: Record<string, unknown> }
    >;
    difficultyMeta: Record<string, number>;
  } {
    const dist = template.cognitiveDistribution ?? { nhan_biet: 0.4, thong_hieu: 0.3, van_dung: 0.3 };
    const selected: Array<
      QuestionBank & { partKey?: string; clusterId?: string | null; passage?: Record<string, unknown> }
    > = [];

    for (const [partKey, partRaw] of Object.entries(template.parts)) {
      const part = partRaw as ExamPartConfig;
      const type = part.type as QuestionType;

      if (type === QuestionType.CLUSTER_MCQ && template.clusterLayout) {
        const layout = template.clusterLayout as { clusters: Array<{ subtype: string; count: number }> };
        for (const cl of layout.clusters) {
          const cluster = clusters.find((c) => c.clusterSubtype === cl.subtype) ?? clusters[0];
          if (!cluster) continue;
          const clusterQs = questions.filter((q) => q.clusterId === cluster.id || q.type === QuestionType.CLUSTER_MCQ);
          const picked = this.pickByDifficulty(clusterQs, cl.count, dist);
          for (const q of picked) {
            selected.push({
              ...q,
              partKey,
              clusterId: cluster.id,
              passage: cluster.passage,
            });
          }
        }
        continue;
      }

      const pool = questions.filter((q) => q.type === type);
      const count = part.count ?? (part.score ? 1 : 0);
      if (count <= 0) continue;

      const picked = this.pickByDifficulty(pool, count, dist);
      for (const q of picked) {
        selected.push({ ...q, partKey });
      }
    }

    const difficultyMeta = {
      low: selected.filter((q) => q.difficulty === Difficulty.LOW).length,
      medium: selected.filter((q) => q.difficulty === Difficulty.MEDIUM).length,
      high: selected.filter((q) => q.difficulty === Difficulty.HIGH).length,
    };

    return { selected, difficultyMeta };
  }

  generatePaper(questions: QuestionBank[], count: number) {
    const { selected, difficultyMeta } = this.generateFromTemplate(
      {
        parts: { part1_mcq: { count, type: 'mcq' } },
        cognitiveDistribution: { nhan_biet: 0.4, thong_hieu: 0.3, van_dung: 0.3 },
      } as unknown as ExamStructureTemplate,
      questions,
    );
    return { selected, difficultyMeta };
  }
}
