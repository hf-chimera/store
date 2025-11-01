# ChimeraStore React Integration

This package provides React hooks for seamless integration with ChimeraStore, enabling reactive data management in React applications.

## Features

- **React Hooks**: Custom hooks for managing ChimeraStore queries
- **TypeScript Support**: Full type safety with TypeScript
- **Automatic State Management**: Automatic re-rendering when data changes

## Installation

```bash
# Install the main package
npm install @hf-chimera/store

# Install React (if not already installed)
npm install react
```

## Usage

### For React Applications

Import from the React-specific entry point:

```tsx
import {
	ChimeraStoreProvider,
	useChimeraStore,
	useChimeraRepository,
	useChimeraCollection,
	useChimeraItem,
	getChimeraTypedHooks
} from '@hf-chimera/store/react';
```

### For Non-React Applications

Import from the main package:

```tsx
import { ChimeraStore } from '@hf-chimera/store';
```

## Quick Start

### 1. Setup the Store Provider

Wrap your app with the `ChimeraStoreProvider`:

```tsx
import { ChimeraStoreProvider } from '@hf-chimera/store/react';
import { ChimeraStore } from '@hf-chimera/store';
import type { MyEntityMap } from './types';

// Create your store instance
const store = new ChimeraStore<MyEntityMap>({
	query: {
		defaults: {
			idGetter: 'id',
			async collectionFetcher(entity, { filter, order }) {
				return { data: await fetchCollection(entity, filter, order) };
			},
			async itemFetcher(entity, { id }) {
				return { data: await fetchItem(entity, id) };
			},
			// ... other fetchers
		},
		entities: {
			customer: {},
			order: {}
		}
	}
});

function App() {
	return (
		<ChimeraStoreProvider store={store}>
			<YourApp/>
		</ChimeraStoreProvider>
	);
}
```

### 2. Use Collection Queries

```tsx
import { useChimeraCollection } from '@hf-chimera/store/react';

function CustomerList() {
	const customers = useChimeraCollection('customer', {
		filter: { status: 'active' },
		order: [{ field: 'name', direction: 'asc' }]
	});

	if (!customers.ready) return <div>Loading...</div>;
	if (customers.lastError) return <div>Error: {String(customers.lastError)}</div>;

	return (
		<div>
			{customers.map(customer => (
				<div key={customer.id}>
					{customer.name}
					<button onClick={() => customers.delete(customer.id)}>Delete</button>
				</div>
			))}
			<button onClick={() => customers.create({ name: 'New Customer' })}>
				Add Customer
			</button>
		</div>
	);
}
```

### 3. Use Item Queries

```tsx
import { useChimeraItem } from '@hf-chimera/store/react';

function CustomerDetail({ customerId }: { customerId: string }) {
	const customer = useChimeraItem('customer', customerId);

	if (!customer.ready) return <div>Loading...</div>;
	if (customer.lastError) return <div>Error: {String(customer.lastError)}</div>;
	if (!customer.data) return <div>Customer not found</div>;

	const handleUpdate = () => {
		customer.mutable.name = 'Updated Name';
		customer.commit();
	};

	return (
		<div>
			<h3>{customer.data.name}</h3>
			<button onClick={handleUpdate}>Update Name</button>
		</div>
	);
}
```

### 4. Using with Query Builder

You can use the `ChimeraQueryBuilder` with React hooks by passing a builder function instead of the query descriptor. This provides a more fluent and type-safe API:

```tsx
import { getChimeraTypedHooks } from '@hf-chimera/store/react';
import { store, type MyChimeraStore } from './store';

// Create typed hooks
const { useChimeraCollection, useChimeraItem } = getChimeraTypedHooks<MyChimeraStore>();

function ActiveUsers() {
	// Pass a builder function - the hook will call it and build the query
	const activeUsers = useChimeraCollection('customer', (q) => {
		q.where('email', 'contains', '@example.com')
		 .orderBy('createdAt', true);
	});

	if (!activeUsers.ready) {
		return <div>Loading...</div>;
	}

	return (
		<div>
			{activeUsers.map(user => (
				<div key={user.id}>{user.name}</div>
			))}
		</div>
	);
}
```

**With the Store Provider Pattern:**

```tsx
import { ChimeraStoreProvider } from '@hf-chimera/store/react';
import { store } from './store';
import { getChimeraTypedHooks } from '@hf-chimera/store/react';

const { useChimeraCollection } = getChimeraTypedHooks<typeof store>();

function App() {
	return (
		<ChimeraStoreProvider store={store}>
			<ActiveOrdersList />
		</ChimeraStoreProvider>
	);
}

function ActiveOrdersList() {
	const orders = useChimeraCollection('order', (q) => {
		q.where('status', 'eq', 'completed')
		 .where('totalAmount', 'gte', 100)
		 .orderBy('createdAt', true)
		 .orderBy('totalAmount', true);
	});

	if (!orders.ready) return <div>Loading orders...</div>;

	return (
		<div>
			<h2>Active Orders</h2>
			{orders.map(order => (
				<div key={order.id}>
					<p>{order.productName} - ${order.totalAmount}</p>
				</div>
			))}
		</div>
	);
}
```

**Complex Query with Groups:**

```tsx
import { getChimeraTypedHooks } from '@hf-chimera/store/react';
import { store } from './store';

const { useChimeraCollection } = getChimeraTypedHooks<typeof store>();

function FeaturedOrders() {
	const orders = useChimeraCollection('order', (q) => {
		q.where('status', 'eq', 'completed')
		 // Must be either high value OR from VIP customer
		 .group('or', (group) => {
			 group.where('totalAmount', 'gte', 1000)
						.where('customerId', 'in', [1, 2, 3]); // VIP customers
		 })
		 // But not cancelled
		 .whereNot('status', 'eq', 'cancelled')
		 .orderBy('totalAmount', true);
	});

	return (
		<div>
			{orders.map(order => (
				<div key={order.id}>{order.productName}</div>
			))}
		</div>
	);
}
```

