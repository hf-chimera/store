# ChimeraStore React Integration

This package provides React hooks and components for seamless integration with
ChimeraStore, enabling reactive data management in React applications.

## Features

- **React Hooks**: Custom hooks for managing ChimeraStore queries and operations
- **React Components**: Pre-built components for common data operations
- **TypeScript Support**: Full type safety with TypeScript
- **Automatic State Management**: Automatic re-rendering when data changes
- **Error Handling**: Built-in error handling and loading states
- **Optional Dependency**: React integration is optional and only loaded when
  needed

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
	useCollectionQuery,
	useItemQuery
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
import { ChimeraStoreProvider } from '@hf-chimera/store';

const storeConfig = {
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
};

function App() {
	return (
		<ChimeraStoreProvider config={storeConfig}>
			<YourApp/>
		</ChimeraStoreProvider>
	);
}
```

### 2. Use Collection Queries

```tsx
import { useCollectionQuery } from '@hf-chimera/store';

function CustomerList() {
	const {
		data: customers,
		isLoading,
		error,
		create,
		update,
		delete: deleteCustomer
	} = useCollectionQuery('customer', {
		filter: { status: 'active' },
		order: [{ field: 'name', direction: 'asc' }]
	});

	if (isLoading) return <div>Loading...</div>;
	if (error) return <div>Error: {String(error)}</div>;

	return (
		<div>
			{customers.map(customer => (
				<div key={customer.id}>
					{customer.name}
					<button onClick={() => deleteCustomer(customer.id)}>Delete</button>
				</div>
			))}
			<button onClick={() => create({ name: 'New Customer' })}>
				Add Customer
			</button>
		</div>
	);
}
```

### 3. Use Item Queries

```tsx
import { useItemQuery } from '@hf-chimera/store';

function CustomerDetail({ customerId }: { customerId: string }) {
	const {
		data: customer,
		isLoading,
		error,
		update,
		mutable
	} = useItemQuery('customer', customerId);

	if (isLoading) return <div>Loading...</div>;
	if (error) return <div>Error: {String(error)}</div>;
	if (!customer) return <div>Customer not found</div>;

	const handleUpdate = () => {
		if (mutable) {
			mutable.name = 'Updated Name';
			update(mutable);
		}
	};

	return (
		<div>
			<h3>{customer.name}</h3>
			<button onClick={handleUpdate}>Update Name</button>
		</div>
	);
}
```

## API Reference

### Hooks

#### `useStore<EntityMap, FilterConfig>()`

Access the ChimeraStore instance directly.

```tsx
const store = useStore<EntityMap>();
const customerRepo = store.from('customer');
```

#### `useRepository<EntityMap, EntityName, FilterConfig>(entityName)`

Access a specific entity repository.

```tsx
const customerRepo = useRepository<EntityMap, 'customer'>('customer');
```

####

`useCollectionQuery<EntityMap, EntityName, FilterConfig, Meta>(entityName, options)`

Hook for collection queries with automatic state management.

**Options:**

- `filter?: ChimeraSimplifiedFilter` - Filter criteria
- `order?: ChimeraSimplifiedOrderDescriptor[]` - Sort order
- `meta?: Meta` - Additional metadata
- `enabled?: boolean` - Enable/disable the query

**Returns:**

- `data: Item[]` - Array of items
- `state: ChimeraQueryFetchingState` - Current query state
- `error: unknown` - Error if any
- `isLoading: boolean` - Loading state
- `isError: boolean` - Error state
- `isSuccess: boolean` - Success state
- `isReady: boolean` - Data ready state
- `refetch: () => Promise<void>` - Refetch function
- `create: (item: Partial<Item>) => Promise<Item>` - Create item
- `update: (item: Item) => Promise<Item>` - Update item
- `delete: (id: ChimeraEntityId) => Promise<void>` - Delete item
- `batchedCreate: (items: Partial<Item>[]) => Promise<Item[]>` - Batch create
- `batchedUpdate: (items: Item[]) => Promise<Item[]>` - Batch update
- `batchedDelete: (ids: ChimeraEntityId[]) => Promise<void>` - Batch delete

####

`useItemQuery<EntityMap, EntityName, FilterConfig, Meta>(entityName, id, options)`

Hook for individual item queries with automatic state management.

**Options:**

- `meta?: Meta` - Additional metadata
- `enabled?: boolean` - Enable/disable the query

**Returns:**

- `data: Item | null` - Item data
- `state: ChimeraQueryFetchingState` - Current query state
- `error: unknown` - Error if any
- `isLoading: boolean` - Loading state
- `isError: boolean` - Error state
- `isSuccess: boolean` - Success state
- `isReady: boolean` - Data ready state
- `refetch: () => Promise<void>` - Refetch function
- `update: (item: Item) => Promise<Item>` - Update item
- `mutate: (mutator: (draft: Item) => Item) => Promise<Item>` - Mutate item
- `commit: () => Promise<Item>` - Commit mutable changes
- `delete: () => Promise<void>` - Delete item
- `mutable: Item | null` - Mutable reference to item

#### Utility Hooks

- `useCreateItem<EntityMap, EntityName>(entityName)` - Create items without
  query management
- `useUpdateItem<EntityMap, EntityName>(entityName)` - Update items without
  query management
- `useDeleteItem<EntityMap, EntityName>(entityName)` - Delete items without
  query management
- `useGetItem<EntityMap, EntityName>(entityName)` - Get items without query
  management

### Components

#### `ChimeraStoreProvider<EntityMap, FilterConfig>`

Provider component that makes the store available to child components.

**Props:**

- `children: ReactNode` - Child components
- `config: ChimeraStoreConfig` - Store configuration

#### `CollectionQuery<EntityMap, EntityName, FilterConfig, Meta>`

Component for collection queries using render props pattern.

```tsx
<CollectionQuery entityName="customer" filter={{ status: 'active' }}>
	{({ data, isLoading, error, create, update, delete: deleteItem }) => (
		<div>
			{data.map(item => (
				<div key={item.id}>{item.name}</div>
			))}
		</div>
	)}
