// The Shopping home's bundled category photos, by the API's top-level
// category slug. Free under the Unsplash License; each photo's page and
// photographer are in assets/images/shopping/CREDITS.md. A category with no
// photo here shows its icon instead.

import type { ImageSourcePropType } from 'react-native';

export const CATEGORY_PHOTOS: Record<string, ImageSourcePropType> = {
  women: require('../../assets/images/shopping/women.jpg'),
  men: require('../../assets/images/shopping/men.jpg'),
  kids: require('../../assets/images/shopping/kids.jpg'),
  'beauty-care': require('../../assets/images/shopping/beauty.jpg'),
  'home-living': require('../../assets/images/shopping/home.jpg'),
  accessories: require('../../assets/images/shopping/accessories.jpg'),
  handmade: require('../../assets/images/shopping/handmade.jpg'),
  'electronics-accessories': require('../../assets/images/shopping/electronics.jpg'),
  grocery: require('../../assets/images/shopping/grocery.jpg'),
};
