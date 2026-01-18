# Chimera Store

A cross-platform, reactive cache management library with intelligent
deduplication and efficient data synchronization. Chimera Store provides a
powerful API for managing cached data with built-in querying, filtering,
ordering, and real-time updates.

## Features

- **🔄 Cross-Platform Reactivity**: Works seamlessly across web, mobile, and desktop platforms
- **💾 Intelligent Cache Management**: Automatic deduplication and memory-efficient caching
- **🔍 Advanced Querying**: Built-in filtering, and sorting support (Pagination in development)
- **⚡ Real-Time Updates**: Event-driven architecture with automatic cache invalidation
- **🎯 Type Safety**: Full TypeScript support with comprehensive type definitions
- **🛡️ Error Handling**: Robust error handling with detailed error messages
- **📦 Modular Architecture**: Composable components for flexible integration
- **🌐 Universal Compatibility**: Works with any data source (REST APIs, GraphQL, WebSockets, etc.)

## Packages

Chimera Store is published as multiple packages to support different use cases:

| Package                                          | Description              | Use Case                             |
| ------------------------------------------------ | ------------------------ | ------------------------------------ |
| [`@hf-chimera/store`](./packages/store)          | Core store library       | Required for all projects            |
| [`@hf-chimera/react`](./packages/adapters/react) | React integration        | React applications using hooks       |
| [`@hf-chimera/vue`](./packages/adapters/vue)     | Vue integration          | Vue 3 applications using composables |
| [`@hf-chimera/query-builder`](./packages/qb)     | Fluent query builder     | Type-safe query construction         |
| `@hf-chimera/adapters-shared`                    | Shared adapter utilities | Internal package (auto-installed)    |

## Installation

### Core Store

The core store is required for all projects:

```bash
npm install @hf-chimera/store
# or
yarn add @hf-chimera/store
# or
pnpm add @hf-chimera/store
```

### React Integration

For React applications, install the React adapter:

```bash
npm install @hf-chimera/store @hf-chimera/react react
# or
yarn add @hf-chimera/store @hf-chimera/react react
# or
pnpm add @hf-chimera/store @hf-chimera/react react
```

### Vue Integration

For Vue 3 applications, install the Vue adapter:

```bash
npm install @hf-chimera/store @hf-chimera/vue vue
# or
yarn add @hf-chimera/store @hf-chimera/vue vue
# or
pnpm add @hf-chimera/store @hf-chimera/vue vue
```

### Query Builder (Optional)

For a fluent, type-safe query building API:

```bash
npm install @hf-chimera/query-builder
# or
yarn add @hf-chimera/query-builder
# or
pnpm add @hf-chimera/query-builder
```

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

// Create an entity store for users
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

// Create additional entity stores as needed
type Post = {
  id: number;
  title: string;
  content: string;
  userId: number;
  createdAt: Date;
};

