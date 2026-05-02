import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationsTable1756500000012 implements MigrationInterface {
  name = 'CreateNotificationsTable1756500000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "notification_type_enum" AS ENUM (
        'NEW_FOLLOWER',
        'POST_LIKED',
        'POST_COMMENTED'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id"          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
        "recipientId" uuid        NOT NULL,
        "actorId"     uuid,
        "type"        "notification_type_enum" NOT NULL,
        "postId"      uuid,
        "isRead"      boolean     NOT NULL DEFAULT false,
        "readAt"      TIMESTAMP,
        "createdAt"   TIMESTAMP   NOT NULL DEFAULT now(),

        CONSTRAINT "FK_notifications_recipient"
          FOREIGN KEY ("recipientId")
          REFERENCES "base_users"("id")
          ON DELETE CASCADE,

        CONSTRAINT "FK_notifications_actor"
          FOREIGN KEY ("actorId")
          REFERENCES "base_users"("id")
          ON DELETE SET NULL,

        CONSTRAINT "FK_notifications_post"
          FOREIGN KEY ("postId")
          REFERENCES "posts"("id")
          ON DELETE SET NULL
      )
    `);

    // Primary read path: fetch a user's notifications ordered by newest first
    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_recipient_createdAt"
        ON "notifications" ("recipientId", "createdAt" DESC)
    `);

    // Unread-count query: WHERE recipientId = ? AND isRead = false
    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_recipient_unread"
        ON "notifications" ("recipientId", "isRead")
        WHERE "isRead" = false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_notifications_recipient_unread"`);
    await queryRunner.query(
      `DROP INDEX "IDX_notifications_recipient_createdAt"`,
    );
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TYPE "notification_type_enum"`);
  }
}
