// ═══════════════════════════════════════════════════════
// MetroMatrix — A prescription
// ═══════════════════════════════════════════════════════
// The document as the doctor wrote it, Share as PDF (the same layout, for
// WhatsApp or a pharmacy), and Book follow-up when the doctor asked for one
// (the same doctor, the same place).

import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { useHealthNav } from '../../../../hooks/useHealth';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../../../theme/index';
import { AppText, Button, InlineNotice, PrescriptionSheet, ScreenShell, SkeletonLines } from '../../../../Custom-Components/index';
import type { AccountStackParamList } from '../../../../types';
import { addDays, dateInZone, formatDayShort, formatOn } from '../../../../utils/healthTime';
import { prescriptionHtml } from '../../../../utils/prescriptionHtml';
import { sharePrescriptionPdf } from '../../../../services/prescriptionPdf';
import { loadPrescriptionAsync, selectPrescriptionEntry } from './prescriptionViewSlice';

type Props = NativeStackScreenProps<AccountStackParamList, 'PrescriptionView'>;

const makeStyles = ({ space }: Theme) => StyleSheet.create({ actions: { gap: space.s12 } });

const PrescriptionViewScreen: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <PrescriptionViewContent {...props} />
  </ServiceScope>
);

const PrescriptionViewContent: React.FC<Props> = ({ route }) => {
  const { id } = route.params;
  const { back } = useBack({ name: 'PrescriptionList' });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const { colors, service } = useTheme();
  const nav = useHealthNav();
  const entry = useAppSelector(st => selectPrescriptionEntry(st, id));
  const p = entry.prescription;
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    void dispatch(loadPrescriptionAsync(id));
  }, [dispatch, id]);

  const share = async () => {
    if (!p) return;
    setSharing(true);
    try {
      const r = await sharePrescriptionPdf(prescriptionHtml(p, { ink: colors.ink, muted: colors.inkMuted, line: colors.line, accent: service.accentDeep }), `Prescription ${formatOn(p.issuedAt)}`);
      if (r === 'unavailable') Toast.show({ type: 'info', text1: 'Sharing isn’t available on this device' });
    } catch {
      Toast.show({ type: 'error', text1: 'The PDF wasn’t made', text2: 'Try again.' });
    } finally {
      setSharing(false);
    }
  };

  const followUpOn = p?.followUpInDays ? addDays(dateInZone(p.issuedAt, 'Asia/Karachi'), p.followUpInDays) : null;

  return (
    <ScreenShell
      title="Prescription"
      subtitle={p ? `${p.doctor.name} · ${formatOn(p.issuedAt)}` : undefined}
      onBack={back}
      footer={p ? <Button label="Share as PDF" leftIcon="share-outline" onPress={() => void share()} loading={sharing} fullWidth /> : undefined}>
      {entry.status === 'failed' ? <InlineNotice message={entry.error.message} action={{ label: 'Try again', onPress: () => void dispatch(loadPrescriptionAsync(id)) }} /> : null}
      {!p ? (
        entry.status === 'failed' ? null : <SkeletonLines lines={12} />
      ) : (
        <>
          <PrescriptionSheet prescription={p} />
          <View style={styles.actions}>
            {followUpOn ? (
              <>
                <AppText variant="body">{`The doctor asked to see you again around ${formatDayShort(followUpOn)}.`}</AppText>
                <Button
                  label="Book follow-up"
                  variant="secondary"
                  leftIcon="calendar-outline"
                  onPress={() => nav.openDoctor(p.doctorId, { locationId: p.locationId })}
                  fullWidth
                />
              </>
            ) : null}
            <AppText variant="small" tone="muted">
              Take medicines only as written. If you feel worse, or a medicine doesn’t agree with you, contact the doctor.
            </AppText>
          </View>
        </>
      )}
    </ScreenShell>
  );
};

export default PrescriptionViewScreen;
