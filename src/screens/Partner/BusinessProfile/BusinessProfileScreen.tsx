// ═══════════════════════════════════════════════════════
// MetroMatrix — Business details
// ═══════════════════════════════════════════════════════
// The sub-type decides the fields (businessModel.BUSINESS_FORM_SCHEMA): a
// home kitchen asks for cuisine and daily capacity, a doctor for specialty
// and PMDC number. "Use my location" pins the map point (optional).

import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '@hooks/useReduxHooks';
import { hasErrors } from '@models/authModel';
import {
  BUSINESS_FORM_SCHEMA,
  CITIES,
  SUBTYPE_LABELS,
  SUBTYPE_SERVICE,
  validateBusinessProfile,
  type DetailFieldSpec,
} from '@models/businessModel';
import { visibleErrors } from '@utils/formErrors';
import { haptics } from '@utils/haptics';
import { ServiceScope, useStyles, type Theme } from '@theme/index';
import {
  AppText,
  BottomSheetPicker,
  Button,
  Card,
  InlineNotice,
  PickerField,
  ScreenShell,
  TextField,
} from '@custom/index';
import type { RootStackParamList } from '@/types';
import { selectBusiness } from '../../Auth/authSlice';
import {
  clearLocation,
  initialise,
  locateAsync,
  markSubmitted,
  openPicker,
  saveDraftAsync,
  selectBusinessProfile,
  setCoreField,
  setDetail,
  touch,
} from './businessProfileSlice';

type Props = NativeStackScreenProps<RootStackParamList, 'BusinessProfile'>;

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: space.s8, flexWrap: 'wrap' },
  });

