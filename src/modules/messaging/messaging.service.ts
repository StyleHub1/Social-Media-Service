import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

@Injectable()
export class MessagingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MessagingService.name);

  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.ConfirmChannel | null = null;

  private readonly url: string;
  private readonly exchange: string;

  private isConnecting = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private buffer: Array<{
    routingKey: string;
    payload: unknown;
  }> = [];

  constructor(private readonly configService: ConfigService) {
    this.url = this.configService.get<string>('rabbitmq.url')!;
    this.exchange = this.configService.get<string>('rabbitmq.exchange')!;
  }

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  // =========================
  // CONNECTION
  // =========================
  private async connect(): Promise<void> {
    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      this.connection = await amqp.connect(this.url);

      this.connection.on('close', () => {
        this.logger.warn('RabbitMQ connection closed — reconnecting...');
        this.reconnect();
      });

      this.connection.on('error', (err) => {
        this.logger.error('RabbitMQ connection error', err.message);
      });

      this.channel = await this.connection.createConfirmChannel();

      await this.channel.assertExchange(this.exchange, 'topic', {
        durable: true,
      });

      this.logger.log(
        `Connected to RabbitMQ — exchange "${this.exchange}" ready`,
      );

      await this.flushBuffer();
    } catch (error) {
      this.logger.warn(
        'RabbitMQ connection failed — retrying...',
        error instanceof Error ? error.message : String(error),
      );
      this.reconnect();
    } finally {
      this.isConnecting = false;
    }
  }

  private reconnect() {
    this.channel = null;
    this.connection = null;
    this.reconnectTimer = setTimeout(() => {
      void this.connect().catch((err) =>
        this.logger.error(
          'RabbitMQ reconnect error',
          err instanceof Error ? err.message : String(err),
        ),
      );
    }, 5000);
  }

  private async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch (err) {
      this.logger.warn(
        'Error during RabbitMQ disconnect',
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  // =========================
  // PUBLISH
  // =========================
  async publish<T>(routingKey: string, payload: T): Promise<void> {
    if (!this.channel) {
      this.logger.warn(`RabbitMQ down — buffering: ${routingKey}`);
      this.buffer.push({ routingKey, payload });
      return;
    }

    const buffer = Buffer.from(JSON.stringify(payload));

    try {
      await new Promise<void>((resolve, reject) => {
        this.channel!.publish(
          this.exchange,
          routingKey,
          buffer,
          {
            persistent: true,
            contentType: 'application/json',
          },
          (err) => {
            if (err) return reject(err);
            resolve();
          },
        );
      });

      this.logger.debug(`Published "${routingKey}"`);
    } catch (error) {
      this.logger.error(`Publish failed — retrying "${routingKey}"`);
      this.buffer.push({ routingKey, payload });
    }
  }

  // =========================
  // BUFFER FLUSH
  // =========================
  private async flushBuffer() {
    if (!this.channel || this.buffer.length === 0) return;

    this.logger.log(`Flushing ${this.buffer.length} buffered messages`);

    const pending = [...this.buffer];
    this.buffer = [];

    for (const msg of pending) {
      await this.publish(msg.routingKey, msg.payload);
    }
  }
}
