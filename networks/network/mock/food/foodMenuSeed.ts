// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy Food menus (the three demo vendors)
// ═══════════════════════════════════════════════════════
// Categories, dishes with sizes, reusable add-on groups and a home kitchen's
// day. Prices are in rupees; names and dishes are ordinary Pakistani menu
// fare, nothing from a real brand.

import type { MockItemTag, MockMenuCategory, MockMenuItem, MockOptionGroup, MockPreorderSlot } from './foodTypes';
import { FOOD_IMG } from './foodImages';

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

interface DishSeed {
  id: string;
  name: string;
  price: number;
  description?: string;
  tags?: MockItemTag[];
  serves?: number;
  isDeal?: boolean;
  days?: number[];
  sizes?: [string, number][];
  groups?: string[];
  sold30d?: number;
  /** Home kitchens: today's portions and how many are left. */
  portions?: [number, number];
  photo?: keyof typeof FOOD_IMG;
}

interface MenuSeed {
  businessId: string;
  groups: { id: string; name: string; min: number; max: number; options: [string, number, boolean?][] }[];
  categories: { id: string; name: string; window?: [string, string]; dishes: DishSeed[] }[];
}

const MENUS: MenuSeed[] = [
  {
    businessId: 'b_resto',
    groups: [
      { id: 'og_spice', name: 'Spice level', min: 1, max: 1, options: [['Mild', 0, true], ['Medium', 0], ['Hot', 0]] },
      { id: 'og_raita', name: 'Add raita or salad', min: 0, max: 2, options: [['Raita', 60], ['Kachumber salad', 80]] },
      { id: 'og_drink', name: 'Add a drink', min: 0, max: 1, options: [['Soft drink (345 ml)', 120], ['Mineral water', 70], ['Sweet lassi', 180]] },
    ],
    categories: [
      {
        id: 'mc_resto_biryani',
        name: 'Biryani',
        dishes: [
          {
            id: 'mi_chicken_biryani', photo: 'biryani',
            name: 'Chicken Biryani',
            price: 650,
            description: 'Long-grain rice, slow-cooked chicken, fried onions and mint.',
            tags: ['spicy', 'bestseller'],
            serves: 1,
            sizes: [['Single', 650], ['Half kg', 1100], ['Family (1 kg)', 2100]],
            groups: ['og_spice', 'og_raita', 'og_drink'],
            sold30d: 412,
          },
          { id: 'mi_beef_biryani', name: 'Beef Biryani', price: 720, description: 'Tender beef, aloo bukhara and whole spices.', tags: ['spicy'], serves: 1, groups: ['og_spice', 'og_raita'], sold30d: 188 },
          { id: 'mi_sindhi_biryani', name: 'Sindhi Biryani', price: 780, description: 'Potatoes, plums and green chillies, Sindhi style.', tags: ['spicy', 'new'], serves: 1, groups: ['og_spice', 'og_raita'], sold30d: 64 },
        ],
      },
      {
        id: 'mc_resto_karahi',
        name: 'Karahi',
        dishes: [
          {
            id: 'mi_chicken_karahi', photo: 'curry',
            name: 'Chicken Karahi',
            price: 1450,
            description: 'Tomatoes, ginger and green chillies, cooked in the wok.',
            serves: 2,
            sizes: [['Half', 1450], ['Full', 2600]],
            groups: ['og_spice'],
            sold30d: 140,
          },
          { id: 'mi_mutton_karahi', name: 'Mutton Karahi (half)', price: 2400, description: 'Bone-in mutton, black pepper and butter.', serves: 2, groups: ['og_spice'], sold30d: 52 },
        ],
      },
      {
        id: 'mc_resto_bbq',
        name: 'BBQ',
        window: ['18:00', '23:30'],
        dishes: [
          { id: 'mi_seekh', photo: 'kebab', name: 'Seekh Kebab (4 pcs)', price: 900, description: 'Charcoal-grilled beef seekh with mint chutney.', tags: ['bestseller'], sold30d: 230 },
          { id: 'mi_tikka', photo: 'tikka', name: 'Chicken Tikka (leg)', price: 550, description: 'Yoghurt and spice marinade, grilled over coal.', tags: ['spicy'], sold30d: 175 },
          { id: 'mi_malai', name: 'Malai Boti', price: 980, description: 'Cream-marinated boneless chicken.', sold30d: 96 },
        ],
      },
      {
        id: 'mc_resto_deals',
        name: 'Deals',
        dishes: [
          { id: 'mi_deal_family', photo: 'biryani', name: 'Family deal', price: 3200, description: '1 kg chicken biryani, 4 seekh kebabs, raita, salad and 1.5 L drink.', isDeal: true, serves: 4, sold30d: 88 },
          { id: 'mi_deal_solo', name: 'Solo deal', price: 850, description: 'Single chicken biryani, raita and a soft drink.', isDeal: true, serves: 1, sold30d: 201 },
        ],
      },
      {
        id: 'mc_resto_breads',
        name: 'Breads',
        dishes: [
          { id: 'mi_naan', name: 'Naan', price: 60, tags: ['veg'], sold30d: 210 },
          { id: 'mi_roghni', name: 'Roghni naan', price: 90, tags: ['veg'], sold30d: 210 },
        ],
      },
      {
        id: 'mc_resto_drinks',
        name: 'Drinks and dessert',
        dishes: [
          { id: 'mi_lassi', name: 'Lassi', price: 180, tags: ['veg'], sizes: [['Sweet', 180], ['Salted', 160]], sold30d: 140 },
          { id: 'mi_soft', name: 'Soft drink (345 ml)', price: 120, sold30d: 160 },
          { id: 'mi_kheer', name: 'Kheer', price: 250, description: 'Rice pudding with cardamom and pistachio.', tags: ['veg', 'contains_nuts'], sold30d: 77 },
        ],
      },
    ],
  },
  {
    businessId: 'b_cloud',
    groups: [
      { id: 'og_toppings', name: 'Extra toppings', min: 0, max: 4, options: [['Cheese slice', 90], ['Jalapeños', 60], ['Fried egg', 80], ['Extra beef patty', 350]] },
      { id: 'og_meal', name: 'Make it a meal', min: 0, max: 1, options: [['Fries and a drink', 380], ['Loaded fries and a drink', 520]] },
      { id: 'og_sauce', name: 'Choose a dip', min: 1, max: 1, options: [['Garlic mayo', 0, true], ['Chipotle', 0], ['Smoky BBQ', 0]] },
    ],
    categories: [
      {
        id: 'mc_cloud_burgers',
        name: 'Smash burgers',
        dishes: [
          {
            id: 'mi_classic_smash', photo: 'burger',
            name: 'Classic Smash',
            price: 890,
            description: 'Smashed beef, American cheese, pickles, house sauce.',
            tags: ['bestseller'],
            sizes: [['Single', 890], ['Double', 1290]],
            groups: ['og_toppings', 'og_meal'],
            sold30d: 380,
          },
          { id: 'mi_cheese_smash', name: 'Triple Cheese Smash', price: 1190, description: 'Three cheeses, caramelised onion, double beef.', tags: ['new'], groups: ['og_toppings', 'og_meal'], sold30d: 120 },
          { id: 'mi_spicy_chicken', name: 'Spicy Crunch Chicken', price: 820, description: 'Crispy thigh, hot honey, slaw.', tags: ['spicy'], groups: ['og_toppings', 'og_meal'], sold30d: 210 },
        ],
      },
      {
        id: 'mc_cloud_sides',
        name: 'Sides',
        dishes: [
          { id: 'mi_loaded_fries', photo: 'friesTray', name: 'Loaded fries', price: 590, description: 'Cheese sauce, jalapeños and beef crumbs.', groups: ['og_sauce'], sold30d: 260 },
          { id: 'mi_fries', photo: 'fries', name: 'Fries', price: 290, tags: ['veg'], groups: ['og_sauce'], sizes: [['Regular', 290], ['Large', 390]], sold30d: 330 },
          { id: 'mi_wings', name: 'Hot wings (6 pcs)', price: 690, tags: ['spicy'], groups: ['og_sauce'], sold30d: 150 },
        ],
      },
      {
        id: 'mc_cloud_deals',
        name: 'Deals',
        dishes: [
          { id: 'mi_smash_deal', photo: 'burger', name: 'Smash deal for two', price: 2390, description: 'Two Classic Smash, large fries and two drinks.', isDeal: true, serves: 2, sold30d: 170 },
        ],
      },
      {
        id: 'mc_cloud_drinks',
        name: 'Drinks',
        dishes: [
          { id: 'mi_shake', name: 'Thick shake', price: 550, sizes: [['Vanilla', 550], ['Chocolate', 590], ['Lotus', 650]], tags: ['veg'], sold30d: 140 },
          { id: 'mi_cola', name: 'Soft drink (500 ml)', price: 150, sold30d: 280 },
        ],
      },
    ],
  },
  {
    businessId: 'b_homek',
    groups: [{ id: 'og_roti', name: 'Extra roti', min: 0, max: 1, options: [['1 roti', 40], ['2 roti', 70]] }],
    categories: [
      {
        id: 'mc_homek_handi',
        name: 'Today’s handi',
        dishes: [
          { id: 'mi_qorma', photo: 'curry', name: 'Chicken qorma with 2 roti', price: 550, description: 'Slow-cooked in a clay handi, the way Ammi makes it.', serves: 1, groups: ['og_roti'], portions: [20, 14], sold30d: 260 },
          { id: 'mi_daal', photo: 'thali', name: 'Daal chawal', price: 350, description: 'Masoor daal, boiled rice and achaar.', tags: ['veg'], serves: 1, days: [1, 3, 5], portions: [15, 15], sold30d: 140 },
          { id: 'mi_aloo_keema', name: 'Aloo keema with 2 roti', price: 480, serves: 1, groups: ['og_roti'], days: [0, 2, 4, 6], sold30d: 90 },
          { id: 'mi_pulao', name: 'Chicken pulao', price: 520, description: 'Yakhni pulao with raita, Fridays only.', serves: 1, days: [5], sold30d: 120 },
        ],
      },
      {
        id: 'mc_homek_sweet',
        name: 'Sweet',
        dishes: [{ id: 'mi_homek_kheer', name: 'Kheer (bowl)', price: 220, tags: ['veg', 'contains_nuts'], sold30d: 60 }],
      },
    ],
  },
  {
    businessId: 'b_tandoor',
    groups: [
      { id: 'og_tn_spice', name: 'Spice level', min: 1, max: 1, options: [['Mild', 0, true], ['Medium', 0], ['Hot', 0]] },
      { id: 'og_tn_bread', name: 'Bread with it', min: 0, max: 2, options: [['Naan', 60], ['Roghni naan', 90], ['Tandoori roti', 30]] },
    ],
    categories: [
      {
        id: 'mc_tn_bbq',
        name: 'Off the coals',
        dishes: [
          { id: 'mi_tn_seekh', name: 'Beef seekh kebab (4)', price: 950, description: 'Hand-pressed, charcoal grilled, with mint chutney.', tags: ['bestseller'], groups: ['og_tn_bread'], photo: 'kebabGrill', sold30d: 640 },
          { id: 'mi_tn_tikka', name: 'Chicken tikka boti', price: 890, description: 'Boneless, yoghurt and red chilli marinade.', tags: ['spicy'], groups: ['og_tn_spice', 'og_tn_bread'], photo: 'tikka', sold30d: 510 },
          { id: 'mi_tn_platter', name: 'BBQ platter for two', price: 2650, description: 'Seekh, tikka, malai boti, two naan and salad.', isDeal: true, serves: 2, photo: 'kebab', sold30d: 220 },
        ],
      },
      {
        id: 'mc_tn_karahi',
        name: 'Karahi',
        dishes: [
          { id: 'mi_tn_karahi', name: 'Chicken karahi', price: 1500, serves: 2, sizes: [['Half', 1500], ['Full', 2800]], groups: ['og_tn_spice', 'og_tn_bread'], photo: 'curry', sold30d: 300 },
          { id: 'mi_tn_white', name: 'White karahi (half)', price: 1650, description: 'Cream, black pepper and green chilli.', serves: 2, groups: ['og_tn_bread'], sold30d: 120 },
        ],
      },
    ],
  },
  {
    businessId: 'b_wok',
    groups: [{ id: 'og_wok_rice', name: 'Add rice', min: 0, max: 1, options: [['Egg fried rice', 250], ['Plain rice', 150]] }],
    categories: [
      {
        id: 'mc_wok_noodles',
        name: 'Noodles and rice',
        dishes: [
          { id: 'mi_wok_chowmein', name: 'Chicken chowmein', price: 750, description: 'Wok-tossed noodles, vegetables, soy and garlic.', tags: ['bestseller'], photo: 'noodles', sold30d: 280 },
          { id: 'mi_wok_rice', name: 'Egg fried rice', price: 550, tags: ['veg'], sold30d: 190 },
        ],
      },
      {
        id: 'mc_wok_mains',
        name: 'Mains',
        dishes: [
          { id: 'mi_wok_chilli', name: 'Chilli chicken', price: 980, tags: ['spicy'], groups: ['og_wok_rice'], sold30d: 210 },
          { id: 'mi_wok_soup', name: 'Hot and sour soup', price: 450, sizes: [['Bowl', 450], ['Family', 1200]], sold30d: 150 },
        ],
      },
    ],
  },
  {
    businessId: 'b_slice',
    groups: [
      { id: 'og_slice_crust', name: 'Crust', min: 1, max: 1, options: [['Thin', 0, true], ['Pan', 150]] },
      { id: 'og_slice_extra', name: 'Extra toppings', min: 0, max: 3, options: [['Extra cheese', 200], ['Jalapeños', 100], ['Olives', 120]] },
    ],
    categories: [
      {
        id: 'mc_slice_pizza',
        name: 'Pizza',
        dishes: [
          { id: 'mi_slice_marg', name: 'Margherita', price: 1100, tags: ['veg'], sizes: [['Small', 1100], ['Medium', 1700], ['Large', 2300]], groups: ['og_slice_crust', 'og_slice_extra'], photo: 'pizza', sold30d: 260 },
          { id: 'mi_slice_tikka', name: 'Chicken tikka pizza', price: 1350, tags: ['spicy', 'bestseller'], sizes: [['Small', 1350], ['Medium', 1950], ['Large', 2600]], groups: ['og_slice_crust', 'og_slice_extra'], photo: 'pizza', sold30d: 330 },
          { id: 'mi_slice_by', name: 'Pizza by the slice', price: 380, description: 'Today’s pie, one big slice.', tags: ['new'], sold30d: 90 },
        ],
      },
      { id: 'mc_slice_sides', name: 'Sides', dishes: [{ id: 'mi_slice_fries', name: 'Garlic fries', price: 390, tags: ['veg'], photo: 'fries', sold30d: 120 }] },
    ],
  },
  {
    businessId: 'b_roll',
    groups: [{ id: 'og_roll_sauce', name: 'Sauce', min: 1, max: 2, options: [['Garlic mayo', 0, true], ['Mint chutney', 0], ['Chilli garlic', 0]] }],
    categories: [
      {
        id: 'mc_roll_rolls',
        name: 'Rolls',
        dishes: [
          { id: 'mi_roll_chicken', name: 'Chicken paratha roll', price: 420, tags: ['bestseller'], groups: ['og_roll_sauce'], sold30d: 700 },
          { id: 'mi_roll_seekh', name: 'Seekh kebab roll', price: 480, tags: ['spicy'], groups: ['og_roll_sauce'], sold30d: 410 },
        ],
      },
      {
        id: 'mc_roll_shawarma',
        name: 'Shawarma',
        dishes: [
          { id: 'mi_roll_shawarma', name: 'Chicken shawarma', price: 450, sizes: [['Regular', 450], ['Large', 600]], groups: ['og_roll_sauce'], photo: 'shawarma', sold30d: 520 },
          { id: 'mi_roll_platter', name: 'Shawarma platter', price: 890, description: 'Shawarma, fries, garlic mayo and salad.', isDeal: true, photo: 'shawarma', sold30d: 160 },
        ],
      },
    ],
  },
  {
    businessId: 'b_green',
    groups: [{ id: 'og_green_protein', name: 'Add protein', min: 0, max: 1, options: [['Grilled chicken', 250], ['Chickpeas', 120], ['Paneer', 220]] }],
    categories: [
      {
        id: 'mc_green_bowls',
        name: 'Bowls',
        dishes: [
          { id: 'mi_green_rainbow', name: 'Rainbow bowl', price: 1250, description: 'Avocado, chickpeas, sweet potato, greens and tahini.', tags: ['veg', 'bestseller'], groups: ['og_green_protein'], photo: 'salad', sold30d: 150 },
          { id: 'mi_green_caesar', name: 'Chicken caesar', price: 1150, groups: ['og_green_protein'], sold30d: 90 },
        ],
      },
    ],
  },
  {
    businessId: 'b_chai',
    groups: [],
    categories: [
      {
        id: 'mc_chai_drinks',
        name: 'Chai',
        dishes: [
          { id: 'mi_chai_doodh', name: 'Doodh patti', price: 120, tags: ['veg', 'bestseller'], photo: 'chai', sold30d: 900 },
          { id: 'mi_chai_karak', name: 'Karak chai', price: 150, tags: ['veg'], photo: 'chai', sold30d: 600 },
        ],
      },
      { id: 'mc_chai_cake', name: 'Cake', dishes: [{ id: 'mi_chai_cake', name: 'Chocolate fudge cake (slice)', price: 450, tags: ['veg', 'contains_nuts'], photo: 'cake', sold30d: 200 }] },
    ],
  },
  {
    businessId: 'b_nani',
    groups: [{ id: 'og_nani_roti', name: 'Extra roti', min: 0, max: 1, options: [['1 roti', 40], ['2 roti', 70]] }],
    categories: [
      {
        id: 'mc_nani_handi',
        name: 'Today’s handi',
        dishes: [
          { id: 'mi_nani_qorma', name: 'Chicken qorma with 2 roti', price: 520, description: 'Slow-cooked in a clay handi.', serves: 1, groups: ['og_nani_roti'], photo: 'curry', portions: [25, 6], sold30d: 330 },
          { id: 'mi_nani_daal', name: 'Daal chawal with achaar', price: 320, tags: ['veg'], serves: 1, photo: 'thali', portions: [20, 0], sold30d: 260 },
          { id: 'mi_nani_pulao', name: 'Chicken pulao', price: 480, serves: 1, days: [5], sold30d: 140 },
        ],
      },
    ],
  },
];

