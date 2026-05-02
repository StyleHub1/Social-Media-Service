import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFeedItemsTable1756500000010 implements MigrationInterface {
  name = 'CreateFeedItemsTable1756500000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "feed_items" (
        "id"        uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "ownerId"   uuid NOT NULL,
        "postId"    uuid NOT NULL,
        "authorId"  uuid NOT NULL,
        "type"      VARCHAR(10) NOT NULL DEFAULT 'POST',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),

        CONSTRAINT "UQ_feed_items_owner_post"
          UNIQUE ("ownerId", "postId"),

        CONSTRAINT "FK_feed_items_owner"
          FOREIGN KEY ("ownerId")
          REFERENCES "base_users"("id")
          ON DELETE CASCADE,

        CONSTRAINT "FK_feed_items_post"
          FOREIGN KEY ("postId")
          REFERENCES "posts"("id")
          ON DELETE CASCADE,

        CONSTRAINT "FK_feed_items_author"
          FOREIGN KEY ("authorId")
          REFERENCES "base_users"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_feed_items_owner_createdAt"
        ON "feed_items" ("ownerId", "createdAt" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_feed_items_owner_authorId"
        ON "feed_items" ("ownerId", "authorId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_feed_items_postId"
        ON "feed_items" ("postId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_feed_items_postId"`);
    await queryRunner.query(`DROP INDEX "IDX_feed_items_owner_authorId"`);
    await queryRunner.query(`DROP INDEX "IDX_feed_items_owner_createdAt"`);
    await queryRunner.query(`DROP TABLE "feed_items"`);
  }
}
