# ChimeraWeakValueMap

A TypeScript implementation of a weak value map that automatically cleans up
entries when their values are garbage collected. This class extends
`EventEmitter` to provide real-time notifications about map operations and
automatic cleanup events.

## Features

- **Weak References**: Values are stored as weak references, allowing them to be
  garbage collected
- **Automatic Cleanup**: Stale entries are automatically removed when values are
  collected
- **Event-Driven**: Emits events for all map operations and cleanup activities
- **Map-like API**: Implements standard Map methods for familiar usage
- **TypeScript Support**: Full type safety with generic key and value types
- **Performance Optimized**: Uses `requestIdleCallback` for non-blocking cleanup
  operations

## Requirements

- ES2021+ (for `WeakRef` and `FinalizationRegistry`)
- Node.js 14.17.0+ or modern browsers
- TypeScript 4.5+

## Installation

```typescript
import { ChimeraWeakValueMap } from "./ChimeraWeakValueMap.ts";
```

## Basic Usage

```typescript
// Create a new weak value map
const weakMap = new ChimeraWeakValueMap<string, object>();

// Add entries
const obj1 = {id: 1, data: "example"};
const obj2 = {id: 2, data: "test"};

weakMap.set("key1", obj1);
weakMap.set("key2", obj2);

// Check if key exists
console.log(weakMap.has("key1")); // true

// Get value
const value = weakMap.get("key1"); // { id: 1, data: "example" }

// Iterate over entries
for (const [key, value] of weakMap) {
	console.log(`${key}:`, value);
}

// Delete entry
weakMap.delete("key1");
```

## Event Handling

The `ChimeraWeakValueMap` extends `EventEmitter` and provides several events:

```typescript
// Listen for events
weakMap.on("set", (map, key, value) => {
	console.log(`Added: ${key} ->`, value);
});

weakMap.on("delete", (map, key, value) => {
	console.log(`Deleted: ${key} ->`, value);
});

weakMap.on("finalize", (map, key) => {
	console.log(`Garbage collected: ${key}`);
});

weakMap.on("clear", (map) => {
	console.log("Map cleared");
});

// Add some entries
const obj = {data: "will be collected"};
weakMap.set("temp", obj);

// Remove reference to trigger garbage collection
obj = null;

// The "finalize" event will be emitted when the object is collected
```

## API Reference

### Constructor

```typescript
new ChimeraWeakValueMap < K, V
extends
object > (values ? : readonly(readonly [K, V])[] | null)
```

Creates a new weak value map with optional initial entries.

### Methods

#### `set(key: K, value: V): this`

Adds or updates an entry in the map.

```typescript
weakMap.set("key", {data: "value"});
```

#### `get(key: K): V | undefined`

Retrieves a value by key. Returns `undefined` if the key doesn't exist or the
value has been garbage collected.

```typescript
const value = weakMap.get("key");
```

#### `has(key: K): boolean`

Checks if a key exists and its value hasn't been garbage collected.

```typescript
if (weakMap.has("key")) {
	// Key exists and value is available
}
```

#### `delete(key: K): boolean`

Removes an entry from the map. Returns `true` if the key existed, `false`
otherwise.

```typescript
const wasDeleted = weakMap.delete("key");
```

#### `clear(): void`

Removes all entries from the map and unregisters all finalization callbacks.

```typescript
weakMap.clear();
```

#### `cleanup(): void`

Forces immediate cleanup of stale entries. This is usually called automatically.

```typescript
weakMap.cleanup();
```

### Iteration Methods

#### `entries(): IterableIterator<[K, V]>`

Returns an iterator of key-value pairs.

```typescript
for (const [key, value] of weakMap.entries()) {
	console.log(key, value);
}
```

#### `keys(): IterableIterator<K>`

Returns an iterator of keys.

```typescript
for (const key of weakMap.keys()) {
	console.log(key);
}
```

#### `values(): IterableIterator<V>`

Returns an iterator of values.

