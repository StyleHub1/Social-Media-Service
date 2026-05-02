import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
@Injectable()
export class PasswordService {
  private readonly SALT_ROUNDS = 10; // Number of salt rounds for bcrypt hashing

  public async hashPassword(plainPassword: string): Promise<string> {
    return await bcrypt.hash(plainPassword, this.SALT_ROUNDS);
  }

  public async verifyPassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }
}
