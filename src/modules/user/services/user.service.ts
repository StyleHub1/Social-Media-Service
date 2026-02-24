import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { UserProfile } from "../entities/user-profile.entity";
import { UserRepository } from '../repositories/user.repository';
import { UserProfileDto } from '../dto/user-profile.dto';

@Injectable()
export class UserService {
    constructor(
        private readonly userRepository: UserRepository
    ) {}
    public async register(baseUserId: string, userData: Partial<UserProfile>): Promise<UserProfile> {
        userData={...userData, baseUserId: baseUserId};
        try {
            return await this.userRepository.createUser(userData);
        } catch (error) {
        if (error.code === '23505') {
            throw new ConflictException('Username already exists');
        }
        throw error;
        }
    }
    public async findByUsername(username: string): Promise<UserProfile | null> {
        return await this.userRepository.findByUsername(username);
    }

    public async findById(id: string): Promise<UserProfile | null> {
        return await this.userRepository.findById(id);
    }
    public async findByBaseUserId(baseUserId: string): Promise<UserProfile | null> {
        return await this.userRepository.findByBaseUserId(baseUserId);
    }
    public async getProfile(userId: string): Promise<UserProfileDto> {
        const user = await this.userRepository.findByBaseUserId(userId);
        if (!user) {
            throw new NotFoundException('User not found');
        }
        const profile: UserProfileDto = {
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            gender: user.gender,
            phoneNumber: user.phoneNumber,
            numberOfFollowers: 0, // Placeholder, should be calculated based on followers table 
            numberOfFollowing: 0,// Placeholder, should be calculated based on followers table
            numberOfPosts: 0,// Placeholder, should be calculated based on posts table
            bio: user.bio,
            profileImageUrl: user.profileImageUrl

        };
        return profile;
    }
}
