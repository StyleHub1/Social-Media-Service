import { Injectable } from "@nestjs/common";
import { User } from "../entities/user.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

@Injectable()
export class UserRepository {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>
    ){}

    async createUser(user: Partial<User>): Promise<User> {
        const newUser = this.userRepository.create(user);
        return await this.userRepository.save(newUser);
    }
    async findByEmail(email: string): Promise<User | null> {
        return await this.userRepository.findOne({ where: { email } });
    }

    async findByUsername(username: string): Promise<User | null> {
        return await this.userRepository.findOne({ where: { username } });
    }

    async findById(id: string): Promise<User | null> {
        return await this.userRepository.findOne({ where: { id } });
    }

    async updateUser(id: string, updates: Partial<User>): Promise<User|null> {
        await this.userRepository.update(id, updates);
        return await this.findById(id);
    }

    async deleteUser(id: string): Promise<void> { // Soft delete to allow for potential recovery and auditing
    await this.userRepository.softDelete(id);
    }
    async getPasswordHash(id: string): Promise<string | null> {
        const user = await this.userRepository.findOne({ where: { id }, select: ['password'] });
        return user ? user.password : null;
    }
    async findByEmailOrUsername(emailOrUsername: string): Promise<User | null> {
        return await this.userRepository.findOne({
            where: [{ email: emailOrUsername }, { username: emailOrUsername }],
            select: ['id', 'email', 'username', 'password', 'role', 'firstName', 'lastName'], // Include password for authentication
        });
    }
    async updatePassword(email: string, hashedPassword: string): Promise<void> {
        await this.userRepository.update({ email }, { password: hashedPassword });
    }
}