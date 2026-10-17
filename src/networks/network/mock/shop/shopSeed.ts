// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy shop seed
// ═══════════════════════════════════════════════════════
// Three fictional stores (any likeness to a real brand is accidental), a
// category tree, ~55 products with size × colour variants, reviews, coupons,
// banners and orders in every state — enough for every Shopping QA row.
// Photos: free Unsplash License images, credited in docs/MOCK_IMAGES.md.

import type {
  MockAddress,
  MockBanner,
  MockCategory,
  MockCollection,
  MockCoupon,
  MockGroup,
  MockNotification,
  MockOrder,
  MockOrderItem,
  MockProduct,
  MockReturn,
  MockReview,
  MockShop,
  MockStore,
} from './shopTypes';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const ahead = (ms: number) => new Date(Date.now() + ms).toISOString();

/** A free Unsplash photo by id; utils/cdn adds the size at render time. */
export const unsplash = (id: string) => `https://images.unsplash.com/photo-${id}`;

const IMG = {
  W1: '1733470381571-c3d082e68457',
  W2: '1707576618343-26a1b377ca7a',
  W3: '1705920824583-0e783235394d',
  W4: '1733731402869-57e0cce24aea',
  W5: '1733470381591-c5dfb9df3c3d',
  W6: '1701252072712-e939599623f2',
  W7: '1667665970124-2273c6ef3489',
  W8: '1655288828238-21d86ec971c3',
  W9: '1597983073540-684a10b15ab1',
  W10: '1704119142483-1269733bcedb',
  B1: '1598532163257-ae3c6b2524b6',
  B2: '1584917865442-de89df76afd3',
  B3: '1614179689702-355944cd0918',
  B4: '1600857062241-98e5dba7f214',
  B5: '1590874103328-eac38a683ce7',
  B6: '1566150905458-1bf1fc113f0d',
  B7: '1559563458-527698bf5295',
  B8: '1591561954557-26941169b49e',
  M1: '1770359993283-a2c2f386584e',
  M2: '1785613590746-f57d638c7d38',
  M3: '1727835523545-70ee992b5763',
  M4: '1734418040900-e964f84e8abb',
  M5: '1710624125523-3420db282dfe',
  M6: '1624970415682-3f99fae61a94',
  T1: '1581655353564-df123a1eb820',
  T2: '1583743814966-8936f5b7be1a',
  T3: '1618354691373-d851c5c3a990',
  T4: '1562157873-818bc0726f68',
  T5: '1620799140408-edc6dcb6d633',
  J1: '1602293589930-45aad59ba3ab',
  J3: '1624378439575-d8705ad7ae80',
  J4: '1714143136372-ddaf8b606da7',
  S3: '1525966222134-fcfa99b8ae77',
  S5: '1560769629-975ec94e6a86',
  X2: '1524805444758-089113d48a6d',
  X3: '1622434641406-a158123450f9',
  X4: '1609587312208-cea54be969e7',
  H1: '1505740420928-5e560c06d30e',
  H2: '1618366712010-f4ae9c647dcb',
  H3: '1583394838336-acd977736f90',
  H4: '1613040809024-b4ef7ba99bc3',
  H5: '1484704849700-f032a568e944',
  H6: '1609081219090-a6d81d3085bf',
  E1: '1606220588913-b3aacb4d2f46',
  E2: '1606220945770-b5b6c2c55bf1',
  E3: '1578319439584-104c94d37305',
  P1: '1535157412991-2ef801c1748b',
  P2: '1623393884989-cb3663e431c5',
  P3: '1620786963525-4a74f1697a46',
  PB1: '1566554738544-d962991c3fee',
  PB2: '1706275399494-fb26bbc5da63',
  SW1: '1461141346587-763ab02bced9',
} as const;

const img = (k: keyof typeof IMG) => ({ url: unsplash(IMG[k]), publicId: `mock/${k}` });

// ─── Stores ───────────────────────────────────────────
const stores: MockStore[] = [
  {
    id: 's_lawn',
    slug: 'lawn-and-loom-7a1f3',
    ownerId: 'u_store',
    name: 'Lawn & Loom',
    tagline: 'Hand-finished eastern wear from Lahore',
    about:
      'Lawn & Loom started in a two-room studio in Gulberg. Every kurta is cut in-house, embroidered by artisans we know by name, and checked twice before it ships.',
    logoUrl: null,
    coverUrl: unsplash(IMG.W1),
    brandColor: '#7A1F3D',
    onBrandColor: '#FFFFFF',
    city: 'Lahore',
    socials: { instagram: '@lawnandloom', facebook: null, tiktok: null, website: null },
    phone: '+924235761234',
    whatsapp: '+923001112233',
    isFeatured: true,
    isPaused: false,
    pauseMessage: null,
    settings: {
      shippingFee: 250,
      freeShippingOver: 6000,
      nationwide: true,
      deliveryCities: [],
      dispatchMinDays: 2,
      dispatchMaxDays: 4,
      returnWindowDays: 7,
      codEnabled: true,
      codLimit: 15000,
    },
    paymentAccounts: [
      { id: 'pa_lawn_raast', kind: 'raast', title: 'Lawn and Loom', number: '03001112233', bankName: null, isActive: true },
      {
        id: 'pa_lawn_bank',
        kind: 'bank',
        title: 'LAWN AND LOOM PVT LTD',
        number: 'PK36SCBL0000001123456702',
        bankName: 'Standard Chartered',
        isActive: true,
      },
    ],
    createdAt: ago(120 * DAY),
  },
  {
    id: 's_urban',
    slug: 'urban-thread-1c9e2',
    ownerId: 'u_urban',
    name: 'Urban Thread',
    tagline: 'Menswear basics, done properly',
    about: 'Kurtas for the week, tees for the weekend and denim that lasts. Designed in Karachi.',
    logoUrl: null,
    coverUrl: unsplash(IMG.M4),
    brandColor: '#111827',
    onBrandColor: '#FFFFFF',
    city: 'Karachi',
    socials: { instagram: '@urbanthread.pk', facebook: null, tiktok: '@urbanthread', website: null },
    phone: '+922134567890',
    whatsapp: '+923211234567',
    isFeatured: true,
    isPaused: false,
    pauseMessage: null,
    settings: {
      shippingFee: 300,
      freeShippingOver: 5000,
      nationwide: false,
      deliveryCities: ['Karachi', 'Lahore', 'Islamabad', 'Rawalpindi'],
      dispatchMinDays: 1,
      dispatchMaxDays: 3,
      returnWindowDays: 7,
      codEnabled: true,
      codLimit: 10000,
    },
    paymentAccounts: [
      { id: 'pa_urban_jazz', kind: 'jazzcash', title: 'Urban Thread', number: '03211234567', bankName: null, isActive: true },
    ],
    createdAt: ago(90 * DAY),
  },
  {
    id: 's_volt',
    slug: 'volt-gadgets-0f766',
    ownerId: 'u_volt',
    name: 'Volt Gadgets',
    tagline: 'Audio, wearables and the cables you keep losing',
    about: 'Checked, boxed and warrantied. Every gadget is tested in our Hall Road workshop before it leaves.',
    logoUrl: null,
    coverUrl: unsplash(IMG.H1),
    brandColor: '#0F766E',
    onBrandColor: '#FFFFFF',
    city: 'Lahore',
    socials: { instagram: '@voltgadgets', facebook: null, tiktok: null, website: null },
    phone: '+924237654321',
    whatsapp: '+923334445566',
    isFeatured: false,
    isPaused: false,
    pauseMessage: null,
    settings: {
      shippingFee: 200,
      freeShippingOver: 10000,
      nationwide: false,
      deliveryCities: ['Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad'],
      dispatchMinDays: 1,
      dispatchMaxDays: 2,
      returnWindowDays: 14,
      codEnabled: true,
      codLimit: 20000,
    },
    paymentAccounts: [
      { id: 'pa_volt_easy', kind: 'easypaisa', title: 'Volt Gadgets', number: '03334445566', bankName: null, isActive: true },
    ],
    createdAt: ago(60 * DAY),
  },
];

