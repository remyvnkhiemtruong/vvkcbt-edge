export enum StructureSource {
  QD764 = 'QD764',
  CUSTOM = 'custom',
}

export enum GdptAssessmentPeriod {
  GK1 = 'GK1',
  GK2 = 'GK2',
  CK1 = 'CK1',
  CK2 = 'CK2',
}

export type ClusterSubtype =
  | 'fill_notice'
  | 'fill_flyer'
  | 'reorder'
  | 'fill_gap'
  | 'reading_8'
  | 'reading_10';

export interface ExamPartConfig {
  count?: number;
  score?: number;
  score_per_item?: number;
  score_branch?: Record<string, number>;
  type: string;
  subtype?: string;
}

export interface ClusterLayoutItem {
  subtype: ClusterSubtype;
  count: number;
}

export interface ExamStructureTemplate {
  id?: string;
  code: string;
  subject: string;
  source: StructureSource;
  isCustom: boolean;
  durationMin: number;
  totalScore: number;
  parts: Record<string, ExamPartConfig>;
  clusterLayout?: { clusters: ClusterLayoutItem[]; total_mcq: number };
  cognitiveDistribution?: { nhan_biet: number; thong_hieu: number; van_dung: number };
  uiMode: 'split_view' | 'vertical_focus';
  parentTemplateId?: string;
}

export interface StructureRulesSection {
  source: StructureSource;
  is_custom: boolean;
  structure_template_id?: string;
  overrides?: Record<string, unknown>;
}

export interface CognitiveDistribution {
  nhan_biet: number;
  thong_hieu: number;
  van_dung: number;
}
