# @hf-chimera/store

Core store library for Chimera Store - a cross-platform, reactive cache management library with intelligent deduplication and efficient data synchronization.

## Features

- **💾 Intelligent Cache Management**: Automatic deduplication and memory-efficient caching
- **🔍 Advanced Querying**: Built-in filtering and sorting support
- **⚡ Real-Time Updates**: Event-driven architecture with automatic cache invalidation
- **🎯 Type Safety**: Full TypeScript support with comprehensive type definitions
- **🛡️ Error Handling**: Robust error handling with detailed error messages
- **🌐 Universal Compatibility**: Works with any data source (REST APIs, GraphQL, WebSockets, etc.)

## Installation

```bash
npm install @hf-chimera/store
# or
yarn add @hf-chimera/store
# or
pnpm add @hf-chimera/store
```

## Framework Integrations

- **React**: Use [`@hf-chimera/react`](../adapters/react) for React hooks
- **Vue**: Use [`@hf-chimera/vue`](../adapters/vue) for Vue 3 composables
- **Query Builder**: Use [`@hf-chimera/query-builder`](../qb) for fluent query building

## Quick Start

### Basic Setup

```typescript
import { createChimeraEntityStore } from "@hf-chimera/store";

// Define your entity type
type User = {
  id: number;
  name: string;
  email: string;
  age: number;
};

// Create an entity store
const userStore = createChimeraEntityStore<"user", User>({
  name: "user",
  idGetter: "id", // Can be a string (property name) or function
  trustQuery: true,

  // Collection fetcher - fetch multiple items
  collectionFetcher: async (params, requestParams) => {
    const response = await fetch(`/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filter: params.filter, order: params.order }),
      signal: requestParams.signal,
    });
    return { data: await response.json() };
  },

  // Item fetcher - fetch single item by ID
  itemFetcher: async (params, requestParams) => {
    const response = await fetch(`/api/users/${params.id}`, {
      signal: requestParams.signal,
    });
    return { data: await response.json() };
  },

  // Item creator - create new item
  itemCreator: async (item, requestParams) => {
    const response = await fetch(`/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
      signal: requestParams.signal,
    });
    return { data: await response.json() };
  },

  // Item updater - update existing item
  itemUpdater: async (item, requestParams) => {
    const response = await fetch(`/api/users/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
      signal: requestParams.signal,
    });
    return { data: await response.json() };
  },

  // Item deleter - delete item by ID
  itemDeleter: async (id, requestParams) => {
    await fetch(`/api/users/${id}`, {
      method: "DELETE",
      signal: requestParams.signal,
    });
    return { result: { id, success: true } };
  },
});
```

### Working with Data

```typescript
import {
  chimeraCreateConjunction,
  chimeraCreateOperator,
  chimeraCreateOrderBy,
  ChimeraOrderNulls,
} from "@hf-chimera/store";

// Create a new user
const newUserQuery = userStore.createItem({
  name: "John Doe",
  email: "john@example.com",
  age: 30,
});

// Listen for creation events
newUserQuery.on("created", (query) => {
  console.log("User created:", query.data);
});

// Get a specific user
const userQuery = userStore.getItem(123);

// Listen for data updates
userQuery.on("ready", (query) => {
  console.log("User loaded:", query.data);
});

// Update user data
userQuery.mutable.name = "Jane Doe";
await userQuery.commit();

// Get a collection with filtering and sorting
const activeUsersQuery = userStore.getCollection({
  filter: chimeraCreateConjunction("and", [
    chimeraCreateOperator("gte", "age", 18),
  ]),
  order: [chimeraCreateOrderBy("name", false, ChimeraOrderNulls.Last)],
});

// Listen for collection updates
activeUsersQuery.on("updated", (query, items, oldItems) => {
  console.log("Active users updated:", items);
});

// External updates (e.g., from WebSocket)
userStore.updateOne({
  id: 123,
  name: "Updated Name",
  email: "updated@example.com",
  age: 31,
});
```

## Core Concepts

### Entity Store

Each entity type has its own `ChimeraEntityStore` instance created via `createChimeraEntityStore`. This provides:

- **Isolated caching** per entity type
- **Type-safe operations** for that specific entity
- **Event-driven updates** for real-time synchronization
- **Query management** with automatic deduplication

### Query Types

- **Item Query**: Manages a single entity instance
- **Collection Query**: Manages a filtered/sorted collection of entities

### Filtering System

Chimera Store provides a powerful filtering system with support for:

- **Operators**: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`, `startsWith`, `endsWith`, `in`, `notIn`
- **Conjunctions**: `and`, `or`, `not`
- **Custom Operators**: Extensible operator system for custom logic
- **Utility Functions**: Use `chimeraCreateOperator` and `chimeraCreateConjunction` to build filters

### Ordering System

Flexible ordering with support for:

- **Multiple Fields**: Sort by multiple properties
- **Direction**: Ascending/descending order
- **Null Handling**: Configurable null value positioning using `ChimeraOrderNulls.First` or `ChimeraOrderNulls.Last`
- **Utility Functions**: Use `chimeraCreateOrderBy` to build order descriptors

## API Reference

### createChimeraEntityStore

The main function to create an entity store instance.

#### Signature

```typescript
function createChimeraEntityStore<
  TEntityName extends string,
  TItem extends object,
>(
  config: ChimeraQueryEntityConfig<TEntityName, TItem, OperatorsMap>,
): ChimeraEntityStore<TEntityName, TItem, OperatorsMap>;
```

#### Parameters

