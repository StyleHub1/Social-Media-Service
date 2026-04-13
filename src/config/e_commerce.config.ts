import { registerAs } from "@nestjs/config";

export interface ECommerceConfig {
    serviceUrl: string;
}
export const eCommerceConfig= registerAs('ecommerce', (): ECommerceConfig => ({
    serviceUrl: process.env.E_COMMERCE_SERVICE_URL ?? 'https://ecommerce-app-e6303c36e118.herokuapp.com/api/v1',
}))