/** Rich-text / structured question content (JSONB) — QĐ 764 */

export type InformaticsCodeLanguage = 'cpp' | 'python';

export interface InformaticsCodeBlock {
  language: InformaticsCodeLanguage;
  source: string;
  label?: string;
}

export interface McqQuestionContent {
  stem: string;
  /** Nội dung đề bài phía dưới khối code (Tin học) */
  stemAfter?: string;
  options: string[];
  codeBlocks?: InformaticsCodeBlock[];
  codeDisplay?: 'tabs' | 'side_by_side';
}

export interface TrueFalseQuestionContent {
  stem?: string;
  /** Nội dung đề bài phía dưới khối code (Tin học) */
  stemAfter?: string;
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
  /** Các câu/utterances cần sắp xếp (dạng reorder: a., b., c.…) */
  sentences?: string[];
  options: string[];
  passage?: string;
  /** Tiêu đề / hướng dẫn chùm (vd. Mark the letter A, B, C or D…) */
  instruction?: string;
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
  /** Tiêu đề / hướng dẫn chùm câu (tiếng Anh) */
  instruction?: string;
  body?: string;
  text?: string;
  images?: string[];
  audio_id?: string;
}