// ─── Categories ───────────────────────────────────────
const categories: MockCategory[] = [
  { id: 'cat_women', name: 'Women', slug: 'women', icon: 'woman-outline', parentId: null, position: 0 },
  { id: 'cat_w_kurtas', name: 'Kurtas & sets', slug: 'kurtas-sets', icon: 'shirt-outline', parentId: 'cat_women', position: 0 },
  { id: 'cat_w_formal', name: 'Formals', slug: 'formals', icon: 'sparkles-outline', parentId: 'cat_women', position: 1 },
  { id: 'cat_w_bags', name: 'Bags', slug: 'bags', icon: 'bag-handle-outline', parentId: 'cat_women', position: 2 },
  { id: 'cat_men', name: 'Men', slug: 'men', icon: 'man-outline', parentId: null, position: 1 },
  { id: 'cat_m_eastern', name: 'Shalwar kameez', slug: 'shalwar-kameez', icon: 'shirt-outline', parentId: 'cat_men', position: 0 },
  { id: 'cat_m_tees', name: 'T-shirts', slug: 't-shirts', icon: 'shirt-outline', parentId: 'cat_men', position: 1 },
  { id: 'cat_m_jeans', name: 'Jeans', slug: 'jeans', icon: 'cut-outline', parentId: 'cat_men', position: 2 },
  { id: 'cat_m_shoes', name: 'Shoes', slug: 'shoes', icon: 'footsteps-outline', parentId: 'cat_men', position: 3 },
  { id: 'cat_tech', name: 'Electronics', slug: 'electronics', icon: 'hardware-chip-outline', parentId: null, position: 2 },
  { id: 'cat_t_audio', name: 'Audio', slug: 'audio', icon: 'headset-outline', parentId: 'cat_tech', position: 0 },
  { id: 'cat_t_wear', name: 'Wearables', slug: 'wearables', icon: 'watch-outline', parentId: 'cat_tech', position: 1 },
  { id: 'cat_t_acc', name: 'Phone accessories', slug: 'phone-accessories', icon: 'phone-portrait-outline', parentId: 'cat_tech', position: 2 },
];

const collections: MockCollection[] = [
  { id: 'col_lawn_luxe', storeId: 's_lawn', name: 'Luxe pret', slug: 'luxe-pret', position: 0 },
  { id: 'col_lawn_summer', storeId: 's_lawn', name: "Summer lawn '26", slug: 'summer-lawn', position: 1 },
  { id: 'col_lawn_bags', storeId: 's_lawn', name: 'Bags', slug: 'bags', position: 2 },
  { id: 'col_urban_eid', storeId: 's_urban', name: 'Eid edit', slug: 'eid-edit', position: 0 },
  { id: 'col_urban_basics', storeId: 's_urban', name: 'Everyday basics', slug: 'everyday-basics', position: 1 },
  { id: 'col_urban_denim', storeId: 's_urban', name: 'Denim & sneakers', slug: 'denim-sneakers', position: 2 },
  { id: 'col_volt_audio', storeId: 's_volt', name: 'Audio', slug: 'audio', position: 0 },
  { id: 'col_volt_wear', storeId: 's_volt', name: 'Wearables', slug: 'wearables', position: 1 },
  { id: 'col_volt_charge', storeId: 's_volt', name: 'Charging & cases', slug: 'charging-cases', position: 2 },
];

// ─── Products ─────────────────────────────────────────
const SIZES = ['XS', 'S', 'M', 'L', 'XL'];
const STOCK_PATTERN = [6, 9, 0, 4, 12, 2, 7, 0, 5, 3, 10, 1];

interface ProductSpec {
  id: string;
  store: string;
  name: string;
  description: string;
  category: string;
  collection: string | null;
  price: number;
  sale?: number;
  images: (keyof typeof IMG)[];
  /** option1 (usually Size). */
  o1?: { name: string; values: string[] };
  /** option2 colours: name → hex. */
  colours?: Record<string, string>;
  /** Override every variant's stock. */
  stock?: number;
  trending?: number;
  daysAgo?: number;
  status?: MockProduct['status'];
}

let stockCursor = 0;
const make = (p: ProductSpec): MockProduct => {
  const o1 = p.o1 ?? null;
  const colourNames = p.colours ? Object.keys(p.colours) : [];
  const o1Values = o1 ? o1.values : [null];
  const o2Values = colourNames.length ? colourNames : [null];
  const variants = [];
  let i = 0;
  for (const a of o1Values) {
    for (const b of o2Values) {
      const stock = p.stock ?? STOCK_PATTERN[stockCursor++ % STOCK_PATTERN.length];
      variants.push({
        id: `${p.id}_v${i++}`,
        option1: a,
        option2: b,
        sku: [p.id.replace(/^p_/, '').toUpperCase(), a, b?.slice(0, 4).toUpperCase()].filter(Boolean).join('-'),
        stock,
        priceDelta: 0,
      });
    }
  }
  return {
    id: p.id,
    storeId: p.store,
    name: p.name,
    description: p.description,
    categoryId: p.category,
    collectionId: p.collection,
    price: p.price,
    salePrice: p.sale ?? null,
    status: p.status ?? 'active',
    images: p.images.map(img),
    option1: o1,
    option2: colourNames.length ? { name: 'Colour', values: colourNames, swatches: p.colours! } : null,
    variants,
    removed: false,
    trending: p.trending ?? 0,
    createdAt: ago((p.daysAgo ?? 30) * DAY),
    updatedAt: ago((p.daysAgo ?? 30) * DAY),
  };
};

const size = (values = SIZES) => ({ name: 'Size', values });

