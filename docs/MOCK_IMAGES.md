# Dummy catalogue photos

The dummy shop's product, store and banner photos (`src/networks/network/mock/shop/shopSeed.ts`, the `IMG` map) are loaded from Unsplash's image CDN. They are never bundled into the app. In mock mode `cdn()` (`src/utils/cdn.ts`) asks Unsplash for the rendered size.

All are published under the [Unsplash License](https://unsplash.com/license): free for commercial and non-commercial use, with no permission or attribution required. They are listed here as a courtesy and so they can be swapped out.

- **Sourcing:** chosen by searching Unsplash for each product type, keeping only free (non-Unsplash+) photos.
- **Stand-ins only:** they stand in for photos a store uploads. The real API serves the store's own Cloudinary images.
- **Before a public demo:** don't use these to suggest a real brand sells these items. Seeded store names are fictional.

| Key | Subject | Image | Used by |
|---|---|---|---|
| `W1` | Women's eastern wear | https://images.unsplash.com/photo-1733470381571-c3d082e68457 | `p_l1`, `p_l4` |
| `W2` | Women's eastern wear | https://images.unsplash.com/photo-1707576618343-26a1b377ca7a | `p_l10` |
| `W3` | Women's eastern wear | https://images.unsplash.com/photo-1705920824583-0e783235394d | `p_l2` |
| `W4` | Women's eastern wear | https://images.unsplash.com/photo-1733731402869-57e0cce24aea | `p_l3` |
| `W5` | Women's eastern wear | https://images.unsplash.com/photo-1733470381591-c5dfb9df3c3d | `p_l1`, `p_l4` |
| `W6` | Women's eastern wear | https://images.unsplash.com/photo-1701252072712-e939599623f2 | `p_l5` |
| `W7` | Women's eastern wear | https://images.unsplash.com/photo-1667665970124-2273c6ef3489 | `p_l6` |
| `W8` | Women's eastern wear | https://images.unsplash.com/photo-1655288828238-21d86ec971c3 | `p_l7` |
| `W9` | Women's eastern wear | https://images.unsplash.com/photo-1597983073540-684a10b15ab1 | `p_l8` |
| `W10` | Women's eastern wear | https://images.unsplash.com/photo-1704119142483-1269733bcedb | `p_l9` |
| `B1` | Bags | https://images.unsplash.com/photo-1598532163257-ae3c6b2524b6 | `p_b1` |
| `B2` | Bags | https://images.unsplash.com/photo-1584917865442-de89df76afd3 | `p_b2` |
| `B3` | Bags | https://images.unsplash.com/photo-1614179689702-355944cd0918 | `p_b3` |
| `B4` | Bags | https://images.unsplash.com/photo-1600857062241-98e5dba7f214 | `p_b4` |
| `B5` | Bags | https://images.unsplash.com/photo-1590874103328-eac38a683ce7 | `p_b5` |
| `B6` | Bags | https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d | `p_b6` |
| `B7` | Bags | https://images.unsplash.com/photo-1559563458-527698bf5295 | `p_b7` |
| `B8` | Bags | https://images.unsplash.com/photo-1591561954557-26941169b49e | `p_b8` |
| `M1` | Menswear | https://images.unsplash.com/photo-1770359993283-a2c2f386584e | `p_u1` |
| `M2` | Menswear | https://images.unsplash.com/photo-1785613590746-f57d638c7d38 | `p_u2` |
| `M3` | Menswear | https://images.unsplash.com/photo-1727835523545-70ee992b5763 | `p_u3` |
| `M4` | Menswear | https://images.unsplash.com/photo-1734418040900-e964f84e8abb | `p_u4` |
| `M5` | Menswear | https://images.unsplash.com/photo-1710624125523-3420db282dfe | `p_u5` |
| `M6` | Menswear | https://images.unsplash.com/photo-1624970415682-3f99fae61a94 | `p_u6` |
| `T1` | T-shirts | https://images.unsplash.com/photo-1581655353564-df123a1eb820 | `p_u7` |
| `T2` | T-shirts | https://images.unsplash.com/photo-1583743814966-8936f5b7be1a | `p_u8` |
| `T3` | T-shirts | https://images.unsplash.com/photo-1618354691373-d851c5c3a990 | `p_u9` |
| `T4` | T-shirts | https://images.unsplash.com/photo-1562157873-818bc0726f68 | `p_u10` |
| `T5` | T-shirts | https://images.unsplash.com/photo-1620799140408-edc6dcb6d633 | `p_u11` |
| `J1` | Jeans | https://images.unsplash.com/photo-1602293589930-45aad59ba3ab | `p_u12` |
| `J3` | Jeans | https://images.unsplash.com/photo-1624378439575-d8705ad7ae80 | `p_u13` |
| `J4` | Jeans | https://images.unsplash.com/photo-1714143136372-ddaf8b606da7 | `p_u14` |
| `S3` | Shoes | https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77 | `p_u15` |
| `S5` | Shoes | https://images.unsplash.com/photo-1560769629-975ec94e6a86 | `p_u16` |
| `X2` | Watches | https://images.unsplash.com/photo-1524805444758-089113d48a6d | `p_v16` |
| `X3` | Watches | https://images.unsplash.com/photo-1622434641406-a158123450f9 | `p_v17` |
| `X4` | Watches | https://images.unsplash.com/photo-1609587312208-cea54be969e7 | `p_v18` |
| `H1` | Headphones | https://images.unsplash.com/photo-1505740420928-5e560c06d30e | `p_v1` |
| `H2` | Headphones | https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb | `p_v1`, `p_v2` |
| `H3` | Headphones | https://images.unsplash.com/photo-1583394838336-acd977736f90 | `p_v3` |
| `H4` | Headphones | https://images.unsplash.com/photo-1613040809024-b4ef7ba99bc3 | `p_v4` |
| `H5` | Headphones | https://images.unsplash.com/photo-1484704849700-f032a568e944 | `p_v6` |
| `H6` | Headphones | https://images.unsplash.com/photo-1609081219090-a6d81d3085bf | `p_v5` |
| `E1` | Earbuds | https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46 | `p_v7` |
| `E2` | Earbuds | https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1 | `p_v8` |
| `E3` | Earbuds | https://images.unsplash.com/photo-1578319439584-104c94d37305 | `p_v9` |
| `P1` | Phone accessories | https://images.unsplash.com/photo-1535157412991-2ef801c1748b | `p_v10` |
| `P2` | Phone accessories | https://images.unsplash.com/photo-1623393884989-cb3663e431c5 | `p_v11` |
| `P3` | Phone accessories | https://images.unsplash.com/photo-1620786963525-4a74f1697a46 | `p_v12` |
| `PB1` | Power banks | https://images.unsplash.com/photo-1566554738544-d962991c3fee | `p_v13` |
| `PB2` | Power banks | https://images.unsplash.com/photo-1706275399494-fb26bbc5da63 | `p_v14` |
| `SW1` | Smartwatches | https://images.unsplash.com/photo-1461141346587-763ab02bced9 | `p_v15` |
