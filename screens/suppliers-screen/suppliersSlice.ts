// MetroMatrix — Kitchen: suppliers (who the kitchen buys from).

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { createSupplier, deleteSupplier, fetchSuppliers, updateSupplier } from '../../networks/kitchen/purchases';
import { toRejectedValue, required } from '../../networks/network/network';
import type { Supplier } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { suppliersSerializer, supplierSerializer } from '../../serializers/kitchen/stockSerializer';

export interface SupplierDraft {
  id: string | null;
  name: string;
  phone: string;
  note: string;
}

export interface SuppliersSliceState {
  suppliers: Supplier[];
  status: FormStatus;
  error: ServerError;
  editing: SupplierDraft | null;
  saving: boolean;
  saveError: ServerError;
}

const initialState: SuppliersSliceState = { suppliers: [], status: 'idle', error: NO_ERROR, editing: null, saving: false, saveError: NO_ERROR };

export const suppliersSlice = createAppSlice({
  name: 'suppliers',
  initialState,
  reducers: create => ({
    editSupplier: create.reducer((state, action: PayloadAction<SupplierDraft | null>) => {
      state.editing = action.payload;
      state.saveError = NO_ERROR;
    }),
    setSupplierDraft: create.reducer((state, action: PayloadAction<Partial<SupplierDraft>>) => {
      if (state.editing) Object.assign(state.editing, action.payload);
    }),
    loadSuppliersAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return await fetchSuppliers();
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = suppliersSerializer(action.payload);
          state.status = 'succeeded';
          state.suppliers = payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Suppliers didn't load.");
        },
      },
    ),
    saveSupplierAsync: create.asyncThunk(
      async (d: SupplierDraft, { rejectWithValue }) => {
        try {
          const body = { name: d.name.trim(), phone: d.phone.trim() || null, note: d.note.trim() || null };
          return d.id ? await updateSupplier(d.id, body) : await createSupplier(body);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.saving = true;
          state.saveError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = supplierSerializer(action.payload);
          state.saving = false;
          state.editing = null;
          if (!payload) return;
          const at = state.suppliers.findIndex(x => x.id === payload.id);
          if (at >= 0) state.suppliers[at] = payload;
          else state.suppliers.push(payload);
        },
        rejected: (state, action) => {
          state.saving = false;
          state.saveError = readRejection(action, "The supplier didn't save.");
        },
      },
    ),
    deleteSupplierAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          await deleteSupplier(id);
          return id;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        fulfilled: (state, action) => {
          state.suppliers = state.suppliers.filter(x => x.id !== action.payload);
          state.editing = null;
        },
        rejected: (state, action) => {
          state.saveError = readRejection(action, "The supplier wasn't removed.");
        },
      },
    ),
  }),
  selectors: {
    selectSuppliers: state => state,
  },
});

export const { editSupplier, setSupplierDraft, loadSuppliersAsync, saveSupplierAsync, deleteSupplierAsync } = suppliersSlice.actions;
export const { selectSuppliers } = suppliersSlice.selectors;
