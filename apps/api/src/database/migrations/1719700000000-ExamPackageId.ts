import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExamPackageId1719700000000 implements MigrationInterface {
  name = 'ExamPackageId1719700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE exam_sessions
        ADD COLUMN IF NOT EXISTS package_id UUID UNIQUE
    `);
    await queryRunner.query(`
      ALTER TABLE question_bank
        ADD COLUMN IF NOT EXISTS package_id UUID
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_question_bank_package_id ON question_bank(package_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_question_bank_package_id`);
    await queryRunner.query(`ALTER TABLE question_bank DROP COLUMN IF EXISTS package_id`);
    await queryRunner.query(`ALTER TABLE exam_sessions DROP COLUMN IF EXISTS package_id`);
  }
}
