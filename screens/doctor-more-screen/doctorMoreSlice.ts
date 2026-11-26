// ═══════════════════════════════════════════════════════
// MetroMatrix — More: your listing (the public link, and hide or show it)
// ═══════════════════════════════════════════════════════
// Reads GET /health/doctor/profile for the doctor's id (their public page) and
// whether patients can find them. Hiding calls /listing/unpublish (booked
// visits stay); showing again is /listing/publish (the checklist must be done).
// Either answers with the business, which the session takes on.

import { createAppSlice } from '../../store/createAppSlice';
import { fetchOwnProfile } from '../../networks/health/doctor/profile';
import { toRejectedValue } from '../../networks/network/network';
import { setBusiness } from '../../store/authSlice';
import { listingSerializer } from '../../serializers/health/doctorSerializer';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { publishProfile, unpublishProfile } from '../shared/practiceReads';

export interface DoctorListing {
  id: string;
  isListed: boolean;
  /** Staff took the profile off the directory, and why. */
  hiddenByStaff: string | null;
}

export interface DoctorMoreSliceState {
  listing: DoctorListing | null;
  status: FormStatus;
  busy: boolean;
  error: ServerError;
}

const initialState: DoctorMoreSliceState = { listing: null, status: 'idle', busy: false, error: NO_ERROR };

export const doctorMoreSlice = createAppSlice({
  name: 'doctorMore',
  initialState,
  reducers: create => ({
    loadListingAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return await fetchOwnProfile();
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          const listing = listingSerializer(action.payload);
          if (!listing) return;
          state.listing = listing;
          state.error = NO_ERROR;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your listing didn't load.");
        },
      },
    ),
    setListedAsync: create.asyncThunk(
      async (listed: boolean, { dispatch, rejectWithValue }) => {
        try {
          const business = listed ? await publishProfile() : await unpublishProfile();
          dispatch(setBusiness(business));
          return business;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.busy = true;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.busy = false;
          if (state.listing) state.listing.isListed = !!action.payload.isListed;
        },
        rejected: (state, action) => {
          state.busy = false;
          state.error = readRejection(action, "That didn't change. Try again.");
        },
      },
    ),
  }),
  selectors: {
    selectDoctorMore: state => state,
  },
});

export const { loadListingAsync, setListedAsync } = doctorMoreSlice.actions;
export const { selectDoctorMore } = doctorMoreSlice.selectors;
