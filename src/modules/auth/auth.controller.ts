import { Body, ClassSerializerInterceptor, Controller, HttpCode, HttpStatus, Post, SerializeOptions, UseInterceptors } from '@nestjs/common';
import { AuthService } from './services/auth.service';
import { RegistrationDto } from './dto/registration.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyResetCodeDto } from './dto/verify-reset-code.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Controller('auth')
@UseInterceptors(ClassSerializerInterceptor)
export class AuthController {
    constructor(
        private readonly authService: AuthService
    ){}

    @Post('register')
    @HttpCode(HttpStatus.CREATED)
    async register(@Body() input: RegistrationDto):Promise<AuthResponseDto>{
        return await this.authService.register(input);
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    async login(@Body() input: LoginDto):Promise<AuthResponseDto>{
        return await this.authService.login(input);
    }
    @Post('forgot-password')
    @HttpCode(HttpStatus.OK)
    async forgotPassword(@Body() input: ForgotPasswordDto) {
        return await this.authService.forgotPassword(input);
    }

    // 2. Verify Code (Check)
    @Post('verify-reset-code')
    @HttpCode(HttpStatus.OK)
    async verifyResetCode(@Body() input: VerifyResetCodeDto) {
        return await this.authService.verifyResetCode(input);
    }

    // 3. Reset Password (Action)
    @Post('reset-password')
    @HttpCode(HttpStatus.OK)
    async resetPassword(@Body() input: ResetPasswordDto) {
        return await this.authService.resetPassword(input);
    }
}
