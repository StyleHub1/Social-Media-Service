import { registerAs } from "@nestjs/config";

export interface EmailConfig{
    email: {
         BREVO_API_KEY: string;
         EMAIL_FROM: string;
         EMAIL_NAME: string;
    }
}

export const emailConfig = registerAs('email', (): EmailConfig => ({
    email: {
    BREVO_API_KEY: process.env.BREVO_API_KEY as string,
    EMAIL_FROM: process.env.EMAIL_FROM || 'omarsherifelghamry@gmail.com',
    EMAIL_NAME: process.env.EMAIL_NAME || 'StyleHub'
}
}))