const products: MockProduct[] = [
  // Lawn & Loom
  make({
    id: 'p_l1', store: 's_lawn', name: 'Rouge embroidered kurta set', category: 'cat_w_kurtas', collection: 'col_lawn_luxe',
    price: 8990, sale: 7190, images: ['W1', 'W5'], o1: size(), trending: 95, daysAgo: 3,
    description: 'Three-piece kurta set in rouge cotton net with tilla embroidery on the yoke and sleeves. Straight trousers and a chiffon dupatta with a hand-finished border.',
  }),
  make({
    id: 'p_l2', store: 's_lawn', name: 'Lilac chiffon three-piece', category: 'cat_w_formal', collection: 'col_lawn_luxe',
    price: 12500, images: ['W3'], o1: size(['S', 'M', 'L']), trending: 70, daysAgo: 5,
    description: 'Lilac chiffon shirt with sequinned neckline, lined in silk. Paired with a raw-silk trouser and an organza dupatta.',
  }),
  make({
    id: 'p_l3', store: 's_lawn', name: 'Plum embroidered kurta', category: 'cat_w_kurtas', collection: 'col_lawn_luxe',
    price: 6490, images: ['W4'], o1: size(['XS', 'S', 'M', 'L']), colours: { Plum: '#5B2A6E', Noir: '#1C1917' }, trending: 60, daysAgo: 12,
    description: 'Straight-cut kurta in plum khaddar with tone-on-tone thread embroidery. Side slits and a buttoned placket.',
  }),
  make({
    id: 'p_l4', store: 's_lawn', name: 'Ink block-print shirt with dupatta', category: 'cat_w_kurtas', collection: 'col_lawn_summer',
    price: 7990, sale: 6390, images: ['W5', 'W1'], o1: size(['S', 'M', 'L', 'XL']), trending: 55, daysAgo: 8,
    description: 'Hand block-printed lawn shirt in ink and ivory with a printed chiffon dupatta. Unstitched trouser fabric included.',
  }),
  make({
    id: 'p_l5', store: 's_lawn', name: 'Marigold lawn two-piece', category: 'cat_w_kurtas', collection: 'col_lawn_summer',
    price: 4990, images: ['W6'], o1: size(), colours: { Marigold: '#D4A017', Ivory: '#F2EAD3' }, trending: 82, daysAgo: 2,
    description: 'Breezy two-piece in fine lawn: an A-line shirt with lace inserts and matching cigarette pants.',
  }),
  make({
    id: 'p_l6', store: 's_lawn', name: 'Ivory chikankari kurta', category: 'cat_w_kurtas', collection: 'col_lawn_summer',
    price: 5490, images: ['W7'], o1: size(['S', 'M', 'L']), trending: 40, daysAgo: 20,
    description: 'Hand chikankari on soft cotton voile. Light enough for the hottest afternoons.',
  }),
  make({
    id: 'p_l7', store: 's_lawn', name: 'White cotton kurti', category: 'cat_w_kurtas', collection: 'col_lawn_summer',
    price: 2990, images: ['W8'], o1: size(), trending: 66, daysAgo: 4,
    description: 'An everyday kurti in breathable white cotton with a band collar and three-quarter sleeves.',
  }),
  make({
    id: 'p_l8', store: 's_lawn', name: 'Emerald printed lawn suit', category: 'cat_w_kurtas', collection: 'col_lawn_summer',
    price: 5990, sale: 4490, images: ['W9'], o1: size(['S', 'M', 'L']), trending: 50, daysAgo: 15,
    description: 'Digitally printed lawn in emerald and rose with a flared hem. Three pieces.',
  }),
  make({
    id: 'p_l9', store: 's_lawn', name: 'Noir velvet shawl set', category: 'cat_w_formal', collection: 'col_lawn_luxe',
    price: 14990, images: ['W10'], o1: size(['M', 'L']), trending: 35, daysAgo: 45,
    description: 'Black velvet shirt with resham embroidery and a matching embroidered shawl. Made for winter weddings.',
  }),
  make({
    id: 'p_l10', store: 's_lawn', name: 'Bridal lehenga, made to order', category: 'cat_w_formal', collection: 'col_lawn_luxe',
    price: 89000, images: ['W2'], o1: size(['S', 'M', 'L']), stock: 1, trending: 20, daysAgo: 60,
    description: 'Hand-embellished bridal lehenga in deep red with zardozi and dabka work. Allow four weeks after confirmation.',
  }),
  make({
    id: 'p_b1', store: 's_lawn', name: 'Woven leather tote', category: 'cat_w_bags', collection: 'col_lawn_bags',
    price: 7990, images: ['B1'], colours: { Cognac: '#8B4513' }, trending: 45, daysAgo: 10,
    description: 'Hand-woven leather tote with a chain detail. Fits a laptop up to 14 inches.',
  }),
  make({
    id: 'p_b2', store: 's_lawn', name: 'Scarlet top-handle bag', category: 'cat_w_bags', collection: 'col_lawn_bags',
    price: 9490, images: ['B2'], colours: { Scarlet: '#C0392B' }, trending: 30, daysAgo: 25,
    description: 'Structured top-handle bag in pebbled leather with a polished turn-lock.',
  }),
  make({
    id: 'p_b3', store: 's_lawn', name: 'Noir work tote', category: 'cat_w_bags', collection: 'col_lawn_bags',
    price: 6990, images: ['B3'], colours: { Noir: '#1C1917' }, trending: 25, daysAgo: 30,
    description: 'Clean-lined work tote with a zipped inner pocket and sturdy rolled handles.',
  }),
  make({
    id: 'p_b4', store: 's_lawn', name: 'Tan crossbody', category: 'cat_w_bags', collection: 'col_lawn_bags',
    price: 4990, sale: 3990, images: ['B4'], colours: { Tan: '#B5651D' }, trending: 58, daysAgo: 6,
    description: 'Compact crossbody with an adjustable strap. Room for a phone, cards and keys.',
  }),
  make({
    id: 'p_b5', store: 's_lawn', name: 'Wicker basket bag', category: 'cat_w_bags', collection: 'col_lawn_bags',
    price: 5490, images: ['B5'], colours: { Natural: '#D2A679' }, trending: 18, daysAgo: 40,
    description: 'Wicker body with a leather flap and top handle. A summer favourite.',
  }),
  make({
    id: 'p_b6', store: 's_lawn', name: 'Blush flap bag', category: 'cat_w_bags', collection: 'col_lawn_bags',
    price: 4490, images: ['B6'], colours: { Blush: '#E8B4B8' }, trending: 22, daysAgo: 18,
    description: 'Soft blush flap bag with a striped front panel and a slim chain strap.',
  }),
  make({
    id: 'p_b7', store: 's_lawn', name: 'Studded silver bag', category: 'cat_w_bags', collection: 'col_lawn_bags',
    price: 8990, images: ['B7'], colours: { Silver: '#C0C0C0' }, stock: 0, trending: 12, daysAgo: 50,
    description: 'Metallic silver shoulder bag with gold-tone studs and a chain strap.',
  }),
  make({
    id: 'p_b8', store: 's_lawn', name: 'Floral print satchel', category: 'cat_w_bags', collection: 'col_lawn_bags',
    price: 6490, images: ['B8'], colours: { Floral: '#D98880' }, trending: 15, daysAgo: 35,
    description: 'Printed canvas satchel with leather trims and a detachable strap.',
  }),

  // Urban Thread
  make({
    id: 'p_u1', store: 's_urban', name: 'Royal blue shalwar kameez', category: 'cat_m_eastern', collection: 'col_urban_eid',
    price: 6990, images: ['M1'], o1: size(['S', 'M', 'L', 'XL']), trending: 88, daysAgo: 4,
    description: 'Wash-and-wear shalwar kameez in royal blue with a classic collar and a tailored fit.',
  }),
  make({
    id: 'p_u2', store: 's_urban', name: 'Ash grey kurta', category: 'cat_m_eastern', collection: 'col_urban_eid',
    price: 4490, images: ['M2'], o1: size(['S', 'M', 'L', 'XL']), trending: 64, daysAgo: 9,
    description: 'Band-collar kurta in ash-grey cotton with a concealed placket.',
  }),
  make({
    id: 'p_u3', store: 's_urban', name: 'Mint cotton kurta', category: 'cat_m_eastern', collection: 'col_urban_eid',
    price: 3990, sale: 3190, images: ['M3'], o1: size(['S', 'M', 'L', 'XL']), trending: 52, daysAgo: 14,
    description: 'Light mint cotton kurta with self-print. Pairs with white shalwar or jeans.',
  }),
  make({
    id: 'p_u4', store: 's_urban', name: 'Pure white shalwar kameez', category: 'cat_m_eastern', collection: 'col_urban_eid',
    price: 7490, images: ['M4'], o1: size(['S', 'M', 'L', 'XL']), trending: 91, daysAgo: 1,
    description: 'Crisp white shalwar kameez in premium cotton. The Eid staple.',
  }),
  make({
    id: 'p_u5', store: 's_urban', name: 'Midnight kurta', category: 'cat_m_eastern', collection: 'col_urban_eid',
    price: 4990, images: ['M5'], o1: size(['S', 'M', 'L', 'XL']), trending: 33, daysAgo: 22,
    description: 'Deep navy kurta with contrast piping on the placket and cuffs.',
  }),
  make({
    id: 'p_u6', store: 's_urban', name: 'Navy band-collar kameez', category: 'cat_m_eastern', collection: 'col_urban_eid',
    price: 5490, images: ['M6'], o1: size(['S', 'M', 'L', 'XL']), trending: 28, daysAgo: 28,
    description: 'Navy kameez with a band collar and a relaxed straight hem.',
  }),
  make({
    id: 'p_u7', store: 's_urban', name: 'Essential white tee', category: 'cat_m_tees', collection: 'col_urban_basics',
    price: 1490, images: ['T1'], o1: size(['S', 'M', 'L', 'XL']), trending: 77, daysAgo: 11,
    description: '180 gsm combed cotton tee with a ribbed crew neck. Pre-shrunk.',
  }),
  make({
    id: 'p_u8', store: 's_urban', name: 'Graphic tee', category: 'cat_m_tees', collection: 'col_urban_basics',
    price: 1790, images: ['T2'], o1: size(['S', 'M', 'L', 'XL']), trending: 41, daysAgo: 16,
    description: 'Soft black tee with a screen-printed chest graphic.',
  }),
  make({
    id: 'p_u9', store: 's_urban', name: 'Black crest tee', category: 'cat_m_tees', collection: 'col_urban_basics',
    price: 1690, images: ['T3'], o1: size(['S', 'M', 'L', 'XL']), trending: 36, daysAgo: 19,
    description: 'Black cotton tee with a small printed crest on the chest.',
  }),
  make({
    id: 'p_u10', store: 's_urban', name: 'Everyday tee, six colours', category: 'cat_m_tees', collection: 'col_urban_basics',
    price: 1290, images: ['T4'], o1: size(['S', 'M', 'L']), colours: { Red: '#B91C1C', Black: '#1C1917', White: '#FFFFFF', Navy: '#1E3A8A', Yellow: '#EAB308' },
    trending: 84, daysAgo: 7,
    description: 'Our best-selling everyday tee in six colours. Buy three, wear them all week.',
  }),
  make({
    id: 'p_u11', store: 's_urban', name: 'Heavyweight sweatshirt', category: 'cat_m_tees', collection: 'col_urban_basics',
    price: 3490, sale: 2790, images: ['T5'], o1: size(['S', 'M', 'L', 'XL']), trending: 47, daysAgo: 26,
    description: '320 gsm brushed fleece sweatshirt with ribbed cuffs and hem.',
  }),
  make({
    id: 'p_u12', store: 's_urban', name: 'Light-wash straight jeans', category: 'cat_m_jeans', collection: 'col_urban_denim',
    price: 4290, images: ['J1'], o1: size(['28', '30', '32', '34', '36']), trending: 62, daysAgo: 13,
    description: 'Straight-leg jeans in light-wash rigid denim with a classic five-pocket build.',
  }),
  make({
    id: 'p_u13', store: 's_urban', name: 'Raw indigo jeans', category: 'cat_m_jeans', collection: 'col_urban_denim',
    price: 4990, images: ['J3'], o1: size(['30', '32', '34']), trending: 31, daysAgo: 33,
    description: '13 oz raw indigo denim that fades to you. Slim through the thigh.',
  }),
  make({
    id: 'p_u14', store: 's_urban', name: 'Slim tapered jeans', category: 'cat_m_jeans', collection: 'col_urban_denim',
    price: 3990, sale: 3290, images: ['J4'], o1: size(['28', '30', '32', '34']), trending: 54, daysAgo: 10,
    description: 'Mid-blue stretch denim with a slim, tapered leg.',
  }),
  make({
    id: 'p_u15', store: 's_urban', name: 'Maroon canvas low-tops', category: 'cat_m_shoes', collection: 'col_urban_denim',
    price: 4490, images: ['S3'], o1: size(['40', '41', '42', '43', '44']), trending: 59, daysAgo: 8,
    description: 'Canvas low-top sneakers with a vulcanised rubber sole.',
  }),
  make({
    id: 'p_u16', store: 's_urban', name: 'Colour-block runners', category: 'cat_m_shoes', collection: 'col_urban_denim',
    price: 6990, images: ['S5'], o1: size(['40', '41', '42', '43', '44']), trending: 73, daysAgo: 5,
    description: 'Lightweight mesh runners with a cushioned midsole.',
  }),

  // Volt Gadgets
  make({
    id: 'p_v1', store: 's_volt', name: 'Studio wireless headphones', category: 'cat_t_audio', collection: 'col_volt_audio',
    price: 14990, sale: 12490, images: ['H1', 'H2'], colours: { Black: '#1C1917', Sand: '#D6C7A1' }, trending: 90, daysAgo: 6,
    description: 'Over-ear wireless headphones with 40 hours of battery and fast charging. One-year warranty.',
  }),
  make({
    id: 'p_v2', store: 's_volt', name: 'Noise-cancelling headphones', category: 'cat_t_audio', collection: 'col_volt_audio',
    price: 24990, images: ['H2'], colours: { Graphite: '#3F3F46' }, trending: 68, daysAgo: 12,
    description: 'Adaptive noise cancelling, transparency mode and a foldable case.',
  }),
  make({
    id: 'p_v3', store: 's_volt', name: 'Monitor wired headphones', category: 'cat_t_audio', collection: 'col_volt_audio',
    price: 6990, images: ['H3'], colours: { Black: '#1C1917' }, trending: 26, daysAgo: 40,
    description: 'Closed-back studio monitors with a detachable 3 m cable.',
  }),
  make({
    id: 'p_v4', store: 's_volt', name: 'Blush wireless headphones', category: 'cat_t_audio', collection: 'col_volt_audio',
    price: 9990, images: ['H4'], colours: { Blush: '#F4B6C2' }, trending: 44, daysAgo: 9,
    description: 'Lightweight wireless headphones in blush with cushioned memory-foam cups.',
  }),
  make({
    id: 'p_v5', store: 's_volt', name: 'Silver over-ear headphones', category: 'cat_t_audio', collection: 'col_volt_audio',
    price: 19990, images: ['H6'], colours: { Silver: '#C0C0C0' }, trending: 57, daysAgo: 15,
    description: 'Aluminium over-ear headphones with a breathable mesh headband.',
  }),
  make({
    id: 'p_v6', store: 's_volt', name: 'Retro corded headphones', category: 'cat_t_audio', collection: 'col_volt_audio',
    price: 3990, images: ['H5'], colours: { Walnut: '#7C5C3B' }, trending: 19, daysAgo: 50,
    description: 'Walnut and aluminium headphones with a braided cable.',
  }),
  make({
    id: 'p_v7', store: 's_volt', name: 'Pulse wireless earbuds', category: 'cat_t_audio', collection: 'col_volt_audio',
    price: 5490, images: ['E1'], colours: { Black: '#1C1917', Blue: '#1D4ED8' }, trending: 80, daysAgo: 3,
    description: 'True wireless earbuds with 30 hours in the case and an IPX5 rating.',
  }),
  make({
    id: 'p_v8', store: 's_volt', name: 'Sport earbuds', category: 'cat_t_audio', collection: 'col_volt_audio',
    price: 4490, images: ['E2'], colours: { Black: '#1C1917' }, trending: 38, daysAgo: 21,
    description: 'Secure-fit earbuds with ear wings, built for the gym.',
  }),
  make({
    id: 'p_v9', store: 's_volt', name: 'Mini earbuds with case', category: 'cat_t_audio', collection: 'col_volt_audio',
    price: 3290, sale: 2690, images: ['E3'], colours: { Black: '#1C1917' }, trending: 49, daysAgo: 11,
    description: 'Compact earbuds with a pocketable charging case.',
  }),
  make({
    id: 'p_v10', store: 's_volt', name: 'Silicone phone case', category: 'cat_t_acc', collection: 'col_volt_charge',
    price: 1290, images: ['P1'], o1: { name: 'Model', values: ['iPhone 15', 'iPhone 15 Pro', 'Galaxy S24'] },
    colours: { Mint: '#99E2C9', Pink: '#F5A3B7', Navy: '#1E3A8A' }, trending: 61, daysAgo: 7,
    description: 'Soft-touch silicone case with a microfibre lining.',
  }),
  make({
    id: 'p_v11', store: 's_volt', name: 'Abstract print case', category: 'cat_t_acc', collection: 'col_volt_charge',
    price: 1490, images: ['P2'], o1: { name: 'Model', values: ['iPhone 15', 'Galaxy S24'] }, trending: 23, daysAgo: 29,
    description: 'Slim printed case with raised edges to protect the camera.',
  }),
  make({
    id: 'p_v12', store: 's_volt', name: 'Leather wallet case', category: 'cat_t_acc', collection: 'col_volt_charge',
    price: 2990, images: ['P3'], o1: { name: 'Model', values: ['iPhone 15', 'iPhone 15 Pro'] }, trending: 34, daysAgo: 17,
    description: 'Full-grain leather case with a card slot on the back.',
  }),
  make({
    id: 'p_v13', store: 's_volt', name: '20,000 mAh power bank', category: 'cat_t_acc', collection: 'col_volt_charge',
    price: 5990, images: ['PB1'], colours: { Green: '#16A34A' }, trending: 66, daysAgo: 13,
    description: 'Charges a phone four times. 22.5 W fast charging over USB-C.',
  }),
  make({
    id: 'p_v14', store: 's_volt', name: 'Slim aluminium power bank', category: 'cat_t_acc', collection: 'col_volt_charge',
    price: 4490, images: ['PB2'], colours: { Silver: '#C0C0C0' }, trending: 29, daysAgo: 24,
    description: '10,000 mAh in an aluminium shell thinner than most phones.',
  }),
  make({
    id: 'p_v15', store: 's_volt', name: 'Leather-strap smartwatch', category: 'cat_t_wear', collection: 'col_volt_wear',
    price: 18990, images: ['SW1'], colours: { Tan: '#B5651D' }, trending: 71, daysAgo: 5,
    description: 'Fitness and heart-rate tracking, seven-day battery, and a tan leather strap.',
  }),
  make({
    id: 'p_v16', store: 's_volt', name: 'Skeleton automatic watch', category: 'cat_t_wear', collection: 'col_volt_wear',
    price: 24990, images: ['X2'], colours: { Brown: '#5C4033' }, trending: 42, daysAgo: 19,
    description: 'Self-winding movement on show through an open dial. Brown leather strap.',
  }),
  make({
    id: 'p_v17', store: 's_volt', name: 'Bronze chronograph', category: 'cat_t_wear', collection: 'col_volt_wear',
    price: 16990, sale: 13990, images: ['X3'], colours: { Bronze: '#8C6E54' }, trending: 37, daysAgo: 31,
    description: 'A three-dial chronograph with a bronze-tone case.',
  }),
  make({
    id: 'p_v18', store: 's_volt', name: 'Steel chronograph', category: 'cat_t_wear', collection: 'col_volt_wear',
    price: 15990, images: ['X4'], colours: { Steel: '#9CA3AF' }, trending: 27, daysAgo: 36,
    description: 'Stainless-steel chronograph, water resistant to 100 m.',
  }),
];

