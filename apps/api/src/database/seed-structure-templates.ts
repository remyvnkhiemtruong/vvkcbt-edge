export {
  QD764_DEFAULT_STRUCTURES as QD764_STRUCTURE_TEMPLATES,
  TNPT_36_COMBOS,
  DEFAULT_COGNITIVE_DISTRIBUTION,
} from '@vnu/shared-types';

export const GDPT_STREAM_SAMPLES = [
  { streamCode: 'MATH_G12_GK2', streamName: 'Toán 12 GK2', grade: '12', subjectCodes: ['MATH'], assessmentPeriod: 'GK2' as const, templateCode: 'MATH_QD764' },
  { streamCode: 'LITERATURE_G12_GK2', streamName: 'Văn 12 GK2', grade: '12', subjectCodes: ['LITERATURE'], assessmentPeriod: 'GK2' as const, templateCode: 'LITERATURE_QD764' },
  { streamCode: 'ENGLISH_G12_CK2', streamName: 'Anh 12 CK2', grade: '12', subjectCodes: ['ENGLISH'], assessmentPeriod: 'CK2' as const, templateCode: 'ENGLISH_QD764' },
  { streamCode: 'PHYSICS_G12_GK1', streamName: 'Lý 12 GK1', grade: '12', subjectCodes: ['PHYSICS'], assessmentPeriod: 'GK1' as const, templateCode: 'PHYSICS_QD764' },
];
