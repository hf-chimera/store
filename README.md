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

## Installation

```bash
npm install @hf-chimera/store
# or
yarn add @hf-chimera/store
# or
pnpm add @hf-chimera/store
```

## Quick Start

### Basic Setup

```typescript
import { ChimeraStore } from '@hf-chimera/store';

// Define your entity types
type User = {
	id: string;
	name: string;
	email: string;
	age: number;
};

type Post = {
	id: string;
	title: string;
	content: string;
	authorId: string;
	createdAt: Date;
};

// Define your entity map
type EntityMap = {
	users: User;
	posts: Post;
};

// Create store configuration
const store = new ChimeraStore<EntityMap>({
	query: {
		defaults: {
			trustQuery: true,
			// idGetter can be a string (object key) or a function
			// String: Uses the specified property as the ID (e.g., 'id', 'uuid', 'key')
			// Function: Custom ID extraction logic (entityName, value) => string | number
			idGetter: 'id',
		},
		entities: {
			// Define configuration for each entity in your EntityMap
			// Each entity must have its own fetchers, updaters, deleters, and creators
			users: {
				collectionFetcher: async (params, requestParams) => {
					const response = await fetch(`/api/users`, {
						signal: requestParams.signal,
					});
					return { data: await response.json() };
				},
				itemFetcher: async (params, requestParams) => {
					const response = await fetch(`/api/users/${params.id}`, {
						signal: requestParams.signal,
					});
					return { data: await response.json() };
				},
				itemUpdater: async (item, requestParams) => {
					const response = await fetch(`/api/users/${item.id}`, {
						method: 'PUT',
						body: JSON.stringify(item),
						signal: requestParams.signal,
					});
					return { data: await response.json() };
				},
				itemDeleter: async (id, requestParams) => {
					await fetch(`/api/users/${id}`, {
						method: 'DELETE',
						signal: requestParams.signal,
					});
					return { result: { id, success: true } };
				},
				itemCreator: async (item, requestParams) => {
					const response = await fetch(`/api/users`, {
						method: 'POST',
						body: JSON.stringify(item),
						signal: requestParams.signal,
					});
					return { data: await response.json() };
				},
			},
			posts: {
				collectionFetcher: async (params, requestParams) => {
					const response = await fetch(`/api/posts`, {
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
				itemUpdater: async (item, requestParams) => {
					const response = await fetch(`/api/posts/${item.id}`, {
						method: 'PUT',
						body: JSON.stringify(item),
						signal: requestParams.signal,
					});
					return { data: await response.json() };
				},
				itemDeleter: async (id, requestParams) => {
					await fetch(`/api/posts/${id}`, {
						method: 'DELETE',
						signal: requestParams.signal,
					});
					return { result: { id, success: true } };
				},
				itemCreator: async (item, requestParams) => {
					const response = await fetch(`/api/posts`, {
						method: 'POST',
						body: JSON.stringify(item),
						signal: requestParams.signal,
					});
					return { data: await response.json() };
				},
			},
		},
	},
});
```

### Working with Data

```typescript
import {
	ChimeraStore,
	chimeraCreateConjunction,
	chimeraCreateOperator,
	chimeraCreateOrderBy,
	ChimeraOrderNulls
} from '@hf-chimera/store';

// Get a repository for a specific entity
const userRepo = store.from('users');
const postRepo = store.from('posts');

// Create a new user
const newUserQuery = userRepo.createItem({
	name: 'John Doe',
	email: 'john@example.com',
	age: 30,
});

// Listen for creation events
newUserQuery.on('created', (query) => {
	console.log('User created:', query.data);
});

// Get a specific user
const userQuery = userRepo.getItem('user-123');

// Listen for data updates
userQuery.on('ready', (query) => {
	console.log('User loaded:', query.data);
});

// Update user data
userQuery.mutable.name = 'Jane Doe';
await userQuery.commit();

// Get a collection with filtering and sorting
const activeUsersQuery = userRepo.getCollection({
	filter: chimeraCreateConjunction('and', [
		chimeraCreateOperator('gte', 'age', 18),
	]),
	order: [
		chimeraCreateOrderBy('name', false, ChimeraOrderNulls.Last),
	],
});

// Listen for collection updates
activeUsersQuery.on('updated', (query, items, oldItems) => {
	console.log('Active users updated:', items);
});

// External updates (e.g., from WebSocket)
store.updateOne('users', {
	id: 'user-123',
	name: 'Updated Name',
	email: 'updated@example.com',
	age: 31,
});
```

## Core Concepts

### Store Architecture

Chimera Store is built around several key concepts:

1. **Store**: The main entry point that manages all entities
2. **Repository**: Entity-specific data management with query capabilities
3. **Query**: Represents a specific data request (single item or collection)
4. **Cache**: Intelligent deduplication and memory management
5. **Events**: Real-time updates and state synchronization

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

### ChimeraStore

The main store class that manages all entities and provides cross-entity
operations.

#### Constructor

```typescript
const store = new ChimeraStore<EntityMap>(config)
```

#### Methods

- `from<EntityName>(entityName: EntityName)`: Get repository for specific entity
- `updateOne<EntityName>(entityName: EntityName, item: EntityMap[EntityName])`: Update single item
- `updateMany<EntityName>(entityName: EntityName, items: Iterable<EntityMap[EntityName]>)`: Update multiple items
- `deleteOne<EntityName>(entityName: EntityName, id: ChimeraEntityId)`: Delete single item
- `deleteMany<EntityName>(entityName: EntityName, ids: Iterable<ChimeraEntityId>)`: Delete multiple items

