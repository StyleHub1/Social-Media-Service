import { Test, TestingModule } from '@nestjs/testing';
import { PasswordService } from '../services/password.service';
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashedPassword'),
  compare: jest.fn().mockResolvedValue(true),
}));
describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PasswordService],
    }).compile();

    service = module.get<PasswordService>(PasswordService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  //bcrypt.hash -> was called with the correct password and salt
  // mocks and spies
  //spies is used to track calls to a function and its arguments, while mocks can replace the implementation of a function with a custom one.
  it('should hash password correctly', async () => {
    const password = 'myPassword';
    const saltRounds = 10;
    const hashSpy = jest.spyOn(require('bcrypt'), 'hash');
    await service.hashPassword(password);
    expect(hashSpy).toHaveBeenCalledWith(password, saltRounds);
  });

  it('should compare password correctly', async () => {
    const password = 'myPassword';
    const hashedPassword = 'hashedPassword';
    const compareSpy = jest.spyOn(require('bcrypt'), 'compare');
    const result = await service.verifyPassword(password, hashedPassword);
    expect(compareSpy).toHaveBeenCalledWith(password, hashedPassword);
    expect(result).toBe(true);
  });

  it('should fail on incorrect password', async () => {
    const password = 'myPassword';
    const hashedPassword = 'hashedPassword';
    jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(false);
    const result = await service.verifyPassword(password, hashedPassword);
    expect(result).toBe(false);
  });
});
