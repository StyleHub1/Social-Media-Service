import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePostsTable1707486000000 implements MigrationInterface {
  name = 'CreatePostsTable1707486000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create visibility enum type
    await queryRunner.query(`
      CREATE TYPE "posts_visibility_enum" AS ENUM ('PUBLIC', 'FOLLOWERS', 'PRIVATE')
    `);

    // Create posts table
    await queryRunner.query(`
      CREATE TABLE "posts" (
        "id"         uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
        "content"    text,
        "images"     text[]      NOT NULL DEFAULT '{}',
        "videos"     text[]      NOT NULL DEFAULT '{}',
        "authorId"   uuid        NOT NULL,
        "visibility" "posts_visibility_enum" NOT NULL DEFAULT 'PUBLIC',
        "createdAt"  TIMESTAMP   NOT NULL DEFAULT now(),
        "updatedAt"  TIMESTAMP   NOT NULL DEFAULT now(),
        "deletedAt"  TIMESTAMP,

        CONSTRAINT "FK_posts_author"
          FOREIGN KEY ("authorId")
          REFERENCES "base_users"("id")
          ON DELETE CASCADE
      )
    `);

    // Index on authorId (for fetching posts by a specific user)
    await queryRunner.query(`
      CREATE INDEX "IDX_posts_authorId"
      ON "posts" ("authorId")
    `);

    // Index on createdAt (for sorting / feed queries)
    await queryRunner.query(`
      CREATE INDEX "IDX_posts_createdAt"
      ON "posts" ("createdAt")
    `);

    // Composite index on (authorId, createdAt) (for paginated user-feed queries)
    await queryRunner.query(`
      CREATE INDEX "IDX_posts_authorId_createdAt"
      ON "posts" ("authorId", "createdAt")
    `);

    // Partial index: exclude soft-deleted rows from all standard queries
    await queryRunner.query(`
      CREATE INDEX "IDX_posts_active"
      ON "posts" ("authorId", "createdAt")
      WHERE "deletedAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_posts_active"`);
    await queryRunner.query(`DROP INDEX "IDX_posts_authorId_createdAt"`);
    await queryRunner.query(`DROP INDEX "IDX_posts_createdAt"`);
    await queryRunner.query(`DROP INDEX "IDX_posts_authorId"`);
    await queryRunner.query(`DROP TABLE "posts"`);
    await queryRunner.query(`DROP TYPE "posts_visibility_enum"`);
  }
}