</CollectionQuery>
```

#### `ItemQuery<EntityMap, EntityName, FilterConfig, Meta>`

Component for individual item queries using render props pattern.

```tsx
<ItemQuery entityName="customer" id="customer-1">
	{({ data, isLoading, error, update, mutable }) => (
		<div>
			{data && <h3>{data.name}</h3>}
		</div>
	)}
</ItemQuery>
```

#### Form Components

- `CreateItemForm<EntityMap, EntityName>` - Form for creating new items
- `UpdateItemForm<EntityMap, EntityName>` - Form for updating existing items
- `DeleteItemButton<EntityMap, EntityName>` - Button for deleting items

#### `QueryState`

Utility component for handling query states.

```tsx
<QueryState
	state={queryState}
	error={error}
	loadingComponent={<div>Loading...</div>}
	errorComponent={<div>Error occurred</div>}
>
	<YourContent/>
</QueryState>
```

## TypeScript Support

The React integration provides full TypeScript support with proper type
inference:

```tsx
// Define your entity map
type EntityMap = {
	customer: Customer;
	order: Order;
};

// Use with full type safety
const { data: customers } = useCollectionQuery<EntityMap, 'customer'>('customer');
// customers is typed as Customer[]

const { data: customer } = useItemQuery<EntityMap, 'customer'>('customer', 'id');
// customer is typed as Customer | null
```

## Tips

1. **Use the Provider**: Always wrap your app with `ChimeraStoreProvider`
2. **Type Safety**: Define your entity map type for full type safety
3. **Error Handling**: Always handle loading and error states
4. **Optimistic Updates**: Use the mutable references for optimistic updates
5. **Batch Operations**: Use batch operations for multiple items when possible

## Migration from Vanilla ChimeraStore

If you're already using ChimeraStore without React, you can gradually migrate
by:

1. Adding the `ChimeraStoreProvider` to your app
2. Replacing direct store usage with hooks
3. Using the provided components for common operations

The React integration is fully compatible with existing ChimeraStore
configurations.