### ChimeraEntityRepository

Entity-specific repository with query capabilities.

#### Methods

- `createItem(item: DeepPartial<Item>, meta?: any)`: Create new item
- `getItem(id: ChimeraEntityId, meta?: any)`: Get single item
- `getCollection(params: ChimeraCollectionParams)`: Get filtered/sorted collection

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
const customFilterConfig = {
	...chimeraDefaultFilterConfig,
	operators: {
		...chimeraDefaultFilterConfig.operators,
		// Custom operator for text search
		textSearch: (text: string, searchTerm: string) =>
			text.toLowerCase().includes(searchTerm.toLowerCase()),
	},
};

const store = new ChimeraStore<EntityMap, typeof customFilterConfig.operators>({
	filter: customFilterConfig,
	// ... other config
});
```

### Complex Filtering Examples

```typescript
import {
	chimeraCreateConjunction,
	chimeraCreateOperator,
	chimeraCreateOrderBy,
	ChimeraOrderNulls
} from '@hf-chimera/store';

// Simple filter: users with age >= 18
const adultUsers = userRepo.getCollection({
	filter: chimeraCreateOperator('gte', 'age', 18),
});

// Complex filter: active users with specific age range and email domain
const activeUsers = userRepo.getCollection({
	filter: chimeraCreateConjunction('and', [
		chimeraCreateOperator('gte', 'age', 18),
		chimeraCreateOperator('lte', 'age', 65),
		chimeraCreateOperator('endsWith', 'email', '@company.com'),
		chimeraCreateOperator('eq', 'isActive', true),
	]),
});

// OR filter: users with specific names or email domains
const specificUsers = userRepo.getCollection({
	filter: chimeraCreateConjunction('or', [
		chimeraCreateOperator('in', 'name', ['John', 'Jane', 'Bob']),
		chimeraCreateOperator('endsWith', 'email', '@gmail.com'),
	]),
});

// Nested filters: complex business logic
const premiumUsers = userRepo.getCollection({
	filter: chimeraCreateConjunction('and', [
		chimeraCreateOperator('gte', 'age', 21),
		chimeraCreateConjunction('or', [
			chimeraCreateOperator('gte', 'subscriptionLevel', 'premium'),
			chimeraCreateOperator('gte', 'totalSpent', 1000),
		]),
		chimeraCreateOperator('neq', 'status', 'suspended'),
	]),
});

// Text search with multiple conditions
const searchResults = userRepo.getCollection({
	filter: chimeraCreateConjunction('and', [
		chimeraCreateConjunction('or', [
			chimeraCreateOperator('contains', 'name', searchTerm),
			chimeraCreateOperator('contains', 'email', searchTerm),
		]),
		chimeraCreateOperator('eq', 'isActive', true),
	]),
	order: [
		chimeraCreateOrderBy('name', false, ChimeraOrderNulls.Last),
		chimeraCreateOrderBy('createdAt', true, ChimeraOrderNulls.Last), // newest first
	],
});
```

### Custom Order Comparators

```typescript
const customOrderConfig = {
	...chimeraDefaultOrderConfig,
	primitiveComparator: (a: unknown, b: unknown, nulls: ChimeraOrderNulls) => {
		// Custom comparison logic
		if (typeof a === 'string' && typeof b === 'string') {
			return a.localeCompare(b, undefined, { numeric: true });
		}
		return chimeraDefaultOrderConfig.primitiveComparator(a, b, nulls);
	},
};
```

### Event Handling

```typescript
// Listen to store-level events
store.on('itemAdded', (repository, item) => {
	console.log('Item added to', repository, item);
});

// Listen to repository events
const userRepo = store.from('users');
userRepo.on('itemUpdated', (repo, item, oldItem) => {
	console.log('User updated:', item, 'was:', oldItem);
});

// Listen to query events
const userQuery = userRepo.getItem('user-123');
userQuery.on('updated', (query, item, oldItem) => {
	console.log('Query updated:', item);
});
```

### Optimistic Updates

```typescript
// Optimistic update with rollback
const userQuery = userRepo.getItem('user-123');

// Update optimistically
userQuery.mutable.name = 'New Name';

try {
	await userQuery.commit();
	console.log('Update successful');
} catch (error) {
	// Rollback on error
	await userQuery.refetch();
	console.log('Update failed, rolled back');
}
```

## Configuration Options

### Query Configuration

```typescript
type ConfigExample = {
	query: {
		defaults: {
			trustQuery: boolean; // Trust external data providers
			idGetter: ((entityName: string, value: unknown) => string | number) | string; // Default ID getter
			collectionFetcher?: (params: any, request: {
				signal?: AbortSignal
			}) => Promise<{ data: any[] }>;
			itemFetcher?: (params: any, request: {
				signal?: AbortSignal
			}) => Promise<{ data: any }>;
			itemUpdater?: (item: any, request: { signal?: AbortSignal }) => Promise<{
				data: any
			}>;
			itemDeleter?: (id: string | number, request: {
				signal?: AbortSignal
			}) => Promise<{ result?: any }>;
			itemCreator?: (item: any, request: { signal?: AbortSignal }) => Promise<{
				data: any
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
		primitiveComparator: (a: unknown, b: unknown, nulls: ChimeraOrderNulls) => number; // Custom comparator
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
