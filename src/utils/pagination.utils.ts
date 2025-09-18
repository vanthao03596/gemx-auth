import { PaginationMeta } from '../types/response.types';

export interface PaginationOptions {
  page?: number;
  limit?: number;
  defaultLimit?: number;
  maxLimit?: number;
}

export interface PrismaResult<T> {
  data: T[];
  total: number;
}

export const calculatePagination = (
  options: PaginationOptions
): { skip: number; take: number; page: number } => {
  const { page = 1, limit, defaultLimit = 10, maxLimit = 100 } = options;

  const currentPage = Math.max(1, page);
  const perPage = limit ? Math.min(Math.max(1, limit), maxLimit) : defaultLimit;
  const skip = (currentPage - 1) * perPage;

  return {
    skip,
    take: perPage,
    page: currentPage,
  };
};

export const createPaginationMeta = (
  totalCount: number,
  currentPage: number,
  perPage: number
): PaginationMeta => {
  const totalPages = Math.ceil(totalCount / perPage);

  return {
    total_count: totalCount,
    current_page: currentPage,
    total_pages: totalPages,
    per_page: perPage,
    has_next: currentPage < totalPages,
    has_previous: currentPage > 1,
  };
};

export const getPaginationFromQuery = (
  query: Record<string, unknown>
): PaginationOptions => {
  const page = query.page ? parseInt(query.page as string, 10) : undefined;
  const limit = query.limit ? parseInt(query.limit as string, 10) : undefined;

  const result: PaginationOptions = {};
  if (page !== undefined) result.page = page;
  if (limit !== undefined) result.limit = limit;

  return result;
};

export const paginateWithPrisma = async <T>(
  prismaQuery: (args: { skip: number; take: number }) => Promise<T[]>,
  countQuery: () => Promise<number>,
  options: PaginationOptions
): Promise<PrismaResult<T>> => {
  const { skip, take } = calculatePagination(options);

  const [data, total] = await Promise.all([
    prismaQuery({ skip, take }),
    countQuery(),
  ]);

  return { data, total };
};
