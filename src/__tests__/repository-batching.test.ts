/**
 * Comprehensive tests for the repository write batching system
 * Tests the critical batching functionality including timing, batch sizes, and concurrent operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { repository, DatabaseObject, RepositoryConfig, EntityRegistry } from '../repository/index.js';

// Mock lowdb
vi.mock('lowdb/node', () => ({
  JSONFilePreset: vi.fn()
}));

// Test entity for batching tests
class TestBatchEntity implements DatabaseObject {
  static readonly storageKey = 'test-batch-entities';

  constructor(
    public guildId: string,
    public id: string,
    public data: string,
    public timestamp: string = new Date().toISOString()
  ) {}
}

describe('Repository Write Batching System', () => {
  const testGuildId = '123456789012345678';
  const testDatabasePath = '/tmp/test-batch.json';

  // Mock database instance
  const mockWrite = vi.fn();
  const mockDbInstance = {
    data: {} as Record<string, any>,
    write: mockWrite
  };

  beforeEach(async () => {
    // Clear timers first
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Reset repository internal state completely
    (repository as any).config = null;
    (repository as any).initialized = false;
    (repository as any).dbInstance = null;
    (repository as any).pendingWrites = [];
    (repository as any).writeTimeout = null;
    (repository as any).isWriting = false;
    (repository as any).metrics = {
      totalWrites: 0,
      batchedWrites: 0,
      avgWriteTime: 0,
      lastWriteTime: 0
    };

    // Reset mock database instance data
    mockDbInstance.data = {};

    // Reset mock implementation completely
    mockWrite.mockClear();
    mockWrite.mockResolvedValue(undefined);

    const { JSONFilePreset } = await import('lowdb/node');
    (JSONFilePreset as any).mockClear();
    (JSONFilePreset as any).mockResolvedValue(mockDbInstance);

    // Create and configure entity registry
    const registry = new EntityRegistry();
    registry.register(TestBatchEntity, (entity) => entity.guildId);

    // Initialize repository with registry
    await repository.initialize({
      databasePath: testDatabasePath,
      entityRegistry: registry
    } as RepositoryConfig);

    // Ensure database instance is properly initialized for tests
    // This prevents race conditions with async timer operations
    (repository as any).dbInstance = mockDbInstance;
  });

  afterEach(() => {
    // Clear any pending timeouts from the repository
    if ((repository as any).writeTimeout) {
      clearTimeout((repository as any).writeTimeout);
      (repository as any).writeTimeout = null;
    }

    // Clear any pending writes without executing them
    (repository as any).pendingWrites = [];
    (repository as any).isWriting = false;

    // Run any pending timers to completion
    vi.runOnlyPendingTimers();

    // Now it's safe to restore real timers
    vi.useRealTimers();
  });

  describe('Batch Delay Timing (50ms)', () => {
    it('should delay writes by 50ms when batching is enabled', async () => {
      const entity = new TestBatchEntity(testGuildId, 'test-1', 'data-1');

      // Store entity - should be scheduled for batching
      const storePromise = repository.store(entity);

      // Immediately check that write hasn't happened yet
      expect(mockWrite).not.toHaveBeenCalled();
      expect((repository as any).pendingWrites).toHaveLength(1);

      // Fast-forward 49ms - should still be pending
      vi.advanceTimersByTime(49);
      expect(mockWrite).not.toHaveBeenCalled();

      // Fast-forward 1 more ms (total 50ms) - should trigger batch write
      vi.advanceTimersByTime(1);
      await vi.runOnlyPendingTimersAsync();

      await storePromise;

      expect(mockWrite).toHaveBeenCalledTimes(1);
      expect((repository as any).pendingWrites).toHaveLength(0);
    });

    it('should reset batch timer if new items arrive during delay', async () => {
      const entity1 = new TestBatchEntity(testGuildId, 'test-1', 'data-1');
      const entity2 = new TestBatchEntity(testGuildId, 'test-2', 'data-2');

      const promise1 = repository.store(entity1);

      // Advance 25ms
      vi.advanceTimersByTime(25);
      expect(mockWrite).not.toHaveBeenCalled();

      // Add second entity - should extend the batch window
      const promise2 = repository.store(entity2);

      // Advance another 40ms (total 65ms) - first timer would have expired
      vi.advanceTimersByTime(40);
      expect(mockWrite).not.toHaveBeenCalled();
      expect((repository as any).pendingWrites).toHaveLength(2);

      // Wait for the new 50ms delay to complete
      vi.advanceTimersByTime(10);
      await vi.runOnlyPendingTimersAsync();

      await Promise.all([promise1, promise2]);

      expect(mockWrite).toHaveBeenCalledTimes(1);
      expect(mockDbInstance.data[testGuildId][TestBatchEntity.storageKey]).toHaveLength(2);
    });
  });

  describe('Batch Size Limits (100 items)', () => {
    it('should process exactly 100 items in a single batch', async () => {
      const entities = Array.from({ length: 100 }, (_, i) =>
        new TestBatchEntity(testGuildId, `test-${i}`, `data-${i}`)
      );

      const storePromises = entities.map(entity => repository.store(entity));

      // Trigger batch processing
      vi.advanceTimersByTime(50);
      await vi.runOnlyPendingTimersAsync();

      await Promise.all(storePromises);

      expect(mockWrite).toHaveBeenCalledTimes(1);
      expect(mockDbInstance.data[testGuildId][TestBatchEntity.storageKey]).toHaveLength(100);
      expect((repository as any).pendingWrites).toHaveLength(0);
    });

    it('should split writes into multiple batches when exceeding 100 items', async () => {
      const entities = Array.from({ length: 150 }, (_, i) =>
        new TestBatchEntity(testGuildId, `test-${i}`, `data-${i}`)
      );

      const storePromises = entities.map(entity => repository.store(entity));

      // First batch (100 items) - advance time and wait for completion
      vi.advanceTimersByTime(50);
      await vi.runOnlyPendingTimersAsync();

      // Second batch should be automatically scheduled
      vi.advanceTimersByTime(50);
      await vi.runOnlyPendingTimersAsync();

      await Promise.all(storePromises);

      expect(mockWrite).toHaveBeenCalledTimes(2);
      expect(mockDbInstance.data[testGuildId][TestBatchEntity.storageKey]).toHaveLength(150);
      expect((repository as any).pendingWrites).toHaveLength(0);
    });

    it('should handle exactly 101 items in two batches', async () => {
      const entities = Array.from({ length: 101 }, (_, i) =>
        new TestBatchEntity(testGuildId, `test-${i}`, `data-${i}`)
      );

      const storePromises = entities.map(entity => repository.store(entity));

      // Check initial state
      expect((repository as any).pendingWrites).toHaveLength(101);
      expect(mockWrite).toHaveBeenCalledTimes(0);

      // Process first batch (100 items)
      vi.advanceTimersByTime(50);
      await vi.runOnlyPendingTimersAsync();

      // The first batch should process all 100 items, triggering another timer for the remaining 1
      // So we might have 2 calls already due to the automatic scheduling

      // Process any remaining batches
      vi.advanceTimersByTime(50);
      await vi.runOnlyPendingTimersAsync();

      // Wait for all store operations to complete
      await Promise.all(storePromises);

      // Verify final state - should have called write twice (once for 100 items, once for 1 item)
      expect(mockWrite).toHaveBeenCalledTimes(2);
      expect(mockDbInstance.data[testGuildId][TestBatchEntity.storageKey]).toHaveLength(101);
      expect((repository as any).pendingWrites).toHaveLength(0);
    });
  });

  describe('Concurrent Write Batching', () => {
    it('should batch concurrent writes into single database operation', async () => {
      const entities = [
        new TestBatchEntity(testGuildId, 'concurrent-1', 'data-1'),
        new TestBatchEntity(testGuildId, 'concurrent-2', 'data-2'),
        new TestBatchEntity(testGuildId, 'concurrent-3', 'data-3')
      ];

      // Simulate concurrent writes
      const storePromises = entities.map(entity => repository.store(entity));

      expect((repository as any).pendingWrites).toHaveLength(3);
      expect(mockWrite).not.toHaveBeenCalled();

      // All writes should be batched together
      vi.advanceTimersByTime(50);
      await vi.runOnlyPendingTimersAsync();

      await Promise.all(storePromises);

      expect(mockWrite).toHaveBeenCalledTimes(1);
      expect(mockDbInstance.data[testGuildId][TestBatchEntity.storageKey]).toHaveLength(3);
    });

    it('should handle mixed entity types in the same batch', async () => {
      class SecondEntityType implements DatabaseObject {
        static readonly storageKey = 'second-type-entities';
        constructor(public guildId: string, public id: string) {}
      }

      // Register the second entity type
      const registry = (repository as any).config.entityRegistry;
      registry.register(SecondEntityType, (entity: SecondEntityType) => entity.guildId);

      const entity1 = new TestBatchEntity(testGuildId, 'test-1', 'data-1');
      const entity2 = new SecondEntityType(testGuildId, 'second-1');

      const promises = [
        repository.store(entity1),
        repository.store(entity2)
      ];

      vi.advanceTimersByTime(50);
      await vi.runOnlyPendingTimersAsync();

      await Promise.all(promises);

      expect(mockWrite).toHaveBeenCalledTimes(1);
      expect(mockDbInstance.data[testGuildId][TestBatchEntity.storageKey]).toHaveLength(1);
      expect(mockDbInstance.data[testGuildId][SecondEntityType.storageKey]).toHaveLength(1);
    });
  });

  describe('scheduleBatchWrite() and performBatchWrite() Methods', () => {
    it('should not schedule multiple timeouts simultaneously', async () => {
      const entity1 = new TestBatchEntity(testGuildId, 'test-1', 'data-1');
      const entity2 = new TestBatchEntity(testGuildId, 'test-2', 'data-2');

      // Call scheduleBatchWrite multiple times (don't await - we want pending operations)
      const promise1 = repository.store(entity1);
      const promise2 = repository.store(entity2);

      // Should have only one timeout scheduled
      expect((repository as any).writeTimeout).toBeTruthy();

      // Manually call scheduleBatchWrite again (simulating internal logic)
      (repository as any).scheduleBatchWrite();

      // Should still be the same timeout (no duplicate scheduling)
      const firstTimeout = (repository as any).writeTimeout;
      (repository as any).scheduleBatchWrite();
      expect((repository as any).writeTimeout).toBe(firstTimeout);

      vi.advanceTimersByTime(50);
      await vi.runOnlyPendingTimersAsync();
      
      // Clean up promises
      await Promise.all([promise1, promise2]);
    });

    it('should clear timeout after batch processing', async () => {
      const entity = new TestBatchEntity(testGuildId, 'test-1', 'data-1');

      const storePromise = repository.store(entity);
      expect((repository as any).writeTimeout).toBeTruthy();

      vi.advanceTimersByTime(50);
      await vi.runOnlyPendingTimersAsync();

      expect((repository as any).writeTimeout).toBeNull();
      
      // Clean up promise
      await storePromise;
    });

    it('should handle performBatchWrite when no pending writes exist', async () => {
      // Manually call performBatchWrite with empty pending writes
      await (repository as any).performBatchWrite();

      expect(mockWrite).not.toHaveBeenCalled();
      expect((repository as any).isWriting).toBe(false);
    });

    it('should prevent concurrent batch writes', async () => {
      const entities = Array.from({ length: 5 }, (_, i) =>
        new TestBatchEntity(testGuildId, `test-${i}`, `data-${i}`)
      );

      entities.forEach(entity => repository.store(entity));

      // Simulate isWriting flag being set
      (repository as any).isWriting = true;

      // Try to perform batch write - should skip
      await (repository as any).performBatchWrite();

      expect(mockWrite).not.toHaveBeenCalled();
      expect((repository as any).pendingWrites).toHaveLength(5);

      // Reset flag and allow processing
      (repository as any).isWriting = false;
      await (repository as any).performBatchWrite();

      expect(mockWrite).toHaveBeenCalledTimes(1);
    });
  });

  describe('Single Database Write Per Batch Verification', () => {
    it('should call database.write() exactly once per batch regardless of batch size', async () => {
      const testSizes = [1, 5, 10, 50, 100];

      for (const size of testSizes) {
        vi.clearAllMocks();
        mockDbInstance.data = {};
        (repository as any).pendingWrites = [];

        const entities = Array.from({ length: size }, (_, i) =>
          new TestBatchEntity(testGuildId, `test-${i}`, `data-${i}`)
        );

        const storePromises = entities.map(entity => repository.store(entity));

        vi.advanceTimersByTime(50);
        await vi.runOnlyPendingTimersAsync();

        await Promise.all(storePromises);

        expect(mockWrite).toHaveBeenCalledTimes(1);
        expect(mockDbInstance.data[testGuildId][TestBatchEntity.storageKey]).toHaveLength(size);
      }
    });

    it('should verify all entities are written to database in single operation', async () => {
      const entities = [
        new TestBatchEntity(testGuildId, 'verify-1', 'content-1'),
        new TestBatchEntity(testGuildId, 'verify-2', 'content-2'),
        new TestBatchEntity(testGuildId, 'verify-3', 'content-3')
      ];

      const storePromises = entities.map(entity => repository.store(entity));

      vi.advanceTimersByTime(50);
      await vi.runOnlyPendingTimersAsync();

      await Promise.all(storePromises);

      expect(mockWrite).toHaveBeenCalledTimes(1);

      const storedEntities = mockDbInstance.data[testGuildId][TestBatchEntity.storageKey];
      expect(storedEntities).toHaveLength(3);

      entities.forEach(entity => {
        expect(storedEntities).toContainEqual(entity);
      });
    });
  });


  describe('flushPendingWrites() Method', () => {
    it('should immediately process all pending writes', async () => {
      const entities = [
        new TestBatchEntity(testGuildId, 'flush-1', 'data-1'),
        new TestBatchEntity(testGuildId, 'flush-2', 'data-2'),
        new TestBatchEntity(testGuildId, 'flush-3', 'data-3')
      ];

      const storePromises = entities.map(entity => repository.store(entity));

      // Don't wait for timer - flush immediately
      expect(mockWrite).not.toHaveBeenCalled();
      expect((repository as any).pendingWrites).toHaveLength(3);

      await repository.flushPendingWrites();

      expect(mockWrite).toHaveBeenCalledTimes(1);
      expect((repository as any).pendingWrites).toHaveLength(0);
      expect((repository as any).writeTimeout).toBeNull();

      await Promise.all(storePromises);
    });

    it('should clear existing timeout when flushing', async () => {
      const entity = new TestBatchEntity(testGuildId, 'timeout-1', 'data-1');

      const storePromise = repository.store(entity);
      expect((repository as any).writeTimeout).toBeTruthy();

      await repository.flushPendingWrites();

      expect((repository as any).writeTimeout).toBeNull();
      expect(mockWrite).toHaveBeenCalledTimes(1);
      
      await storePromise; // Clean up the promise
    });

    it('should handle empty pending writes gracefully', async () => {
      await repository.flushPendingWrites();

      expect(mockWrite).not.toHaveBeenCalled();
      expect((repository as any).pendingWrites).toHaveLength(0);
    });
  });
});