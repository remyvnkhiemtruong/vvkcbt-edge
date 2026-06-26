import { Controller, Get, Param, Query } from '@nestjs/common';
import { CoreService } from './core.service';

/** Read-only catalog endpoints for runtime; prep workflows live in vnu-composer. */
@Controller('core')
export class CoreController {
  constructor(private readonly coreService: CoreService) {}

  @Get('subjects')
  listSubjects() {
    return this.coreService.listSubjects();
  }

  @Get('subjects/:code/structure')
  getSubjectStructure(
    @Param('code') code: string,
    @Query('mode') mode?: 'default' | 'custom',
  ) {
    return this.coreService.getSubjectStructure(code, mode ?? 'default');
  }

  @Get('structure-templates')
  listTemplates(@Query('subject') subject?: string) {
    return this.coreService.listStructureTemplates(subject);
  }

  @Get('structure-templates/:id')
  getTemplate(@Param('id') id: string) {
    return this.coreService.getStructureTemplate(id);
  }

  @Get('combos')
  listCombos() {
    return this.coreService.listCombos();
  }
}
