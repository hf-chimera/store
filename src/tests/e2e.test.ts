import { beforeEach, describe, expect, it } from "vitest";
import { type ChimeraEntityStore, createChimeraEntityStore } from "../entity-store/index.ts";
import type { chimeraDefaultFilterOperators } from "../filter/defaults";
import { chimeraCreateConjunction, chimeraCreateOperator } from "../filter/index.ts";
import { ChimeraOrderNulls, chimeraCreateOrderBy } from "../order/index.ts";
import { ChimeraQueryFetchingState } from "../query";
import { stubApi } from "./api.ts";
import type { Album, Comment, Photo, Post, Todo, User } from "./types.ts";

type ChimeraOperatorMap = typeof chimeraDefaultFilterOperators;

type EntityStores = {
	album: ChimeraEntityStore<"album", Album, ChimeraOperatorMap>;
	comment: ChimeraEntityStore<"comment", Comment, ChimeraOperatorMap>;
	photo: ChimeraEntityStore<"photo", Photo, ChimeraOperatorMap>;
	post: ChimeraEntityStore<"post", Post, ChimeraOperatorMap>;
	todo: ChimeraEntityStore<"todo", Todo, ChimeraOperatorMap>;
	user: ChimeraEntityStore<"user", User, ChimeraOperatorMap>;
};

