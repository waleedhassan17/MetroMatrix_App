// MetroMatrix — the three services on the customer home (the FYP's cards,
// with the Food Court in Home Services' place). Photo sources and licences:
// assets/images/services/CREDITS.md.

import type { ServiceCardData } from './ServiceCard';

export const SERVICE_CARDS: ServiceCardData[] = [
  {
    service: 'food',
    title: 'Food Court',
    category: 'FOOD COURT',
    description: 'Fast-food brands, restaurants and home kitchens from your city.',
    live: true,
    cta: 'Explore',
    image: require('../../../assets/images/services/food.jpg'),
    glyph: 'silverware-fork-knife',
  },
  {
    service: 'healthcare',
    title: 'Digital Health',
    category: 'MEDICAL',
    description: 'Connect with certified doctors and manage health records seamlessly.',
    live: false,
    cta: 'Explore',
    image: require('../../../assets/images/services/healthcare.jpg'),
    glyph: 'stethoscope',
  },
  {
    service: 'shopping',
    title: 'Smart Shopping',
    category: 'RETAIL',
    description: 'Explore the latest trends and everyday essentials delivered to your doorstep.',
    live: true,
    cta: 'Explore',
    image: require('../../../assets/images/services/shopping.jpg'),
    glyph: 'shopping-outline',
  },
];
