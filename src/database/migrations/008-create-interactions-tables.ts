import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInteractionCounters1776500000000 implements MigrationInterface {
  name = 'AddInteractionCounters1776500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "posts"
        ADD COLUMN IF NOT EXISTS "reactionsCount" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "commentsCount"  integer NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "posts"
        DROP COLUMN IF EXISTS "reactionsCount",
        DROP COLUMN IF EXISTS "commentsCount"
    `);
  }
}
