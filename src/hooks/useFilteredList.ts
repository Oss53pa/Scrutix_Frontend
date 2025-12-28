import { useMemo, useState, useCallback } from 'react';

interface UseFilteredListOptions<T, F> {
  items: T[];
  searchFn?: (item: T, searchTerm: string) => boolean;
  filterFn?: (item: T, filters: F) => boolean;
  sortFn?: (a: T, b: T) => number;
  initialSearch?: string;
  initialFilters?: F;
}

interface UseFilteredListReturn<T, F> {
  filteredItems: T[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filters: F;
  setFilters: (filters: F) => void;
  updateFilter: <K extends keyof F>(key: K, value: F[K]) => void;
  resetFilters: () => void;
  totalCount: number;
  filteredCount: number;
}

export function useFilteredList<T, F extends Record<string, unknown> = Record<string, unknown>>({
  items,
  searchFn,
  filterFn,
  sortFn,
  initialSearch = '',
  initialFilters = {} as F,
}: UseFilteredListOptions<T, F>): UseFilteredListReturn<T, F> {
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [filters, setFilters] = useState<F>(initialFilters);

  const updateFilter = useCallback(<K extends keyof F>(key: K, value: F[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setSearchTerm('');
    setFilters(initialFilters);
  }, [initialFilters]);

  const filteredItems = useMemo(() => {
    let result = [...items];

    // Apply search filter
    if (searchTerm && searchFn) {
      result = result.filter((item) => searchFn(item, searchTerm.toLowerCase()));
    }

    // Apply custom filters
    if (filterFn) {
      result = result.filter((item) => filterFn(item, filters));
    }

    // Apply sorting
    if (sortFn) {
      result.sort(sortFn);
    }

    return result;
  }, [items, searchTerm, searchFn, filters, filterFn, sortFn]);

  return {
    filteredItems,
    searchTerm,
    setSearchTerm,
    filters,
    setFilters,
    updateFilter,
    resetFilters,
    totalCount: items.length,
    filteredCount: filteredItems.length,
  };
}

// Simplified hook for basic text search
export function useSearch<T>(
  items: T[],
  searchFn: (item: T, term: string) => boolean
) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    return items.filter((item) => searchFn(item, searchTerm.toLowerCase()));
  }, [items, searchTerm, searchFn]);

  return {
    filteredItems,
    searchTerm,
    setSearchTerm,
    hasSearch: searchTerm.trim().length > 0,
  };
}
