// MetroMatrix — A store's policies in plain words (store page, product page).

import type { StorePolicies } from '../shopping';
import { formatPKR } from '../../utils/money/money';
import type { IonName } from '../../Custom-Components/Icon';

export interface PolicyLine {
  icon: IonName;
  text: string;
}

export const deliveryAreaText = (p: Pick<StorePolicies, 'nationwide' | 'deliveryCities'>): string => {
  if (p.nationwide) return 'Delivers anywhere in Pakistan';
  const cities = p.deliveryCities;
  if (!cities.length) return 'Delivery area not set';
  if (cities.length <= 3) return `Delivers to ${cities.join(', ')}`;
  return `Delivers to ${cities.slice(0, 2).join(', ')} and ${cities.length - 2} more cities`;
};

export const shippingText = (p: Pick<StorePolicies, 'shippingFee' | 'freeShippingOver'>): string => {
  const fee = p.shippingFee === 0 ? 'Free delivery' : `${formatPKR(p.shippingFee)} delivery`;
  return p.freeShippingOver && p.shippingFee > 0 ? `${fee}, free over ${formatPKR(p.freeShippingOver)}` : fee;
};

export const dispatchText = (p: Pick<StorePolicies, 'dispatchMinDays' | 'dispatchMaxDays'>): string =>
  p.dispatchMaxDays <= 1
    ? 'Ships within a day'
    : p.dispatchMinDays === p.dispatchMaxDays
      ? `Ships in ${p.dispatchMaxDays} days`
      : `Ships in ${p.dispatchMinDays}–${p.dispatchMaxDays} days`;

export const returnsText = (days: number): string => (days > 0 ? `${days}-day returns` : 'No returns');

export const paymentText = (p: Pick<StorePolicies, 'codEnabled' | 'codLimit' | 'paymentMethods'>): string => {
  const transfer = p.paymentMethods.includes('transfer');
  if (!p.codEnabled) return 'Pay by bank or wallet transfer';
  const cod = p.codLimit ? `Cash on delivery up to ${formatPKR(p.codLimit)}` : 'Cash on delivery';
  return transfer ? `${cod}, or transfer` : cod;
};

export const policyLines = (p: StorePolicies): PolicyLine[] => [
  { icon: 'location-outline', text: deliveryAreaText(p) },
  { icon: 'car-outline', text: shippingText(p) },
  { icon: 'time-outline', text: dispatchText(p) },
  { icon: 'return-down-back-outline', text: returnsText(p.returnWindowDays) },
  { icon: 'wallet-outline', text: paymentText(p) },
];

/** wa.me wants the number without + or spaces. */
export const whatsappUrl = (phone: string, text?: string) =>
  `https://wa.me/${phone.replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
