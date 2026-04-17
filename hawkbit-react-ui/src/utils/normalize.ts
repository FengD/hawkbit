import type { ApiPageResponse } from '../types/api';

export const normalizePageResponse = <T>(payload: ApiPageResponse<T> | T[] | Record<string, unknown>): { items: T[]; total: number } => {
  if (Array.isArray(payload)) {
    return { items: payload, total: payload.length };
  }

  const page = payload as ApiPageResponse<T>;

  if (Array.isArray(page.content)) {
    return { items: page.content, total: page.total ?? page.content.length };
  }

  if (page._embedded && typeof page._embedded === 'object') {
    const embeddedValues = Object.values(page._embedded);
    const firstList = embeddedValues.find((value) => Array.isArray(value)) as T[] | undefined;
    if (firstList) {
      return { items: firstList, total: page.total ?? firstList.length };
    }
  }

  return { items: [], total: 0 };
};

export const toErrorMessage = (error: unknown): string => {
  if (error && typeof error === 'object') {
    const candidate = error as { response?: { data?: { message?: string }; statusText?: string }; message?: string };
    return candidate.response?.data?.message ?? candidate.response?.statusText ?? candidate.message ?? 'Unexpected error';
  }

  return String(error);
};
