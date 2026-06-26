/** Rich-text / structured question content (JSONB) — QĐ 764 */

export type InformaticsCodeLanguage = 'cpp' | 'python';

export interface InformaticsCodeBlock {
  language: InformaticsCodeLanguage;
  source: string;
  label?: string;
}

export interface McqQuestionContent {
  stem: string;
  options: string[];
  codeBlocks?: InformaticsCodeBlock[];
  codeDisplay?: 'tabs' | 'side_by_side';
}

export interface TrueFalseQuestionContent {
  stem?: string;
  statements: string[];
  codeBlocks?: InformaticsCodeBlock[];
  codeDisplay?: 'tabs' | 'side_by_side';
  /** @deprecated use informaticsSlot on question row */
  orientation?: string;
  informaticsSlot?: number;
}

export interface ShortAnswerQuestionContent {
  stem: string;
}

export interface ClusterMcqQuestionContent {
  stem?: string;
  options: string[];
  passage?: string;
  subtype?: string;
}

export interface EssayQuestionContent {
  stem?: string;
  body?: string;
}

export type QuestionContent =
  | McqQuestionContent
  | TrueFalseQuestionContent
  | ShortAnswerQuestionContent
  | ClusterMcqQuestionContent
  | EssayQuestionContent;

export interface ClusterPassageContent {
  title?: string;
  body?: string;
  text?: string;
  images?: string[];
  audio_id?: string;
}
