import { beforeEach, describe, expect, it } from "vitest";
import type { chimeraDefaultFilterOperators } from '../filter/defaults';
import { chimeraCreateConjunction, chimeraCreateOperator } from "../filter/index.ts";
import { ChimeraOrderNulls, chimeraCreateOrderBy } from "../order/index.ts";
import { ChimeraQueryFetchingState } from "../query";
import { ChimeraStore } from "../store/index.ts";
import { stubApi } from "./api.ts";
import type { Comment, Post, TestEntityMap, Todo, User } from "./types.ts";

type ChimeraOperatorMap = typeof chimeraDefaultFilterOperators;

const createStore = () =>
	new ChimeraStore<TestEntityMap>({
		debug: {
			devMode: true,
			logs: 'off',
		},
		query: {
			defaults: {
				batchedCreator: stubApi.batchCreate,
				batchedDeleter: stubApi.batchDelete,
				batchedUpdater: stubApi.batchUpdate,
				idGetter: "id",
				trustQuery: false,
				updateDebounceTimeout: 0,
			},
			entities: {
				album: {
					collectionFetcher: (params, requestParams) => stubApi.fetchCollection("album", params, requestParams),
					itemCreator: (item, requestParams) => stubApi.createItem("album", item, requestParams),
					itemDeleter: (deleteId, requestParams) => stubApi.deleteItem("album", deleteId, requestParams),
					itemFetcher: (params, requestParams) => stubApi.fetchItem("album", params, requestParams),
					itemUpdater: (updatedEntity, requestParams) => stubApi.updateItem("album", updatedEntity, requestParams),
				},
				comment: {
					collectionFetcher: (params, requestParams) => stubApi.fetchCollection("comment", params, requestParams),
					itemCreator: (item, requestParams) => stubApi.createItem("comment", item, requestParams),
					itemDeleter: (deleteId, requestParams) => stubApi.deleteItem("comment", deleteId, requestParams),
					itemFetcher: (params, requestParams) => stubApi.fetchItem("comment", params, requestParams),
					itemUpdater: (updatedEntity, requestParams) => stubApi.updateItem("comment", updatedEntity, requestParams),
				},
				photo: {
					collectionFetcher: (params, requestParams) => stubApi.fetchCollection("photo", params, requestParams),
					itemCreator: (item, requestParams) => stubApi.createItem("photo", item, requestParams),
					itemDeleter: (deleteId, requestParams) => stubApi.deleteItem("photo", deleteId, requestParams),
					itemFetcher: (params, requestParams) => stubApi.fetchItem("photo", params, requestParams),
					itemUpdater: (updatedEntity, requestParams) => stubApi.updateItem("photo", updatedEntity, requestParams),
				},
				post: {
					collectionFetcher: (params, requestParams) => stubApi.fetchCollection("post", params, requestParams),
					itemCreator: (item, requestParams) => stubApi.createItem("post", item, requestParams),
					itemDeleter: (deleteId, requestParams) => stubApi.deleteItem("post", deleteId, requestParams),
					itemFetcher: (params, requestParams) => stubApi.fetchItem("post", params, requestParams),
					itemUpdater: (updatedEntity, requestParams) => stubApi.updateItem("post", updatedEntity, requestParams),
				},
				todo: {
					collectionFetcher: (params, requestParams) => stubApi.fetchCollection("todo", params, requestParams),
					itemCreator: (item, requestParams) => stubApi.createItem("todo", item, requestParams),
					itemDeleter: (deleteId, requestParams) => stubApi.deleteItem("todo", deleteId, requestParams),
					itemFetcher: (params, requestParams) => stubApi.fetchItem("todo", params, requestParams),
					itemUpdater: (updatedEntity, requestParams) => stubApi.updateItem("todo", updatedEntity, requestParams),
				},
				user: {
					collectionFetcher: (params, requestParams) => stubApi.fetchCollection("user", params, requestParams),
					itemCreator: (item, requestParams) => stubApi.createItem("user", item, requestParams),
					itemDeleter: (deleteId, requestParams) => stubApi.deleteItem("user", deleteId, requestParams),
					itemFetcher: (params, requestParams) => stubApi.fetchItem("user", params, requestParams),
					itemUpdater: (updatedEntity, requestParams) => stubApi.updateItem("user", updatedEntity, requestParams),
				},
			},
		},
	});

