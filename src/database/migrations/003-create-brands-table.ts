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
        "phoneNumber" varchar,
        "profileImageUrl" varchar,
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

    // Enable trigram extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);

    // Add trigram index for username
    await queryRunner.query(`
      CREATE INDEX "idx_brand_profiles_username_trgm"
      ON "brand_profiles"
      USING gin ("username" gin_trgm_ops)
    `);

    // Add trigram index for brandName
    await queryRunner.query(`
      CREATE INDEX "idx_brand_profiles_brandname_trgm"
      ON "brand_profiles"
      USING gin ("brandName" gin_trgm_ops)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_brand_profiles_username_trgm"`);
    await queryRunner.query(`DROP INDEX "idx_brand_profiles_brandname_trgm"`);
    await queryRunner.query(`DROP TABLE "brand_profiles"`);
  }
}