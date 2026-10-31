import { TypedUseSelectorHook, useDispatch, useSelector, useStore } from 'react-redux';
import type { RootState, AppDispatch } from '../store/store';

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
/**
 * The store itself, for a screen that reads what a thunk just saved right
 * after dispatching it: `selectX(appStore.getState()).saved` (the slice
 * serialized it in `fulfilled`; screens never read a thunk's raw payload).
 */
export const useAppStore = () => useStore<RootState>();