const postStore = createChimeraEntityStore<"post", Post>({
  name: "post",
  idGetter: "id",
  trustQuery: true,
  collectionFetcher: async (params, requestParams) => {
    const response = await fetch(`/api/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filter: params.filter, order: params.order }),
      signal: requestParams.signal,
    });
    return { data: await response.json() };
  },
  itemFetcher: async (params, requestParams) => {
    const response = await fetch(`/api/posts/${params.id}`, {
      signal: requestParams.signal,
    });
    return { data: await response.json() };
  },
  // ... other CRUD operations
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
const userQuery = userStore.getItem("user-123");

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

### React Integration

For React applications, use the `@hf-chimera/react` package which provides hooks for seamless integration:

```tsx
import { createChimeraStoreHooks } from "@hf-chimera/react";
import { createChimeraEntityStore } from "@hf-chimera/store";

// Define your entity type
type User = {
  id: number;
  name: string;
  email: string;
  age: number;
};

// Create your entity store
const userStore = createChimeraEntityStore<"user", User>({
  name: "user",
  idGetter: "id",
  // ... CRUD operations (collectionFetcher, itemFetcher, etc.)
});

// Create hooks bound to your user store
// This generates: useChimeraUserStore, useChimeraUserCollection, useChimeraUserItem
export const {
  useChimeraUserStore,
  useChimeraUserCollection,
  useChimeraUserItem,
} = createChimeraStoreHooks(userStore);

// Use in components
function UserList() {
  const users = useChimeraUserCollection({
    filter: chimeraCreateOperator("gte", "age", 18),
    order: [chimeraCreateOrderBy("name", false, ChimeraOrderNulls.Last)],
  });

  if (!users.ready) return <div>Loading...</div>;
  if (users.lastError) return <div>Error: {String(users.lastError)}</div>;

  return (
    <div>
      {users.map((user) => (
        <div key={user.id}>{user.name}</div>
      ))}
    </div>
  );
}
```

**Learn more:** See the [React adapter documentation](./packages/adapters/react/README.md) for detailed usage.

### Vue Integration

For Vue 3 applications, use the `@hf-chimera/vue` package which provides composables:

```vue
<script setup lang="ts">
import { createChimeraStoreComposables } from "@hf-chimera/vue";
import { createChimeraEntityStore, chimeraCreateOperator, chimeraCreateOrderBy, ChimeraOrderNulls } from "@hf-chimera/store";

// Define your entity type
type User = {
  id: number;
  name: string;
  email: string;
  age: number;
};

// Create your entity store
const userStore = createChimeraEntityStore<"user", User>({
  name: "user",
  idGetter: "id",
  // ... CRUD operations (collectionFetcher, itemFetcher, etc.)
});

// Create composables bound to your user store
// This generates: useChimeraUserStore, useChimeraUserCollection, useChimeraUserItem
export const {
  useChimeraUserStore,
  useChimeraUserCollection,
  useChimeraUserItem,
} = createChimeraStoreComposables(userStore);

// Use in components
const users = useChimeraUserCollection({
  filter: chimeraCreateOperator("gte", "age", 18),
  order: [chimeraCreateOrderBy("name", false, ChimeraOrderNulls.Last)],
});
</script>

<template>
  <div>
    <div v-if="!users.ready">Loading...</div>
    <div v-else-if="users.lastError">Error: {{ String(users.lastError) }}</div>
    <div v-else>
      <div v-for="user in users" :key="user.id">{{ user.name }}</div>
    </div>
  </div>
</template>
```

**Learn more:** See the [Vue adapter documentation](./packages/adapters/vue/README.md) for detailed usage.

### Query Builder

For complex queries, use the `@hf-chimera/query-builder` package for a fluent, type-safe API:

```typescript
import { ChimeraQueryBuilder } from "@hf-chimera/query-builder";

// Create a query builder
const query = new ChimeraQueryBuilder<typeof userStore, User, OperatorsMap>()
  .where("active", "eq", true)
  .where("age", "gte", 18)
  .group("or", (q) => {
    q.where("role", "eq", "admin").where("verified", "eq", true);
  })
  .orderBy("createdAt", true)
  .orderBy("name");

// Use with entity store
const collection = userStore.getCollection(query.build());

// Or with React hooks
const users = useChimeraUserCollection((q) => {
  q.where("active", "eq", true).where("age", "gte", 18).orderBy("name");
});

// Or with Vue composables
const users = useChimeraUserCollection((q) => {
  q.where("active", "eq", true).where("age", "gte", 18).orderBy("name");
});
```

**Learn more:** See the [Query Builder documentation](./packages/qb/README.md) for detailed usage.

## Core Concepts

### Store Architecture

Chimera Store is built around several key concepts:

1. **Entity Store**: Individual store instance for each entity type (created via `createChimeraEntityStore`)
2. **Query**: Represents a specific data request (single item or collection)
3. **Cache**: Intelligent deduplication and memory management per entity
4. **Events**: Real-time updates and state synchronization

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

### ChimeraItemQuery

Represents a single item query with full CRUD operations.

#### Properties

- `data`: Current item data (throws if not ready)
- `mutable`: Mutable reference for updates
- `state`: Current query state
- `ready`: Whether data is available
- `inProgress`: Whether operation is in progress

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

### Custom Filter Operators

```typescript
import {
  createChimeraEntityStore,
  chimeraDefaultFilterConfig,
} from "@hf-chimera/store";

// Define custom filter config with custom operators
const customFilterConfig = {
  ...chimeraDefaultFilterConfig,
  operators: {
    ...chimeraDefaultFilterConfig.operators,
    // Custom operator for text search
    textSearch: (text: string, searchTerm: string) =>
      text.toLowerCase().includes(searchTerm.toLowerCase()),
  },
};

// Create entity store with custom filter config as second parameter
const userStore = createChimeraEntityStore<
  "user",
  User,
  typeof customFilterConfig.operators
>(
  {
    name: "user",
    idGetter: "id",
    collectionFetcher: async (params, requestParams) => {
      /* ... */
    },
    itemFetcher: async (params, requestParams) => {
      /* ... */
    },
    // ... other CRUD operations
  },
  customFilterConfig, // Pass as second parameter
);
```

### Complex Filtering Examples

```typescript
import {
  chimeraCreateConjunction,
  chimeraCreateOperator,
  chimeraCreateOrderBy,
  ChimeraOrderNulls,
} from "@hf-chimera/store";

// Simple filter: users with age >= 18
const adultUsers = userStore.getCollection({
  filter: chimeraCreateOperator("gte", "age", 18),
});

// Complex filter: active users with specific age range and email domain
const activeUsers = userStore.getCollection({
  filter: chimeraCreateConjunction("and", [
    chimeraCreateOperator("gte", "age", 18),
    chimeraCreateOperator("lte", "age", 65),
    chimeraCreateOperator("endsWith", "email", "@company.com"),
    chimeraCreateOperator("eq", "isActive", true),
  ]),
});

// OR filter: users with specific names or email domains
const specificUsers = userStore.getCollection({
  filter: chimeraCreateConjunction("or", [
    chimeraCreateOperator("in", "name", ["John", "Jane", "Bob"]),
    chimeraCreateOperator("endsWith", "email", "@gmail.com"),
  ]),
});

// Nested filters: complex business logic
const premiumUsers = userStore.getCollection({
  filter: chimeraCreateConjunction("and", [
    chimeraCreateOperator("gte", "age", 21),
    chimeraCreateConjunction("or", [
      chimeraCreateOperator("gte", "subscriptionLevel", "premium"),
      chimeraCreateOperator("gte", "totalSpent", 1000),
    ]),
    chimeraCreateOperator("neq", "status", "suspended"),
  ]),
});

// Text search with multiple conditions
const searchResults = userStore.getCollection({
  filter: chimeraCreateConjunction("and", [
    chimeraCreateConjunction("or", [
      chimeraCreateOperator("contains", "name", searchTerm),
      chimeraCreateOperator("contains", "email", searchTerm),
    ]),
    chimeraCreateOperator("eq", "isActive", true),
  ]),
  order: [
    chimeraCreateOrderBy("name", false, ChimeraOrderNulls.Last),
    chimeraCreateOrderBy("createdAt", true, ChimeraOrderNulls.Last), // newest first
  ],
});
```

### Custom Order Comparators

```typescript
const customOrderConfig = {
  ...chimeraDefaultOrderConfig,
  primitiveComparator: (a: unknown, b: unknown, nulls: ChimeraOrderNulls) => {
    // Custom comparison logic
    if (typeof a === "string" && typeof b === "string") {
      return a.localeCompare(b, undefined, { numeric: true });
    }
    return chimeraDefaultOrderConfig.primitiveComparator(a, b, nulls);
  },
};
```

### Event Handling

```typescript
// Listen to entity store events
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

## Configuration Options

### Query Configuration

```typescript
type ConfigExample = {
  query: {
    defaults: {
      trustQuery: boolean; // Trust external data providers
      idGetter:
        | ((entityName: string, value: unknown) => string | number)
        | string; // Default ID getter
      collectionFetcher?: (
        params: any,
        request: {
          signal?: AbortSignal;
        },
      ) => Promise<{ data: any[] }>;
      itemFetcher?: (
        params: any,
        request: {
          signal?: AbortSignal;
        },
      ) => Promise<{ data: any }>;
      itemUpdater?: (
        item: any,
        request: { signal?: AbortSignal },
      ) => Promise<{
        data: any;
      }>;
      itemDeleter?: (
        id: string | number,
        request: {
          signal?: AbortSignal;
        },
      ) => Promise<{ result?: any }>;
      itemCreator?: (
        item: any,
        request: { signal?: AbortSignal },
      ) => Promise<{
        data: any;
      }>;
      // ... batched operations
    };
    entities: {
      [entityName: string]: {
        // Entity-specific overrides
      };
    };
  };
};
```

### Filter Configuration

```typescript
type FilterConfigExample = {
  filter: {
    operators: {
      eq: <T>(a: T, b: T) => boolean;
      neq: <T>(a: T, b: T) => boolean;
      gt?: (a: number, b: number) => boolean;
      // ... custom operators
    };
    getFilterKey?: (input: unknown) => string; // Cache key generator for filters
    getOperatorKey?: (input: unknown) => string; // Cache key generator for operators
  };
};
```

### Order Configuration

```typescript
type OrderConfigExample = {
  order: {
    primitiveComparator: (
      a: unknown,
      b: unknown,
      nulls: ChimeraOrderNulls,
    ) => number; // Custom comparator
    getKey: (input: unknown) => string; // Cache key generator
  };
};
```

## Performance Considerations

### Memory Management

- Chimera Store uses weak references for automatic memory cleanup
- Queries are automatically cached and deduplicated
- Stale references are cleaned up automatically

### Caching Strategy

- Collection queries are cached by a filter/order combination
- Item queries are cached by ID
- Cache keys are generated automatically for optimal performance

### Update Optimization

- Batch operations for multiple updates
- Optimistic updates for better UX

## Browser Support

- **Modern Browsers**: Full support for ES2021+ features
- **Node.js**: 14.17.0+ with `--harmony-weak-refs` flag, 16.0.0+ stable
- **TypeScript**: 4.5+ recommended

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License — see [LICENSE](LICENSE) file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/hf-chimera/store/issues)
- **Documentation**: [GitHub Wiki](https://github.com/hf-chimera/store/wiki)
- **Discussions**: [GitHub Discussions](https://github.com/hf-chimera/store/discussions)
