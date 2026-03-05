import { BadRequestException, Body, ClassSerializerInterceptor, Controller, Get, HttpCode, HttpStatus, Post, Query, Req, SerializeOptions, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthService } from './services/auth.service';
import { RegistrationDto } from './dto/registration.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyResetCodeDto } from './dto/verify-reset-code.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import { RTGuard } from './guards/RT.guard';
import { RefreshResponseDto } from './dto/refresh-response.dto';

@Controller('auth')
@UseInterceptors(ClassSerializerInterceptor)
export class AuthController {
    constructor(
        private readonly authService: AuthService
    ){}

    @Post('register')
    @Public()
    @HttpCode(HttpStatus.CREATED)
    async register(@Body() input: RegistrationDto):Promise<{ message: string }> {
        return await this.authService.register(input);
    }

    @Post('login')
    @Public()
    @HttpCode(HttpStatus.OK)
    async login(@Body() input: LoginDto):Promise<AuthResponseDto>{
        return await this.authService.login(input);
    }
    @Post('forgot-password')
    @Public()
    @HttpCode(HttpStatus.OK)
    async forgotPassword(@Body() input: ForgotPasswordDto) {
        return await this.authService.forgotPassword(input);
    }
    // @Post('verify-reset-code')
    // @Public()
    // @HttpCode(HttpStatus.OK)
    // async verifyResetCode(@Body() input: VerifyResetCodeDto) {
    //     return await this.authService.verifyResetCode(input);
    // }
    @Post('reset-password')
    @Public()
    @HttpCode(HttpStatus.OK)
    async resetPassword(@Body() input: ResetPasswordDto) {
        return await this.authService.resetPassword(input);
    }

    @Post('logout')
    @HttpCode(HttpStatus.OK)
    async logout(
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: Role,
    ) {
    await this.authService.logout(userId, role);
    return { message: 'Logged out successfully' };
    }

    @Post('refresh')
    @Public()
    @UseGuards(RTGuard)
    @HttpCode(HttpStatus.OK)
    async refreshToken(@Req() req: any): Promise<RefreshResponseDto> {
    const payload = req.user;             // JWT payload from RTGuard
    const storedToken = req.refreshToken; // Stored refresh token entity

    return this.authService.refreshToken(payload, storedToken);
    }
    @Get('verify-email')
    @Public()
    @HttpCode(HttpStatus.OK)
    async verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
    }
}
