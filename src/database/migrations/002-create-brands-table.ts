import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateBrandsTable1707483923456 implements MigrationInterface {
  name = 'CreateBrandsTable1707483923456';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "brands" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "email" varchar(255) NOT NULL UNIQUE,
        "password" varchar NOT NULL,
        "role" varchar NOT NULL DEFAULT 'BRAND',
        "isEmailVerified" boolean NOT NULL DEFAULT false,
        "refreshToken" varchar,
        "brandName" varchar(255) NOT NULL,
        "username" varchar(100) NOT NULL UNIQUE,
        "websiteUrl" varchar,
        "bio" varchar,
        "profileImageUrl" varchar,
        "phoneNumber" varchar,
        "status" varchar NOT NULL DEFAULT 'PENDING_VERIFICATION',
        "isVerified" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP DEFAULT now(),
        "updatedAt" TIMESTAMP DEFAULT now(),
        "deletedAt" TIMESTAMP
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "brands"`);
  }
}