- `config`: Entity configuration object containing:
  - `name`: Entity name (string)
  - `idGetter`: Property name (string) or function to extract ID from entity
  - `trustQuery`: Whether to trust query results (boolean)
  - `collectionFetcher`: Function to fetch multiple items
  - `itemFetcher`: Function to fetch single item by ID
  - `itemCreator`: Function to create new item
  - `itemUpdater`: Function to update existing item
  - `itemDeleter`: Function to delete item by ID
  - Optional: `batchedCreator`, `batchedUpdater`, `batchedDeleter` for batch operations
  - Optional: `updateDebounceTimeout` for debouncing updates

#### Returns

`ChimeraEntityStore<TEntityName, TItem, OperatorsMap>` instance

### ChimeraEntityStore

Entity-specific store with query capabilities.

#### Properties

- `name`: Entity name (readonly)

#### Methods

- `createItem(item: DeepPartial<Item>, meta?: any)`: Create new item
- `getItem(id: ChimeraEntityId, meta?: any)`: Get single item
- `getCollection(params: ChimeraCollectionParams)`: Get filtered/sorted collection
- `updateOne(item: Item)`: Update single item externally
- `updateMany(items: Item[])`: Update multiple items externally
- `deleteOne(id: ChimeraEntityId)`: Delete single item externally
- `deleteMany(ids: ChimeraEntityId[])`: Delete multiple items externally
- `updateMixed(toAdd: Item[], toDelete: ChimeraEntityId[])`: Mixed update/delete operation

#### Events

- `initialized`: Store initialized
- `itemAdded`: Item added to cache
- `itemUpdated`: Item updated
- `updated`: Multiple items updated
- `itemDeleted`: Item deleted
- `deleted`: Multiple items deleted

### ChimeraItemQuery

Represents a single item query with full CRUD operations.

#### Properties

- `data`: Current item data (throws if not ready)
- `mutable`: Mutable reference for updates
- `state`: Current query state
- `ready`: Whether data is available
- `inProgress`: Whether operation is in progress
- `id`: Item ID

#### Methods

- `refetch(force?: boolean)`: Refetch data
- `update(item: Item, force?: boolean)`: Update item
- `mutate(mutator: (draft: Item) => Item, force?: boolean)`: Update using mutator function
- `commit(force?: boolean)`: Commit mutable changes
- `delete(force?: boolean)`: Delete item

#### Events

- `initialized`: Query initialized
- `created`: Item created
- `ready`: Data ready
- `updated`: Data updated
- `selfUpdated`: Self-initiated update
- `deleted`: Item deleted
- `selfDeleted`: Self-initiated deletion
- `error`: Error occurred

### ChimeraCollectionQuery

Represents a collection query with filtering and sorting.

#### Properties

- `length`: Number of items
- `state`: Current query state
- `ready`: Whether data is available
- `inProgress`: Whether operation is in progress

#### Methods

- `refetch(force?: boolean)`: Refetch data
- `update(item: Item)`: Update single item
- `batchedUpdate(items: Iterable<Item>)`: Update multiple items
- `delete(id: ChimeraEntityId)`: Delete single item
- `batchedDelete(ids: Iterable<ChimeraEntityId>)`: Delete multiple items
- `create(item: DeepPartial<Item>)`: Create new item
- `batchedCreate(items: Iterable<DeepPartial<Item>>)`: Create multiple items

#### Array-like Methods

Collection queries implement the standard Array interface:

- `at(index: number)`: Get item at index
- `find(predicate)`: Find item by predicate
- `filter(predicate)`: Filter items
- `map(transform)`: Transform items
- `forEach(callback)`: Iterate over items
- `slice(start?, end?)`: Get subset of items
- And many more...

#### Events

- `initialized`: Query initialized
- `ready`: Data ready
- `updated`: Data updated
- `selfUpdated`: Self-initiated update
- `itemAdded`: Item added
- `itemUpdated`: Item updated
- `selfItemUpdated`: Self-initiated item update
- `itemDeleted`: Item deleted
- `selfItemDeleted`: Self-initiated item deletion
- `error`: Error occurred

## Advanced Usage

### Event Handling

```typescript
// Listen to store-level events
userStore.on("itemAdded", ({ instance, item }) => {
  console.log("Item added:", item);
});

userStore.on("itemUpdated", ({ instance, item, oldItem }) => {
  console.log("User updated:", item, "was:", oldItem);
});

// Listen to query events
const userQuery = userStore.getItem(123);
userQuery.on("updated", (query, item, oldItem) => {
  console.log("Query updated:", item);
});
```

### Optimistic Updates

```typescript
// Optimistic update with rollback
const userQuery = userStore.getItem(123);

// Update optimistically
userQuery.mutable.name = "New Name";

try {
  await userQuery.commit();
  console.log("Update successful");
} catch (error) {
  // Rollback on error
  await userQuery.refetch();
  console.log("Update failed, rolled back");
}
```

## Performance Considerations

### Memory Management

- Chimera Store uses weak references for automatic memory cleanup
- Queries are automatically cached and deduplicated
- Stale references are cleaned up automatically

### Caching Strategy

- Collection queries are cached by filter/order combination
- Item queries are cached by ID
- Cache keys are generated automatically for optimal performance

### Update Optimization

- Batch operations for multiple updates
- Optimistic updates for better UX
- Debounced updates to reduce API calls

## Browser Support

- **Modern Browsers**: Full support for ES2021+ features
- **Node.js**: 14.17.0+ with `--harmony-weak-refs` flag, 16.0.0+ stable
- **TypeScript**: 4.5+ recommended

## Learn More

- [Main Documentation](../../README.md)
- [React Integration](../adapters/react/README.md)
- [Vue Integration](../adapters/vue/README.md)
- [Query Builder](../qb/README.md)

## License

MIT License — see [LICENSE](../../LICENSE) file for details.
