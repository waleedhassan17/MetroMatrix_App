// ═══════════════════════════════════════════════════════
// MetroMatrix — usePagedList (ported from FinMatrix)
// ═══════════════════════════════════════════════════════
// A list the SERVER pages, searches and filters. As in FinMatrix, the screen
// hands over the network function (it returns the raw body) and the page's
// serializer (raw body → `Paged<T>`, `{ items, total, page, pageSize }`), so
// the screen itself never shapes API data. This is the one sanctioned place a
// screen calls a network function instead of a thunk.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { appendUnique, hasMorePages, LIST_PAGE_SIZE } from '../models/pagingModel';
import type { Paged } from '../models/shopping';
import { required } from '../networks/network/network';

export interface PagedList<T, P extends Paged<T> = Paged<T>> {
  /** The pages loaded so far, in the server's order. */
  rows: T[];
  /** The first page's whole answer — for extras some lists carry (segment counts). */
  first: P | null;
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
  /** Page one again with no indicator at all (a timer while the screen is open). */
  poll: () => void;
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
/** The row type of a page type. */
type RowOf<P> = P extends Paged<infer T> ? T : never;

type PagedOptions<T> = { enabled?: boolean; keyOf?: (row: T) => string | undefined; pageSize?: number };

export function usePagedList<P extends Paged<unknown>, T = RowOf<P>>(
  fetchPage: (page: number, pageSize: number) => Promise<unknown>,
  serialize: (payload: unknown) => P | null,
  key: string,
  options: PagedOptions<T> = {},
): PagedList<T, P & Paged<T>> {
  const { enabled = true, keyOf, pageSize = LIST_PAGE_SIZE } = options;
  const [rows, setRowsState] = useState<T[]>([]);
  const [first, setFirst] = useState<(P & Paged<T>) | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  // Loading from the start, so an empty state never flashes before the first answer.
  const [isLoading, setIsLoading] = useState(enabled);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  // The latest callbacks, so reload/loadMore keep one identity per `key`.
  // One page, serialized: a body the serializer can't read fails the load.
  const fetchRef = useRef((page: number, size: number) => fetchPage(page, size).then(raw => required(serialize(raw))));
  const keyOfRef = useRef(keyOf);
  useEffect(() => {
    fetchRef.current = (page: number, size: number) => fetchPage(page, size).then(raw => required(serialize(raw)));
    keyOfRef.current = keyOf;
  });

  /** Bumped by every reload: a page from an older generation is dropped. */
  const generation = useRef(0);
  const moreInFlight = useRef(false);

  const load = useCallback(
    (mode: 'reload' | 'refresh' | 'poll') => {
      if (!enabled) return;
      // A poll never interrupts the person scrolling further pages in.
      if (mode === 'poll' && moreInFlight.current) return;
      const gen = ++generation.current;
      moreInFlight.current = false;
      if (mode === 'reload') setIsLoading(true);
      else if (mode === 'refresh') setIsRefreshing(true);
      setIsLoadingMore(false);
      if (mode !== 'poll') setError('');
      fetchRef
        .current(1, pageSize)
        .then(p => {
          if (gen !== generation.current) return;
          setRowsState(p.items as T[]);
          setFirst(p as P & Paged<T>);
          setPage(1);
          setTotal(p.total);
          setHasMore(hasMorePages(p));
        })
        .catch((e: unknown) => {
          if (gen !== generation.current || mode === 'poll') return;
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
  const poll = useCallback(() => load('poll'), [load]);

  const loadMore = useCallback(() => {
    if (!enabled || isLoading || moreInFlight.current || !hasMore) return;
    const gen = generation.current;
    moreInFlight.current = true;
    setIsLoadingMore(true);
    fetchRef
      .current(page + 1, pageSize)
      .then(p => {
        if (gen !== generation.current) return;
        setRowsState(prev => appendUnique(prev, p.items as T[], keyOfRef.current));
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

  return { rows, first, total, hasMore, isLoading, isLoadingMore, isRefreshing, error, reload, refresh, poll, loadMore, setRows };
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
