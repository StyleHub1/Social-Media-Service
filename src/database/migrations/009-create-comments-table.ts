import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCommentsTable1756500000001 implements MigrationInterface {
  name = 'CreateCommentsTable1756500000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "comments" (
        "id"        uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "authorId"  uuid NOT NULL,
        "postId"    uuid NOT NULL,
        "content"   text NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP NULL,

        CONSTRAINT "FK_comments_author"
          FOREIGN KEY ("authorId")
          REFERENCES "base_users"("id")
          ON DELETE CASCADE,

        CONSTRAINT "FK_comments_post"
          FOREIGN KEY ("postId")
          REFERENCES "posts"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_comments_authorId" ON "comments" ("authorId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_comments_postId" ON "comments" ("postId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_comments_postId_createdAt"
      ON "comments" ("postId", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_comments_postId_createdAt"`);
    await queryRunner.query(`DROP INDEX "IDX_comments_postId"`);
    await queryRunner.query(`DROP INDEX "IDX_comments_authorId"`);
    await queryRunner.query(`DROP TABLE "comments"`);
  }
}