import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateResetTokensTable1807483924000 implements MigrationInterface {
  name = 'CreateResetTokensTable1807483924000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."resettokens_role_enum" AS ENUM ('USER', 'BRAND');
    `);

    await queryRunner.query(`
      CREATE TABLE "ResetTokens" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "email" varchar NOT NULL UNIQUE,
        "role" "public"."resettokens_role_enum" NOT NULL,
        "token" varchar NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_resettokens_id" ON "ResetTokens" ("id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_resettokens_id"`);
    await queryRunner.query(`DROP TABLE "ResetTokens"`);
    await queryRunner.query(`DROP TYPE "public"."resettokens_role_enum"`);
  }
}