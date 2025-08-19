export interface Post {
	userId: number;
	id: number;
	title: string;
	body: string;
}

export interface Comment {
	postId: number;
	id: number;
	name: string;
	email: string;
	body: string;
}

export interface Album {
	userId: number;
	id: number;
	title: string;
}

export interface Photo {
	albumId: number;
	id: number;
	title: string;
	url: string;
	thumbnailUrl: string;
}

export interface Todo {
	userId: 1;
	id: 1;
	title: string;
	completed: boolean;
}

export interface UserAddressGeo {
	lat: string;
	lng: string;
}

export interface UserAddress {
	street: string;
	suite: string;
	city: string;
	zipcode: string;
	geo: UserAddressGeo;
}

export interface UserCompany {
	name: string;
	catchPhrase: string;
	bs: string;
}

export interface User {
	id: number;
	name: string;
	username: string;
	email: string;
	address: UserAddress;
	phone: string;
	website: string;
	company: UserCompany;
}

export enum TestEntityName {
	Post = "post",
	Comment = "comment",
	Album = "album",
	Photo = "photo",
	Todo = "todo",
	User = "user",
}

export type TestEntityMap = {
	[TestEntityName.Post]: Post;
	[TestEntityName.Comment]: Comment;
	[TestEntityName.Album]: Album;
	[TestEntityName.Photo]: Photo;
	[TestEntityName.Todo]: Todo;
	[TestEntityName.User]: User;
};
