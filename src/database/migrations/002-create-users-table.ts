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
        "phoneNumber" varchar,
        "bio" varchar,
        "gender" varchar,
        "profileImageUrl" varchar,
        "status" varchar NOT NULL DEFAULT 'PENDING_VERIFICATION',

        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),

        CONSTRAINT "FK_user_profile_base_user"
          FOREIGN KEY ("baseUserId")
          REFERENCES "base_users"("id")
          ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user_profiles"`);
  }
}