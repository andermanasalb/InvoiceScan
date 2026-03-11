import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { createTestDataSource, clearTables } from '../test/db-test.helper';
import { ProviderOrmEntity } from '../entities/provider.orm-entity';
import { ProviderTypeOrmRepository } from '../repositories/provider.typeorm-repository';
import { createProvider } from '../../../domain/test/factories';
import { ProviderName } from '../../../domain/value-objects';

describe('ProviderTypeOrmRepository (integration)', () => {
  let ds: DataSource;
  let ormRepo: Repository<ProviderOrmEntity>;
  let repo: ProviderTypeOrmRepository;

  beforeAll(async () => {
    ds = await createTestDataSource();
    ormRepo = ds.getRepository(ProviderOrmEntity);
    repo = new ProviderTypeOrmRepository(ormRepo);
  });

  afterAll(async () => {
    await ds.destroy();
  });

  beforeEach(async () => {
    await clearTables(ds);
  });

  // --- save ---

  describe('save', () => {
    it('should persist a new provider to the database', async () => {
      const provider = createProvider({ id: randomUUID() });

      await repo.save(provider);

      const row = await ormRepo.findOneBy({ id: provider.getId() });
      expect(row).not.toBeNull();
      expect(row!.name).toBe(provider.getName().getValue());
      expect(row!.adapterType).toBe(provider.getAdapterType());
    });
  });

  // --- findById ---

  describe('findById', () => {
    it('should return a domain Provider when found', async () => {
      const provider = createProvider({ id: randomUUID() });
      await repo.save(provider);

      const found = await repo.findById(provider.getId());

      expect(found).not.toBeNull();
      expect(found!.getId()).toBe(provider.getId());
    });

    it('should return null when provider does not exist', async () => {
      const found = await repo.findById(randomUUID());
      expect(found).toBeNull();
    });
  });

  // --- findByName ---

  describe('findByName', () => {
    it('should return a domain Provider when name matches', async () => {
      const provider = createProvider({
        id: randomUUID(),
        name: ProviderName.create('Telefonica')._unsafeUnwrap(),
      });
      await repo.save(provider);

      const found = await repo.findByName('Telefonica');

      expect(found).not.toBeNull();
      expect(found!.getId()).toBe(provider.getId());
    });

    it('should return null when name does not exist', async () => {
      const found = await repo.findByName('NonExistent');
      expect(found).toBeNull();
    });
  });

  // --- findAll ---

  describe('findAll', () => {
    it('should return all persisted providers ordered by name', async () => {
      const p1 = createProvider({
        id: randomUUID(),
        name: ProviderName.create('Telefonica')._unsafeUnwrap(),
      });
      const p2 = createProvider({
        id: randomUUID(),
        name: ProviderName.create('Amazon')._unsafeUnwrap(),
      });
      await repo.save(p1);
      await repo.save(p2);

      const all = await repo.findAll();

      expect(all).toHaveLength(2);
      // Ordered alphabetically by name
      expect(all[0].getName().getValue()).toBe('Amazon');
      expect(all[1].getName().getValue()).toBe('Telefonica');
    });
  });

  // --- mapper round-trip ---

  describe('mapper round-trip', () => {
    it('should reconstruct the same domain entity after save + findById', async () => {
      const provider = createProvider({ id: randomUUID() });
      await repo.save(provider);

      const found = await repo.findById(provider.getId());

      expect(found!.getId()).toBe(provider.getId());
      expect(found!.getName().getValue()).toBe(provider.getName().getValue());
      expect(found!.getAdapterType()).toBe(provider.getAdapterType());
    });
  });
});
