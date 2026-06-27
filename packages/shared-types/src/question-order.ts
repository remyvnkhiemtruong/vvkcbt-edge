export function seededShuffle<T>(items: T[], seed: string): T[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) >>> 0;
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    h = (Math.imul(1664525, h) + 1013904223) >>> 0;
    const j = h % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function resolveQuestionPartKey(q: { part?: string; partKey?: string }): string {
  const raw = q.part ?? q.partKey;
  return raw?.trim() ? raw.trim() : '_default';
}

type PartCfg = { type?: string; count?: number };

/** Gán phần từ loại câu khi thiếu part; hỗ trợ nhiều phần cùng type. */
export function enrichQuestionsWithPart<T extends { type?: string; part?: string; partKey?: string }>(
  questions: T[],
  structure?: { parts: Record<string, PartCfg> },
): T[] {
  if (!structure?.parts) {
    return questions.map((q) => {
      const p = q.part ?? q.partKey;
      return p ? { ...q, part: p } : q;
    });
  }

  const partOrder = Object.keys(structure.parts);
  const typeToPart = new Map<string, string | null>();
  for (const [partKey, cfg] of Object.entries(structure.parts)) {
    const t = cfg.type;
    if (!t) continue;
    if (typeToPart.has(t)) typeToPart.set(t, null);
    else typeToPart.set(t, partKey);
  }

  const result: T[] = questions.map((q) => ({ ...q }));
  const unassigned: number[] = [];

  for (let i = 0; i < result.length; i++) {
    const q = result[i];
    const existing = q.part ?? q.partKey;
    if (existing) {
      result[i] = { ...q, part: existing };
      continue;
    }
    const inferred = q.type ? typeToPart.get(q.type) : undefined;
    if (inferred) {
      result[i] = { ...q, part: inferred };
    } else if (q.type) {
      unassigned.push(i);
    }
  }

  if (unassigned.length > 0) {
    const buckets: Array<{ partKey: string; type: string; remaining: number }> = [];
    for (const partKey of partOrder) {
      const cfg = structure.parts[partKey];
      if (!cfg?.type) continue;
      if (typeToPart.get(cfg.type) !== null) continue;
      const cap = cfg.count ?? 1;
      buckets.push({ partKey, type: cfg.type, remaining: cap });
    }

    let bucketIdx = 0;
    for (const qi of unassigned) {
      const q = result[qi];
      while (
        bucketIdx < buckets.length &&
        (buckets[bucketIdx].remaining <= 0 || buckets[bucketIdx].type !== q.type)
      ) {
        bucketIdx++;
      }
      if (bucketIdx < buckets.length && buckets[bucketIdx].type === q.type) {
        result[qi] = { ...q, part: buckets[bucketIdx].partKey };
        buckets[bucketIdx].remaining--;
      }
    }
  }

  return result.map((q) => {
    const p = q.part ?? q.partKey;
    return p ? { ...q, part: p } : q;
  });
}

export type EnglishClusterOrderQuestion = {
  id: string;
  part?: string;
  partKey?: string;
  clusterId?: string | null;
  clusterOrder?: number | null;
  clusterSubtype?: string;
  content?: { subtype?: string };
};

function resolveClusterSubtype(q: EnglishClusterOrderQuestion): string | undefined {
  if (q.clusterSubtype) return q.clusterSubtype;
  const st = q.content?.subtype;
  return typeof st === 'string' ? st : undefined;
}

function englishClusterGroupKey(q: EnglishClusterOrderQuestion): string {
  if (q.clusterId) return `cluster:${q.clusterId}`;
  const subtype = resolveClusterSubtype(q);
  if (subtype) return `subtype:${subtype}`;
  return `solo:${q.id}`;
}

function sortEnglishClusterQuestions<T extends EnglishClusterOrderQuestion>(
  group: T[],
  subtype: string | undefined,
  seed: string,
  groupKey: string,
): T[] {
  if (subtype === 'reorder') {
    return seededShuffle(group, `${seed}:english:${groupKey}:reorder`);
  }
  return group
    .map((q, idx) => ({ q, idx }))
    .sort((a, b) => {
      const ao = a.q.clusterOrder ?? Number.POSITIVE_INFINITY;
      const bo = b.q.clusterOrder ?? Number.POSITIVE_INFINITY;
      if (ao !== bo) return ao - bo;
      return a.idx - b.idx;
    })
    .map(({ q }) => q);
}

/**
 * Tiếng Anh QĐ764: trộn thứ tự các bài đọc (cluster), giữ thứ tự câu trong cluster;
 * chỉ trộn thứ tự câu hỏi đối với dạng sắp xếp (reorder).
 */
export function orderEnglishClusterQuestions<T extends EnglishClusterOrderQuestion>(
  questions: T[],
  seed: string,
): T[] {
  if (questions.length === 0) return [];

  const groupKeys: string[] = [];
  const groups = new Map<string, T[]>();
  for (const q of questions) {
    const key = englishClusterGroupKey(q);
    if (!groups.has(key)) {
      groups.set(key, []);
      groupKeys.push(key);
    }
    groups.get(key)!.push(q);
  }

  const shuffledKeys = seededShuffle(groupKeys, `${seed}:english:clusters`);
  const result: T[] = [];
  for (const key of shuffledKeys) {
    const group = groups.get(key)!;
    const subtype = resolveClusterSubtype(group[0]);
    result.push(...sortEnglishClusterQuestions(group, subtype, seed, key));
  }
  return result;
}

/** Sắp xếp câu theo môn — Anh dùng quy tắc cluster; môn khác trộn trong phần. */
export function orderQuestionsForExam<T extends EnglishClusterOrderQuestion & { part?: string; partKey?: string }>(
  subjectCode: string | undefined,
  questions: T[],
  partOrder: string[],
  seed: string,
  options?: { shuffleWithinPart?: boolean },
): T[] {
  if ((subjectCode ?? '').toUpperCase() === 'ENGLISH') {
    return orderEnglishClusterQuestions(questions, seed);
  }
  if (partOrder.length > 0) {
    return orderQuestionsByPart(questions, partOrder, seed, options);
  }
  return questions;
}

/** Giữ thứ tự phần (I → II → III), chỉ trộn câu trong từng phần. */
export function orderQuestionsByPart<T extends { id: string; part?: string; partKey?: string }>(
  questions: T[],
  partOrder: string[],
  seed: string,
  options?: { shuffleWithinPart?: boolean },
): T[] {
  if (questions.length === 0) return [];

  const byPart = new Map<string, T[]>();
  for (const q of questions) {
    const key = resolveQuestionPartKey(q);
    const list = byPart.get(key) ?? [];
    list.push(q);
    byPart.set(key, list);
  }

  const orderedParts = [
    ...partOrder.filter((p) => byPart.has(p)),
    ...[...byPart.keys()].filter((p) => !partOrder.includes(p) && p !== '_default'),
  ];
  if (byPart.has('_default')) orderedParts.push('_default');

  const shuffle = options?.shuffleWithinPart !== false;
  const result: T[] = [];
  for (const partKey of orderedParts) {
    const group = byPart.get(partKey) ?? [];
    result.push(...(shuffle ? seededShuffle(group, `${seed}:${partKey}`) : group));
  }
  return result;
}
