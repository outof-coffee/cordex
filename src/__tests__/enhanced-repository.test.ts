import { describe, it, expect, vi } from 'vitest';
import { EnhancedRepository } from '../enhanced-repository';
import { DiscordEntity } from '../discord/entities';
import { DiscordRepository } from '../discord/repository';
import { EntityRegistry } from '../entity-registry';
import { repository } from '../repository';
import { UserDiscordEntity, ChannelDiscordEntity, TemporaryDiscordEntity, EventDiscordEntity } from '../enhanced-entities';

// Simple test entity
class TestEntity extends DiscordEntity {
  constructor(guildId: string, public name: string) {
    super(guildId);
  }
  static storageKey = 'test-entities';
}

// Test user entity
class TestUserEntity extends UserDiscordEntity {
  constructor(guildId: string, userId: string, public action: string) {
    super(guildId, userId);
  }
  static storageKey = 'test-user-entities';
}

// Test channel entity
class TestChannelEntity extends ChannelDiscordEntity {
  constructor(guildId: string, channelId: string, public setting: string) {
    super(guildId, channelId);
  }
  static storageKey = 'test-channel-entities';
}

// Test temporary entity
class TestTemporaryEntity extends TemporaryDiscordEntity {
  constructor(guildId: string, durationMs: number, public action: string) {
    super(guildId, durationMs);
  }
  static storageKey = 'test-temporary-entities';
}

// Test event entity
class TestEventEntity extends EventDiscordEntity {
  constructor(guildId: string, eventType: string, public data: string) {
    super(guildId, eventType);
  }
  static storageKey = 'test-event-entities';
}

