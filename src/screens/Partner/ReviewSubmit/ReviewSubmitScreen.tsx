// ═══════════════════════════════════════════════════════
// MetroMatrix — Review and submit
// ═══════════════════════════════════════════════════════

import React, { useEffect } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import {
  BUSINESS_FORM_SCHEMA,
  DOCUMENT_LABELS,
  SERVICE_LABELS,
  SUBTYPE_LABELS,
  missingDocuments,
} from '@models/businessModel';
import { formatPkPhoneForDisplay } from '@utils/phone';
import { haptics } from '@utils/haptics';
import { ServiceScope } from '@theme/index';
import { AppText, Button, Card, Divider, InlineNotice, ListRow, ScreenShell, StatusPill } from '@custom/index';
import type { RootStackParamList } from '@/types';
import { selectBusiness } from '../../Auth/authSlice';
import { clearSubmitError, selectReviewSubmit, submitAsync } from './reviewSubmitSlice';

type Props = NativeStackScreenProps<RootStackParamList, 'ReviewSubmit'>;

const ReviewSubmitScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const business = useAppSelector(selectBusiness);
  const s = useAppSelector(selectReviewSubmit);

  useEffect(
    () => () => {
      dispatch(clearSubmitError());
    },
    [dispatch],
  );

  if (!business) return null;
  const schema = BUSINESS_FORM_SCHEMA[business.subType];
  const required = business.requiredDocuments;
  const missing = missingDocuments(business.subType, business.documents);
  const byKind = new Map(business.documents.map(d => [d.kind, d]));

  const submit = async () => {
    const result = await dispatch(submitAsync());
    if (submitAsync.fulfilled.match(result)) {
      haptics.success();
      return;
    }
    haptics.warning();
    const payload = result.payload as { code?: string; details?: { missing?: string[] } } | undefined;
    if (payload?.code === 'DOCUMENTS_MISSING') {
      navigation.navigate('Documents', {
        highlight: (payload.details?.missing ?? missing) as typeof missing,
      });
    }
  };

  const missingNames = (s.missing.length ? s.missing : missing).map(k => DOCUMENT_LABELS[k].label);

  return (
    <ServiceScope service={business.serviceType}>
      <ScreenShell
        eyebrow={`${SERVICE_LABELS[business.serviceType].title} · ${SUBTYPE_LABELS[business.subType].title}`}
        title="Review and submit"
        subtitle="Our team reviews applications within one working day."
        onBack={navigation.canGoBack() ? () => navigation.goBack() : () => navigation.navigate('Documents')}
        footer={
          <Button label="Submit for review" onPress={submit} loading={s.status === 'loading'} fullWidth size="lg" />
        }>
        {s.error.message ? (
          <InlineNotice
            tone="error"
            title={s.error.code === 'DOCUMENTS_MISSING' ? 'Documents missing' : "Couldn't submit"}
            message={
              s.error.code === 'DOCUMENTS_MISSING' ? `Add ${missingNames.join(', ')} first.` : s.error.message
            }
          />
        ) : missing.length ? (
          <InlineNotice tone="warning" message={`Still needed: ${missingNames.join(', ')}.`} />
        ) : null}

        <Card>
          <AppText variant="micro" tone="muted">
            Business
          </AppText>
          <AppText variant="display">{business.name || 'Unnamed business'}</AppText>
          <AppText variant="body" tone="muted">
            {[business.address, business.city].filter(Boolean).join(', ')}
          </AppText>
          <AppText variant="body">{formatPkPhoneForDisplay(business.phone)}</AppText>
          {schema.details.map(field =>
            business.details[field.key] ? (
              <AppText key={field.key} variant="small" tone="muted">
                {field.label}: {business.details[field.key]}
              </AppText>
            ) : null,
          )}
          <Button label="Edit details" variant="ghost" size="sm" onPress={() => navigation.navigate('BusinessProfile')} />
        </Card>

        <Card padded="horizontal">
          {required.map((kind, i) => {
            const doc = byKind.get(kind);
            const ok = doc && doc.status !== 'rejected';
            return (
              <React.Fragment key={kind}>
                {i > 0 ? <Divider /> : null}
                <ListRow
                  title={DOCUMENT_LABELS[kind].label}
                  right={<StatusPill label={ok ? 'Added' : 'Missing'} tone={ok ? 'success' : 'danger'} />}
                  chevron={false}
                />
              </React.Fragment>
            );
          })}
        </Card>
        <Button label="Edit documents" variant="ghost" size="sm" onPress={() => navigation.navigate('Documents')} />
      </ScreenShell>
    </ServiceScope>
  );
};

export default ReviewSubmitScreen;
