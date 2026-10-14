// ═══════════════════════════════════════════════════════
// MetroMatrix — What do you run?
// ═══════════════════════════════════════════════════════
// Three large cards, each in its service's accent. Food expands to
// Restaurant / Home kitchen / Cloud kitchen.

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { useSignOut } from '@hooks/useSignOut';
import { SERVICE_LABELS, SERVICE_SUBTYPES, SUBTYPE_LABELS } from '@models/businessModel';
import { ServiceScope, useStyles, useTheme, type Theme } from '@theme/index';
import { AppText, Button, Card, Icon, ScreenShell, type IconName } from '@custom/index';
import type { RootStackParamList, ServiceType } from '@/types';
import { selectBusiness } from '../../Auth/authSlice';
import { chooseService, chooseSubType, preselect, selectServiceSelect } from './serviceSelectSlice';

type Props = NativeStackScreenProps<RootStackParamList, 'ServiceSelect'>;

const SERVICES: { key: ServiceType; icon: IconName }[] = [
  { key: 'shopping', icon: 'shopping-bag' },
  { key: 'healthcare', icon: 'heart' },
  { key: 'food', icon: 'coffee' },
];

const makeStyles = ({ space, size, radius }: Theme) =>
  StyleSheet.create({
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s16 },
    badge: { width: size.avatar.md, height: size.avatar.md, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
    text: { flex: 1, gap: space.s4 },
    subs: { gap: space.s8 },
    sub: { flexDirection: 'row', alignItems: 'center', gap: space.s12, padding: space.s12, borderRadius: radius.md, borderWidth: size.border },
  });

const ServiceCard: React.FC<{
  service: ServiceType;
  icon: IconName;
  selected: boolean;
  subType: string | null;
  onSelect: () => void;
  onSelectSub: (sub: (typeof SERVICE_SUBTYPES)[ServiceType][number]) => void;
}> = ({ service, icon, selected, subType, onSelect, onSelectSub }) => {
  const styles = useStyles(makeStyles);
  const { service: accent, colors } = useTheme();
  const subs = SERVICE_SUBTYPES[service];
  return (
    <Card selected={selected} onPress={onSelect} accessibilityLabel={SERVICE_LABELS[service].partnerTitle}>
      <View style={styles.head}>
        <View style={[styles.badge, { backgroundColor: accent.accentSoft }]}>
          <Icon name={icon} size="lg" color={accent.accentDeep} />
        </View>
        <View style={styles.text}>
          <AppText variant="title">{SERVICE_LABELS[service].partnerTitle}</AppText>
          <AppText variant="small" tone="muted">
            {SERVICE_LABELS[service].description}
          </AppText>
        </View>
        <Icon name={selected ? 'check-circle' : 'circle'} size="lg" color={selected ? accent.accent : colors.lineStrong} />
      </View>
      {selected && subs.length > 1 ? (
        <View style={styles.subs} accessibilityRole="radiogroup">
          {subs.map(sub => {
            const on = sub === subType;
            return (
              <Pressable
                key={sub}
                onPress={() => onSelectSub(sub)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={SUBTYPE_LABELS[sub].title}
                style={[
                  styles.sub,
                  { borderColor: on ? accent.accent : colors.line, backgroundColor: on ? accent.accentSoft : colors.surface },
                ]}>
                <View style={styles.text}>
                  <AppText variant="bodyStrong" tone={on ? 'accentDeep' : 'ink'}>
                    {SUBTYPE_LABELS[sub].title}
                  </AppText>
                  <AppText variant="small" tone="muted">
                    {SUBTYPE_LABELS[sub].description}
                  </AppText>
                </View>
                {on ? <Icon name="check" size="md" color={accent.accentDeep} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </Card>
  );
};

const ServiceSelectScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const business = useAppSelector(selectBusiness);
  const { serviceType, subType } = useAppSelector(selectServiceSelect);
  const { confirmSignOut } = useSignOut();

  // Changing a saved draft: start from what it is now.
  useEffect(() => {
    if (business) dispatch(preselect({ serviceType: business.serviceType, subType: business.subType }));
  }, [business, dispatch]);

  return (
    <ScreenShell
      eyebrow="Step 1 of 3"
      title="What do you run?"
      subtitle="Choose the service your business offers on MetroMatrix."
      onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
      headerRight={<Button label="Sign out" variant="ghost" size="sm" onPress={confirmSignOut} />}
      footer={
        <ServiceScope service={serviceType ?? 'neutral'}>
          <Button
            label="Continue"
            onPress={() =>
              serviceType && subType && navigation.navigate('BusinessProfile', { serviceType, subType })
            }
            disabled={!serviceType || !subType}
            fullWidth
            size="lg"
          />
        </ServiceScope>
      }>
      {SERVICES.map(({ key, icon }) => (
        <ServiceScope key={key} service={key}>
          <ServiceCard
            service={key}
            icon={icon}
            selected={serviceType === key}
            subType={subType}
            onSelect={() => dispatch(chooseService(key))}
            onSelectSub={sub => dispatch(chooseSubType(sub))}
          />
        </ServiceScope>
      ))}
    </ScreenShell>
  );
};

export default ServiceSelectScreen;
