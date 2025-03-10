import type * as Entity from "./entities";

export enum TestEntityName {
	Post = "post",
	Comment = "comment",
	Album = "album",
	Photo = "photo",
	Todo = "todo",
	User = "user",
}

export type TestEntityMap = {
	[TestEntityName.Post]: Entity.Post;
	[TestEntityName.Comment]: Entity.Comment;
	[TestEntityName.Album]: Entity.Album;
	[TestEntityName.Photo]: Entity.Photo;
	[TestEntityName.Todo]: Entity.Todo;
	[TestEntityName.User]: Entity.User;
};
