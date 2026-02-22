import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { User } from '../entities/user.entity';
import { UserRepository } from '../repositories/user.repository';
import { UserProfileDto } from '../dto/user-profile.dto';

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
    public async updatePassword(email: string, hashedPassword: string): Promise<void> {
        await this.userRepository.updatePassword(email, hashedPassword);}
    
    public async getProfile(userId: string): Promise<UserProfileDto> {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new NotFoundException('User not found');
        }
        const profile: UserProfileDto = {
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            gender: user.gender,
            numberOfFollowers: 0, // Placeholder, should be calculated based on followers table 
            numberOfFollowing: 0,// Placeholder, should be calculated based on followers table
            numberOfPosts: 0,// Placeholder, should be calculated based on posts table
            bio: user.bio,
            profileImageUrl: user.profileImageUrl

        };
        return profile;
    }
}