const BusinessProfileScreen: React.FC<Props> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  const styles = useStyles(makeStyles);
  const business = useAppSelector(selectBusiness);
  const s = useAppSelector(selectBusinessProfile);
  const phoneRef = useRef<TextInput>(null);
  const addressRef = useRef<TextInput>(null);

  // Sub-type: an explicit choice from ServiceSelect wins; else the draft's.
  const subType = route.params?.subType ?? business?.subType ?? 'store';
  const serviceType = route.params?.serviceType ?? SUBTYPE_SERVICE[subType];
  const schema = BUSINESS_FORM_SCHEMA[subType];

  useEffect(() => {
    dispatch(initialise({ business, serviceType, subType }));
  }, [dispatch, business, serviceType, subType]);

  const errors = validateBusinessProfile(subType, s.form);
  const shown = visibleErrors(errors, s.touched, s.submitted);
  const saving = s.status === 'loading';

  const save = async () => {
    dispatch(markSubmitted());
    if (hasErrors(errors) || saving) return;
    const result = await dispatch(saveDraftAsync({ business, serviceType, subType, form: s.form }));
    if (saveDraftAsync.fulfilled.match(result)) {
      haptics.success();
      navigation.navigate('Documents');
    } else haptics.warning();
  };

  const pickerSpec: DetailFieldSpec | null =
    s.picker && s.picker !== 'city' ? schema.details.find(d => d.key === s.picker) ?? null : null;

  return (
    <ServiceScope service={serviceType}>
      <ScreenShell
        eyebrow={`Step 2 of 3 · ${SUBTYPE_LABELS[subType].title}`}
        title="Business details"
        subtitle="Customers see these once you're approved."
        onBack={navigation.canGoBack() ? () => navigation.goBack() : () => navigation.navigate('ServiceSelect')}
        footer={<Button label="Save and continue" onPress={save} loading={saving} fullWidth size="lg" />}>
        {s.error.message ? (
          <InlineNotice tone={s.locateStatus === 'failed' ? 'info' : 'error'} message={s.error.message} />
        ) : null}
        {s.submitted && hasErrors(errors) ? (
          <InlineNotice tone="error" message="Some details are missing. Check the highlighted fields." />
        ) : null}

        <Card>
          <TextField
            label={schema.nameLabel}
            value={s.form.name}
            onChangeText={value => dispatch(setCoreField({ field: 'name', value }))}
            onBlur={() => dispatch(touch('name'))}
            error={shown.name}
            placeholder={schema.namePlaceholder}
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => phoneRef.current?.focus()}
            submitBehavior="submit"
          />
          <TextField
            ref={phoneRef}
            label="Business phone"
            mode="phone"
            value={s.form.phone}
            onChangeText={value => dispatch(setCoreField({ field: 'phone', value }))}
            onBlur={() => dispatch(touch('phone'))}
            error={shown.phone}
            placeholder="42 35761234"
            helper="Mobile or landline."
            returnKeyType="next"
            onSubmitEditing={() => addressRef.current?.focus()}
            submitBehavior="submit"
          />
        </Card>

        <Card>
          <PickerField
            label="City"
            valueLabel={s.form.city || null}
            placeholder="Choose a city"
            onPress={() => dispatch(openPicker('city'))}
            error={shown.city}
          />
          <TextField
            ref={addressRef}
            label={schema.addressLabel}
            value={s.form.address}
            onChangeText={value => dispatch(setCoreField({ field: 'address', value }))}
            onBlur={() => dispatch(touch('address'))}
            error={shown.address}
            helper={schema.addressHelper}
            placeholder="Street, block and area"
            multiline
          />
          <View style={styles.locationRow}>
            <Button
              label={s.form.location ? 'Update map pin' : 'Use my location'}
              leftIcon="map-pin"
              variant="secondary"
              size="sm"
              onPress={() => dispatch(locateAsync())}
              loading={s.locateStatus === 'loading'}
            />
            {s.form.location ? (
              <>
                <AppText variant="small" tone="muted">
                  Pinned {s.form.location.lat.toFixed(4)}, {s.form.location.lng.toFixed(4)}
                </AppText>
                <Button label="Remove" variant="ghost" size="sm" onPress={() => dispatch(clearLocation())} />
              </>
            ) : (
              <AppText variant="small" tone="muted">
                Optional
              </AppText>
            )}
          </View>
        </Card>

        {schema.details.length ? (
          <Card>
            {schema.details.map(field =>
              field.kind === 'picker' ? (
                <PickerField
                  key={field.key}
                  label={field.label}
                  valueLabel={s.form.details[field.key] || null}
                  placeholder={field.placeholder}
                  onPress={() => dispatch(openPicker(field.key))}
                  error={shown[field.key]}
                />
              ) : (
                <TextField
                  key={field.key}
                  label={field.label}
                  mode={field.kind === 'number' ? 'numeric' : 'text'}
                  value={s.form.details[field.key] ?? ''}
                  onChangeText={value => dispatch(setDetail({ key: field.key, value }))}
                  onBlur={() => dispatch(touch(field.key))}
                  error={shown[field.key]}
                  helper={field.helper}
                  placeholder={field.placeholder}
                  autoCapitalize="characters"
                />
              ),
            )}
          </Card>
        ) : null}

        <BottomSheetPicker
          visible={s.picker === 'city'}
          onClose={() => dispatch(openPicker(null))}
          title="Choose a city"
          options={CITIES}
          value={s.form.city || null}
          onSelect={value => {
            dispatch(setCoreField({ field: 'city', value }));
            dispatch(touch('city'));
          }}
        />
        <BottomSheetPicker
          visible={!!pickerSpec}
          onClose={() => dispatch(openPicker(null))}
          title={pickerSpec?.label ?? ''}
          options={pickerSpec?.options ?? []}
          value={pickerSpec ? s.form.details[pickerSpec.key] ?? null : null}
          onSelect={value => {
            if (!pickerSpec) return;
            dispatch(setDetail({ key: pickerSpec.key, value }));
            dispatch(touch(pickerSpec.key));
          }}
        />
      </ScreenShell>
    </ServiceScope>
  );
};

export default BusinessProfileScreen;
