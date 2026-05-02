export const testConfig = {
  database: {
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: 'postgres',
    database: 'test_e2e',
    synchronize: true,
  },
  app: {
    messagePrefix: 'Hello World!',
  },
  auth: {
    jwt: {
      secret: 'secret-123',
      expiresIn: '1m',
    },
  },
};
