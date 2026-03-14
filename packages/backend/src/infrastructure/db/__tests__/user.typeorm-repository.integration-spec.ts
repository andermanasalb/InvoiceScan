import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { createTestDataSource, clearTables } from '../test/db-test.helper';
import { UserOrmEntity } from '../entities/user.orm-entity';
import { UserTypeOrmRepository } from '../repositories/user.typeorm-repository';
import { createUser } from '../../../domain/test/factories';

describe('UserTypeOrmRepository (integration)', () => {
  let ds: DataSource;
  let ormRepo: Repository<UserOrmEntity>;
  let repo: UserTypeOrmRepository;

  beforeAll(async () => {
    ds = await createTestDataSource();
    ormRepo = ds.getRepository(UserOrmEntity);
    repo = new UserTypeOrmRepository(ormRepo);
  });

  afterAll(async () => {
    await ds.destroy();
  });

  beforeEach(async () => {
    await clearTables(ds);
  });

  // --- save ---

  describe('save', () => {
    it('should persist a new user to the database', async () => {
      const user = createUser({ id: randomUUID() });

      await repo.save(user);

      const row = await ormRepo.findOneBy({ id: user.getId() });
      expect(row).not.toBeNull();
      expect(row!.email).toBe(user.getEmail());
      expect(row!.role).toBe(user.getRole());
    });

    it('should update an existing user when saved again', async () => {
      const user = createUser({ id: randomUUID(), role: 'uploader' });
      await repo.save(user);

      // Save a new user entity with same id but different role
      const updated = createUser({ id: user.getId(), role: 'validator' });
      await repo.save(updated);

      const row = await ormRepo.findOneBy({ id: user.getId() });
      expect(row!.role).toBe('validator');
    });
  });

  // --- findById ---

  describe('findById', () => {
    it('should return a domain User when found', async () => {
      const user = createUser({ id: randomUUID() });
      await repo.save(user);

      const found = await repo.findById(user.getId());

      expect(found).not.toBeNull();
      expect(found!.getId()).toBe(user.getId());
      expect(found!.getEmail()).toBe(user.getEmail());
    });

    it('should return null when user does not exist', async () => {
      const found = await repo.findById(randomUUID());
      expect(found).toBeNull();
    });
  });

  // --- findByEmail ---

  describe('findByEmail', () => {
    it('should return a domain User when email matches', async () => {
      const user = createUser({ id: randomUUID(), email: 'test@example.com' });
      await repo.save(user);

      const found = await repo.findByEmail('test@example.com');

      expect(found).not.toBeNull();
      expect(found!.getId()).toBe(user.getId());
    });

    it('should return null when email does not exist', async () => {
      const found = await repo.findByEmail('nobody@example.com');
      expect(found).toBeNull();
    });
  });

  // --- findAll ---

  describe('findAll', () => {
    it('should return all persisted users', async () => {
      const u1 = createUser({ id: randomUUID(), email: 'a@example.com' });
      const u2 = createUser({ id: randomUUID(), email: 'b@example.com' });
      await repo.save(u1);
      await repo.save(u2);

      const all = await repo.findAll();

      expect(all).toHaveLength(2);
    });

    it('should return empty array when no users exist', async () => {
      const all = await repo.findAll();
      expect(all).toHaveLength(0);
    });
  });

  // --- delete ---

  describe('delete', () => {
    it('should remove the user from the database', async () => {
      const user = createUser({ id: randomUUID() });
      await repo.save(user);

      await repo.delete(user.getId());

      const row = await ormRepo.findOneBy({ id: user.getId() });
      expect(row).toBeNull();
    });

    it('should not throw when deleting a non-existent user', async () => {
      await expect(repo.delete(randomUUID())).resolves.not.toThrow();
    });
  });

  // --- mapper round-trip ---

  describe('mapper round-trip', () => {
    it('should reconstruct the same domain entity after save + findById', async () => {
      const user = createUser({ id: randomUUID() });
      await repo.save(user);

      const found = await repo.findById(user.getId());

      expect(found!.getId()).toBe(user.getId());
      expect(found!.getEmail()).toBe(user.getEmail());
      expect(found!.getRole()).toBe(user.getRole());
    });
  });
});