describe('Enhanced Repository - Unit Tests', () => {
  it('should apply filter correctly in count method', async () => {
    // Create repository instance
    const enhancedRepo = new EnhancedRepository();

    // Mock the getAll method to return predictable test data
    const mockEntities = [
      new TestEntity('123456789012345678', 'entity1'),
      new TestEntity('123456789012345678', 'entity2'),
      new TestEntity('123456789012345678', 'special'),
      new TestEntity('123456789012345678', 'entity4'),
      new TestEntity('123456789012345678', 'special'),
    ];

    vi.spyOn(enhancedRepo, 'getAll').mockResolvedValue(mockEntities);

    // Test 1: Count without filter should return total count
    const totalCount = await enhancedRepo.count(TestEntity, '123456789012345678');
    expect(totalCount).toBe(5);

    // Test 2: Count with filter should return filtered count
    const filteredCount = await enhancedRepo.count(
      TestEntity,
      '123456789012345678',
      (entity) => entity.name === 'special'
    );
    expect(filteredCount).toBe(2);

    // Verify getAll was called correctly
    expect(enhancedRepo.getAll).toHaveBeenCalledTimes(2);
    expect(enhancedRepo.getAll).toHaveBeenCalledWith(TestEntity, '123456789012345678');
  });

  it('should return first entity or null in findOneByField method', async () => {
    // Create repository instance
    const enhancedRepo = new EnhancedRepository();

    const testEntity1 = new TestEntity('123456789012345678', 'first');
    const testEntity2 = new TestEntity('123456789012345678', 'second');

    // Mock findByField method
    const mockFindByField = vi.spyOn(enhancedRepo, 'findByField');

    // Test 1: Should return first entity when results are found
    mockFindByField.mockResolvedValueOnce([testEntity1, testEntity2]);
    const result = await enhancedRepo.findOneByField(TestEntity, '123456789012345678', 'name', 'test');
    expect(result).toBe(testEntity1);

    // Test 2: Should return null when no results are found
    mockFindByField.mockResolvedValueOnce([]);
    const nullResult = await enhancedRepo.findOneByField(TestEntity, '123456789012345678', 'name', 'nonexistent');
    expect(nullResult).toBe(null);

    // Verify findByField was called correctly
    expect(mockFindByField).toHaveBeenCalledTimes(2);
    expect(mockFindByField).toHaveBeenNthCalledWith(1, TestEntity, '123456789012345678', 'name', 'test');
    expect(mockFindByField).toHaveBeenNthCalledWith(2, TestEntity, '123456789012345678', 'name', 'nonexistent');
  });

  it('should handle constructor parameters correctly', () => {
    // Test 1: Constructor with no parameters should use defaults
    const repo1 = new EnhancedRepository();
    expect(repo1).toBeInstanceOf(EnhancedRepository);

    // Test 2: Constructor with custom repository
    const customRepo = repository;
    const repo2 = new EnhancedRepository(customRepo);
    expect(repo2).toBeInstanceOf(EnhancedRepository);

    // Test 3: Constructor with DiscordRepository should use it directly
    const discordRepo = new DiscordRepository(repository);
    const repo3 = new EnhancedRepository(discordRepo);
    expect(repo3).toBeInstanceOf(EnhancedRepository);

    // Test 4: Constructor with custom registry
    const customRegistry = new EntityRegistry();
    const repo4 = new EnhancedRepository(undefined, customRegistry);
    expect(repo4).toBeInstanceOf(EnhancedRepository);
    expect(repo4.getRegistry()).toBe(customRegistry);
  });

  it('should handle query method filtering, pagination, and result structure', async () => {
    const enhancedRepo = new EnhancedRepository();

    const mockEntities = [
      new TestEntity('123456789012345678', 'entity1'),
      new TestEntity('123456789012345678', 'entity2'),
      new TestEntity('123456789012345678', 'entity3'),
    ];

    // Mock getAll dependency
    const mockGetAll = vi.spyOn(enhancedRepo, 'getAll').mockResolvedValue(mockEntities);

    // Test 1: Query with filter
    const filteredResult = await enhancedRepo.query(TestEntity, '123456789012345678', {
      filter: (entity) => entity.name.includes('entity1')
    });

    expect(filteredResult.entities).toHaveLength(1);
    expect(filteredResult.entities[0].name).toBe('entity1');
    expect(filteredResult.totalCount).toBe(3);
    expect(filteredResult.hasMore).toBe(false);
    expect(filteredResult.executionTimeMs).toBeGreaterThanOrEqual(0);

    // Test 2: Query with pagination
    const paginatedResult = await enhancedRepo.query(TestEntity, '123456789012345678', {
      limit: 2,
      offset: 1
    });

    expect(paginatedResult.entities).toHaveLength(2);
    expect(paginatedResult.totalCount).toBe(3);
    expect(paginatedResult.hasMore).toBe(false);

    // Test 3: Query with sort
    const sortedResult = await enhancedRepo.query(TestEntity, '123456789012345678', {
      sort: (a, b) => b.name.localeCompare(a.name)
    });

    expect(sortedResult.entities[0].name).toBe('entity3');
    expect(sortedResult.entities[2].name).toBe('entity1');

    expect(mockGetAll).toHaveBeenCalledTimes(3);
  });

  it('should delegate findByField to query method with correct filter', async () => {
    const enhancedRepo = new EnhancedRepository();

    const mockEntities = [
      new TestEntity('123456789012345678', 'target'),
      new TestEntity('123456789012345678', 'other'),
    ];

    // Mock the query method
    const mockQuery = vi.spyOn(enhancedRepo, 'query').mockResolvedValue({
      entities: [mockEntities[0]],
      totalCount: 2,
      hasMore: false,
      executionTimeMs: 1
    });

    // Call findByField
    const result = await enhancedRepo.findByField(TestEntity, '123456789012345678', 'name', 'target');

    // Verify it called query with correct filter
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery).toHaveBeenCalledWith(TestEntity, '123456789012345678', {
      filter: expect.any(Function)
    });

    // Verify the filter function works correctly
    const call = mockQuery.mock.calls[0];
    const filterFunction = call[2].filter;
    expect(filterFunction(mockEntities[0])).toBe(true);  // 'target' === 'target'
    expect(filterFunction(mockEntities[1])).toBe(false); // 'other' !== 'target'

    // Verify it returns the entities from query result
    expect(result).toEqual([mockEntities[0]]);
  });

  it('should handle bulkStore error counting and result structure', async () => {
    const enhancedRepo = new EnhancedRepository();

    const testEntities = [
      new TestEntity('123456789012345678', 'entity1'),
      new TestEntity('123456789012345678', 'entity2'),
      new TestEntity('123456789012345678', 'entity3'),
    ];

    // Mock store method - success for first two, error for third
    const mockStore = vi.spyOn(enhancedRepo, 'store')
      .mockResolvedValueOnce(undefined)      // Success
      .mockResolvedValueOnce(undefined)      // Success
      .mockRejectedValueOnce(new Error('Store failed')); // Error

    const result = await enhancedRepo.bulkStore(testEntities);

    // Verify store was called for each entity
    expect(mockStore).toHaveBeenCalledTimes(3);
    expect(mockStore).toHaveBeenNthCalledWith(1, testEntities[0]);
    expect(mockStore).toHaveBeenNthCalledWith(2, testEntities[1]);
    expect(mockStore).toHaveBeenNthCalledWith(3, testEntities[2]);

    // Verify result structure
    expect(result.successful).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].entity).toBe(testEntities[2]);
    expect(result.errors[0].error).toBe('Store failed');
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should handle bulkDelete success/failure counting and error collection', async () => {
    const enhancedRepo = new EnhancedRepository();

    const entityIds = ['123456789012345678', '123456789012345679', '123456789012345680'];

    // Mock deleteById method - success, not found, error
    const mockDeleteById = vi.spyOn(enhancedRepo, 'deleteById')
      .mockResolvedValueOnce(true)           // Success
      .mockResolvedValueOnce(false)          // Not found
      .mockRejectedValueOnce(new Error('Delete failed')); // Error

    const result = await enhancedRepo.bulkDelete(TestEntity, '123456789012345678', entityIds);

    // Verify deleteById was called for each entity
    expect(mockDeleteById).toHaveBeenCalledTimes(3);
    expect(mockDeleteById).toHaveBeenNthCalledWith(1, TestEntity, '123456789012345678', entityIds[0]);
    expect(mockDeleteById).toHaveBeenNthCalledWith(2, TestEntity, '123456789012345678', entityIds[1]);
    expect(mockDeleteById).toHaveBeenNthCalledWith(3, TestEntity, '123456789012345678', entityIds[2]);

    // Verify result structure
    expect(result.successful).toBe(1);
    expect(result.failed).toBe(2);
    expect(result.errors).toHaveLength(2);

    // First error: entity not found
    expect(result.errors[0].entity).toEqual({ id: entityIds[1] });
    expect(result.errors[0].error).toBe('Entity not found');

    // Second error: exception
    expect(result.errors[1].entity).toEqual({ id: entityIds[2] });
    expect(result.errors[1].error).toBe('Delete failed');

    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should delegate getUserEntities to findByField with userId', async () => {
    const enhancedRepo = new EnhancedRepository();

    const mockUserEntities = [
      new TestUserEntity('123456789012345678', '111111111111111111', 'action1'),
      new TestUserEntity('123456789012345678', '111111111111111111', 'action2'),
    ];

    // Mock findByField method
    const mockFindByField = vi.spyOn(enhancedRepo, 'findByField').mockResolvedValue(mockUserEntities);

    const result = await enhancedRepo.getUserEntities(TestUserEntity, '123456789012345678', '111111111111111111');

    // Verify it called findByField with correct parameters
    expect(mockFindByField).toHaveBeenCalledTimes(1);
    expect(mockFindByField).toHaveBeenCalledWith(TestUserEntity, '123456789012345678', 'userId', '111111111111111111');

    // Verify it returns the result from findByField
    expect(result).toBe(mockUserEntities);
  });

  it('should delegate getChannelEntities to findByField with channelId', async () => {
    const enhancedRepo = new EnhancedRepository();

    const mockChannelEntities = [
      new TestChannelEntity('123456789012345678', '222222222222222222', 'setting1'),
      new TestChannelEntity('123456789012345678', '222222222222222222', 'setting2'),
    ];

    // Mock findByField method
    const mockFindByField = vi.spyOn(enhancedRepo, 'findByField').mockResolvedValue(mockChannelEntities);

    const result = await enhancedRepo.getChannelEntities(TestChannelEntity, '123456789012345678', '222222222222222222');

    // Verify it called findByField with correct parameters
    expect(mockFindByField).toHaveBeenCalledTimes(1);
    expect(mockFindByField).toHaveBeenCalledWith(TestChannelEntity, '123456789012345678', 'channelId', '222222222222222222');

    // Verify it returns the result from findByField
    expect(result).toBe(mockChannelEntities);
  });

  it('should delegate getActiveTemporary to query with isExpired filter', async () => {
    const enhancedRepo = new EnhancedRepository();

    const mockActiveEntities = [
      new TestTemporaryEntity('123456789012345678', 3600000, 'action1'), // 1 hour
      new TestTemporaryEntity('123456789012345678', 7200000, 'action2'), // 2 hours
    ];

    // Mock the query method
    const mockQuery = vi.spyOn(enhancedRepo, 'query').mockResolvedValue({
      entities: mockActiveEntities,
      totalCount: 4,
      hasMore: false,
      executionTimeMs: 1
    });

    const result = await enhancedRepo.getActiveTemporary(TestTemporaryEntity, '123456789012345678');

    // Verify it called query with correct filter
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery).toHaveBeenCalledWith(TestTemporaryEntity, '123456789012345678', {
      filter: expect.any(Function)
    });

    // Verify the filter function works correctly (should filter for NOT expired)
    const call = mockQuery.mock.calls[0];
    const filterFunction = call[2].filter;

    // Create test entities to verify filter logic
    const activeEntity = new TestTemporaryEntity('123456789012345678', 3600000, 'active');
    const expiredEntity = new TestTemporaryEntity('123456789012345678', -3600000, 'expired');

    expect(filterFunction(activeEntity)).toBe(true);   // !isExpired() === true
    expect(filterFunction(expiredEntity)).toBe(false); // !isExpired() === false

    // Verify it returns the entities from query result
    expect(result).toEqual(mockActiveEntities);
  });

  it('should delegate getExpiredTemporary to query with isExpired filter', async () => {
    const enhancedRepo = new EnhancedRepository();

    const mockExpiredEntities = [
      new TestTemporaryEntity('123456789012345678', -3600000, 'expired1'), // Expired 1 hour ago
      new TestTemporaryEntity('123456789012345678', -7200000, 'expired2'), // Expired 2 hours ago
    ];

    // Mock the query method
    const mockQuery = vi.spyOn(enhancedRepo, 'query').mockResolvedValue({
      entities: mockExpiredEntities,
      totalCount: 4,
      hasMore: false,
      executionTimeMs: 1
    });

    const result = await enhancedRepo.getExpiredTemporary(TestTemporaryEntity, '123456789012345678');

    // Verify it called query with correct filter
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery).toHaveBeenCalledWith(TestTemporaryEntity, '123456789012345678', {
      filter: expect.any(Function)
    });

    // Verify the filter function works correctly (should filter for expired)
    const call = mockQuery.mock.calls[0];
    const filterFunction = call[2].filter;

    // Create test entities to verify filter logic
    const activeEntity = new TestTemporaryEntity('123456789012345678', 3600000, 'active');
    const expiredEntity = new TestTemporaryEntity('123456789012345678', -3600000, 'expired');

    expect(filterFunction(activeEntity)).toBe(false); // isExpired() === false
    expect(filterFunction(expiredEntity)).toBe(true); // isExpired() === true

    // Verify it returns the entities from query result
    expect(result).toEqual(mockExpiredEntities);
  });

  it('should delegate getEventsByType to findByField with eventType', async () => {
    const enhancedRepo = new EnhancedRepository();

    const mockEventEntities = [
      new TestEventEntity('123456789012345678', 'user.join', 'data1'),
      new TestEventEntity('123456789012345678', 'user.join', 'data2'),
    ];

    // Mock findByField method
    const mockFindByField = vi.spyOn(enhancedRepo, 'findByField').mockResolvedValue(mockEventEntities);

    const result = await enhancedRepo.getEventsByType(TestEventEntity, '123456789012345678', 'user.join');

    // Verify it called findByField with correct parameters
    expect(mockFindByField).toHaveBeenCalledTimes(1);
    expect(mockFindByField).toHaveBeenCalledWith(TestEventEntity, '123456789012345678', 'eventType', 'user.join');

    // Verify it returns the result from findByField
    expect(result).toBe(mockEventEntities);
  });

  it('should handle purgeExpiredTemporary registry iteration and entity cleanup', async () => {
    const enhancedRepo = new EnhancedRepository();

    // Mock registry with temporary entities
    const mockRegistrations = [
      { storageKey: 'temp-bans', entityClass: TestTemporaryEntity, tags: ['temporary'], isPurgeable: true, isIdentified: true },
      { storageKey: 'regular-data', entityClass: TestEntity, tags: [], isPurgeable: false, isIdentified: false },
      { storageKey: 'temp-mutes', entityClass: TestTemporaryEntity, tags: ['temporary'], isPurgeable: true, isIdentified: true },
    ];

    // Mock the private registry property
    const mockGetAllRegistrations = vi.fn().mockReturnValue(mockRegistrations);
    (enhancedRepo as any).registry = {
      getAllRegistrations: mockGetAllRegistrations
    };

    // Mock entities - some expired, some active
    const activeEntity = new TestTemporaryEntity('123456789012345678', 3600000, 'active');
    const expiredEntity1 = new TestTemporaryEntity('123456789012345678', -3600000, 'expired1');
    const expiredEntity2 = new TestTemporaryEntity('123456789012345678', -7200000, 'expired2');

    const mockGetAll = vi.spyOn(enhancedRepo, 'getAll')
      .mockResolvedValueOnce([activeEntity, expiredEntity1]) // temp-bans
      .mockResolvedValueOnce([expiredEntity2]); // temp-mutes

    const mockReplaceAll = vi.spyOn(enhancedRepo, 'replaceAll').mockResolvedValue(undefined);

    const result = await enhancedRepo.purgeExpiredTemporary('123456789012345678');

    // Verify registry was accessed
    expect(mockGetAllRegistrations).toHaveBeenCalledTimes(1);

    // Verify getAll was called for temporary entities only
    expect(mockGetAll).toHaveBeenCalledTimes(2);
    expect(mockGetAll).toHaveBeenNthCalledWith(1, TestTemporaryEntity, '123456789012345678');
    expect(mockGetAll).toHaveBeenNthCalledWith(2, TestTemporaryEntity, '123456789012345678');

    // Verify replaceAll was called with fresh entities
    expect(mockReplaceAll).toHaveBeenCalledTimes(2);
    expect(mockReplaceAll).toHaveBeenNthCalledWith(1, TestTemporaryEntity, '123456789012345678', [activeEntity]);
    expect(mockReplaceAll).toHaveBeenNthCalledWith(2, TestTemporaryEntity, '123456789012345678', []);

    // Verify result structure
    expect(result).toEqual({
      'temp-bans': 1,    // 1 expired entity removed
      'temp-mutes': 1    // 1 expired entity removed
    });
  });

  it('should handle getGuildStats entity counting and statistics aggregation', async () => {
    const enhancedRepo = new EnhancedRepository();

    // Mock registry with different entity types
    const mockRegistrations = [
      { storageKey: 'users', entityClass: TestUserEntity, tags: [], isPurgeable: false, isIdentified: true },
      { storageKey: 'temp-bans', entityClass: TestTemporaryEntity, tags: ['temporary'], isPurgeable: true, isIdentified: true },
      { storageKey: 'events', entityClass: TestEventEntity, tags: [], isPurgeable: true, isIdentified: true },
    ];

    // Mock the private registry property
    const mockGetAllRegistrations = vi.fn().mockReturnValue(mockRegistrations);
    (enhancedRepo as any).registry = {
      getAllRegistrations: mockGetAllRegistrations
    };

    // Mock entities for each type
    const userEntities = [
      new TestUserEntity('123456789012345678', '111111111111111111', 'action1'),
      new TestUserEntity('123456789012345678', '222222222222222222', 'action2'),
    ];

    const tempEntities = [
      new TestTemporaryEntity('123456789012345678', 3600000, 'active'),   // Active
      new TestTemporaryEntity('123456789012345678', -3600000, 'expired'), // Expired
    ];

    const eventEntities = [
      new TestEventEntity('123456789012345678', 'user.join', 'data1'),
    ];

    const mockGetAll = vi.spyOn(enhancedRepo, 'getAll')
      .mockResolvedValueOnce(userEntities)
      .mockResolvedValueOnce(tempEntities)
      .mockResolvedValueOnce(eventEntities);

    const result = await enhancedRepo.getGuildStats('123456789012345678');

    // Verify registry was accessed
    expect(mockGetAllRegistrations).toHaveBeenCalledTimes(1);

    // Verify getAll was called for each entity type
    expect(mockGetAll).toHaveBeenCalledTimes(3);

    // Verify result structure
    expect(result.totalEntities).toBe(5); // 2 + 2 + 1
    expect(result.entitiesByType).toEqual({
      'users': 2,
      'temp-bans': 2,
      'events': 1
    });
    expect(result.purgeableEntities).toBe(3); // temp-bans + events
    expect(result.identifiedEntities).toBe(5); // all entities
    expect(result.temporaryEntities).toBe(2); // temp-bans
    expect(result.expiredEntities).toBe(1); // 1 expired temp entity
  });
});