// ─── Reviews ──────────────────────────────────────────
const NAMES = ['Mahnoor S.', 'Ali R.', 'Fatima Z.', 'Hamza K.', 'Zara A.', 'Usman T.', 'Sana M.', 'Bilal H.', 'Iqra N.'];
const REVIEW_TEXT: [number, string | null, string][] = [
  [5, 'Exactly like the photos', 'The fabric is beautiful and the stitching is neat. Arrived well packed.'],
  [4, 'Lovely, runs a little large', 'Great quality. I would size down next time.'],
  [5, null, 'Third order from this store and never disappointed.'],
  [3, 'Good, not great', 'Nice colour but the dupatta was thinner than I expected.'],
  [5, 'Worth every rupee', 'Delivered in two days. Will buy again.'],
  [4, null, 'Comfortable and looks smart. Colour is slightly darker than the photo.'],
  [2, 'Late delivery', 'The product is fine but it took nine days to arrive.'],
  [5, 'Perfect fit', 'Fits true to size and the finish is excellent.'],
];

const reviews: MockReview[] = [];
products.forEach((p, pi) => {
  if (pi % 3 === 2) return; // some products have no reviews yet
  const n = 2 + (pi % 5);
  for (let i = 0; i < n; i++) {
    const [rating, title, body] = REVIEW_TEXT[(pi + i) % REVIEW_TEXT.length];
    reviews.push({
      id: `r_${p.id}_${i}`,
      productId: p.id,
      storeId: p.storeId,
      userId: `u_reviewer_${i}`,
      authorName: NAMES[(pi + i) % NAMES.length],
      orderItemId: null,
      rating,
      title,
      body,
      photos: i === 0 && pi % 2 === 0 ? [p.images[0].url] : [],
      createdAt: ago((3 + i * 4 + pi) * DAY),
      reply:
        i === 1
          ? { body: 'Thank you for the kind words! We hope to see you again soon.', createdAt: ago((2 + i * 4 + pi) * DAY) }
          : null,
    });
  }
});

