// MetroMatrix — What the video call screen does on every platform: leave
// the room and go where the role goes next (the patient to Rate visit, the
// doctor back to the appointment).

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { HealthBrowseParamList } from '../../models';

export type VideoNav = NativeStackNavigationProp<HealthBrowseParamList, 'VideoConsult'>;

export const afterCall = (navigation: VideoNav, target: { code?: string; appointmentId?: string }) => {
  if (target.code) navigation.replace('PostConsultReview', { code: target.code });
  else (navigation as unknown as { replace: (n: string, p: object) => void }).replace('DoctorAppointment', { id: target.appointmentId ?? '' });
};
