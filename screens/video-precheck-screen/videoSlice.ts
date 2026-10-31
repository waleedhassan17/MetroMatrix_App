// ═══════════════════════════════════════════════════════
// MetroMatrix — A video consultation: the visit, and its room
// ═══════════════════════════════════════════════════════
// Both sides use it: the patient by appointment code, the doctor by
// appointment id. The visit tells the precheck when the room opens; joining
// asks the API for the room (Jitsi URL, or JaaS with a token).

import { createAppSlice } from '../../store/createAppSlice';
import { fetchAppointment } from '../../networks/health/appointments';

import { joinVideo, joinVideoAsDoctor } from '../../networks/health/video';
import { toRejectedValue, required } from '../../networks/network/network';
import type { VideoJoin } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { appointmentDetailSerializer } from '../../serializers/health/appointmentSerializer';
import { videoJoinSerializer } from '../../serializers/health/recordsSerializer';
import { getDoctorAppointment } from '../shared/practiceReads';

export interface VideoTarget {
  code?: string;
  appointmentId?: string;
}

export interface VideoVisit {
  /** Who is on the other side ("Dr. Ayesha Siddiqui", "Zara Khan"). */
  other: string;
  startAt: string;
  endAt: string;
  timezone: string;
  joinOpensAt: string | null;
  canJoin: boolean;
  /** The patient's code (for Rate visit after the call). */
  code: string;
}

export interface VideoSliceState {
  visit: VideoVisit | null;
  visitStatus: FormStatus;
  room: VideoJoin | null;
  status: FormStatus;
  error: ServerError;
}

const initialState: VideoSliceState = { visit: null, visitStatus: 'idle', room: null, status: 'idle', error: NO_ERROR };

export const videoSlice = createAppSlice({
  name: 'video',
  initialState,
  reducers: create => ({
    leaveRoom: create.reducer(state => {
      state.room = null;
      state.status = 'idle';
    }),
    loadVideoVisitAsync: create.asyncThunk(
      async (t: VideoTarget, { rejectWithValue }): Promise<VideoVisit | ReturnType<typeof rejectWithValue>> => {
        try {
          if (t.code) {
            const a = required(appointmentDetailSerializer(await fetchAppointment(t.code)));
            return { other: a.doctor.name, startAt: a.startAt, endAt: a.endAt, timezone: a.timezone, joinOpensAt: a.joinOpensAt, canJoin: a.flags.canJoinVideo, code: a.code };
          }
          const a = await getDoctorAppointment(t.appointmentId ?? '');
          return { other: a.patient.name, startAt: a.startAt, endAt: a.endAt, timezone: a.timezone, joinOpensAt: a.joinOpensAt, canJoin: a.actions.canJoinVideo, code: a.code };
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.visitStatus = 'loading';
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.visitStatus = 'succeeded';
          state.visit = action.payload as VideoVisit;
        },
        rejected: (state, action) => {
          state.visitStatus = 'failed';
          state.error = readRejection(action, "The consultation didn't load.");
        },
      },
    ),
    joinRoomAsync: create.asyncThunk(
      async (t: VideoTarget, { rejectWithValue }) => {
        try {
          return t.code ? required(videoJoinSerializer(await joinVideo(t.code))) : required(videoJoinSerializer(await joinVideoAsDoctor(t.appointmentId ?? '')));
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
          state.status = 'succeeded';
          state.room = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "The room didn't open. Try again.");
        },
      },
    ),
  }),
  selectors: {
    selectVideo: state => state,
  },
});

export const { leaveRoom, loadVideoVisitAsync, joinRoomAsync } = videoSlice.actions;
export const { selectVideo } = videoSlice.selectors;
