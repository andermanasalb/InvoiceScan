import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { createTestDataSource, clearTables } from '../test/db-test.helper';
import { InvoiceOrmEntity } from '../entities/invoice.orm-entity';
import { UserOrmEntity } from '../entities/user.orm-entity';
import { ProviderOrmEntity } from '../entities/provider.orm-entity';
import { InvoiceTypeOrmRepository } from '../repositories/invoice.typeorm-repository';
import { UserTypeOrmRepository } from '../repositories/user.typeorm-repository';
import { createInvoice, createUser } from '../../../domain/test/factories';
import { InvoiceStatusEnum } from '../../../domain/value-objects';

describe('InvoiceTypeOrmRepository (integration)', () => {
  let ds: DataSource;
  let ormRepo: Repository<InvoiceOrmEntity>;
  let repo: InvoiceTypeOrmRepository;
  let userRepo: UserTypeOrmRepository;

  // Shared user and provider for all tests (FK requirements)
  let uploaderId: string;
  let providerId: string;

  beforeAll(async () => {
    ds = await createTestDataSource();
    ormRepo = ds.getRepository(InvoiceOrmEntity);
    repo = new InvoiceTypeOrmRepository(ormRepo);
    userRepo = new UserTypeOrmRepository(ds.getRepository(UserOrmEntity));
  });

  afterAll(async () => {
    await ds.destroy();
  });

  beforeEach(async () => {
    await clearTables(ds);

    // Every invoice needs a valid uploader (FK -> users) and provider (FK -> providers)
    uploaderId = randomUUID();
    providerId = randomUUID();
    await userRepo.save(createUser({ id: uploaderId }));
    await ds
      .getRepository(ProviderOrmEntity)
      .save({ id: providerId, name: 'generic' });
  });

  // --- save ---

  describe('save', () => {
    it('should persist a new invoice to the database', async () => {
      const invoice = createInvoice({
        id: randomUUID(),
        uploaderId,
        providerId,
      });

      await repo.save(invoice);

      const row = await ormRepo.findOneBy({ id: invoice.getId() });
      expect(row).not.toBeNull();
      expect(row!.uploaderId).toBe(uploaderId);
      expect(row!.providerId).toBe(providerId);
      expect(row!.status).toBe(InvoiceStatusEnum.PENDING);
    });

    it('should update status when invoice transitions and is saved again', async () => {
      const invoice = createInvoice({
        id: randomUUID(),
        uploaderId,
        providerId,
      });
      await repo.save(invoice);

      invoice.startProcessing();
      await repo.save(invoice);

      const row = await ormRepo.findOneBy({ id: invoice.getId() });
      expect(row!.status).toBe(InvoiceStatusEnum.PROCESSING);
    });
  });

  // --- findById ---

  describe('findById', () => {
    it('should return a domain Invoice when found', async () => {
      const invoice = createInvoice({
        id: randomUUID(),
        uploaderId,
        providerId,
      });
      await repo.save(invoice);

      const found = await repo.findById(invoice.getId());

      expect(found).not.toBeNull();
      expect(found!.getId()).toBe(invoice.getId());
      expect(found!.getStatus().getValue()).toBe(InvoiceStatusEnum.PENDING);
    });

    it('should return null when invoice does not exist', async () => {
      const found = await repo.findById(randomUUID());
      expect(found).toBeNull();
    });
  });

  // --- findByUploaderId ---

  describe('findByUploaderId', () => {
    it('should only return invoices belonging to the given uploader', async () => {
      const otherUploaderId = randomUUID();
      await userRepo.save(
        createUser({ id: otherUploaderId, email: 'other@example.com' }),
      );

      const mine = createInvoice({ id: randomUUID(), uploaderId, providerId });
      const theirs = createInvoice({
        id: randomUUID(),
        uploaderId: otherUploaderId,
        providerId,
      });
      await repo.save(mine);
      await repo.save(theirs);

      const result = await repo.findByUploaderId(uploaderId, {});

      expect(result.total).toBe(1);
      expect(result.items[0].getId()).toBe(mine.getId());
    });

    it('should return empty result when uploader has no invoices', async () => {
      const result = await repo.findByUploaderId(randomUUID(), {});
      expect(result.total).toBe(0);
      expect(result.items).toHaveLength(0);
    });
  });

  // --- findAll with filters ---

  describe('findAll', () => {
    it('should return all invoices with pagination', async () => {
      const i1 = createInvoice({ id: randomUUID(), uploaderId, providerId });
      const i2 = createInvoice({ id: randomUUID(), uploaderId, providerId });
      const i3 = createInvoice({ id: randomUUID(), uploaderId, providerId });
      await repo.save(i1);
      await repo.save(i2);
      await repo.save(i3);

      const page1 = await repo.findAll({ page: 1, limit: 2 });
      expect(page1.total).toBe(3);
      expect(page1.items).toHaveLength(2);

      const page2 = await repo.findAll({ page: 2, limit: 2 });
      expect(page2.total).toBe(3);
      expect(page2.items).toHaveLength(1);
    });

    it('should filter by status', async () => {
      const pending = createInvoice({
        id: randomUUID(),
        uploaderId,
        providerId,
      });
      const processing = createInvoice({
        id: randomUUID(),
        uploaderId,
        providerId,
      });
      await repo.save(pending);
      await repo.save(processing);
      processing.startProcessing();
      await repo.save(processing);

      const result = await repo.findAll({
        status: InvoiceStatusEnum.PROCESSING,
      });

      expect(result.total).toBe(1);
      expect(result.items[0].getStatus().getValue()).toBe(
        InvoiceStatusEnum.PROCESSING,
      );
    });
  });

  // --- delete ---

  describe('delete', () => {
    it('should remove the invoice from the database', async () => {
      const invoice = createInvoice({
        id: randomUUID(),
        uploaderId,
        providerId,
      });
      await repo.save(invoice);

      await repo.delete(invoice.getId());

      const row = await ormRepo.findOneBy({ id: invoice.getId() });
      expect(row).toBeNull();
    });
  });

  // --- mapper round-trip ---

  describe('mapper round-trip', () => {
    it('should preserve all fields after save + findById', async () => {
      const invoice = createInvoice({
        id: randomUUID(),
        uploaderId,
        providerId,
      });
      await repo.save(invoice);

      const found = await repo.findById(invoice.getId());

      expect(found!.getId()).toBe(invoice.getId());
      expect(found!.getUploaderId()).toBe(uploaderId);
      expect(found!.getProviderId()).toBe(providerId);
      expect(found!.getFilePath()).toBe(invoice.getFilePath());
      expect(found!.getStatus().getValue()).toBe(InvoiceStatusEnum.PENDING);
      expect(found!.getValidationErrors()).toEqual([]);
      expect(found!.getApproverId()).toBeNull();
      expect(found!.getRejectionReason()).toBeNull();
    });
  });
});
