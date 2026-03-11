import { randomUUID } from 'crypto';
import { User, CreateUserProps, UserRole } from '../../entities/user.entity';

const defaultProps = (): CreateUserProps => ({
  id: randomUUID(),
  email: `user-${randomUUID()}@example.com`,
  role: UserRole.UPLOADER,
  createdAt: new Date('2025-01-15'),
});

export const createUser = (overrides?: Partial<CreateUserProps>): User => {
  const props = { ...defaultProps(), ...overrides };
  return User.create(props)._unsafeUnwrap();
};
