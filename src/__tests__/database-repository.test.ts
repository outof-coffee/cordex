import { describe, it, expect, vi } from 'vitest';
import { DatabaseRepository, EntityRegistry } from '../repository/index.js';
import { DatabaseObject, IdentifiedEntity } from '../types.js';

class TestEntity implements DatabaseObject {
  static readonly storageKey = 'test-entities';
  constructor(public guildId: string, public name: string) {}
}

class TestUserEntity implements DatabaseObject, IdentifiedEntity {
  static readonly storageKey = 'test-user-entities';
  public readonly id: string;

  constructor(public guildId: string, public userId: string, public action: string) {
    this.id = `${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  }
}

class TestChannelEntity implements DatabaseObject, IdentifiedEntity {
  static readonly storageKey = 'test-channel-entities';
  public readonly id: string;

  constructor(public guildId: string, public channelId: string, public setting: string) {
    this.id = `${channelId}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  }
}

class TestTemporaryEntity implements DatabaseObject, IdentifiedEntity {
  static readonly storageKey = 'test-temporary-entities';
  public readonly id: string;
  public readonly timestamp: string;
  public readonly expiresAt: string;

  constructor(public guildId: string, public durationMs: number, public action: string) {
    this.id = `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    this.timestamp = new Date().toISOString();

    const expirationDate = new Date();
    expirationDate.setMilliseconds(expirationDate.getMilliseconds() + durationMs);
    this.expiresAt = expirationDate.toISOString();
  }

  isExpired(): boolean {
    return new Date().toISOString() > this.expiresAt;
  }
}

describe('DatabaseRepository - Business Logic Tests', () => {
  it('should handle query method filtering, pagination, and result structure', async () => {
    const repo = new DatabaseRepository();

    const mockEntities = [
      new TestEntity('123456789012345678', 'entity1'),
      new TestEntity('123456789012345678', 'entity2'),
      new TestEntity('123456789012345678', 'entity3'),
    ];

    const mockGetAll = vi.spyOn(repo, 'getAll').mockResolvedValue(mockEntities);

    const filteredResult = await repo.query(TestEntity, '123456789012345678', {
      filter: (entity) => entity.name.includes('entity1')
    });

    expect(filteredResult.entities).toHaveLength(1);
    expect(filteredResult.entities[0].name).toBe('entity1');
    expect(filteredResult.totalCount).toBe(3);
    expect(filteredResult.hasMore).toBe(false);
    expect(filteredResult.executionTimeMs).toBeGreaterThanOrEqual(0);

    const paginatedResult = await repo.query(TestEntity, '123456789012345678', {
      limit: 2,
      offset: 1
    });

    expect(paginatedResult.entities).toHaveLength(2);
    expect(paginatedResult.totalCount).toBe(3);
    expect(paginatedResult.hasMore).toBe(false);

    const sortedResult = await repo.query(TestEntity, '123456789012345678', {
      sort: (a, b) => b.name.localeCompare(a.name)
    });

    expect(sortedResult.entities[0].name).toBe('entity3');
    expect(sortedResult.entities[2].name).toBe('entity1');

    expect(mockGetAll).toHaveBeenCalledTimes(3);
  });

  it('should delegate findByField to query with correct filter', async () => {
    const repo = new DatabaseRepository();

    const mockEntities = [
      new TestEntity('123456789012345678', 'target'),
      new TestEntity('123456789012345678', 'other'),
    ];

    const mockQuery = vi.spyOn(repo, 'query').mockResolvedValue({
      entities: [mockEntities[0]],
      totalCount: 2,
      hasMore: false,
      executionTimeMs: 1
    });

    const result = await repo.findByField(TestEntity, '123456789012345678', 'name', 'target');

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery).toHaveBeenCalledWith(TestEntity, '123456789012345678', {
      filter: expect.any(Function)
    });

    const call = mockQuery.mock.calls[0];
    const filterFunction = call[2].filter;
    expect(filterFunction(mockEntities[0])).toBe(true);
    expect(filterFunction(mockEntities[1])).toBe(false);

    expect(result).toEqual([mockEntities[0]]);
  });

  it('should return first entity or null in findOneByField method', async () => {
    const repo = new DatabaseRepository();

    const testEntity1 = new TestEntity('123456789012345678', 'first');
    const testEntity2 = new TestEntity('123456789012345678', 'second');

    const mockFindByField = vi.spyOn(repo, 'findByField');

    mockFindByField.mockResolvedValueOnce([testEntity1, testEntity2]);
    const result = await repo.findOneByField(TestEntity, '123456789012345678', 'name', 'test');
    expect(result).toBe(testEntity1);

    mockFindByField.mockResolvedValueOnce([]);
    const nullResult = await repo.findOneByField(TestEntity, '123456789012345678', 'name', 'nonexistent');
    expect(nullResult).toBe(null);

    expect(mockFindByField).toHaveBeenCalledTimes(2);
    expect(mockFindByField).toHaveBeenNthCalledWith(1, TestEntity, '123456789012345678', 'name', 'test');
    expect(mockFindByField).toHaveBeenNthCalledWith(2, TestEntity, '123456789012345678', 'name', 'nonexistent');
  });

  it('should return boolean based on getById for exists method', async () => {
    const repo = new DatabaseRepository();

    const mockGetById = vi.spyOn(repo, 'getById');

    const testEntity = new TestEntity('123456789012345678', 'test');
    mockGetById.mockResolvedValueOnce(testEntity);
    const exists = await repo.exists(TestEntity, '123456789012345678', 'test-id');
    expect(exists).toBe(true);

    mockGetById.mockResolvedValueOnce(null);
    const notExists = await repo.exists(TestEntity, '123456789012345678', 'nonexistent');
    expect(notExists).toBe(false);

    expect(mockGetById).toHaveBeenCalledTimes(2);
  });

  it('should delegate getUserEntities to findByField with userId', async () => {
    const repo = new DatabaseRepository();

    const mockUserEntities = [
      new TestUserEntity('123456789012345678', '111111111111111111', 'action1'),
      new TestUserEntity('123456789012345678', '111111111111111111', 'action2'),
    ];

    const mockFindByField = vi.spyOn(repo, 'findByField').mockResolvedValue(mockUserEntities);

    const result = await repo.getUserEntities(TestUserEntity, '123456789012345678', '111111111111111111');

    expect(mockFindByField).toHaveBeenCalledTimes(1);
    expect(mockFindByField).toHaveBeenCalledWith(TestUserEntity, '123456789012345678', 'userId', '111111111111111111');

    expect(result).toBe(mockUserEntities);
  });

  it('should delegate getChannelEntities to findByField with channelId', async () => {
    const repo = new DatabaseRepository();

    const mockChannelEntities = [
      new TestChannelEntity('123456789012345678', '222222222222222222', 'setting1'),
      new TestChannelEntity('123456789012345678', '222222222222222222', 'setting2'),
    ];

    const mockFindByField = vi.spyOn(repo, 'findByField').mockResolvedValue(mockChannelEntities);

    const result = await repo.getChannelEntities(TestChannelEntity, '123456789012345678', '222222222222222222');

    expect(mockFindByField).toHaveBeenCalledTimes(1);
    expect(mockFindByField).toHaveBeenCalledWith(TestChannelEntity, '123456789012345678', 'channelId', '222222222222222222');

    expect(result).toBe(mockChannelEntities);
  });

  it('should delegate getActiveTemporary to query with isExpired filter', async () => {
    const repo = new DatabaseRepository();

    const mockActiveEntities = [
      new TestTemporaryEntity('123456789012345678', 3600000, 'action1'),
      new TestTemporaryEntity('123456789012345678', 7200000, 'action2'),
    ];

    const mockQuery = vi.spyOn(repo, 'query').mockResolvedValue({
      entities: mockActiveEntities,
      totalCount: 4,
      hasMore: false,
      executionTimeMs: 1
    });

    const result = await repo.getActiveTemporary(TestTemporaryEntity, '123456789012345678');

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery).toHaveBeenCalledWith(TestTemporaryEntity, '123456789012345678', {
      filter: expect.any(Function)
    });

    const call = mockQuery.mock.calls[0];
    const filterFunction = call[2].filter;

    const activeEntity = new TestTemporaryEntity('123456789012345678', 3600000, 'active');
    const expiredEntity = new TestTemporaryEntity('123456789012345678', -3600000, 'expired');

    expect(filterFunction(activeEntity)).toBe(true);
    expect(filterFunction(expiredEntity)).toBe(false);

    expect(result).toEqual(mockActiveEntities);
  });

  it('should delegate getExpiredTemporary to query with isExpired filter', async () => {
    const repo = new DatabaseRepository();

    const mockExpiredEntities = [
      new TestTemporaryEntity('123456789012345678', -3600000, 'expired1'),
      new TestTemporaryEntity('123456789012345678', -7200000, 'expired2'),
    ];

    const mockQuery = vi.spyOn(repo, 'query').mockResolvedValue({
      entities: mockExpiredEntities,
      totalCount: 4,
      hasMore: false,
      executionTimeMs: 1
    });

    const result = await repo.getExpiredTemporary(TestTemporaryEntity, '123456789012345678');

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery).toHaveBeenCalledWith(TestTemporaryEntity, '123456789012345678', {
      filter: expect.any(Function)
    });

    const call = mockQuery.mock.calls[0];
    const filterFunction = call[2].filter;

    const activeEntity = new TestTemporaryEntity('123456789012345678', 3600000, 'active');
    const expiredEntity = new TestTemporaryEntity('123456789012345678', -3600000, 'expired');

    expect(filterFunction(activeEntity)).toBe(false);
    expect(filterFunction(expiredEntity)).toBe(true);

    expect(result).toEqual(mockExpiredEntities);
  });

  it('should handle bulkStore error counting and result structure', async () => {
    const repo = new DatabaseRepository();

    const testEntities = [
      new TestEntity('123456789012345678', 'entity1'),
      new TestEntity('123456789012345678', 'entity2'),
      new TestEntity('123456789012345678', 'entity3'),
    ];

    const mockStore = vi.spyOn(repo, 'store')
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Store failed'));

    const result = await repo.bulkStore(testEntities);

    expect(mockStore).toHaveBeenCalledTimes(3);
    expect(mockStore).toHaveBeenNthCalledWith(1, testEntities[0]);
    expect(mockStore).toHaveBeenNthCalledWith(2, testEntities[1]);
    expect(mockStore).toHaveBeenNthCalledWith(3, testEntities[2]);

    expect(result.successful).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].entity).toBe(testEntities[2]);
    expect(result.errors[0].error).toBe('Store failed');
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should handle bulkDelete success/failure counting and error collection', async () => {
    const repo = new DatabaseRepository();

    const entityIds = ['123456789012345678', '123456789012345679', '123456789012345680'];

    const mockDeleteById = vi.spyOn(repo, 'deleteById')
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(new Error('Delete failed'));

    const result = await repo.bulkDelete(TestEntity, '123456789012345678', entityIds);

    expect(mockDeleteById).toHaveBeenCalledTimes(3);
    expect(mockDeleteById).toHaveBeenNthCalledWith(1, TestEntity, '123456789012345678', entityIds[0]);
    expect(mockDeleteById).toHaveBeenNthCalledWith(2, TestEntity, '123456789012345678', entityIds[1]);
    expect(mockDeleteById).toHaveBeenNthCalledWith(3, TestEntity, '123456789012345678', entityIds[2]);

    expect(result.successful).toBe(1);
    expect(result.failed).toBe(2);
    expect(result.errors).toHaveLength(2);

    expect(result.errors[0].entity).toEqual({ id: entityIds[1] });
    expect(result.errors[0].error).toBe('Entity not found');

    expect(result.errors[1].entity).toEqual({ id: entityIds[2] });
    expect(result.errors[1].error).toBe('Delete failed');

    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
  });
});

describe('DatabaseRepository - Defect Fixes for Unique Entities', () => {
  describe('deleteById - Fixed to delete ALL matching IDs (Defects 2 & 3)', () => {
    it('should return false when no entities match the ID', async () => {
      const repo = new DatabaseRepository();
      // Mock initialization first
      vi.spyOn(repo, 'isInitialized').mockReturnValue(true);
      const mockGetAll = vi.spyOn(repo, 'getAll').mockResolvedValue([]);

      const result = await repo.deleteById(TestChannelEntity, 'test-collection', 'nonexistent-id');

      expect(result).toBe(false);
      expect(mockGetAll).toHaveBeenCalledWith(TestChannelEntity, 'test-collection');
    });

    it('should delete and return true when single entity matches the ID', async () => {
      const repo = new DatabaseRepository();
      vi.spyOn(repo, 'isInitialized').mockReturnValue(true);

      const entity = new TestChannelEntity('123456789012345678', '222222222222222222', 'test-setting');
      const entities = [entity];

      const mockGetAll = vi.spyOn(repo, 'getAll').mockResolvedValue(entities);
      const mockReplaceAll = vi.spyOn(repo, 'replaceAll').mockResolvedValue(undefined);

      const result = await repo.deleteById(TestChannelEntity, 'test-collection', entity.id);

      expect(result).toBe(true);
      expect(mockReplaceAll).toHaveBeenCalledWith(TestChannelEntity, 'test-collection', []);
    });

    it('should delete ALL entities matching the ID (critical fix for duplicates)', async () => {
      const repo = new DatabaseRepository();
      vi.spyOn(repo, 'isInitialized').mockReturnValue(true);

      // Create three duplicate entries with the same ID
      const duplicateId = 'guild-123-duplicate';
      const entity1 = new TestChannelEntity('123456789012345678', '222222222222222222', 'v1');
      const entity2 = new TestChannelEntity('123456789012345678', '222222222222222222', 'v2');
      const entity3 = new TestChannelEntity('123456789012345678', '222222222222222222', 'v3');
      const otherEntity = new TestChannelEntity('123456789012345678', '222222222222222222', 'other');

      // Manually set IDs to create duplicates
      Object.defineProperty(entity1, 'id', { value: duplicateId, configurable: true });
      Object.defineProperty(entity2, 'id', { value: duplicateId, configurable: true });
      Object.defineProperty(entity3, 'id', { value: duplicateId, configurable: true });

      const entities = [entity1, entity2, entity3, otherEntity];

      const mockGetAll = vi.spyOn(repo, 'getAll').mockResolvedValue(entities);
      const mockReplaceAll = vi.spyOn(repo, 'replaceAll').mockResolvedValue(undefined);

      const result = await repo.deleteById(TestChannelEntity, 'test-collection', duplicateId);

      expect(result).toBe(true);
      // Should only have the one other entity left
      expect(mockReplaceAll).toHaveBeenCalledWith(TestChannelEntity, 'test-collection', [otherEntity]);
    });

    it('should verify deleted entities are actually gone via query', async () => {
      const repo = new DatabaseRepository();
      vi.spyOn(repo, 'isInitialized').mockReturnValue(true);

      const deleteId = 'to-delete-id';
      const entity1 = new TestChannelEntity('123456789012345678', '222222222222222222', 'delete-me');
      const entity2 = new TestChannelEntity('123456789012345678', '222222222222222222', 'keep-me');

      Object.defineProperty(entity1, 'id', { value: deleteId, configurable: true });

      const allEntities = [entity1, entity2];
      const remainingEntities = [entity2];

      const mockGetAll = vi.spyOn(repo, 'getAll');
      mockGetAll.mockResolvedValueOnce(allEntities); // First call to deleteById
      mockGetAll.mockResolvedValueOnce(remainingEntities); // Second call to verify

      const mockReplaceAll = vi.spyOn(repo, 'replaceAll').mockResolvedValue(undefined);

      const deleteResult = await repo.deleteById(TestChannelEntity, 'test-collection', deleteId);
      expect(deleteResult).toBe(true);

      const verifyResult = await repo.getAll(TestChannelEntity, 'test-collection');
      expect(verifyResult).toHaveLength(1);
      expect(verifyResult[0]).toBe(entity2);
    });
  });

  describe('storeUnique - New method for upsert behavior (Defect 1 fix)', () => {
    it('should insert new entity and return false when ID does not exist', async () => {
      const repo = new DatabaseRepository();

      const entity = new TestChannelEntity('123456789012345678', '222222222222222222', 'new-setting');

      const mockGetAll = vi.spyOn(repo, 'getAll').mockResolvedValue([]);
      const mockStoreData = vi.spyOn(repo as any, 'storeData').mockResolvedValue(undefined);
      const mockInit = vi.spyOn(repo, 'isInitialized').mockReturnValue(true);
      const mockRegistry = {
        getRegistrationForInstance: vi.fn().mockReturnValue({
          getCollectionKey: vi.fn().mockReturnValue('test-collection'),
          storageKey: 'test-storage'
        })
      };
      (repo as any).config = { entityRegistry: mockRegistry };

      const result = await repo.storeUnique(entity);

      expect(result).toBe(false); // false = inserted
      expect(mockGetAll).toHaveBeenCalledWith(TestChannelEntity, 'test-collection');
      expect(mockStoreData).toHaveBeenCalledWith('test-collection', 'test-storage', entity);
    });

    it('should update existing entity and return true when ID exists', async () => {
      const repo = new DatabaseRepository();

      const oldEntity = new TestChannelEntity('123456789012345678', '222222222222222222', 'old-setting');
      const newEntity = new TestChannelEntity('123456789012345678', '222222222222222222', 'updated-setting');

      // Set same ID to simulate update
      Object.defineProperty(newEntity, 'id', { value: oldEntity.id, configurable: true });

      const mockGetAll = vi.spyOn(repo, 'getAll').mockResolvedValue([oldEntity]);
      const mockReplaceAll = vi.spyOn(repo, 'replaceAll').mockResolvedValue(undefined);
      const mockInit = vi.spyOn(repo, 'isInitialized').mockReturnValue(true);
      const mockRegistry = {
        getRegistrationForInstance: vi.fn().mockReturnValue({
          getCollectionKey: vi.fn().mockReturnValue('test-collection'),
          storageKey: 'test-storage'
        })
      };
      (repo as any).config = { entityRegistry: mockRegistry };

      const result = await repo.storeUnique(newEntity);

      expect(result).toBe(true); // true = updated
      expect(mockReplaceAll).toHaveBeenCalledWith(TestChannelEntity, 'test-collection', [newEntity]);
    });

    it('should prevent duplicate IDs by updating instead of appending', async () => {
      const repo = new DatabaseRepository();

      const entity = new TestChannelEntity('123456789012345678', '222222222222222222', 'version-1');
      const updatedEntity = new TestChannelEntity('123456789012345678', '222222222222222222', 'version-2');

      // Same ID, different data
      Object.defineProperty(updatedEntity, 'id', { value: entity.id, configurable: true });

      // First storeUnique (insert)
      const mockGetAll1 = vi.spyOn(repo, 'getAll').mockResolvedValueOnce([]);
      const mockStoreData = vi.spyOn(repo as any, 'storeData').mockResolvedValue(undefined);
      const mockInit = vi.spyOn(repo, 'isInitialized').mockReturnValue(true);
      const mockRegistry = {
        getRegistrationForInstance: vi.fn().mockReturnValue({
          getCollectionKey: vi.fn().mockReturnValue('test-collection'),
          storageKey: 'test-storage'
        })
      };
      (repo as any).config = { entityRegistry: mockRegistry };

      const result1 = await repo.storeUnique(entity);
      expect(result1).toBe(false); // inserted

      // Second storeUnique (update)
      const mockGetAll2 = vi.spyOn(repo, 'getAll').mockResolvedValueOnce([entity]);
      const mockReplaceAll = vi.spyOn(repo, 'replaceAll').mockResolvedValue(undefined);

      const result2 = await repo.storeUnique(updatedEntity);
      expect(result2).toBe(true); // updated

      // Should only have one entity (updated, not appended)
      expect(mockReplaceAll).toHaveBeenCalledWith(TestChannelEntity, 'test-collection', [updatedEntity]);
    });
  });

  describe('deleteUnique - Semantic alias for deleteById', () => {
    it('should delegate to deleteById with same signature and return value', async () => {
      const repo = new DatabaseRepository();

      const mockDeleteById = vi.spyOn(repo, 'deleteById').mockResolvedValue(true);

      const result = await repo.deleteUnique(TestChannelEntity, 'test-collection', 'test-id');

      expect(result).toBe(true);
      expect(mockDeleteById).toHaveBeenCalledWith(TestChannelEntity, 'test-collection', 'test-id');
    });

    it('should return false when deleteById returns false', async () => {
      const repo = new DatabaseRepository();

      const mockDeleteById = vi.spyOn(repo, 'deleteById').mockResolvedValue(false);

      const result = await repo.deleteUnique(TestChannelEntity, 'test-collection', 'nonexistent');

      expect(result).toBe(false);
    });
  });
});
