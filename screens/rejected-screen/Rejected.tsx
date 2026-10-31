// ═══════════════════════════════════════════════════════
// MetroMatrix — Changes needed (application rejected)
// ═══════════════════════════════════════════════════════
// The reviewer's reason and per-document notes, then "Edit and resubmit",
// which reopens Personal Info at the step that needs work.
// Stateless: everything shown is the business in the auth slice.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppSelector } from '../../hooks/useReduxHooks';
import { useSignOut } from '../../hooks/useSignOut';
import { DOCUMENT_LABELS, providerTypeLabel } from '../../models/businessModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '../../theme/index';
import { AppText, Button, IonIcon, InlineNotice } from '../../Custom-Components/index';
import { AuthHeader, AuthScreen, ProviderBadge } from '../../Components/auth/AuthChrome';
import type { RootStackParamList } from '../../models';
import { selectBusiness } from '../../store/authSlice';

type Props = NativeStackScreenProps<RootStackParamList, 'Rejected'>;

const makeStyles = ({ colors, space, size, radius }: Theme) =>
  StyleSheet.create({
    mark: {
      alignSelf: 'center',
      width: size.avatar.xl,
      height: size.avatar.xl,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.dangerSoft,
    },
    card: {
      gap: space.s12,
      padding: space.s16,
      borderRadius: radius.md,
      borderWidth: size.hairline,
      borderColor: colors.line,
    },
    row: { flexDirection: 'row', gap: space.s12 },
    rowText: { flex: 1, gap: space.s4 },
  });

const Rejected: React.FC<Props> = ({ navigation }) => {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const business = useAppSelector(selectBusiness);
  const { confirmSignOut } = useSignOut();
  if (!business) return null;
  const notes = business.documents.filter(d => d.status === 'rejected' || d.reviewerNote);
  const rejectedKinds = business.documents.filter(d => d.status === 'rejected').map(d => d.kind);

  return (
    <ServiceScope service={business.serviceType}>
      <AuthScreen>
        <View style={styles.mark}>
          <IonIcon name="document-text-outline" size="xl" color={colors.danger} />
        </View>
        <AuthHeader
          hideLogo
          title="Changes needed"
          badge={<ProviderBadge label={providerTypeLabel(business.subType)} service={business.serviceType} />}
          subtitle="Your application wasn't approved yet. Fix the items below and send it again."
        />
        <InlineNotice
          tone="error"
          title="Reviewer's reason"
          message={business.rejectionReason ?? 'No reason was given. Contact support if you are unsure what to change.'}
        />
        {notes.length ? (
          <View style={styles.card}>
            <AppText variant="title">Documents to replace</AppText>
            {notes.map(doc => (
              <View key={doc.id || doc.kind} style={styles.row}>
                <IonIcon name="alert-circle-outline" size="md" color={colors.danger} />
                <View style={styles.rowText}>
                  <AppText variant="bodyStrong">{DOCUMENT_LABELS[doc.kind].label}</AppText>
                  <AppText variant="small" tone="muted">
                    {doc.reviewerNote ?? 'Upload a new copy.'}
                  </AppText>
                </View>
              </View>
            ))}
          </View>
        ) : null}
        <AppText variant="small" tone="muted" align="center">
          Your details and documents are kept. Change only what the reviewer asked for.
        </AppText>
        <Button
          label="Edit and resubmit"
          onPress={() =>
            navigation.navigate('PersonalInfo', rejectedKinds.length ? { step: 3, highlight: rejectedKinds } : { step: 2 })
          }
          fullWidth
        />
        <Button label="Sign out" variant="ghost" onPress={confirmSignOut} />
      </AuthScreen>
    </ServiceScope>
  );
};

export default Rejected;
