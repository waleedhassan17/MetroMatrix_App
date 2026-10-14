// ═══════════════════════════════════════════════════════
// MetroMatrix — Changes needed (application rejected)
// ═══════════════════════════════════════════════════════
// The reviewer's reason and per-document notes, then "Edit and resubmit",
// which walks back through details → documents → submit (QA 19).
// Stateless: everything shown is the business in the auth slice.

import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppSelector } from '@hooks/useReduxHooks';
import { useSignOut } from '@hooks/useSignOut';
import { DOCUMENT_LABELS } from '@models/businessModel';
import { ServiceScope } from '@theme/index';
import { AppText, Button, Card, Divider, InlineNotice, ListRow, ScreenShell } from '@custom/index';
import type { RootStackParamList } from '@/types';
import { selectBusiness } from '../../Auth/authSlice';

type Props = NativeStackScreenProps<RootStackParamList, 'Rejected'>;

const RejectedScreen: React.FC<Props> = ({ navigation }) => {
  const business = useAppSelector(selectBusiness);
  const { confirmSignOut } = useSignOut();
  if (!business) return null;
  const notes = business.documents.filter(d => d.status === 'rejected' || d.reviewerNote);

  return (
    <ServiceScope service={business.serviceType}>
      <ScreenShell
        title="Changes needed"
        subtitle="Your application wasn't approved yet. Fix the items below and send it again."
        footer={
          <>
            <Button
              label="Edit and resubmit"
              onPress={() => navigation.navigate('BusinessProfile')}
              fullWidth
              size="lg"
            />
            <Button label="Sign out" variant="ghost" onPress={confirmSignOut} />
          </>
        }>
        <InlineNotice
          tone="error"
          title="Reviewer's reason"
          message={business.rejectionReason ?? 'No reason was given. Contact support if you are unsure what to change.'}
        />
        {notes.length ? (
          <Card padded="horizontal">
            {notes.map((doc, i) => (
              <React.Fragment key={doc.id || doc.kind}>
                {i > 0 ? <Divider /> : null}
                <ListRow
                  title={DOCUMENT_LABELS[doc.kind].label}
                  subtitle={doc.reviewerNote ?? 'Upload a new copy.'}
                  leftIcon="alert-circle"
                  chevron={false}
                />
              </React.Fragment>
            ))}
          </Card>
        ) : null}
        <AppText variant="small" tone="muted">
          Your details and documents are kept. Change only what the reviewer asked for.
        </AppText>
      </ScreenShell>
    </ServiceScope>
  );
};

export default RejectedScreen;
