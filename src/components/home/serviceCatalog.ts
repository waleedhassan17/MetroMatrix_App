// MetroMatrix — the three services on the customer home (the FYP's cards,
// with Food in Home Services' place). Photo sources and licences:
// assets/images/services/CREDITS.md.

import type { ServiceCardData } from './ServiceCard';

export const SERVICE_CARDS: ServiceCardData[] = [
  {
    service: 'food',
    title: 'Food Delivery',
    tagline: 'Burgers, pizza, karahi and more — hot at your door',
    category: 'FOOD',
    categoryIcon: 'silverware-fork-knife',
    description: 'Local fast-food brands, restaurants and home kitchens near you.',
    live: true,
    cta: 'Order now',
    highlights: [
      { icon: 'clock-fast', label: '25 min' },
      { icon: 'moped-outline', label: 'Live tracking' },
      { icon: 'tag-heart-outline', label: '0% commission' },
    ],
    image: require('../../../assets/images/services/food.jpg'),
    glyph: 'silverware-fork-knife',
  },
  {
    service: 'healthcare',
    title: 'Digital Health',
    tagline: 'Verified doctors, without the waiting room',
    category: 'MEDICAL',
    categoryIcon: 'stethoscope',
    description: 'Connect with certified doctors and manage health records seamlessly.',
    live: false,
    cta: 'Preview',
    highlights: [
      { icon: 'shield-check-outline', label: 'PMDC verified' },
      { icon: 'video-outline', label: 'Video consults' },
      { icon: 'file-document-outline', label: 'Records' },
    ],
    image: require('../../../assets/images/services/healthcare.jpg'),
    glyph: 'stethoscope',
  },
  {
    service: 'shopping',
    title: 'Smart Shopping',
    tagline: 'Every shop on your street, in one place',
    category: 'RETAIL',
    categoryIcon: 'shopping-outline',
    description: 'Explore the latest trends and everyday essentials delivered to your doorstep.',
    live: false,
    cta: 'Preview',
    highlights: [
      { icon: 'storefront-outline', label: 'Local stores' },
      { icon: 'truck-fast-outline', label: 'Same-day' },
      { icon: 'tag-heart-outline', label: '0% commission' },
    ],
    image: require('../../../assets/images/services/shopping.jpg'),
    glyph: 'shopping-outline',
  },
];
