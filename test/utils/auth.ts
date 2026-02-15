// test/utils/test-accounts.ts
import { Role } from 'src/modules/common/enums/role.enum';
import { Gender } from 'src/modules/user/enums/user-gender';

export const testUserAccount = {
  role: Role.USER,
  email: 'user@example.com',
  username: 'testuser',
  password: 'Password123!',
  passwordConfirmation: 'Password123!',
  firstName: 'Omar',
  lastName: 'Sherif',
  gender: Gender.MALE,
  phoneNumber: '+201234567890',
  bio: 'Hello, I am a test user',
  profileImageUrl: 'http://example.com/avatar.png',
};

export const testBrandAccount = {
  role: Role.BRAND,
  email: 'brand@example.com',
  username: 'testbrand',
  password: 'Brand123!',
  passwordConfirmation: 'Brand123!',
  brandName: 'MyBrand',
  websiteUrl: 'https://mybrand.com',
  phoneNumber: '+201234567891',
  bio: 'This is a test brand',
  profileImageUrl: 'http://example.com/brand.png',
};

export const usrLoginDto = {
    emailOrUsername: testUserAccount.email,
    password: testUserAccount.password,
    role: Role.USER,
}
export const brandLoginDto = {
    emailOrUsername: testBrandAccount.email,
    password: testBrandAccount.password,
    role: Role.BRAND,
 }