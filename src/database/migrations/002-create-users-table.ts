import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUserProfilesTable1707483902000 implements MigrationInterface {
  name = 'CreateUserProfilesTable1707483902000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_profiles" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "baseUserId" uuid NOT NULL UNIQUE,
        "firstName" varchar(100),
        "lastName" varchar(100),
        "username" varchar(100) NOT NULL UNIQUE,
        "profileImageUrl" varchar,
        "phoneNumber" varchar,
        "bio" varchar,
        "gender" varchar,
        "status" varchar NOT NULL DEFAULT 'PENDING_VERIFICATION',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_user_profile_base_user"
          FOREIGN KEY ("baseUserId")
          REFERENCES "base_users"("id")
          ON DELETE CASCADE
      )
    `);

    // Enable trigram extension for fast LIKE/ILIKE searches
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);

    // Add trigram index for username
    await queryRunner.query(`
      CREATE INDEX "idx_user_profiles_username_trgm"
      ON "user_profiles"
      USING gin ("username" gin_trgm_ops)
    `);

    // Add trigram index for firstName
    await queryRunner.query(`
      CREATE INDEX "idx_user_profiles_firstname_trgm"
      ON "user_profiles"
      USING gin ("firstName" gin_trgm_ops)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_user_profiles_username_trgm"`);
    await queryRunner.query(`DROP INDEX "idx_user_profiles_firstname_trgm"`);
    await queryRunner.query(`DROP TABLE "user_profiles"`);
  }
}