// ─── Coupons ──────────────────────────────────────────
const coupons: MockCoupon[] = [
  {
    id: 'cp_lawn10', storeId: 's_lawn', code: 'LAWN10', type: 'percent', value: 10, minOrder: 3000, maxDiscount: 500,
    startsAt: ago(10 * DAY), endsAt: ahead(30 * DAY), usageLimit: 100, perCustomerLimit: 1, usedCount: 14, usedBy: {}, isActive: true,
  },
  {
    id: 'cp_welcome', storeId: 's_lawn', code: 'WELCOME500', type: 'fixed', value: 500, minOrder: 6000, maxDiscount: null,
    startsAt: ago(30 * DAY), endsAt: null, usageLimit: null, perCustomerLimit: 1, usedCount: 31, usedBy: {}, isActive: true,
  },
  {
    id: 'cp_spring', storeId: 's_lawn', code: 'SPRING15', type: 'percent', value: 15, minOrder: null, maxDiscount: 1000,
    startsAt: ago(80 * DAY), endsAt: ago(20 * DAY), usageLimit: 200, perCustomerLimit: 1, usedCount: 120, usedBy: {}, isActive: true,
  },
  {
    id: 'cp_urban300', storeId: 's_urban', code: 'URBAN300', type: 'fixed', value: 300, minOrder: 2500, maxDiscount: null,
    startsAt: ago(5 * DAY), endsAt: ahead(20 * DAY), usageLimit: 1, perCustomerLimit: 1, usedCount: 0, usedBy: {}, isActive: true,
  },
  {
    id: 'cp_volt5', storeId: 's_volt', code: 'VOLT5', type: 'percent', value: 5, minOrder: 5000, maxDiscount: 1000,
    startsAt: ago(15 * DAY), endsAt: ahead(45 * DAY), usageLimit: null, perCustomerLimit: 2, usedCount: 9, usedBy: {}, isActive: true,
  },
];

