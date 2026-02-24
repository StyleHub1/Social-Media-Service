import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateBrandProfilesTable1707483903000 implements MigrationInterface {
  name = 'CreateBrandProfilesTable1707483903000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "brand_profiles" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

        "baseUserId" uuid NOT NULL UNIQUE,

        "brandName" varchar(255) NOT NULL,
        "username" varchar(100) NOT NULL UNIQUE,
        "websiteUrl" varchar,
        "bio" varchar,
        "profileImageUrl" varchar,
        "phoneNumber" varchar,
        "isVerified" boolean NOT NULL DEFAULT false,
        "status" varchar NOT NULL DEFAULT 'PENDING_VERIFICATION',

        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),

        CONSTRAINT "FK_brand_profile_base_user"
          FOREIGN KEY ("baseUserId")
          REFERENCES "base_users"("id")
          ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "brand_profiles"`);
  }
}