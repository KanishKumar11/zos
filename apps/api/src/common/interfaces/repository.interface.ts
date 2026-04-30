// Generic repository contract — all module repos implement this for DIP.
import type { FilterQuery, UpdateQuery } from 'mongoose';

export interface IRepository<T> {
  findById(id: string): Promise<T | null>;
  findOne(filter: FilterQuery<T>): Promise<T | null>;
  findMany(filter: FilterQuery<T>, opts?: FindManyOptions<T>): Promise<T[]>;
  count(filter: FilterQuery<T>): Promise<number>;
  create(data: Partial<T>): Promise<T>;
  updateById(id: string, update: UpdateQuery<T>): Promise<T | null>;
  deleteById(id: string): Promise<boolean>;
}

export interface FindManyOptions<T> {
  skip?: number;
  limit?: number;
  sort?: { [K in keyof T]?: 1 | -1 } | Record<string, 1 | -1>;
  projection?: Record<string, 0 | 1>;
}
