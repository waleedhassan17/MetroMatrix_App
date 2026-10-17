// MetroMatrix — Dummy Food photos (stand-ins for vendors' own uploads).

/**
 * Food photos from Unsplash (free under the Unsplash License; listed with
 * their photographers in docs/MOCK_IMAGES.md). They stand in for the photos a
 * vendor uploads; cdn() asks Unsplash for the size each screen needs.
 */
export const FOOD_IMG = {
  biryani: 'https://images.unsplash.com/photo-1559528896-c5310744cce8',
  kebab: 'https://images.unsplash.com/photo-1626323109697-df55d20f06a8',
  kebabGrill: 'https://images.unsplash.com/photo-1626323109252-0adb3b46692b',
  curry: 'https://images.unsplash.com/photo-1772730065344-4cf131b39951',
  tikka: 'https://images.unsplash.com/photo-1773419808002-bab9e1f840a0',
  burger: 'https://images.unsplash.com/photo-1703219338500-90f646e60c1b',
  pizza: 'https://images.unsplash.com/photo-1707274244494-adf0852ade21',
  thali: 'https://images.unsplash.com/photo-1588644525273-f37b60d78512',
  shawarma: 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783',
  noodles: 'https://images.unsplash.com/flagged/photo-1556742524-750f2ab99913',
  fries: 'https://images.unsplash.com/photo-1634674599370-bec0babedb8a',
  friesTray: 'https://images.unsplash.com/photo-1647705195905-671a25be159d',
  chai: 'https://images.unsplash.com/photo-1579005162638-11c872e1586e',
  salad: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd',
  cake: 'https://images.unsplash.com/photo-1505253599537-305b179737ce',
} as const;