// ─── Banners ──────────────────────────────────────────
const banners: MockBanner[] = [
  {
    id: 'bn_lawn', imageUrl: unsplash(IMG.W1), headline: 'The new lawn is here', subhead: "Lawn & Loom · Summer '26",
    target: { kind: 'store', slug: 'lawn-and-loom-7a1f3' }, startsAt: ago(5 * DAY), endsAt: null, position: 0, isActive: true,
  },
  {
    id: 'bn_audio', imageUrl: unsplash(IMG.H1), headline: 'Sound, sorted', subhead: 'Headphones from Rs 3,990',
    target: { kind: 'category', id: 'cat_t_audio', name: 'Audio' }, startsAt: ago(5 * DAY), endsAt: null, position: 1, isActive: true,
  },
  {
    id: 'bn_eid', imageUrl: unsplash(IMG.M4), headline: 'Eid, made easy', subhead: 'Shalwar kameez at Urban Thread',
    target: { kind: 'store', slug: 'urban-thread-1c9e2' }, startsAt: ago(5 * DAY), endsAt: null, position: 2, isActive: true,
  },
  {
    id: 'bn_runner', imageUrl: unsplash(IMG.S5), headline: 'Runners, re-made', subhead: 'Colour-block runners · Rs 6,990',
    target: { kind: 'product', id: 'p_u16' }, startsAt: ago(5 * DAY), endsAt: null, position: 3, isActive: true,
  },
];

// ─── Addresses, orders, returns, notifications ────────
const addresses: MockAddress[] = [
  {
    id: 'ad_customer_home', userId: 'u_customer', label: 'home', fullName: 'Ayesha Khan', phone: '+923001234567', city: 'Lahore',
    area: 'Gulberg III', line1: 'House 12, Main Boulevard', landmark: 'Near Liberty roundabout', lat: 31.516, lng: 74.342, isDefault: true,
  },
  {
    id: 'ad_customer_work', userId: 'u_customer', label: 'work', fullName: 'Ayesha Khan', phone: '+923001234567', city: 'Quetta',
    area: 'Jinnah Town', line1: 'Office 4, Zarghoon Road', landmark: null, lat: 30.1979, lng: 67.0097, isDefault: false,
  },
  {
    id: 'ad_shopper_home', userId: 'u_shopper', label: 'home', fullName: 'Hamza Qureshi', phone: '+923451234567', city: 'Lahore',
    area: 'DHA Phase 5', line1: 'House 88, Street 9', landmark: null, lat: 31.4718, lng: 74.4023, isDefault: true,
  },
];

const item = (id: string, productId: string, variantIndex: number, quantity: number): MockOrderItem => {
  const p = products.find(x => x.id === productId)!;
  const v = p.variants[variantIndex];
  return {
    id,
    productId,
    variantId: v.id,
    name: p.name,
    variantLabel: [v.option1, v.option2].filter(Boolean).join(' / '),
    imageUrl: p.images[0]?.url ?? null,
    unitPrice: p.salePrice ?? p.price,
    quantity,
    returnedQty: 0,
    reviewed: false,
  };
};