```typescript
for (const value of weakMap.values()) {
	console.log(value);
}
```

#### `forEach(callbackFn, thisArg?): void`

Executes a callback for each entry.

```typescript
weakMap.forEach((value, key, map) => {
	console.log(`${key}:`, value);
});
```

### Properties

#### `size: number`

Returns the number of entries in the map (excluding garbage collected values).

```typescript
console.log(weakMap.size);
```

#### `rawSize: number`

Returns the total number of entries including stale references.

```typescript
console.log(weakMap.rawSize);
```

### Events

#### `set: [ChimeraWeakValueMap<K, V>, K, V]`

Emitted when an entry is added or updated.

#### `delete: [ChimeraWeakValueMap<K, V>, K, V]`

Emitted when an entry is explicitly deleted.

#### `finalize: [ChimeraWeakValueMap<K, V>, K]`

Emitted when a value is garbage collected and the entry is automatically
removed.

#### `clear: [ChimeraWeakValueMap<K, V>]`

Emitted when all entries are cleared.

## Advanced Usage

### Custom Event Handling

```typescript
class MyWeakMap extends ChimeraWeakValueMap<string, MyObject> {
	constructor() {
		super();

		this.on("finalize", (map, key) => {
			// Custom cleanup logic
			this.handleGarbageCollection(key);
		});
	}

	private handleGarbageCollection(key: string) {
		// Perform additional cleanup
		console.log(`Cleaning up resources for key: ${key}`);
	}
}
```

### Batch Operations

```typescript
// Initialize with multiple entries
const initialEntries: [string, object][] = [
	["key1", {id: 1}],
	["key2", {id: 2}],
	["key3", {id: 3}]
];

const weakMap = new ChimeraWeakValueMap(initialEntries);

// Batch operations
const objects = [
	{id: 4, data: "four"},
	{id: 5, data: "five"}
];

objects.forEach((obj, index) => {
	weakMap.set(`batch-${index}`, obj);
});
```

### Memory Management

```typescript
// Monitor memory usage
let cleanupCount = 0;

weakMap.on("finalize", () => {
	cleanupCount++;
	console.log(`Cleaned up ${cleanupCount} entries`);
});

// Force cleanup when needed
setInterval(() => {
	weakMap.cleanup();
}, 60000); // Cleanup every minute
```

## Performance Considerations

- **Automatic Cleanup**: The map automatically schedules cleanup operations
  using `requestIdleCallback` (or `setTimeout` as fallback) to avoid blocking
  the main thread
- **Lazy Evaluation**: Iteration methods only process live references, skipping
  garbage collected values
- **Memory Efficiency**: Weak references allow the JavaScript engine to collect
  unused objects without manual intervention

## Browser Compatibility

| Feature              | Chrome | Firefox | Safari | Edge |
|----------------------|--------|---------|--------|------|
| WeakRef              | 84     | 79      | 14.1   | 84   |
| FinalizationRegistry | 84     | 79      | 14.1   | 84   |

## Node.js Compatibility

- Node.js 14.17.0+ (with `--harmony-weak-refs` flag)
- Node.js 16.0.0+ (stable support)

## Error Handling

The class throws `ChimeraInternalError` for unsupported operations:

```typescript
try {
	weakMap.emit("custom-event"); // This will throw
} catch (error) {
	console.error("External event dispatching is not supported");
}
```

## TypeScript Types

```typescript
import type { ChimeraWeakValueMapEventMap } from "./ChimeraWeakValueMap.ts";

// Use the event map type for custom event handling
type MyEventMap = ChimeraWeakValueMapEventMap<string, MyObject>;
```

## Contributing

When contributing to this module:

1. Ensure all new features include TypeScript types
2. Add appropriate event emissions for new operations
3. Include cleanup logic for any new internal state
4. Update this README for any API changes
5. Add tests for new functionality

## License

This module is part of the Chimera Store library and follows the same licensing
terms. 