For more information on using the query builder, see the [ChimeraQueryBuilder documentation](../../qb/README.md).

## API Reference

### Provider

#### `ChimeraStoreProvider<Store>`

Provider component that makes the store available to child components.

**Props:**

- `children: ReactNode` - Child components
- `store: Store` - ChimeraStore instance

### Hooks

#### `useChimeraStore<Store>()`

Access the ChimeraStore instance directly.

```tsx
const store = useChimeraStore<MyChimeraStore>();
const customerRepo = store.from('customer');
```

#### `useChimeraRepository<Store, EntityName>(entityName)`

Access a specific entity repository.

```tsx
const customerRepo = useChimeraRepository<MyChimeraStore, 'customer'>('customer');
```

#### `useChimeraCollection<Store, EntityName, Meta>(entityName, params, deps?)`

Hook for collection queries with automatic state management.

**Parameters:**

- `entityName: EntityName` - Name of the entity
- `params: ChimeraCollectionParams | QueryBuilderCreator` - Query parameters or query builder function
- `deps?: unknown[]` - Optional dependency array for memoization

**Returns:** `ChimeraCollectionQuery<Item, OperatorsMap>`

**Properties:**

- `state: ChimeraQueryFetchingState` - Current query state
- `inProgress: boolean` - Whether query is in progress
- `ready: boolean` - Whether data is ready
- `lastError: unknown` - Last error if any
- `length: number` - Number of items

**Methods:**

- `create(item: DeepPartial<Item>): Promise<...>` - Create a new item
- `batchedCreate(items: Iterable<DeepPartial<Item>>): Promise<...>` - Create multiple items
- `update(item: Item): Promise<...>` - Update an item
- `batchedUpdate(items: Iterable<Item>): Promise<...>` - Update multiple items
- `delete(id: ChimeraEntityId): Promise<...>` - Delete an item
- `batchedDelete(ids: Iterable<ChimeraEntityId>): Promise<...>` - Delete multiple items
- `refetch(force?: boolean): Promise<...>` - Refetch the query

**Array Methods:**

The collection query is iterable and supports standard array methods:

- `map()`, `filter()`, `find()`, `forEach()`, `slice()`, etc.
- `entries()`, `values()`, `keys()`

#### `useChimeraItem<Store, EntityName, Meta>(entityName, id, meta?)`

Hook for individual item queries with automatic state management.

**Parameters:**

- `entityName: EntityName` - Name of the entity
- `id: ChimeraEntityId` - Item ID
- `meta?: Meta` - Optional metadata

**Returns:** `ChimeraItemQuery<Item>`

**Properties:**

- `state: ChimeraQueryFetchingState` - Current query state
- `inProgress: boolean` - Whether query is in progress
- `ready: boolean` - Whether data is ready
- `lastError: unknown` - Last error if any
- `id: ChimeraEntityId` - Item ID
- `data: Item` - Item data (throws if not ready)
- `mutable: Item` - Mutable reference to item (throws if not ready)

**Methods:**

- `refetch(force?: boolean): Promise<...>` - Refetch the item
- `update(item: Item, force?: boolean): Promise<...>` - Update the item
- `mutate(mutator: (draft: Item) => Item, force?: boolean): Promise<...>` - Mutate item using a function
- `commit(force?: boolean): Promise<...>` - Commit mutable changes
- `delete(force?: boolean): Promise<...>` - Delete the item

#### `getChimeraTypedHooks<Store>(withoutPrefix?)`

Returns typed hooks for a specific store type.

**Parameters:**

- `withoutPrefix?: boolean` - If `true`, returns hooks without the "Chimera" prefix (e.g., `useStore` instead of `useChimeraStore`)

**Returns:**

- `useChimeraStore` (or `useStore` if `withoutPrefix` is `true`)
- `useChimeraRepository` (or `useRepository` if `withoutPrefix` is `true`)
- `useChimeraCollection` (or `useCollection` if `withoutPrefix` is `true`)
- `useChimeraItem` (or `useItem` if `withoutPrefix` is `true`)

**Example:**

```tsx
const { useChimeraCollection, useChimeraItem } = getChimeraTypedHooks<MyChimeraStore>();

// Or without prefix
const { useCollection, useItem } = getChimeraTypedHooks<MyChimeraStore>(true);
```

## TypeScript Support

The React integration provides full TypeScript support with proper type inference:

```tsx
// Define your entity map
type EntityMap = {
	customer: Customer;
	order: Order;
};

// Use with full type safety
const customers = useChimeraCollection<typeof store, 'customer'>('customer');
// customers is typed as ChimeraCollectionQuery<Customer, ...>

const customer = useChimeraItem<typeof store, 'customer'>('customer', 'id');
// customer is typed as ChimeraItemQuery<Customer>
```

## Tips

1. **Use the Provider**: Always wrap your app with `ChimeraStoreProvider`
2. **Type Safety**: Use `getChimeraTypedHooks` for full type safety
3. **Error Handling**: Always check `ready` and `lastError` properties
4. **Optimistic Updates**: Use the `mutable` property for optimistic updates on item queries
5. **Batch Operations**: Use batch operations for multiple items when possible
6. **Query Builder**: Use the query builder function syntax for better type safety and readability

## Migration from Vanilla ChimeraStore

If you're already using ChimeraStore without React, you can gradually migrate by:

1. Adding the `ChimeraStoreProvider` to your app (pass your existing store instance)
2. Replacing direct store usage with hooks
3. The React integration is fully compatible with existing ChimeraStore instances