const createStores = (): EntityStores => ({
	album: createChimeraEntityStore({
		name: "album",
		idGetter: "id",
		collectionFetcher: (params, requestParams) => stubApi.fetchCollection("album", params, requestParams),
		itemCreator: (item, requestParams) => stubApi.createItem("album", item, requestParams),
		itemDeleter: (deleteId, requestParams) => stubApi.deleteItem("album", deleteId, requestParams),
		itemFetcher: (params, requestParams) => stubApi.fetchItem("album", params, requestParams),
		itemUpdater: (updatedEntity, requestParams) => stubApi.updateItem("album", updatedEntity, requestParams),
		batchedCreator: (items, requestParams) => stubApi.batchCreate("album", items, requestParams),
		batchedDeleter: (ids, requestParams) => stubApi.batchDelete("album", ids, requestParams),
		batchedUpdater: (items, requestParams) => stubApi.batchUpdate("album", items, requestParams),
		trustQuery: false,
		updateDebounceTimeout: 0,
	}),
	comment: createChimeraEntityStore({
		name: "comment",
		idGetter: "id",
		collectionFetcher: (params, requestParams) => stubApi.fetchCollection("comment", params, requestParams),
		itemCreator: (item, requestParams) => stubApi.createItem("comment", item, requestParams),
		itemDeleter: (deleteId, requestParams) => stubApi.deleteItem("comment", deleteId, requestParams),
		itemFetcher: (params, requestParams) => stubApi.fetchItem("comment", params, requestParams),
		itemUpdater: (updatedEntity, requestParams) => stubApi.updateItem("comment", updatedEntity, requestParams),
		batchedCreator: (items, requestParams) => stubApi.batchCreate("comment", items, requestParams),
		batchedDeleter: (ids, requestParams) => stubApi.batchDelete("comment", ids, requestParams),
		batchedUpdater: (items, requestParams) => stubApi.batchUpdate("comment", items, requestParams),
		trustQuery: false,
		updateDebounceTimeout: 0,
	}),
	photo: createChimeraEntityStore({
		name: "photo",
		idGetter: "id",
		collectionFetcher: (params, requestParams) => stubApi.fetchCollection("photo", params, requestParams),
		itemCreator: (item, requestParams) => stubApi.createItem("photo", item, requestParams),
		itemDeleter: (deleteId, requestParams) => stubApi.deleteItem("photo", deleteId, requestParams),
		itemFetcher: (params, requestParams) => stubApi.fetchItem("photo", params, requestParams),
		itemUpdater: (updatedEntity, requestParams) => stubApi.updateItem("photo", updatedEntity, requestParams),
		batchedCreator: (items, requestParams) => stubApi.batchCreate("photo", items, requestParams),
		batchedDeleter: (ids, requestParams) => stubApi.batchDelete("photo", ids, requestParams),
		batchedUpdater: (items, requestParams) => stubApi.batchUpdate("photo", items, requestParams),
		trustQuery: false,
		updateDebounceTimeout: 0,
	}),
	post: createChimeraEntityStore({
		name: "post",
		idGetter: "id",
		collectionFetcher: (params, requestParams) => stubApi.fetchCollection("post", params, requestParams),
		itemCreator: (item, requestParams) => stubApi.createItem("post", item, requestParams),
		itemDeleter: (deleteId, requestParams) => stubApi.deleteItem("post", deleteId, requestParams),
		itemFetcher: (params, requestParams) => stubApi.fetchItem("post", params, requestParams),
		itemUpdater: (updatedEntity, requestParams) => stubApi.updateItem("post", updatedEntity, requestParams),
		batchedCreator: (items, requestParams) => stubApi.batchCreate("post", items, requestParams),
		batchedDeleter: (ids, requestParams) => stubApi.batchDelete("post", ids, requestParams),
		batchedUpdater: (items, requestParams) => stubApi.batchUpdate("post", items, requestParams),
		trustQuery: false,
		updateDebounceTimeout: 0,
	}),
	todo: createChimeraEntityStore({
		name: "todo",
		idGetter: "id",
		collectionFetcher: (params, requestParams) => stubApi.fetchCollection("todo", params, requestParams),
		itemCreator: (item, requestParams) => stubApi.createItem("todo", item, requestParams),
		itemDeleter: (deleteId, requestParams) => stubApi.deleteItem("todo", deleteId, requestParams),
		itemFetcher: (params, requestParams) => stubApi.fetchItem("todo", params, requestParams),
		itemUpdater: (updatedEntity, requestParams) => stubApi.updateItem("todo", updatedEntity, requestParams),
		batchedCreator: (items, requestParams) => stubApi.batchCreate("todo", items, requestParams),
		batchedDeleter: (ids, requestParams) => stubApi.batchDelete("todo", ids, requestParams),
		batchedUpdater: (items, requestParams) => stubApi.batchUpdate("todo", items, requestParams),
		trustQuery: false,
		updateDebounceTimeout: 0,
	}),
	user: createChimeraEntityStore({
		name: "user",
		idGetter: "id",
		collectionFetcher: (params, requestParams) => stubApi.fetchCollection("user", params, requestParams),
		itemCreator: (item, requestParams) => stubApi.createItem("user", item, requestParams),
		itemDeleter: (deleteId, requestParams) => stubApi.deleteItem("user", deleteId, requestParams),
		itemFetcher: (params, requestParams) => stubApi.fetchItem("user", params, requestParams),
		itemUpdater: (updatedEntity, requestParams) => stubApi.updateItem("user", updatedEntity, requestParams),
		batchedCreator: (items, requestParams) => stubApi.batchCreate("user", items, requestParams),
		batchedDeleter: (ids, requestParams) => stubApi.batchDelete("user", ids, requestParams),
		batchedUpdater: (items, requestParams) => stubApi.batchUpdate("user", items, requestParams),
		trustQuery: false,
		updateDebounceTimeout: 0,
	}),
});

