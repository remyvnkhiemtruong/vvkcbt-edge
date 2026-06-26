import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ExamRules,
  ExamStructureTemplate,
  ExamPartConfig,
  StructureSource,
  applyStructureOverrides,
  getDefaultStructure,
  listTnThptSubjects,
} from '@vnu/shared-types';
import { ExamStructureTemplate as ExamStructureTemplateEntity } from '../../database/entities/exam-structure-template.entity';

@Injectable()
export class StructureResolverService {
  constructor(
    @InjectRepository(ExamStructureTemplateEntity)
    private readonly templateRepo: Repository<ExamStructureTemplateEntity>,
  ) {}

  listSubjects() {
    return listTnThptSubjects();
  }

  getDefaultForSubject(subjectCode: string): ExamStructureTemplate {
    const tpl = getDefaultStructure(subjectCode);
    if (!tpl) throw new NotFoundException(`No default structure for subject ${subjectCode}`);
    return tpl;
  }

  entityToTemplate(entity: ExamStructureTemplateEntity): ExamStructureTemplate {
    return {
      id: entity.id,
      code: entity.code,
      subject: entity.subject,
      source: entity.source as StructureSource,
      isCustom: entity.isCustom,
      durationMin: entity.durationMin,
      totalScore: Number(entity.totalScore),
      parts: entity.parts as Record<string, ExamPartConfig>,
      clusterLayout: entity.clusterLayout as ExamStructureTemplate['clusterLayout'],
      cognitiveDistribution: entity.cognitiveDistribution as ExamStructureTemplate['cognitiveDistribution'],
      uiMode: entity.uiMode as ExamStructureTemplate['uiMode'],
      parentTemplateId: entity.parentTemplateId ?? undefined,
    };
  }

  async resolveForSubject(
    subjectCode: string,
    rules?: ExamRules,
  ): Promise<ExamStructureTemplate> {
    const subjectRule = rules?.subjects?.find((s) => s.code === subjectCode);
    const mode =
      subjectRule?.structureMode ??
      (rules?.structure?.is_custom ? 'custom' : 'default');

    if (mode === 'custom') {
      if (subjectRule?.customTemplateId) {
        const custom = await this.templateRepo.findOne({
          where: { id: subjectRule.customTemplateId, source: StructureSource.CUSTOM },
        });
        if (custom) return this.entityToTemplate(custom);
      }
      if (rules?.structure_template_id) {
        const custom = await this.templateRepo.findOne({
          where: { id: rules.structure_template_id },
        });
        if (custom) return this.entityToTemplate(custom);
      }
      const base = this.getDefaultForSubject(subjectCode);
      return applyStructureOverrides(base, subjectRule?.overrides ?? rules?.structure?.overrides);
    }

    const base = this.getDefaultForSubject(subjectCode);
    if (subjectRule?.overrides) {
      return applyStructureOverrides(base, subjectRule.overrides);
    }
    return base;
  }

  async resolveByTemplateId(id: string): Promise<ExamStructureTemplate> {
    const entity = await this.templateRepo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Template not found');
    return this.entityToTemplate(entity);
  }
}
