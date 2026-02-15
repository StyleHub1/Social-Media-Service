import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUsersTable1707483900000 implements MigrationInterface {
  name = 'CreateUsersTable1707483900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "email" varchar(255) NOT NULL UNIQUE,
        "password" varchar NOT NULL,
        "role" varchar NOT NULL DEFAULT 'USER',
        "isEmailVerified" boolean NOT NULL DEFAULT false,
        "refreshToken" varchar,
        "firstName" varchar(100),
        "lastName" varchar(100),
        "username" varchar(100) NOT NULL UNIQUE,
        "phoneNumber" varchar,
        "bio" varchar,
        "gender" varchar,
        "profileImageUrl" varchar,
        "status" varchar NOT NULL DEFAULT 'PENDING_VERIFICATION',
        "createdAt" TIMESTAMP DEFAULT now(),
        "updatedAt" TIMESTAMP DEFAULT now(),
        "deletedAt" TIMESTAMP,
        "lastLogin" TIMESTAMP
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`);
  }
}