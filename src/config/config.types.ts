import { TypeOrmModuleOptions } from "@nestjs/typeorm/dist/interfaces/typeorm-options.interface";
import { AppConfig } from "./app.config";
import * as Joi from 'joi';
import { AuthConfig } from "./auth.config";
export interface ConfigType{
   app:AppConfig;
   database:TypeOrmModuleOptions;
   auth: AuthConfig;
}
export const appConfigSchema = Joi.object({
    APP_MESSAGE_PREFIX: Joi.string().default('Hello'),
    DB_HOST: Joi.string().default('localhost'),
    DB_PORT: Joi.number().default(5432),
    DB_USERNAME: Joi.string().required(),
    DB_PASSWORD: Joi.string().required(),
    DB_NAME: Joi.string().required(),
    JWT_TOKEN: Joi.string().required(),
    JWT_EXPIRES_IN: Joi.string().required(),
})