type OrderSpec = Omit<MockOrder, 'itemsTotal' | 'total' | 'code' | 'internalNote' | 'paymentAccountId' | 'payBy' | 'deliveredAt'> &
  Partial<Pick<MockOrder, 'paymentAccountId' | 'payBy' | 'deliveredAt'>> & { n: number };

const order = (o: OrderSpec): MockOrder => {
  const itemsTotal = o.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  return {
    ...o,
    code: `${o.groupCode}-${o.n}`,
    itemsTotal,
    total: itemsTotal + o.shippingFee - o.discount,
    internalNote: null,
    paymentAccountId: o.paymentAccountId ?? null,
    payBy: o.payBy ?? null,
    deliveredAt: o.deliveredAt ?? null,
  };
};

const ev = (type: MockOrder['events'][number]['type'], msAgo: number, note: string | null = null) => ({
  type,
  note,
  createdAt: ago(msAgo),
});

const orders: MockOrder[] = [
  // Ayesha — delivered last week (return and review possible)
  order({
    id: 'o_1a', n: 1, groupCode: 'MM-24A7Q2', userId: 'u_customer', storeId: 's_lawn', status: 'delivered',
    paymentMethod: 'cod', paymentStatus: 'cash_collected',
    items: [item('oi_1a1', 'p_l5', 2, 1), item('oi_1a2', 'p_l7', 1, 1)], shippingFee: 0, discount: 0, couponCode: null, note: null,
    shipment: { courier: 'tcs', trackingRef: 'TCS7781230045' },
    events: [ev('placed', 9 * DAY), ev('confirmed', 8.8 * DAY), ev('packed', 8 * DAY), ev('shipped', 7 * DAY), ev('delivered', 4 * DAY), ev('cash_collected', 4 * DAY)],
    paymentProof: null, cancelReason: null, createdAt: ago(9 * DAY), deliveredAt: ago(4 * DAY),
  }),
  order({
    id: 'o_1b', n: 2, groupCode: 'MM-24A7Q2', userId: 'u_customer', storeId: 's_urban', status: 'delivered',
    paymentMethod: 'transfer', paymentStatus: 'paid',
    items: [item('oi_1b1', 'p_u7', 1, 2)], shippingFee: 300, discount: 0, couponCode: null, note: null,
    shipment: { courier: 'leopards', trackingRef: 'LP558120934' }, paymentAccountId: 'pa_urban_jazz',
    events: [ev('placed', 9 * DAY), ev('payment_proof_submitted', 8.9 * DAY), ev('payment_confirmed', 8.7 * DAY), ev('confirmed', 8.7 * DAY), ev('packed', 8.2 * DAY), ev('shipped', 7.5 * DAY), ev('delivered', 6 * DAY)],
    paymentProof: { transactionId: 'JC88213304', imageUrl: null, submittedAt: ago(8.9 * DAY), rejectionReason: null },
    cancelReason: null, createdAt: ago(9 * DAY), deliveredAt: ago(6 * DAY),
  }),
  // Ayesha — on its way
  order({
    id: 'o_2a', n: 1, groupCode: 'MM-31KX8D', userId: 'u_customer', storeId: 's_volt', status: 'shipped',
    paymentMethod: 'transfer', paymentStatus: 'paid', paymentAccountId: 'pa_volt_easy',
    items: [item('oi_2a1', 'p_v7', 0, 1)], shippingFee: 200, discount: 0, couponCode: null, note: null,
    shipment: { courier: 'postex', trackingRef: 'PX20931177' },
    events: [ev('placed', 2 * DAY), ev('payment_proof_submitted', 2 * DAY - HOUR), ev('payment_confirmed', 1.8 * DAY), ev('confirmed', 1.8 * DAY), ev('packed', 1.4 * DAY), ev('shipped', 20 * HOUR)],
    paymentProof: { transactionId: 'EP4471290031', imageUrl: null, submittedAt: ago(2 * DAY - HOUR), rejectionReason: null },
    cancelReason: null, createdAt: ago(2 * DAY),
  }),
  order({
    id: 'o_2b', n: 2, groupCode: 'MM-31KX8D', userId: 'u_customer', storeId: 's_lawn', status: 'confirmed',
    paymentMethod: 'cod', paymentStatus: 'cod_pending',
    items: [item('oi_2b1', 'p_l1', 2, 1)], shippingFee: 0, discount: 0, couponCode: null, note: 'Please call before delivery.',
    shipment: null, events: [ev('placed', 2 * DAY), ev('confirmed', 1.5 * DAY)],
    paymentProof: null, cancelReason: null, createdAt: ago(2 * DAY),
  }),
  // Ayesha — needs payment
  order({
    id: 'o_3a', n: 1, groupCode: 'MM-40BN5T', userId: 'u_customer', storeId: 's_urban', status: 'placed',
    paymentMethod: 'transfer', paymentStatus: 'awaiting_transfer', paymentAccountId: 'pa_urban_jazz', payBy: ahead(20 * HOUR),
    items: [item('oi_3a1', 'p_u10', 0, 2), item('oi_3a2', 'p_u12', 2, 1)], shippingFee: 0, discount: 0, couponCode: null, note: null,
    shipment: null, events: [ev('placed', 4 * HOUR)], paymentProof: null, cancelReason: null, createdAt: ago(4 * HOUR),
  }),
  // Ayesha — cancelled
  order({
    id: 'o_4a', n: 1, groupCode: 'MM-18ZC3W', userId: 'u_customer', storeId: 's_volt', status: 'cancelled',
    paymentMethod: 'cod', paymentStatus: 'cod_pending',
    items: [item('oi_4a1', 'p_v3', 0, 1)], shippingFee: 200, discount: 0, couponCode: null, note: null, shipment: null,
    events: [ev('placed', 15 * DAY), ev('cancelled', 14.8 * DAY, 'Ordered by mistake')],
    paymentProof: null, cancelReason: 'Ordered by mistake', createdAt: ago(15 * DAY),
  }),
  // Hamza — orders Lawn & Loom has to act on
  order({
    id: 'o_5a', n: 1, groupCode: 'MM-52HD1F', userId: 'u_shopper', storeId: 's_lawn', status: 'placed',
    paymentMethod: 'cod', paymentStatus: 'cod_pending',
    items: [item('oi_5a1', 'p_l3', 1, 1), item('oi_5a2', 'p_b4', 0, 1)], shippingFee: 0, discount: 0, couponCode: null, note: null,
    shipment: null, events: [ev('placed', 35 * 60 * 1000)], paymentProof: null, cancelReason: null, createdAt: ago(35 * 60 * 1000),
  }),
  order({
    id: 'o_6a', n: 1, groupCode: 'MM-61PW7A', userId: 'u_shopper', storeId: 's_lawn', status: 'placed',
    paymentMethod: 'transfer', paymentStatus: 'proof_submitted', paymentAccountId: 'pa_lawn_raast', payBy: ahead(10 * HOUR),
    items: [item('oi_6a1', 'p_l2', 1, 1)], shippingFee: 0, discount: 0, couponCode: null, note: null, shipment: null,
    events: [ev('placed', 14 * HOUR), ev('payment_proof_submitted', 12 * HOUR)],
    paymentProof: { transactionId: 'RAAST20931188', imageUrl: unsplash(IMG.P2), submittedAt: ago(12 * HOUR), rejectionReason: null },
    cancelReason: null, createdAt: ago(14 * HOUR),
  }),
  order({
    id: 'o_7a', n: 1, groupCode: 'MM-73QT2M', userId: 'u_shopper', storeId: 's_lawn', status: 'packed',
    paymentMethod: 'cod', paymentStatus: 'cod_pending',
    items: [item('oi_7a1', 'p_l8', 0, 2)], shippingFee: 250, discount: 0, couponCode: null, note: null, shipment: null,
    events: [ev('placed', 3 * DAY), ev('confirmed', 2.8 * DAY), ev('packed', DAY)], paymentProof: null, cancelReason: null, createdAt: ago(3 * DAY),
  }),
  order({
    id: 'o_8a', n: 1, groupCode: 'MM-80RV4K', userId: 'u_shopper', storeId: 's_lawn', status: 'delivered',
    paymentMethod: 'cod', paymentStatus: 'cash_collected',
    items: [item('oi_8a1', 'p_l6', 1, 1), item('oi_8a2', 'p_b6', 0, 1)], shippingFee: 0, discount: 0, couponCode: null, note: null,
    shipment: { courier: 'own_rider', trackingRef: 'LL-RIDER-0412' },
    events: [ev('placed', 8 * DAY), ev('confirmed', 7.8 * DAY), ev('packed', 7 * DAY), ev('shipped', 6.5 * DAY), ev('delivered', 5 * DAY), ev('cash_collected', 5 * DAY), ev('return_requested', 2 * DAY)],
    paymentProof: null, cancelReason: null, createdAt: ago(8 * DAY), deliveredAt: ago(5 * DAY),
  }),
];

