import { registerAs } from '@nestjs/config';

export interface RabbitMQConfig {
  url: string;
  exchange: string;
}

export const rabbitmqConfig = registerAs(
  'rabbitmq',
  (): RabbitMQConfig => ({
    url: process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672',
    exchange: process.env.RABBITMQ_EXCHANGE ?? 'stylehub',
  }),
);
