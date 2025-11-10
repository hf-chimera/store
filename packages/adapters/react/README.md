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
import { createChimeraHooks } from '@hf-chimera/store/react';
// In your app, call createChimeraHooks(store) and export the returned hooks
```

### For Non-React Applications

Import from the main package:

```tsx
import { ChimeraStore } from '@hf-chimera/store';
```

## Quick Start

### 1. Prepare hooks for the store

Use the `createChimeraHooks` function to create hooks for the store:

```ts
import { createChimeraHooks } from '@hf-chimera/store/react';
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

export const {
	useChimeraStore,
	useChimeraRepository,
	useChimeraCollection,
	useChimeraItem,
} = createChimeraHooks(store)
```

### 2. Use Collection Queries

```tsx
import { useChimeraCollection } from './store';

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
import { useChimeraItem } from './store';

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
import { useChimeraCollection, useChimeraItem } from './store';

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

**Complex Query with Groups:**

```tsx
import { useChimeraCollection } from './store';

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

### Hooks

#### `useChimeraStore<Store>()`

Access the ChimeraStore instance directly.

```tsx
const store = useChimeraStore<MyChimeraStore>();
const customerRepo = store.from('customer');
```

#### `useChimeraRepository<EntityName>(entityName)`

Access a specific entity repository.

```tsx
const customerRepo = useChimeraRepository<'customer'>('customer');
```

#### `useChimeraCollection<EntityName, Meta>(entityName, params, deps?)`

Hook for collection queries with automatic state management.

**Parameters:**

- `entityName: EntityName` - Name of the entity
- `params: ChimeraCollectionParams | QueryBuilderCreator` - Query parameters or query builder function
- `deps?: unknown[]` - Optional dependency array for memoization

**Returns:** `ChimeraCollectionQuery<Item, OperatorsMap>`, see [ChimeraCollectionQuery documentation](../../../README.md#chimeracollectionquery)

#### `useChimeraItem<Store, EntityName, Meta>(entityName, id, meta?)`

Hook for individual item queries with automatic state management.

**Parameters:**

- `entityName: EntityName` - Name of the entity
- `id: ChimeraEntityId` - Item ID
- `meta?: Meta` - Optional metadata

**Returns:** `ChimeraItemQuery<Item>`, see [ChimeraCollectionQuery documentation](../../../README.md#chimeraitemquery)

## Tips

1. **Type Safety**: Use `getChimeraTypedHooks` for full type safety
2. **Error Handling**: Always check `ready` and `lastError` properties
3. **Optimistic Updates**: Use the `mutable` property for optimistic updates on item queries
4. **Batch Operations**: Use batch operations for multiple items when possible
5. **Query Builder**: Use the query builder function syntax for better type safety and readability

## Migration from Vanilla ChimeraStore

If you're already using ChimeraStore without React, you can gradually migrate by:

1. Replacing direct store usage with hooks
2. The React integration is fully compatible with existing ChimeraStore instances
