export function stripCorrectKey<T extends { correctKey?: unknown }>(q: T): Omit<T, 'correctKey'> {
  const { correctKey: _, ...rest } = q;
  return rest;
}

export function stripQuestionsForPublic<T extends { correctKey?: unknown }>(questions: T[]) {
  return questions.map(stripCorrectKey);
}