const groups: MockGroup[] = [];
for (const o of orders) {
  let g = groups.find(x => x.code === o.groupCode);
  if (!g) {
    const address = addresses.find(a => a.userId === o.userId && a.isDefault)!;
    g = { code: o.groupCode, userId: o.userId, address: { ...address }, orderIds: [], createdAt: o.createdAt };
    groups.push(g);
  }
  g.orderIds.push(o.id);
}

const returns: MockReturn[] = [
  {
    id: 'rt_1', orderId: 'o_8a', userId: 'u_shopper', storeId: 's_lawn', status: 'requested', reason: 'size_issue',
    details: 'The kurta is too long for me. I would like to return it.', photos: [], items: [{ orderItemId: 'oi_8a1', quantity: 1 }],
    storeNote: null, refund: null, createdAt: ago(2 * DAY),
  },
];

const notifications: MockNotification[] = [
  {
    id: 'n_1', userId: 'u_customer', type: 'payment_update', title: 'Payment needed for MM-40BN5T',
    body: 'Transfer Rs 4,870 to Urban Thread to confirm your order.', data: { groupCode: 'MM-40BN5T', orderId: 'o_3a', returnId: null, productId: null },
    isRead: false, createdAt: ago(4 * HOUR),
  },
  {
    id: 'n_2', userId: 'u_customer', type: 'order_update', title: 'Your Volt Gadgets order shipped',
    body: 'PostEx · PX20931177', data: { groupCode: 'MM-31KX8D', orderId: 'o_2a', returnId: null, productId: null },
    isRead: false, createdAt: ago(20 * HOUR),
  },
  {
    id: 'n_3', userId: 'u_customer', type: 'order_update', title: 'Delivered: MM-24A7Q2',
    body: 'How was it? You can review your items now.', data: { groupCode: 'MM-24A7Q2', orderId: 'o_1a', returnId: null, productId: null },
    isRead: true, createdAt: ago(4 * DAY),
  },
  {
    id: 'n_4', userId: 'u_store', type: 'new_order', title: 'New order MM-52HD1F-1', body: 'Hamza ordered 2 items · Cash on delivery',
    data: { groupCode: 'MM-52HD1F', orderId: 'o_5a', returnId: null, productId: null }, isRead: false, createdAt: ago(35 * 60 * 1000),
  },
  {
    id: 'n_5', userId: 'u_store', type: 'payment_proof', title: 'Check a transfer for MM-61PW7A-1', body: 'Raast · RAAST20931188',
    data: { groupCode: 'MM-61PW7A', orderId: 'o_6a', returnId: null, productId: null }, isRead: false, createdAt: ago(12 * HOUR),
  },
  {
    id: 'n_6', userId: 'u_store', type: 'return_requested', title: 'Return requested on MM-80RV4K-1', body: 'Size or fit · 1 item',
    data: { groupCode: 'MM-80RV4K', orderId: 'o_8a', returnId: 'rt_1', productId: null }, isRead: false, createdAt: ago(2 * DAY),
  },
];

/** The shop as a fresh install sees it. */
export const seedShop = (): MockShop =>
  JSON.parse(
    JSON.stringify({
      stores,
      categories,
      collections,
      products,
      reviews,
      cart: [],
      wishlist: { u_customer: ['p_l4', 'p_v1', 'p_b7'] },
      addresses,
      orders,
      groups,
      returns,
      coupons,
      movements: [],
      banners,
      reports: [
        {
          id: 'rp_1', productId: 'p_v18', userId: 'u_customer', reason: 'Counterfeit or copy',
          details: 'The listing photo looks like a branded watch.', status: 'open', createdAt: ago(DAY),
        },
      ],
      notifications,
      idempotency: {},
      seq: 1000,
    } satisfies MockShop),
  );

/** Owner accounts for the seeded stores (password Metro2026). */
export const SHOP_SEED_USERS = [
  { id: 'u_store', email: 'store@metromatrix.app', name: 'Mariam Aslam', storeId: 's_lawn', businessId: 'b_store', city: 'Lahore' },
  { id: 'u_urban', email: 'urban@metromatrix.app', name: 'Faisal Siddiqui', storeId: 's_urban', businessId: 'b_urban', city: 'Karachi' },
  { id: 'u_volt', email: 'volt@metromatrix.app', name: 'Zain Ahmed', storeId: 's_volt', businessId: 'b_volt', city: 'Lahore' },
] as const;

export const SHOP_SEED_SHOPPER = { id: 'u_shopper', email: 'hamza@metromatrix.app', name: 'Hamza Qureshi' } as const;
