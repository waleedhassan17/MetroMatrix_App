// ═══════════════════════════════════════════════════════
// MetroMatrix — usePagedList (ported from FinMatrix)
// ═══════════════════════════════════════════════════════
// A list the SERVER pages, searches and filters. The network function
// returns a serialized `Paged<T>` (`{ items, total, page, pageSize }`), so a
// screen never shapes API data. This is the one sanctioned place a screen
// hands a network function over — as in FinMatrix — instead of a thunk.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { appendUnique, hasMorePages, LIST_PAGE_SIZE } from '../models/pagingModel';
import type { Paged } from '../types/shopping';

export interface PagedList<T> {
  /** The pages loaded so far, in the server's order. */
  rows: T[];
  /** Rows the filters match in all — may exceed what has loaded. */
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  /** Pull-to-refresh is running (rows stay on screen meanwhile). */
  isRefreshing: boolean;
  error: string;
  /** Page one again, with the current filters (retry). */
  reload: () => void;
  /** Page one again, keeping the rows on screen (pull to refresh). */
  refresh: () => void;
  /** The next page, appended — a list's onEndReached. */
  loadMore: () => void;
  /** Change rows locally after an action (remove a saved item, …). */
  setRows: (update: (rows: T[]) => T[]) => void;
}

/**
 * `key` must change with every filter (search, segment, sort) so a change
 * starts over at page one. The list reloads when the screen comes into focus
 * and when `key` changes; an answer for filters no longer on screen is
 * dropped (the generation guard), and only one "load more" runs at a time.
 */
export function usePagedList<T>(
  fetchPage: (page: number, pageSize: number) => Promise<Paged<T>>,
  key: string,
  options: { enabled?: boolean; keyOf?: (row: T) => string | undefined; pageSize?: number } = {},
): PagedList<T> {
  const { enabled = true, keyOf, pageSize = LIST_PAGE_SIZE } = options;
  const [rows, setRowsState] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  // Loading from the start, so an empty state never flashes before the first answer.
  const [isLoading, setIsLoading] = useState(enabled);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  // The latest callbacks, so reload/loadMore keep one identity per `key`.
  const fetchRef = useRef(fetchPage);
  const keyOfRef = useRef(keyOf);
  useEffect(() => {
    fetchRef.current = fetchPage;
    keyOfRef.current = keyOf;
  });

  /** Bumped by every reload: a page from an older generation is dropped. */
  const generation = useRef(0);
  const moreInFlight = useRef(false);

  const load = useCallback(
    (mode: 'reload' | 'refresh') => {
      if (!enabled) return;
      const gen = ++generation.current;
      moreInFlight.current = false;
      if (mode === 'reload') setIsLoading(true);
      else setIsRefreshing(true);
      setIsLoadingMore(false);
      setError('');
      fetchRef
        .current(1, pageSize)
        .then(p => {
          if (gen !== generation.current) return;
          setRowsState(p.items);
          setPage(1);
          setTotal(p.total);
          setHasMore(hasMorePages(p));
        })
        .catch((e: unknown) => {
          if (gen !== generation.current) return;
          setError(e instanceof Error ? e.message : 'Could not load this list.');
        })
        .finally(() => {
          if (gen !== generation.current) return;
          setIsLoading(false);
          setIsRefreshing(false);
        });
    },
    // `key` is what makes a new load: the filters live in fetchPage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, enabled, pageSize],
  );

  const reload = useCallback(() => load('reload'), [load]);
  const refresh = useCallback(() => load('refresh'), [load]);

  const loadMore = useCallback(() => {
    if (!enabled || isLoading || moreInFlight.current || !hasMore) return;
    const gen = generation.current;
    moreInFlight.current = true;
    setIsLoadingMore(true);
    fetchRef
      .current(page + 1, pageSize)
      .then(p => {
        if (gen !== generation.current) return;
        setRowsState(prev => appendUnique(prev, p.items, keyOfRef.current));
        setPage(page + 1);
        setTotal(p.total);
        setHasMore(hasMorePages(p));
      })
      .catch(() => {
        /* the footer stays; scrolling again retries */
      })
      .finally(() => {
        if (gen !== generation.current) return;
        moreInFlight.current = false;
        setIsLoadingMore(false);
      });
  }, [enabled, isLoading, hasMore, page, pageSize]);

  const setRows = useCallback((update: (rows: T[]) => T[]) => setRowsState(update), []);

  // On focus (coming back from a detail) and whenever the filters change.
  useFocusEffect(reload);

  return { rows, total, hasMore, isLoading, isLoadingMore, isRefreshing, error, reload, refresh, loadMore, setRows };
}

/** `value`, once it has stopped changing for `ms` — a search box's query. */
export function useDebouncedValue<T>(value: T, ms = 350): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}
