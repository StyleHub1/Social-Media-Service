import { validate } from 'class-validator';
import { RegistrationDto } from '../dto/registration.dto';
import { Role } from 'src/modules/common/enums/role.enum';
import { Gender } from 'src/modules/user/enums/user-gender';

describe('RegistrationDto', () => {
  const createValidUserDto = (): RegistrationDto => {
    const dto = new RegistrationDto();
    dto.role = Role.USER;
    dto.email = 'test@example.com';
    dto.password = 'Password123!';
    dto.passwordConfirmation = 'Password123!';
    dto.username = 'testuser';
    dto.firstName = 'Test';
    dto.lastName = 'User';
    dto.phoneNumber = '0123456789';
    dto.gender = Gender.MALE;
    dto.bio = 'Hello world';
    dto.profileImageUrl = 'http://example.com/avatar.png';
    return dto;
  };

  const createValidBrandDto = (): RegistrationDto => {
    const dto = new RegistrationDto();
    dto.role = Role.BRAND;
    dto.email = 'brand@example.com';
    dto.password = 'BrandPass123!';
    dto.passwordConfirmation = 'BrandPass123!';
    dto.username = 'branduser';
    dto.brandName = 'My Brand';
    dto.websiteUrl = 'https://mybrand.com';
    return dto;
  };

  const getPasswordErrors = async (password: string) => {
    const dto = createValidUserDto();
    dto.password = password;
    dto.passwordConfirmation = password;

    const errors = await validate(dto);
    return errors.find(e => e.property === 'password');
  };

  it('should validate a complete USER registration', async () => {
    const errors = await validate(createValidUserDto());
    expect(errors).toHaveLength(0);
  });

  it('should validate a complete BRAND registration', async () => {
    const errors = await validate(createValidBrandDto());
    expect(errors).toHaveLength(0);
  });

  it('should fail when required fields are missing', async () => {
    const dto = new RegistrationDto();
    dto.role = Role.USER;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when password and confirmation do not match', async () => {
    const dto = createValidUserDto();
    dto.passwordConfirmation = 'DifferentPassword123!';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  describe('Password complexity rules', () => {
    it('should fail when password has no uppercase letter', async () => {
      const passwordErrors = await getPasswordErrors('password123!');
      expect(passwordErrors).toBeDefined();
      expect(Object.values(passwordErrors?.constraints ?? {}))
        .toContain('Password must contain at least one uppercase letter');
    });

    it('should fail when password has no lowercase letter', async () => {
      const passwordErrors = await getPasswordErrors('PASSWORD123!');
      expect(passwordErrors).toBeDefined();
      expect(Object.values(passwordErrors?.constraints ?? {}))
        .toContain('Password must contain at least one lowercase letter');
    });

    it('should fail when password has no number', async () => {
      const passwordErrors = await getPasswordErrors('Password!');
      expect(passwordErrors).toBeDefined();
      expect(Object.values(passwordErrors?.constraints ?? {}))
        .toContain('Password must contain at least one number');
    });

    it('should fail when password has no special character', async () => {
      const passwordErrors = await getPasswordErrors('Password123');
      expect(passwordErrors).toBeDefined();
      expect(Object.values(passwordErrors?.constraints ?? {}))
        .toContain(
          'Password must contain at least one special character (@$!%*?&)'
        );
    });
  });
});