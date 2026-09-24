import type { SortOrder } from "mongoose";

export type QueryFilter<T> = {
  [P in keyof T]?: T[P] | { $eq?: T[P]; $ne?: T[P]; $in?: T[P][]; $nin?: T[P][] };
} & {
  $and?: QueryFilter<T>[];
  $or?: QueryFilter<T>[];
  $nor?: QueryFilter<T>[];
};

export type QuerySort<T> = { [K in keyof T]?: SortOrder } | string;

export type QuerySelect = string | string[];

export interface QueryOptions<T> {
  filter: QueryFilter<T>;
  select?: QuerySelect;
  sort?: QuerySort<T>;
  limit?: number;
}