describe("Store Module - e2e Tests", () => {
	let stores: EntityStores;

	beforeEach(() => {
		stores = createStores();
	});

	describe("Basic CRUD Operations", () => {
		it("should create, read, update, and delete items", async () => {
			const userStore = stores.user;

			// Create a new user
			const createQuery = userStore.createItem({
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

			const getQuery = userStore.getItem(userId);
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
			const userStore = stores.user;
			const userQuery = userStore.getItem(1);
			await userQuery.progress;
			expect(userQuery.data?.name).toBe("Leanne Graham");

			// Test Post entity
			const postRepo = stores.post;
			const postQuery = postRepo.getItem(1);
			await postQuery.progress;
			expect(postQuery.data?.title).toBe("sunt aut facere repellat provident occaecati excepturi optio reprehenderit");

			// Test Comment entity
			const commentRepo = stores.comment;
			const commentQuery = commentRepo.getItem(1);
			await commentQuery.progress;
			expect(commentQuery.data?.name).toBe("id labore ex et quam laborum");
		});
	});

	describe("Collection Operations", () => {
		it("should fetch and filter collections", async () => {
			const userStore = stores.user;

			// Get all users
			const allUsersQuery = userStore.getCollection({});
			await allUsersQuery.progress;
			expect(allUsersQuery.length).toBe(2);

			// Filter users by name containing "Leanne"
			const filteredQuery = userStore.getCollection({
				filter: chimeraCreateConjunction<User, ChimeraOperatorMap>("and", [
					chimeraCreateOperator<User, ChimeraOperatorMap, "contains">("contains", "name", "Leanne"),
				]),
			});
			await filteredQuery.progress;
			expect(filteredQuery.length).toBe(1);
			expect(filteredQuery.at(0)?.name).toBe("Leanne Graham");
		});

		it("should handle complex filtering with conjunctions", async () => {
			const userStore = stores.user;

			// Filter users with complex conditions
			const complexFilter = chimeraCreateConjunction<User, ChimeraOperatorMap>("and", [
				chimeraCreateOperator<User, ChimeraOperatorMap, "contains">("contains", "name", "Graham"),
				chimeraCreateOperator<User, ChimeraOperatorMap, "eq">("eq", "id", 1),
			]);

			const filteredQuery = userStore.getCollection({
				filter: complexFilter,
			});
			await filteredQuery.progress;
			expect(filteredQuery.length).toBe(1);
			expect(filteredQuery.at(0)?.name).toBe("Leanne Graham");
		});

		it("should handle OR conjunctions", async () => {
			const userStore = stores.user;

			// Filter users with OR condition
			const orFilter = chimeraCreateConjunction<User, ChimeraOperatorMap>("or", [
				chimeraCreateOperator<User, ChimeraOperatorMap, "eq">("eq", "id", 1),
				chimeraCreateOperator<User, ChimeraOperatorMap, "eq">("eq", "id", 2),
			]);

			const filteredQuery = userStore.getCollection({
				filter: orFilter,
			});
			await filteredQuery.progress;
			expect(filteredQuery.length).toBe(2);
		});
	});

	describe("Ordering Operations", () => {
		it("should sort collections by single field", async () => {
			const userStore = stores.user;

			// Sort by name ascending
			const sortedQuery = userStore.getCollection({
				order: [chimeraCreateOrderBy<User>("name", false)],
			});
			await sortedQuery.progress;
			expect(sortedQuery.at(0)?.name).toBe("Ervin Howell");
			expect(sortedQuery.at(1)?.name).toBe("Leanne Graham");
		});

		it("should sort collections by multiple fields", async () => {
			const userStore = stores.user;

			// Sort by name descending, then by id ascending
			const sortedQuery = userStore.getCollection({
				order: [chimeraCreateOrderBy<User>("name", true), chimeraCreateOrderBy<User>("id", false)],
			});
			await sortedQuery.progress;
			expect(sortedQuery.at(0)?.name).toBe("Leanne Graham");
			expect(sortedQuery.at(1)?.name).toBe("Ervin Howell");
		});

		it("should handle null values in ordering", async () => {
			const todoRepo = stores.todo;

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
			const localStores = createStores(); // Create new stores because the ones from before already emitted events
			const storeEvents: any[] = [];
			localStores.user.on("initialized", (event) => storeEvents.push(event));
			localStores.user.on("itemUpdated", (event) => storeEvents.push(event));

			// Wait for initialization
			await new Promise((resolve) => setTimeout(resolve, 10));
			expect(storeEvents).toHaveLength(1);
			expect(storeEvents[0].instance).toBe(localStores.user);
		});

		it("should emit repository-level events", async () => {
			const userStore = stores.user;
			const repoEvents: any[] = [];

			userStore.on("itemAdded", (event) => repoEvents.push(event));
			userStore.on("itemUpdated", (event) => repoEvents.push(event));
			userStore.on("itemDeleted", (event) => repoEvents.push(event));

			// Create a user
			const createQuery = userStore.createItem({
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
			const userStore = stores.user;
			const queryEvents: any[] = [];

			const userQuery = userStore.getItem(1);
			userQuery.on("ready", () => queryEvents.push("ready"));
			userQuery.on("updated", () => queryEvents.push("updated"));
			userQuery.on("deleted", () => queryEvents.push("deleted"));

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
			// Create entity stores with custom ID getter
			const userStore = createChimeraEntityStore<"user", User>({
				name: "user",
				idGetter: (item) => item.id,
				trustQuery: true,
				updateDebounceTimeout: 0,
				collectionFetcher: (params, requestParams) => stubApi.fetchCollection("user", params, requestParams),
				itemCreator: (item, requestParams) => stubApi.createItem("user", item, requestParams),
				itemDeleter: (deleteId, requestParams) => stubApi.deleteItem("user", deleteId, requestParams),
				itemFetcher: (params, requestParams) => stubApi.fetchItem("user", params, requestParams),
				itemUpdater: (updatedEntity, requestParams) => stubApi.updateItem("user", updatedEntity, requestParams),
			});
			const userQuery = userStore.getItem(1);
			await userQuery.progress;
			expect(userQuery.data?.id).toBe(1);
		});

		it("should handle entity-specific configuration", async () => {
			const customUserStore = createChimeraEntityStore<"user", User>({
				name: "user",
				idGetter: "id",
				trustQuery: true,
				updateDebounceTimeout: 200,
				collectionFetcher: (params, requestParams) => stubApi.fetchCollection("user", params, requestParams),
				itemCreator: (item, requestParams) => stubApi.createItem("user", item, requestParams),
				itemDeleter: (deleteId, requestParams) => stubApi.deleteItem("user", deleteId, requestParams),
				itemFetcher: (params, requestParams) => stubApi.fetchItem("user", params, requestParams),
				itemUpdater: (updatedEntity, requestParams) => stubApi.updateItem("user", updatedEntity, requestParams),
			});

			const customPostStore = createChimeraEntityStore<"post", Post>({
				name: "post",
				idGetter: "id",
				trustQuery: true,
				updateDebounceTimeout: 100,
				collectionFetcher: (params, requestParams) => stubApi.fetchCollection("post", params, requestParams),
				itemCreator: (item, requestParams) => stubApi.createItem("post", item, requestParams),
				itemDeleter: (deleteId, requestParams) => stubApi.deleteItem("post", deleteId, requestParams),
				itemFetcher: (params, requestParams) => stubApi.fetchItem("post", params, requestParams),
				itemUpdater: (updatedEntity, requestParams) => stubApi.updateItem("post", updatedEntity, requestParams),
			});

			const userStore = customUserStore;
			const postRepo = customPostStore;

			// Both should work with their respective configurations
			const userQuery = userStore.getItem(1);
			const postQuery = postRepo.getItem(1);

			await Promise.all([userQuery.progress, postQuery.progress]);
			expect(userQuery.data).toBeDefined();
			expect(postQuery.data).toBeDefined();
		});
	});

	describe("Batch Operations", () => {
		it("should handle batch updates through store", async () => {
			const userStore = stores.user;

			// First get existing users
			const allUsersQuery = userStore.getCollection({});
			await allUsersQuery.progress;

			// Update all users
			const updatedUsers = Array.from(allUsersQuery).map((user) => ({
				...user,
				name: `Updated ${user.name}`,
			}));

			// Use entity store-level batch update
			stores.user.updateMany(updatedUsers);

			// Verify the updates
			const updatedQuery = userStore.getCollection({});
			await updatedQuery.progress;
			expect(updatedQuery.length).toBe(2);
			expect(updatedQuery.at(0)?.name).toContain("Updated");
		});

		it("should handle batch deletion through store", async () => {
			const userStore = stores.user;

			// Create some users first
			const createQuery1 = userStore.createItem({
				email: "delete1@example.com",
				name: "Delete User 1",
				username: "delete1",
			});
			const createQuery2 = userStore.createItem({
				email: "delete2@example.com",
				name: "Delete User 2",
				username: "delete2",
			});

			await Promise.all([createQuery1.progress, createQuery2.progress]);

			const userIds = [createQuery1.data?.id, createQuery2.data?.id].filter(Boolean);

			// Delete them in batch through entity store
			stores.user.deleteMany(userIds);

			// Verify deletion
			const remainingQuery = userStore.getCollection({});
			await remainingQuery.progress;
			expect(remainingQuery.length).toBe(2); // Only original users remain
		});
	});

	describe("Error Handling", () => {
		it("should handle fetch errors gracefully", async () => {
			const userStore = stores.user;

			// Try to fetch a non-existent user
			const errorQuery = userStore.getItem(999);
			await expect(errorQuery.result).rejects.toThrow();
		});

		it("should handle update errors", async () => {
			const userStore = stores.user;
			const userQuery = userStore.getItem(1);
			await userQuery.progress;

			// Try to update with invalid data
			(userQuery.mutable as any).invalidValue = "invalid";
			await expect(userQuery.commit()).rejects.toThrow();
		});
	});

	describe("Cross-Entity Operations", () => {
		it("should handle relationships between entities", async () => {
			// Get a user
			const userStore = stores.user;
			const userQuery = userStore.getItem(1);
			await userQuery.progress;
			const user = userQuery.data;
			expect(user).toBeDefined();

			// Get posts by this user
			const postRepo = stores.post;
			const userPostsQuery = postRepo.getCollection({
				filter: chimeraCreateConjunction<Post, ChimeraOperatorMap>("and", [
					chimeraCreateOperator<Post, ChimeraOperatorMap, "eq">("eq", "userId", user?.id || 0),
				]),
			});
			await userPostsQuery.progress;
			expect(userPostsQuery.length).toBeGreaterThan(0);

			// Get comments for the first post
			const commentRepo = stores.comment;
			const postCommentsQuery = commentRepo.getCollection({
				filter: chimeraCreateConjunction<Comment, ChimeraOperatorMap>("and", [
					chimeraCreateOperator<Comment, ChimeraOperatorMap, "eq">("eq", "postId", userPostsQuery.at(0)?.id || 0),
				]),
			});
			await postCommentsQuery.progress;
			expect(postCommentsQuery.length).toBeGreaterThan(0);
		});

		it("should handle store-level updates", async () => {
			const userStore = stores.user;
			const userQuery = userStore.getItem(1);
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

			stores.user.updateOne(updatedUser);

			expect(userQuery.data?.name).toBe("Store Updated User");
		});
	});

	describe("Performance and Caching", () => {
		it("should cache queries efficiently", async () => {
			const userStore = stores.user;

			// First query
			const query1 = userStore.getCollection({});
			await query1.progress;

			// The second identical query should use cache
			const query2 = userStore.getCollection({});
			await query2.progress;

			// Both should return the same data
			expect(Array.from(query1)).toEqual(Array.from(query2));
		});

		it("should handle concurrent queries", async () => {
			const userStore = stores.user;

			// Create multiple concurrent queries
			const queries = Array.from({ length: 5 }, () => userStore.getCollection({}));

			// Wait for all to complete
			await Promise.all(queries.map((q) => q.progress));

			// All should return the same data
			queries.forEach((query) => {
				expect(query.length).toBe(2);
			});
		});
	});
});