export const seedMenus = (today: string) => {
  const categories: MockMenuCategory[] = [];
  const items: MockMenuItem[] = [];
  const groups: MockOptionGroup[] = [];
  for (const m of MENUS) {
    for (const g of m.groups) {
      groups.push({
        id: g.id,
        businessId: m.businessId,
        name: g.name,
        minSelect: g.min,
        maxSelect: g.max,
        options: g.options.map(([name, priceDelta, isDefault], sort) => ({ id: `${g.id}_${sort + 1}`, name, priceDelta, isDefault: !!isDefault, isActive: true, sort, available: true })),
      });
    }
    m.categories.forEach((c, ci) => {
      categories.push({
        id: c.id,
        businessId: m.businessId,
        name: c.name,
        sort: (ci + 1) * 10,
        availableFrom: c.window?.[0] ?? null,
        availableTo: c.window?.[1] ?? null,
        isActive: true,
      });
      c.dishes.forEach((d, di) => {
        const variants = (d.sizes ?? []).map(([name, price], sort) => ({ id: `${d.id}_v${sort + 1}`, name, price, sort }));
        items.push({
          id: d.id,
          businessId: m.businessId,
          categoryId: c.id,
          name: d.name,
          description: d.description ?? null,
          photoUrl: d.photo ? FOOD_IMG[d.photo] : null,
          basePrice: variants.length ? Math.min(...variants.map(v => v.price)) : d.price,
          tags: d.tags ?? [],
          isDeal: !!d.isDeal,
          serves: d.serves ?? null,
          days: d.days ?? EVERY_DAY,
          isActive: true,
          sort: (di + 1) * 10,
          sold30d: d.sold30d ?? 0,
          variants,
          links: (d.groups ?? []).map((groupId, sort) => ({ groupId, variantId: null, sort })),
          override: d.portions
            ? { isAvailable: true, unavailableUntil: null, dailyLimit: d.portions[0], remainingToday: d.portions[1], portionsDate: today }
            : null,
        });
      });
    });
  }
  const slots: MockPreorderSlot[] = [];
  return { categories, items, groups, slots };
};
