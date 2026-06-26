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

/** Gán phần từ loại câu khi thiếu part; hỗ trợ nhiều phần cùng type (Văn, Tin). */
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
