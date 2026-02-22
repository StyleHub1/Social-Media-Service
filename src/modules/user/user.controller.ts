import { Controller, Get, NotFoundException, Req, UseGuards } from '@nestjs/common';
import { UserService } from './services/user.service';
import { AuthRequestDto } from '../auth/dto/auth-request.dto';
import { UserProfileDto } from './dto/user-profile.dto';
import { ATGuard } from '../auth/guards/AT.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@Controller('user')
export class UserController {
    constructor(
        private readonly userService: UserService
    ){}
    @Get('/profile')
    @Roles(Role.USER)
    async getProfile(@Req() req:AuthRequestDto) :Promise<UserProfileDto> {
        const user = await this.userService.getProfile(req.user.sub);
        return user;
    }
}
