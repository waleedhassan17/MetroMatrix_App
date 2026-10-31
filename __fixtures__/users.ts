// Test fixture: a complete, valid User; override what the test is about.

import type { User } from '../types/auth';

export const makeUser = (over: Partial<User> = {}): User => ({
  id: 'u1',
  email: 'ayesha@example.com',
  name: 'Ayesha Khan',
  phone: '+923124890176',
  role: 'customer',
  avatarUrl: null,
  isEmailVerified: true,
  hasPassword: true,
  providers: ['password'],
  createdAt: '2026-10-01T00:00:00Z',
  profileComplete: true,
  profileSkippable: false,
  dateOfBirth: '1995-04-12',
  gender: 'female',
  streetAddress: '12 Main Boulevard',
  city: 'Lahore',
  postalCode: '54000',
  providerServiceType: null,
  providerSubType: null,
  ...over,
});
