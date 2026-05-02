import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLikesTable1756500000002 implements MigrationInterface {
  name = 'CreateLikesTable1756500000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "likes" (
        "id"        uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId"    uuid NOT NULL,
        "postId"    uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),

        CONSTRAINT "UQ_likes_user_post"
          UNIQUE ("userId", "postId"),

        CONSTRAINT "FK_likes_user"
          FOREIGN KEY ("userId")
          REFERENCES "base_users"("id")
          ON DELETE CASCADE,

        CONSTRAINT "FK_likes_post"
          FOREIGN KEY ("postId")
          REFERENCES "posts"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_likes_userId" ON "likes" ("userId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_likes_postId" ON "likes" ("postId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_likes_postId"`);
    await queryRunner.query(`DROP INDEX "IDX_likes_userId"`);
    await queryRunner.query(`DROP TABLE "likes"`);
  }
}
