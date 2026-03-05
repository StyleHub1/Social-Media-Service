import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateBaseUsersTable1707483901000 implements MigrationInterface {
  name = 'CreateBaseUsersTable1707483901000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "base_users" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "email" varchar(255) NOT NULL UNIQUE,
        "password" varchar NOT NULL,
        "role" varchar NOT NULL,
        "isEmailVerified" boolean NOT NULL DEFAULT false,
        "isProfileComplete" boolean NOT NULL DEFAULT false,
        "isActive" boolean NOT NULL DEFAULT true,

        "followersCount" integer NOT NULL DEFAULT 0,
        "followingCount" integer NOT NULL DEFAULT 0,
        "postsCount" integer NOT NULL DEFAULT 0,

        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "base_users"`);
    await queryRunner.query(`DROP TYPE "base_users_role_enum"`);
  }
}