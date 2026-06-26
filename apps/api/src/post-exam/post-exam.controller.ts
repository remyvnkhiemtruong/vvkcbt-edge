import { Controller, Get, Post, Param, Body, Res, Query, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ManualReviewService } from './grading/manual-review.service';
import { AnonymizationService } from './anonymization/anonymization.service';
import { CalibrationService } from './calibration/calibration.service';
import { PdfService } from './pdf/pdf.service';
import { AuditService } from '../shared/audit/audit.service';
import { StaffAuthGuard, StaffRoles } from '../shared/guards/staff-auth.guard';

@Controller('post-exam')
@UseGuards(StaffAuthGuard)
export class PostExamController {
  constructor(
    private readonly reviewService: ManualReviewService,
    private readonly anonymizationService: AnonymizationService,
    private readonly calibrationService: CalibrationService,
    private readonly pdfService: PdfService,
    private readonly auditService: AuditService,
  ) {}

  @Get('grading/pending')
  @StaffRoles('admin', 'proctor', 'composer')
  listPending(@Query('examSessionId') examSessionId?: string) {
    return this.reviewService.listPending(examSessionId);
  }

  @Post('grading/:flagId/review')
  @StaffRoles('admin', 'proctor')
  review(
    @Param('flagId') flagId: string,
    @Body()
    body: {
      reviewedScore: number;
      reviewedBy: string;
      rubricScores?: Array<{ partKey: string; score: number; maxScore: number }>;
    },
  ) {
    return this.reviewService.review(
      flagId,
      body.reviewedScore,
      body.reviewedBy,
      body.rubricScores,
    );
  }

  @Post('anonymize/:examSessionId/generate')
  @StaffRoles('admin')
  generateHashes(@Param('examSessionId') examSessionId: string) {
    return this.anonymizationService.generateForSession(examSessionId);
  }

  @Get('anonymize/:examSessionId')
  @StaffRoles('admin', 'proctor')
  listMasked(@Param('examSessionId') examSessionId: string) {
    return this.anonymizationService.listMasked(examSessionId);
  }

  @Post('anonymize/:examSessionId/reveal')
  @StaffRoles('admin')
  reveal(
    @Param('examSessionId') examSessionId: string,
    @Body() body: { authorizedBy: string },
  ) {
    return this.anonymizationService.reveal(examSessionId, body.authorizedBy);
  }

  @Get('calibration/alerts')
  @StaffRoles('admin')
  getAlerts() {
    return this.calibrationService.getAlerts();
  }

  @Post('calibration/:questionId/lower')
  @StaffRoles('admin')
  lowerDifficulty(@Param('questionId') questionId: string) {
    return this.calibrationService.lowerDifficulty(questionId);
  }

  @Get('pdf/:studentSessionId')
  @StaffRoles('admin', 'proctor')
  async exportPdf(@Param('studentSessionId') studentSessionId: string, @Res() res: Response) {
    const pdf = await this.pdfService.exportExamPdf(studentSessionId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=exam-${studentSessionId}.pdf`);
    res.send(pdf);
  }

  @Get('audit/:examSessionId')
  @StaffRoles('admin', 'proctor')
  async getAudit(@Param('examSessionId') examSessionId: string) {
    return this.auditService.findEnrichedBySession(examSessionId);
  }
}
