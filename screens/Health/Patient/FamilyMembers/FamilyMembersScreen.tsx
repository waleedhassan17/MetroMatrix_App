// ═══════════════════════════════════════════════════════
// MetroMatrix — Family members
// ═══════════════════════════════════════════════════════
// The people you book for: their name on the appointment and the doctor's
// queue, their own records. Add, edit, or remove one with no visit coming.

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import { useBack } from '../../../../hooks/useBack';
import { ServiceScope, useStyles, type Theme } from '../../../../theme/index';
import { Avatar, Button, Card, Divider, EmptyState, IconButton, InlineNotice, ListRow, ScreenShell, SkeletonLines } from '../../../../Custom-Components/index';
import { relationLabel } from '../../../../models/health/familyMemberModel';
import type { AccountStackParamList } from '../../../../types';
import { Alert } from '../../../../utils/alert';
import { ageFrom } from '../../../../utils/healthTime';
import { loadFamilyAsync, removeFamilyMemberAsync, selectFamily } from './familySlice';

type Props = NativeStackScreenProps<AccountStackParamList, 'FamilyMembers'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: space.s4 }, grow: { flex: 1 } });

const FamilyMembersScreen: React.FC<Props> = props => (
  <ServiceScope service="healthcare">
    <FamilyMembersContent {...props} />
  </ServiceScope>
);

const FamilyMembersContent: React.FC<Props> = ({ navigation }) => {
  const { back, canGoBack } = useBack({ name: 'HealthTabs', params: { screen: 'HealthProfileTab' } });
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const s = useAppSelector(selectFamily);

  useFocusEffect(
    useCallback(() => {
      void dispatch(loadFamilyAsync());
    }, [dispatch]),
  );

  const remove = (id: string, name: string) =>
    Alert.alert(`Remove ${name}?`, 'Their records stay in Health records under your account.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void dispatch(removeFamilyMemberAsync(id)) },
    ]);

  return (
    <ScreenShell
      title="Family members"
      subtitle="Book visits and keep records for them"
      onBack={canGoBack ? back : undefined}
      footer={<Button label="Add family member" leftIcon="person-add-outline" onPress={() => navigation.navigate('FamilyMemberForm', undefined)} fullWidth />}
      refreshing={s.status === 'loading' && s.members.length > 0}
      onRefresh={() => void dispatch(loadFamilyAsync())}>
      {s.error.message ? <InlineNotice message={s.error.message} /> : null}
      {s.status === 'loading' && !s.members.length ? (
        <SkeletonLines lines={4} />
      ) : s.members.length ? (
        <Card padded="horizontal">
          {s.members.map((m, i) => {
            const age = ageFrom(m.dateOfBirth);
            return (
              <View key={m.id}>
                {i > 0 ? <Divider /> : null}
                {/* Remove sits beside the row, not inside it: a button can't hold a button. */}
                <View style={styles.row}>
                  <View style={styles.grow}>
                    <ListRow
                      title={m.name}
                      subtitle={[relationLabel(m.relation), age !== null ? `${age} years` : null].filter(Boolean).join(' · ')}
                      left={<Avatar name={m.name} size="sm" />}
                      onPress={() => navigation.navigate('FamilyMemberForm', { id: m.id })}
                    />
                  </View>
                  <IconButton icon="trash-outline" tone="muted" onPress={() => remove(m.id, m.name)} accessibilityLabel={`Remove ${m.name}`} disabled={s.removing === m.id} />
                </View>
              </View>
            );
          })}
        </Card>
      ) : (
        <EmptyState icon="users" title="No family members yet" body="Add your spouse, children or parents to book their visits and keep their records in one place." />
      )}
    </ScreenShell>
  );
};

export default FamilyMembersScreen;
