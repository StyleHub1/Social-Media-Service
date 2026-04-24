import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFollowsTable1756500000000 implements MigrationInterface {
  name = 'CreateFollowsTable1756500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "follows_status_enum" AS ENUM ('ACTIVE', 'BLOCKED')
    `);

    await queryRunner.query(`
      CREATE TABLE "follows" (
        "id"          uuid      PRIMARY KEY DEFAULT uuid_generate_v4(),
        "followerId"  uuid      NOT NULL,
        "followingId" uuid      NOT NULL,
        "status"      "follows_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),

        CONSTRAINT "UQ_follows_follower_following" UNIQUE ("followerId", "followingId"),

        CONSTRAINT "FK_follows_follower"
          FOREIGN KEY ("followerId")
          REFERENCES "base_users"("id")
          ON DELETE CASCADE,

        CONSTRAINT "FK_follows_following"
          FOREIGN KEY ("followingId")
          REFERENCES "base_users"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_follows_followerId" ON "follows" ("followerId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_follows_followingId" ON "follows" ("followingId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_follows_followingId"`);
    await queryRunner.query(`DROP INDEX "IDX_follows_followerId"`);
    await queryRunner.query(`DROP TABLE "follows"`);
    await queryRunner.query(`DROP TYPE "follows_status_enum"`);
  }
}
