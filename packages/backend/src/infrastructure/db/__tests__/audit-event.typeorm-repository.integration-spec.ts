import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { createTestDataSource, clearTables } from '../test/db-test.helper';
import { AuditEventOrmEntity } from '../entities/audit-event.orm-entity';
import { AuditEventTypeOrmRepository } from '../repositories/audit-event.typeorm-repository';
import { createAuditEvent } from '../../../domain/test/factories';

describe('AuditEventTypeOrmRepository (integration)', () => {
  let ds: DataSource;
  let ormRepo: Repository<AuditEventOrmEntity>;
  let repo: AuditEventTypeOrmRepository;

  beforeAll(async () => {
    ds = await createTestDataSource();
    ormRepo = ds.getRepository(AuditEventOrmEntity);
    repo = new AuditEventTypeOrmRepository(ormRepo);
  });

  afterAll(async () => {
    await ds.destroy();
  });

  beforeEach(async () => {
    await clearTables(ds);
  });

  // --- save ---

  describe('save', () => {
    it('should persist a new audit event to the database', async () => {
      const event = createAuditEvent({ id: randomUUID() });

      await repo.save(event);

      const row = await ormRepo.findOneBy({ id: event.getId() });
      expect(row).not.toBeNull();
      expect(row!.action).toBe(event.getAction());
      expect(row!.userId).toBe(event.getUserId());
    });
  });

  // --- findById ---

  describe('findById', () => {
    it('should return a domain AuditEvent when found', async () => {
      const event = createAuditEvent({ id: randomUUID() });
      await repo.save(event);

      const found = await repo.findById(event.getId());

      expect(found).not.toBeNull();
      expect(found!.getId()).toBe(event.getId());
    });

    it('should return null when event does not exist', async () => {
      const found = await repo.findById(randomUUID());
      expect(found).toBeNull();
    });
  });

  // --- findAll with filters ---

  describe('findAll', () => {
    it('should return all events when no filters applied', async () => {
      const e1 = createAuditEvent({ id: randomUUID() });
      const e2 = createAuditEvent({ id: randomUUID() });
      await repo.save(e1);
      await repo.save(e2);

      const all = await repo.findAll({});

      expect(all).toHaveLength(2);
    });

    it('should filter by userId', async () => {
      const userId = randomUUID();
      const e1 = createAuditEvent({ id: randomUUID(), userId });
      const e2 = createAuditEvent({ id: randomUUID(), userId: randomUUID() });
      await repo.save(e1);
      await repo.save(e2);

      const result = await repo.findAll({ userId });

      expect(result).toHaveLength(1);
      expect(result[0].getUserId()).toBe(userId);
    });

    it('should filter by action', async () => {
      const e1 = createAuditEvent({ id: randomUUID(), action: 'approve' });
      const e2 = createAuditEvent({ id: randomUUID(), action: 'reject' });
      await repo.save(e1);
      await repo.save(e2);

      const result = await repo.findAll({ action: 'approve' });

      expect(result).toHaveLength(1);
      expect(result[0].getAction()).toBe('approve');
    });

    it('should return empty array when no events match filters', async () => {
      const result = await repo.findAll({ userId: randomUUID() });
      expect(result).toHaveLength(0);
    });
  });

  // --- mapper round-trip ---

  describe('mapper round-trip', () => {
    it('should reconstruct the same domain entity after save + findById', async () => {
      const event = createAuditEvent({ id: randomUUID() });
      await repo.save(event);

      const found = await repo.findById(event.getId());

      expect(found!.getId()).toBe(event.getId());
      expect(found!.getUserId()).toBe(event.getUserId());
      expect(found!.getAction()).toBe(event.getAction());
      expect(found!.getResourceId()).toBe(event.getResourceId());
      expect(found!.getIp()).toBe(event.getIp());
    });
  });
});
