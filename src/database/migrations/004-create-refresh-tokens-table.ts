import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRefreshTokensTable1707485100000 implements MigrationInterface {
  name = 'CreateRefreshTokensTable1707485100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tokenHash" varchar NOT NULL,

        "baseUserId" uuid NOT NULL,

        "expiresAt" TIMESTAMP NOT NULL,
        "isRevoked" boolean NOT NULL DEFAULT false,
        "ipAddress" varchar,
        "userAgent" varchar,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),

        CONSTRAINT "FK_refresh_base_user"
          FOREIGN KEY ("baseUserId")
          REFERENCES "base_users"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_refresh_base_user"
      ON "refresh_tokens" ("baseUserId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
  }
}
