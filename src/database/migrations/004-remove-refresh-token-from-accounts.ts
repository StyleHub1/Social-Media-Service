import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveRefreshTokenFromAccounts1707485000000 implements MigrationInterface {
  name = 'RemoveRefreshTokenFromAccounts1707485000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN "refreshToken"
    `);

    await queryRunner.query(`
      ALTER TABLE "brands"
      DROP COLUMN "refreshToken"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD "refreshToken" varchar
    `);

    await queryRunner.query(`
      ALTER TABLE "brands"
      ADD "refreshToken" varchar
    `);
  }
}