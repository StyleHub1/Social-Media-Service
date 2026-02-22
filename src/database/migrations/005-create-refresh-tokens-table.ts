import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateRefreshTokensTable1707485100000 implements MigrationInterface {
  name = 'CreateRefreshTokensTable1707485100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tokenHash" varchar NOT NULL,
        "userId" uuid,
        "brandId" uuid,
        "expiresAt" TIMESTAMP NOT NULL,
        "isRevoked" boolean NOT NULL DEFAULT false,
        "ipAddress" varchar,
        "userAgent" varchar,
        "createdAt" TIMESTAMP DEFAULT now(),

        CONSTRAINT "FK_refresh_user"
          FOREIGN KEY ("userId")
          REFERENCES "users"("id")
          ON DELETE CASCADE,

        CONSTRAINT "FK_refresh_brand"
          FOREIGN KEY ("brandId")
          REFERENCES "brands"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_refresh_user" ON "refresh_tokens" ("userId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_refresh_brand" ON "refresh_tokens" ("brandId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
  }
}