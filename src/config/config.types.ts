import { TypeOrmModuleOptions } from "@nestjs/typeorm/dist/interfaces/typeorm-options.interface";
import { AppConfig } from "./app.config";
import * as Joi from 'joi';
import { AuthConfig } from "./auth.config";
import { EmailConfig } from "./email.config";
export interface ConfigType{
   app:AppConfig;
   database:TypeOrmModuleOptions;
   auth: AuthConfig;
   email:EmailConfig

}
export const appConfigSchema = Joi.object({
  APP_MESSAGE_PREFIX: Joi.string().default('Hello'),

  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().default(5432),

  DB_USERNAME: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.optional(),
    otherwise: Joi.string().required(),
  }),

  DB_PASSWORD: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.optional(),
    otherwise: Joi.string().required(),
  }),

  DB_NAME: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.optional(),
    otherwise: Joi.string().required(),
  }),

  DATABASE_URL: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),

  JWT_TOKEN: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().required(),
  BREVO_API_KEY: Joi.string().default('your_brevo_api_key_here'),
  EMAIL_FROM: Joi.string().email().default("omarsherifelghamry@gmail.com"),
  EMAIL_NAME: Joi.string().default("StyleHub"),
  JWT_REFRESH_TOKEN: Joi.string().required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().required(),
  REFRESH_TOKEN_HASH_SECRET: Joi.string().required(),
  JWT_EMAIL_VERIFICATION_SECRET: Joi.string().required(),
  JWT_EMAIL_VERIFICATION_EXPIRES_IN: Joi.string().required(),
});
