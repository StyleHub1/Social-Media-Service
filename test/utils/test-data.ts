// test/utils/test-accounts.ts
import { Role } from 'src/modules/common/enums/role.enum';
import { Gender } from 'src/modules/user/enums/user-gender';

export const testAccount = {
  role: Role.USER,
  email: 'user@example.com',
  password: 'Password123!',
  confirmationPassword: 'Password123!',
};
export const testBrandAccount = {
  role: Role.BRAND,
  email: 'brand@example.com',
  password: 'Password123!',
  confirmationPassword: 'Password123!',
};

export const testUserProfile = {
  username: 'new_user',
  firstName: 'New',
  lastName: 'User',
  phoneNumber: '1234567890',
  bio: 'This is a new user.',
  gender: Gender.MALE,
  profileImageUrl: 'https://example.com/profile.jpg',
};
export const testBrandProfile = {
    brandName: 'Test Brand',
    username: 'test_brand_user',
    websiteUrl: 'https://example.com',
    bio: 'This is a test brand.',
    profileImageUrl: 'https://example.com/brand-profile.jpg',
    phoneNumber: '0987654321',
}
export const userLoginDto = {
    email: testAccount.email,
    password: testAccount.password,
    role: Role.USER,
}

export const brandLoginDto = {
    email: testBrandAccount.email,
    password: testBrandAccount.password,
    role: Role.BRAND,
}