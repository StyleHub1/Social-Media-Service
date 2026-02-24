import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateResetTokensTable1807483924000 implements MigrationInterface {
  name = 'CreateResetTokensTable1807483924000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "reset_tokens" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

        "baseUserId" uuid NOT NULL,
        "token" varchar NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),

        CONSTRAINT "FK_reset_base_user"
          FOREIGN KEY ("baseUserId")
          REFERENCES "base_users"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_reset_base_user"
      ON "reset_tokens" ("baseUserId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "reset_tokens"`);
  }
}