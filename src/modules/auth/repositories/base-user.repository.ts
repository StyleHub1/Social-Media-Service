import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseUser } from '../entities/base-user.entity';

@Injectable()
export class BaseUsersRepository {
  constructor(
    @InjectRepository(BaseUser)
    private readonly baseUserRepo: Repository<BaseUser>,
  ) {}

  async findByEmail(email: string): Promise<BaseUser | null> {
    return this.baseUserRepo.findOne({ where: { email } });
  }

  async findById(id: string): Promise<BaseUser | null> {
    return this.baseUserRepo.findOne({ where: { id } });
  }

  async create(data: Partial<BaseUser>): Promise<BaseUser> {
    const user = this.baseUserRepo.create(data);
    return this.baseUserRepo.save(user);
  }

  async update(id: string, data: Partial<BaseUser>): Promise<BaseUser | null> {
    const user = await this.findById(id);
    if (!user) return null;

    Object.assign(user, data);
    return this.baseUserRepo.save(user);
  }

  async incrementField(
    id: string,
    field: keyof BaseUser,
    value: number,
  ): Promise<void> {
    await this.baseUserRepo.increment({ id }, field as string, value);
  }

  async delete(id: string): Promise<void> {
    await this.baseUserRepo.delete({ id });
  }
}