describe("Store Module - e2e Tests", () => {
	let store: ChimeraStore<TestEntityMap>;

	beforeEach(() => {
		store = createStore();
	});

	describe("Basic CRUD Operations", () => {
		it("should create, read, update, and delete items", async () => {
			const userRepo = store.from("user");

			// Create a new user
			const createQuery = userRepo.createItem({
				email: "test@example.com",
				name: "Test User",
				username: "testuser",
			});

			await createQuery.progress;
			expect(createQuery.data).toBeDefined();
			expect(createQuery.data.name).toBe("Test User");

			// Get the created user
			const userId = createQuery.data.id;
			expect(userId).toBeDefined();

			const getQuery = userRepo.getItem(userId);
			await getQuery.progress;
			expect(getQuery.data).toBeDefined();
			expect(getQuery.data.name).toBe("Test User");

			// Update the user
			getQuery.mutable.name = "Updated User";
			await getQuery.commit();
			expect(getQuery.data.name).toBe("Updated User");

			// Delete the user
			await getQuery.delete();
			expect(getQuery.state).toEqual(ChimeraQueryFetchingState.Deleted);
		});

		it("should handle multiple entity types", async () => {
			// Test User entity
			const userRepo = store.from("user");
			const userQuery = userRepo.getItem(1);
			await userQuery.progress;
			expect(userQuery.data?.name).toBe("Leanne Graham");

			// Test Post entity
			const postRepo = store.from("post");
			const postQuery = postRepo.getItem(1);
			await postQuery.progress;
			expect(postQuery.data?.title).toBe("sunt aut facere repellat provident occaecati excepturi optio reprehenderit");

			// Test Comment entity
			const commentRepo = store.from("comment");
			const commentQuery = commentRepo.getItem(1);
			await commentQuery.progress;
			expect(commentQuery.data?.name).toBe("id labore ex et quam laborum");
		});
	});

	describe("Collection Operations", () => {
		it("should fetch and filter collections", async () => {
			const userRepo = store.from("user");

			// Get all users
			const allUsersQuery = userRepo.getCollection({});
			await allUsersQuery.progress;
			expect(allUsersQuery.length).toBe(2);

			// Filter users by name containing "Leanne"
			const filteredQuery = userRepo.getCollection({
				filter: chimeraCreateConjunction<User, ChimeraOperatorMap>('and', [
					chimeraCreateOperator<User, ChimeraOperatorMap, 'contains'>('contains', 'name', 'Leanne'),
				]),
			});
			await filteredQuery.progress;
			expect(filteredQuery.length).toBe(1);
			expect(filteredQuery.at(0)?.name).toBe("Leanne Graham");
		});

		it("should handle complex filtering with conjunctions", async () => {
			const userRepo = store.from("user");

			// Filter users with complex conditions
			const complexFilter = chimeraCreateConjunction<User, ChimeraOperatorMap>('and', [
				chimeraCreateOperator<User, ChimeraOperatorMap, 'contains'>('contains', 'name', 'Graham'),
				chimeraCreateOperator<User, ChimeraOperatorMap, 'eq'>('eq', 'id', 1),
			]);

			const filteredQuery = userRepo.getCollection({
				filter: complexFilter,
			});
			await filteredQuery.progress;
			expect(filteredQuery.length).toBe(1);
			expect(filteredQuery.at(0)?.name).toBe("Leanne Graham");
		});

		it("should handle OR conjunctions", async () => {
			const userRepo = store.from("user");

			// Filter users with OR condition
			const orFilter = chimeraCreateConjunction<User, ChimeraOperatorMap>('or', [
				chimeraCreateOperator<User, ChimeraOperatorMap, 'eq'>('eq', 'id', 1),
				chimeraCreateOperator<User, ChimeraOperatorMap, 'eq'>('eq', 'id', 2),
			]);

			const filteredQuery = userRepo.getCollection({
				filter: orFilter,
			});
			await filteredQuery.progress;
			expect(filteredQuery.length).toBe(2);
		});
	});

	describe("Ordering Operations", () => {
		it("should sort collections by single field", async () => {
			const userRepo = store.from("user");

			// Sort by name ascending
			const sortedQuery = userRepo.getCollection({
				order: [chimeraCreateOrderBy<User>("name", false)],
			});
			await sortedQuery.progress;
			expect(sortedQuery.at(0)?.name).toBe("Ervin Howell");
			expect(sortedQuery.at(1)?.name).toBe("Leanne Graham");
		});

		it("should sort collections by multiple fields", async () => {
			const userRepo = store.from("user");

			// Sort by name descending, then by id ascending
			const sortedQuery = userRepo.getCollection({
				order: [chimeraCreateOrderBy<User>("name", true), chimeraCreateOrderBy<User>("id", false)],
			});
			await sortedQuery.progress;
			expect(sortedQuery.at(0)?.name).toBe("Leanne Graham");
			expect(sortedQuery.at(1)?.name).toBe("Ervin Howell");
		});

		it("should handle null values in ordering", async () => {
			const todoRepo = store.from("todo");

			// Sort todos by completion status with nulls first
			const sortedQuery = todoRepo.getCollection({
				order: [chimeraCreateOrderBy<Todo>("completed", false, ChimeraOrderNulls.First)],
			});
			await sortedQuery.result;
			expect(sortedQuery.at(0)?.completed).toBe(false);
			expect(sortedQuery.at(1)?.completed).toBe(true);
		});
	});

	describe("Event System", () => {
		it("should emit store-level events", async () => {
			const store = createStore(); // Create a new store because the one from before already emitted events
			const storeEvents: any[] = [];
			store.on("initialized", (event) => storeEvents.push(event));
			store.on("itemUpdated", (event) => storeEvents.push(event));

			// Wait for initialization
			await new Promise((resolve) => setTimeout(resolve, 10));
			expect(storeEvents).toHaveLength(1);
			expect(storeEvents[0].instance).toBe(store);
		});

		it("should emit repository-level events", async () => {
			const userRepo = store.from("user");
			const repoEvents: any[] = [];

			userRepo.on("itemAdded", (event) => repoEvents.push(event));
			userRepo.on("itemUpdated", (event) => repoEvents.push(event));
			userRepo.on("itemDeleted", (event) => repoEvents.push(event));

			// Create a user
			const createQuery = userRepo.createItem({
				email: "event@example.com",
				name: "Event Test User",
				username: "eventuser",
			});
			await createQuery.progress;

			// Update the user
			createQuery.mutable.name = "Updated Event User";
			await createQuery.commit();

			// Delete the user
			await createQuery.delete();

			// Wait for events to propagate
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(repoEvents.length).toBeGreaterThan(0);
		});

		it("should emit query-level events", async () => {
			const userRepo = store.from("user");
			const queryEvents: any[] = [];

			const userQuery = userRepo.getItem(1);
			userQuery.on("ready", (event) => queryEvents.push("ready"));
			userQuery.on("updated", (event) => queryEvents.push("updated"));
			userQuery.on("deleted", (event) => queryEvents.push("deleted"));

			await userQuery.progress;
			expect(queryEvents).toContain("ready");

			// Update the user
			userQuery.mutable.name = "Updated Name";
			await userQuery.commit();
			expect(queryEvents).toContain("updated");
		});
	});

	describe("Store Configuration", () => {
		it("should work with different ID getters", async () => {
			// Create a store with custom ID getter
			const customStore = new ChimeraStore<TestEntityMap>({
				debug: {
					devMode: false,
					logs: 'off',
				},
				query: {
					defaults: {
						idGetter: (entityName, item) => item.id,
						trustQuery: true,
						updateDebounceTimeout: 0,
					},
					entities: {
						album: {
							collectionFetcher: (params, requestParams) => stubApi.fetchCollection("album", params, requestParams),
							itemCreator: (item, requestParams) => stubApi.createItem("album", item, requestParams),
							itemDeleter: (deleteId, requestParams) => stubApi.deleteItem("album", deleteId, requestParams),
							itemFetcher: (params, requestParams) => stubApi.fetchItem("album", params, requestParams),
							itemUpdater: (updatedEntity, requestParams) => stubApi.updateItem("album", updatedEntity, requestParams),
						},
						comment: {
							collectionFetcher: (params, requestParams) => stubApi.fetchCollection("comment", params, requestParams),
							itemCreator: (item, requestParams) => stubApi.createItem("comment", item, requestParams),
							itemDeleter: (deleteId, requestParams) => stubApi.deleteItem("comment", deleteId, requestParams),
							itemFetcher: (params, requestParams) => stubApi.fetchItem("comment", params, requestParams),
							itemUpdater: (updatedEntity, requestParams) =>
								stubApi.updateItem("comment", updatedEntity, requestParams),
						},
						photo: {
							collectionFetcher: (params, requestParams) => stubApi.fetchCollection("photo", params, requestParams),
							itemCreator: (item, requestParams) => stubApi.createItem("photo", item, requestParams),
							itemDeleter: (deleteId, requestParams) => stubApi.deleteItem("photo", deleteId, requestParams),
							itemFetcher: (params, requestParams) => stubApi.fetchItem("photo", params, requestParams),
							itemUpdater: (updatedEntity, requestParams) => stubApi.updateItem("photo", updatedEntity, requestParams),
						},
						post: {
							collectionFetcher: (params, requestParams) => stubApi.fetchCollection("post", params, requestParams),
							itemCreator: (item, requestParams) => stubApi.createItem("post", item, requestParams),
							itemDeleter: (deleteId, requestParams) => stubApi.deleteItem("post", deleteId, requestParams),
							itemFetcher: (params, requestParams) => stubApi.fetchItem("post", params, requestParams),
							itemUpdater: (updatedEntity, requestParams) => stubApi.updateItem("post", updatedEntity, requestParams),
						},
						todo: {
							collectionFetcher: (params, requestParams) => stubApi.fetchCollection("todo", params, requestParams),
							itemCreator: (item, requestParams) => stubApi.createItem("todo", item, requestParams),
							itemDeleter: (deleteId, requestParams) => stubApi.deleteItem("todo", deleteId, requestParams),
							itemFetcher: (params, requestParams) => stubApi.fetchItem("todo", params, requestParams),
							itemUpdater: (updatedEntity, requestParams) => stubApi.updateItem("todo", updatedEntity, requestParams),
						},
						user: {
							collectionFetcher: (params, requestParams) => stubApi.fetchCollection("user", params, requestParams),
							itemCreator: (item, requestParams) => stubApi.createItem("user", item, requestParams),
							itemDeleter: (deleteId, requestParams) => stubApi.deleteItem("user", deleteId, requestParams),
							itemFetcher: (params, requestParams) => stubApi.fetchItem("user", params, requestParams),
							itemUpdater: (updatedEntity, requestParams) => stubApi.updateItem("user", updatedEntity, requestParams),
						},
					},
				},
			});

			const userRepo = customStore.from("user");
			const userQuery = userRepo.getItem(1);
			await userQuery.progress;
			expect(userQuery.data?.id).toBe(1);
		});

		it("should handle entity-specific configuration", async () => {
			const customStore = new ChimeraStore<TestEntityMap>({
				debug: {
					devMode: false,
					logs: 'off',
				},
				query: {
					defaults: {
						idGetter: "id",
						trustQuery: true,
						updateDebounceTimeout: 100,
					},
					entities: {
						album: {
							collectionFetcher: (params, requestParams) => stubApi.fetchCollection("album", params, requestParams),
							itemCreator: (item, requestParams) => stubApi.createItem("album", item, requestParams),
							itemDeleter: (deleteId, requestParams) => stubApi.deleteItem("album", deleteId, requestParams),
							itemFetcher: (params, requestParams) => stubApi.fetchItem("album", params, requestParams),
							itemUpdater: (updatedEntity, requestParams) => stubApi.updateItem("album", updatedEntity, requestParams),
						},
						comment: {
							collectionFetcher: (params, requestParams) => stubApi.fetchCollection("comment", params, requestParams),
							itemCreator: (item, requestParams) => stubApi.createItem("comment", item, requestParams),
							itemDeleter: (deleteId, requestParams) => stubApi.deleteItem("comment", deleteId, requestParams),
							itemFetcher: (params, requestParams) => stubApi.fetchItem("comment", params, requestParams),
							itemUpdater: (updatedEntity, requestParams) =>
								stubApi.updateItem("comment", updatedEntity, requestParams),
						},
						photo: {
							collectionFetcher: (params, requestParams) => stubApi.fetchCollection("photo", params, requestParams),
							itemCreator: (item, requestParams) => stubApi.createItem("photo", item, requestParams),
							itemDeleter: (deleteId, requestParams) => stubApi.deleteItem("photo", deleteId, requestParams),
							itemFetcher: (params, requestParams) => stubApi.fetchItem("photo", params, requestParams),
							itemUpdater: (updatedEntity, requestParams) => stubApi.updateItem("photo", updatedEntity, requestParams),
						},
						post: {
							// Use default settings
							collectionFetcher: (params, requestParams) => stubApi.fetchCollection("post", params, requestParams),
							itemCreator: (item, requestParams) => stubApi.createItem("post", item, requestParams),
							itemDeleter: (deleteId, requestParams) => stubApi.deleteItem("post", deleteId, requestParams),
							itemFetcher: (params, requestParams) => stubApi.fetchItem("post", params, requestParams),
							itemUpdater: (updatedEntity, requestParams) => stubApi.updateItem("post", updatedEntity, requestParams),
						},
						todo: {
							collectionFetcher: (params, requestParams) => stubApi.fetchCollection("todo", params, requestParams),
							itemCreator: (item, requestParams) => stubApi.createItem("todo", item, requestParams),
							itemDeleter: (deleteId, requestParams) => stubApi.deleteItem("todo", deleteId, requestParams),
							itemFetcher: (params, requestParams) => stubApi.fetchItem("todo", params, requestParams),
							itemUpdater: (updatedEntity, requestParams) => stubApi.updateItem("todo", updatedEntity, requestParams),
						},
						user: {
							collectionFetcher: (params, requestParams) => stubApi.fetchCollection("user", params, requestParams), // Override default
							itemCreator: (item, requestParams) => stubApi.createItem("user", item, requestParams),
							itemDeleter: (deleteId, requestParams) => stubApi.deleteItem("user", deleteId, requestParams),
							itemFetcher: (params, requestParams) => stubApi.fetchItem("user", params, requestParams),
							itemUpdater: (updatedEntity, requestParams) => stubApi.updateItem("user", updatedEntity, requestParams),
							updateDebounceTimeout: 200,
						},
					},
				},
			});

			const userRepo = customStore.from("user");
			const postRepo = customStore.from("post");

			// Both should work with their respective configurations
			const userQuery = userRepo.getItem(1);
			const postQuery = postRepo.getItem(1);

			await Promise.all([userQuery.progress, postQuery.progress]);
			expect(userQuery.data).toBeDefined();
			expect(postQuery.data).toBeDefined();
		});
	});

	describe("Batch Operations", () => {
		it("should handle batch updates through store", async () => {
			const userRepo = store.from("user");

			// First get existing users
			const allUsersQuery = userRepo.getCollection({});
			await allUsersQuery.progress;

			// Update all users
			const updatedUsers = Array.from(allUsersQuery).map((user) => ({
				...user,
				name: `Updated ${user.name}`,
			}));

			// Use store-level batch update
			store.updateMany("user", updatedUsers);

			// Verify the updates
			const updatedQuery = userRepo.getCollection({});
			await updatedQuery.progress;
			expect(updatedQuery.length).toBe(2);
			expect(updatedQuery.at(0)?.name).toContain("Updated");
		});

		it("should handle batch deletion through store", async () => {
			const userRepo = store.from("user");

			// Create some users first
			const createQuery1 = userRepo.createItem({
				email: "delete1@example.com",
				name: "Delete User 1",
				username: "delete1",
			});
			const createQuery2 = userRepo.createItem({
				email: "delete2@example.com",
				name: "Delete User 2",
				username: "delete2",
			});

			await Promise.all([createQuery1.progress, createQuery2.progress]);

			const userIds = [createQuery1.data?.id, createQuery2.data?.id].filter(Boolean);

			// Delete them in batch through store
			store.deleteMany("user", userIds);

			// Verify deletion
			const remainingQuery = userRepo.getCollection({});
			await remainingQuery.progress;
			expect(remainingQuery.length).toBe(2); // Only original users remain
		});
	});

	describe("Error Handling", () => {
		it("should handle fetch errors gracefully", async () => {
			const userRepo = store.from("user");

			// Try to fetch a non-existent user
			const errorQuery = userRepo.getItem(999);
			await expect(errorQuery.result).rejects.toThrow();
		});

		it("should handle update errors", async () => {
			const userRepo = store.from("user");
			const userQuery = userRepo.getItem(1);
			await userQuery.progress;

			// Try to update with invalid data
			(userQuery.mutable as any).invalidValue = "invalid";
			await expect(userQuery.commit()).rejects.toThrow();
		});
	});

	describe("Cross-Entity Operations", () => {
		it("should handle relationships between entities", async () => {
			// Get a user
			const userRepo = store.from("user");
			const userQuery = userRepo.getItem(1);
			await userQuery.progress;
			const user = userQuery.data;
			expect(user).toBeDefined();

			// Get posts by this user
			const postRepo = store.from("post");
			const userPostsQuery = postRepo.getCollection({
				filter: chimeraCreateConjunction<Post, ChimeraOperatorMap>('and', [
					chimeraCreateOperator<Post, ChimeraOperatorMap, 'eq'>('eq', 'userId', user?.id || 0),
				]),
			});
			await userPostsQuery.progress;
			expect(userPostsQuery.length).toBeGreaterThan(0);

			// Get comments for the first post
			const commentRepo = store.from("comment");
			const postCommentsQuery = commentRepo.getCollection({
				filter: chimeraCreateConjunction<Comment, ChimeraOperatorMap>('and', [
					chimeraCreateOperator<Comment, ChimeraOperatorMap, 'eq'>('eq', 'postId', userPostsQuery.at(0)?.id || 0),
				]),
			});
			await postCommentsQuery.progress;
			expect(postCommentsQuery.length).toBeGreaterThan(0);
		});

		it("should handle store-level updates", async () => {
			const userRepo = store.from("user");
			const userQuery = userRepo.getItem(1);
			await userQuery.progress;

			// Update a user directly through the store
			const updatedUser = {
				address: {
					city: "Test City",
					geo: { lat: "0", lng: "0" },
					street: "Test Street",
					suite: "Test Suite",
					zipcode: "12345",
				},
				company: {
					bs: "Test BS",
					catchPhrase: "Test Phrase",
					name: "Test Company",
				},
				email: "store@example.com",
				id: 1,
				name: "Store Updated User",
				phone: "123-456-7890",
				username: "storeuser",
				website: "test.com",
			};

			store.updateOne("user", updatedUser);

			expect(userQuery.data?.name).toBe("Store Updated User");
		});
	});

	describe("Performance and Caching", () => {
		it("should cache queries efficiently", async () => {
			const userRepo = store.from("user");

			// First query
			const query1 = userRepo.getCollection({});
			await query1.progress;

			// The second identical query should use cache
			const query2 = userRepo.getCollection({});
			await query2.progress;

			// Both should return the same data
			expect(Array.from(query1)).toEqual(Array.from(query2));
		});

		it("should handle concurrent queries", async () => {
			const userRepo = store.from("user");

			// Create multiple concurrent queries
			const queries = Array.from({ length: 5 }, () => userRepo.getCollection({}));

			// Wait for all to complete
			await Promise.all(queries.map((q) => q.progress));

			// All should return the same data
			queries.forEach((query) => {
				expect(query.length).toBe(2);
			});
		});
	});
});
