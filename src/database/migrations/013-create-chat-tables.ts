import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateChatTables1756500000013 implements MigrationInterface {
  name = 'CreateChatTables1756500000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "message_status_enum" AS ENUM ('SENT', 'DELIVERED', 'SEEN')
    `);

    await queryRunner.query(`
      CREATE TABLE "conversations" (
        "id"            uuid      PRIMARY KEY DEFAULT uuid_generate_v4(),
        "participantA"  uuid      NOT NULL,
        "participantB"  uuid      NOT NULL,
        "lastMessageAt" TIMESTAMP,
        "createdAt"     TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"     TIMESTAMP NOT NULL DEFAULT now(),

        CONSTRAINT "UQ_conversations_participants"
          UNIQUE ("participantA", "participantB"),

        CONSTRAINT "CHK_conversations_participants_ordered"
          CHECK ("participantA" < "participantB"),

        CONSTRAINT "FK_conversations_participantA"
          FOREIGN KEY ("participantA")
          REFERENCES "base_users"("id")
          ON DELETE CASCADE,

        CONSTRAINT "FK_conversations_participantB"
          FOREIGN KEY ("participantB")
          REFERENCES "base_users"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_conversations_participantA"
        ON "conversations" ("participantA", "lastMessageAt" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_conversations_participantB"
        ON "conversations" ("participantB", "lastMessageAt" DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE "chat_messages" (
        "id"             uuid                PRIMARY KEY DEFAULT uuid_generate_v4(),
        "conversationId" uuid                NOT NULL,
        "senderId"       uuid                NOT NULL,
        "content"        TEXT                NOT NULL,
        "status"         message_status_enum NOT NULL DEFAULT 'SENT',
        "seenAt"         TIMESTAMP,
        "createdAt"      TIMESTAMP           NOT NULL DEFAULT now(),

        CONSTRAINT "FK_chat_messages_conversation"
          FOREIGN KEY ("conversationId")
          REFERENCES "conversations"("id")
          ON DELETE CASCADE,

        CONSTRAINT "FK_chat_messages_sender"
          FOREIGN KEY ("senderId")
          REFERENCES "base_users"("id")
          ON DELETE CASCADE
      )
    `);

    // Primary read path: cursor pagination (createdAt, id) newest-first
    await queryRunner.query(`
      CREATE INDEX "IDX_chat_messages_conversation_cursor"
        ON "chat_messages" ("conversationId", "createdAt" DESC, "id" DESC)
    `);

    // Unread count: messages not yet SEEN by recipient
    await queryRunner.query(`
      CREATE INDEX "IDX_chat_messages_unread"
        ON "chat_messages" ("conversationId", "senderId", "status")
        WHERE "status" != 'SEEN'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_chat_messages_unread"`);
    await queryRunner.query(
      `DROP INDEX "IDX_chat_messages_conversation_cursor"`,
    );
    await queryRunner.query(`DROP TABLE "chat_messages"`);
    await queryRunner.query(`DROP INDEX "IDX_conversations_participantB"`);
    await queryRunner.query(`DROP INDEX "IDX_conversations_participantA"`);
    await queryRunner.query(`DROP TABLE "conversations"`);
    await queryRunner.query(`DROP TYPE "message_status_enum"`);
  }
}
