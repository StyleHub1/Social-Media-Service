import { ConflictException, Injectable } from '@nestjs/common';
import { User } from '../entities/user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { UserStatus } from '../enums/user-status.enum';
import { UserRepository } from '../repositories/user.repository';

@Injectable()
export class UserService {
    constructor(
        private readonly userRepository: UserRepository
    ) {}
    public async register(userData: Partial<User>): Promise<User> {
        try {
            return await this.userRepository.createUser(userData);
        } catch (error) {
        if (error.code === '23505') { // PostgreSQL unique violation
            throw new ConflictException('Email already exists');
        }
        throw error;
        }
    }

    public async findByEmail(email: string): Promise<User | null> {
        return await this.userRepository.findByEmail(email);
    }

    public async findByUsername(username: string): Promise<User | null> {
        return await this.userRepository.findByUsername(username);
    }

    public async findByEmailOrUsername(emailOrUsername: string): Promise<User | null> {
        return await this.userRepository.findByEmailOrUsername(emailOrUsername);
    }

    public async findById(id: string): Promise<User | null> {
        return await this.userRepository.findById(id);
    }
}
