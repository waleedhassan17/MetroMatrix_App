// MetroMatrix — A home kitchen's Menu and Riders, as pages pushed from More
// (Today · Orders · Kitchen · More leaves no room for them as tabs). The same
// screens as the tabs, with a back. Stateless: each reads its own slice.

import React from 'react';
import { useBack } from '../../hooks/useBack';
import VendorMenu from '../vendor-menu-screen/VendorMenu';
import VendorRiders from '../vendor-riders-screen/VendorRiders';

export const VendorMenuPageScreen: React.FC = () => {
  const { back } = useBack({ name: 'VendorTabs' });
  return <VendorMenu onBack={back} />;
};

export const VendorRidersPageScreen: React.FC = () => {
  const { back } = useBack({ name: 'VendorTabs' });
  return <VendorRiders onBack={back} />;
};
