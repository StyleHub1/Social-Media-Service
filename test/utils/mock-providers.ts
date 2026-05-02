// test/utils/mock-providers.ts

export const mockEmailService = {
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
};

export const mockMessagingService = {
  publish: jest.fn().mockResolvedValue(undefined),
  onModuleInit: jest.fn().mockResolvedValue(undefined),
  onModuleDestroy: jest.fn().mockResolvedValue(undefined),
};

export const mockCloudinaryService = {
  uploadFile: jest.fn().mockResolvedValue({
    secure_url: 'https://res.cloudinary.com/test/image/upload/test.jpg',
    public_id: 'test/test',
    url: 'http://res.cloudinary.com/test/image/upload/test.jpg',
  }),
};
