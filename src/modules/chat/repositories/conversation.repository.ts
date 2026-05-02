import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Conversation } from '../entities/conversation.entity';
import { PaginationResponse } from '../../common/pagination/pagination.response';

@Injectable()
export class ConversationRepository {
  constructor(
    @InjectRepository(Conversation)
    private readonly repo: Repository<Conversation>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Returns the existing conversation between two participants or creates one.
   * UUIDs are sorted before insert so the UNIQUE constraint on
   * (participantA, participantB) is always satisfied with canonical ordering.
   */
  async findOrCreate(userIdA: string, userIdB: string): Promise<Conversation> {
    const [pA, pB] = [userIdA, userIdB].sort();

    await this.dataSource.query(
      `INSERT INTO "conversations" ("participantA", "participantB")
       VALUES ($1, $2)
       ON CONFLICT ("participantA", "participantB") DO NOTHING`,
      [pA, pB],
    );

    return this.repo.findOneOrFail({
      where: { participantA: pA, participantB: pB },
    });
  }

  findById(id: string): Promise<Conversation | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByUser(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<PaginationResponse<Conversation>> {
    const [items, total] = await this.repo
      .createQueryBuilder('c')
      .where('c.participantA = :userId OR c.participantB = :userId', { userId })
      .orderBy('c.lastMessageAt', 'DESC', 'NULLS LAST')
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    return { items, meta: { total, limit, offset } };
  }

  async updateLastMessageAt(id: string, timestamp: Date): Promise<void> {
    await this.repo.update(id, { lastMessageAt: timestamp });
  }
}
