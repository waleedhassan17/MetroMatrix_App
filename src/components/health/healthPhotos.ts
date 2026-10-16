// The Health home's bundled photos: the "How can we help you today?" cards
// and the service tiles. Free under the Unsplash License; each photo's page
// and photographer are in assets/images/health/CREDITS.md.

import type { ImageSourcePropType } from 'react-native';

export const HEALTH_PHOTOS = {
  video: require('../../../assets/images/health/video.jpg'),
  clinic: require('../../../assets/images/health/clinic.jpg'),
  available: require('../../../assets/images/health/available.jpg'),
  specialties: require('../../../assets/images/health/specialties.jpg'),
  records: require('../../../assets/images/health/records.jpg'),
  prescriptions: require('../../../assets/images/health/prescriptions.jpg'),
  family: require('../../../assets/images/health/family.jpg'),
  symptoms: require('../../../assets/images/health/symptoms.jpg'),
  emergency: require('../../../assets/images/health/emergency.jpg'),
} satisfies Record<string, ImageSourcePropType>;
