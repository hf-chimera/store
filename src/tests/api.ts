import type { DeepPartial } from "../shared/types.ts";
import type { Comment, Post, TestEntityMap, User } from "./types.ts";
import { TestEntityName } from "./types.ts";

// Mock data
const mockUsers: User[] = [
	{
		address: {
			city: "Gwenborough",
			geo: {lat: "-37.3159", lng: "81.1496"},
			street: "Kulas Light",
			suite: "Apt. 556",
			zipcode: "92998-3874",
		},
		company: {
			bs: "harness real-time e-markets",
			catchPhrase: "Multi-layered client-server neural-net",
			name: "Romaguera-Crona",
		},
		email: "Sincere@april.biz",
		id: 1,
		name: "Leanne Graham",
		phone: "1-770-736-8031 x56442",
		username: "Bret",
		website: "hildegard.org",
	},
	{
		address: {
			city: "Wisokyburgh",
			geo: {lat: "-43.9509", lng: "-34.4618"},
			street: "Victor Plains",
			suite: "Suite 879",
			zipcode: "90566-7771",
		},
		company: {
			bs: "synergize scalable supply-chains",
			catchPhrase: "Proactive didactic contingency",
			name: "Deckow-Crist",
		},
		email: "Shanna@melissa.tv",
		id: 2,
		name: "Ervin Howell",
		phone: "010-692-6593 x09125",
		username: "Antonette",
		website: "anastasia.net",
	},
];

const mockPosts: Post[] = [
	{
		body: "quia et suscipit suscipit recusandae consequuntur expedita et cum reprehenderit molestiae ut ut quas totam nostrum rerum est autem sunt rem eveniet architecto",
		id: 1,
		title: "sunt aut facere repellat provident occaecati excepturi optio reprehenderit",
		userId: 1,
	},
	{
		body: "est rerum tempore vitae sequi sint nihil reprehenderit dolor beatae ea dolores neque fugiat blanditiis voluptate porro vel nihil molestiae ut reiciendis qui aperiam non debitis possimus qui neque nisi nulla",
		id: 2,
		title: "qui est esse",
		userId: 1,
	},
];

const mockComments: Comment[] = [
	{
		body: "laudantium enim quasi est quidem magnam voluptate ipsam eos tempora quo necessitatibus dolor quam autem quasi reiciendis et nam sapiente accusantium",
		email: "Eliseo@gardner.biz",
		id: 1,
		name: "id labore ex et quam laborum",
		postId: 1,
	},
	{
		body: "est natus enim nihil est dolore omnis voluptatem numquam et omnis occaecati quod ullam at voluptatem error expedita pariatur nihil sint nostrum voluptatem reiciendis et",
		email: "Jayne_Kuhic@sydney.com",
		id: 2,
		name: "quo vero reiciendis velit similique earum",
		postId: 1,
	},
];

// Generic API response type
type ApiResponse<T> = {
	data: T;
	meta?: any;
};

// Generic collection response
type CollectionResponse<T> = {
	data: T[];
	meta?: any;
};

// Stub API functions
export const stubApi = {
	// Batched operations
	async batchCreate<T extends keyof TestEntityMap>(
		entityName: T,
		items: DeepPartial<TestEntityMap[T]>[],
		requestParams: any,
	): Promise<CollectionResponse<TestEntityMap[T]>> {
		await new Promise((resolve) => setTimeout(resolve, 10));

		const newItems = items.map((item, index) => ({
			...item,
			id: Math.floor(Math.random() * 1000) + 100 + index,
		})) as TestEntityMap[T][];

		return {data: newItems};
	},

	async batchDelete<T extends keyof TestEntityMap>(
		entityName: T,
		ids: (string | number)[],
		requestParams: any,
	): Promise<{ result: { id: string | number; success: boolean }[] }> {
		await new Promise((resolve) => setTimeout(resolve, 10));

		return {result: ids.map((id) => ({id, success: true}))};
	},

	async batchUpdate<T extends keyof TestEntityMap>(
		entityName: T,
		items: TestEntityMap[T][],
		requestParams: any,
	): Promise<CollectionResponse<TestEntityMap[T]>> {
		await new Promise((resolve) => setTimeout(resolve, 10));

		return {data: items};
	},

	// Item creators
	async createItem<T extends keyof TestEntityMap>(
		entityName: T,
		item: DeepPartial<TestEntityMap[T]>,
		requestParams: any,
	): Promise<ApiResponse<TestEntityMap[T]>> {
		await new Promise((resolve) => setTimeout(resolve, 10));

		// Generate a new ID
		const newId = Math.floor(Math.random() * 1000) + 100;
		const newItem = {...item, id: newId} as TestEntityMap[T];

		return {data: newItem};
	},

	// Item deleters
	async deleteItem<T extends keyof TestEntityMap>(
		entityName: T,
		id: string | number,
		requestParams: any,
	): Promise<{ result: { id: string | number; success: boolean } }> {
		await new Promise((resolve) => setTimeout(resolve, 10));

		return {result: {id, success: true}};
	},
	// Collection fetchers
	async fetchCollection<T extends keyof TestEntityMap>(
		entityName: T,
		params: any,
		requestParams: any,
	): Promise<CollectionResponse<TestEntityMap[T]>> {
		// Simulate network delay
		await new Promise((resolve) => setTimeout(resolve, 10));

		switch (entityName) {
			case TestEntityName.User:
				return {data: mockUsers as TestEntityMap[T][]};
			case TestEntityName.Post:
				return {data: mockPosts as TestEntityMap[T][]};
			case TestEntityName.Comment:
				return {data: mockComments as TestEntityMap[T][]};
			default:
				return {data: []};
		}
	},

	// Item fetchers
	async fetchItem<T extends keyof TestEntityMap>(
		entityName: T,
		params: { id: string | number },
		requestParams: any,
	): Promise<ApiResponse<TestEntityMap[T]>> {
		await new Promise((resolve) => setTimeout(resolve, 10));

		const id = Number(params.id);

		switch (entityName) {
			case TestEntityName.User: {
				const user = mockUsers.find((u) => u.id === id);
				if (!user) throw new Error(`User with id ${id} not found`);
				return {data: user as TestEntityMap[T]};
			}
			case TestEntityName.Post: {
				const post = mockPosts.find((p) => p.id === id);
				if (!post) throw new Error(`Post with id ${id} not found`);
				return {data: post as TestEntityMap[T]};
			}
			case TestEntityName.Comment: {
				const comment = mockComments.find((c) => c.id === id);
				if (!comment) throw new Error(`Comment with id ${id} not found`);
				return {data: comment as TestEntityMap[T]};
			}
			default:
				throw new Error(`Unknown entity: ${entityName}`);
		}
	},

	// Item updaters
	async updateItem<T extends keyof TestEntityMap>(
		entityName: T,
		item: TestEntityMap[T],
		requestParams: any,
	): Promise<ApiResponse<TestEntityMap[T]>> {
		await new Promise((resolve) => setTimeout(resolve, 10));

		return {data: item};
	},
};
