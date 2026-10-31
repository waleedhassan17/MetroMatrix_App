# Dummy catalogue photos

The dummy shop's product, store and banner photos (`networks/network/mock/shop/shopSeed.ts`, the `IMG` map) are loaded from Unsplash's image CDN. They are never bundled into the app. In mock mode `cdn()` (`utils/cdn/cdn.ts`) asks Unsplash for the rendered size.

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
| `G1` | Potatoes | https://images.unsplash.com/photo-1518977676601-b53f82aba655 | `p_g1`, `p_g2` |
| `G2` | Red onions | https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb | `p_g3`, `p_g4` |
| `G3` | Tomatoes | https://images.unsplash.com/photo-1582284540020-8acbe03f4924 | `p_g5` |
| `G4` | Green chillies | https://images.unsplash.com/photo-1576763595295-c0371a32af78 | `p_g6` |
| `G5` | Fresh coriander | https://images.unsplash.com/photo-1767156969831-0beee76fa958 | `p_g7` |
| `G6` | Fresh mint | https://images.unsplash.com/photo-1618130070080-91f4d55a2383 | `p_g8` |
| `G7` | Lemons | https://images.unsplash.com/photo-1590502593747-42a996133562 | `p_g9` |
| `G8` | Cucumbers | https://images.unsplash.com/photo-1449300079323-02e209d9d3a6 | `p_g10` |
| `G9` | Raw rice grains | https://images.unsplash.com/photo-1586201375761-83865001e31c | `p_g11` |
| `G10` | Flour | https://images.unsplash.com/photo-1627735483792-233bf632619b | `p_g12` |
| `G11` | Red lentils | https://images.unsplash.com/photo-1672660589379-891ab59588a8 | `p_g13` |
| `G12` | Oil in a glass bottle | https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5 | `p_g14` |
| `G13` | Butter in a jar (ghee stand-in) | https://images.unsplash.com/photo-1573812461383-e5f8b759d12e | `p_g15` |
| `G14` | A glass of milk | https://images.unsplash.com/photo-1517448931760-9bf4414148c5 | `p_g16` |
| `G15` | Bowl of plain yoghurt | https://images.unsplash.com/photo-1571212515416-fef01fc43637 | `p_g17` |
| `G16` | Brown eggs in a tray | https://images.unsplash.com/photo-1506976785307-8732e854ad03 | `p_g18` |
| `G17` | Raw chicken | https://images.unsplash.com/photo-1587593810167-a84920ea0781 | `p_g19` |
| `G18` | Raw beef (mince stand-in) | https://images.unsplash.com/photo-1783632666621-48b8a8b5ce88 | `p_g20` |
| `G19` | Granulated sugar | https://images.unsplash.com/photo-1673791031202-ebc0eea03bf2 | `p_g21` |
| `G20` | Red chilli powder on a spoon | https://images.unsplash.com/photo-1577563717655-919fc57789b4 | `p_g22` |
| `G21` | Whole spices | https://images.unsplash.com/photo-1581600140682-d4e68c8cde32 | `p_g23` |
| `G22` | Ginger, garlic and onions | https://images.unsplash.com/photo-1567752458426-b62144165409 | `p_g24` |
| `G23` | Vegetables on grocery shelves | https://images.unsplash.com/photo-1542838132-92c53300491e | Daily Basket cover |

# Health: demo doctors and banners

The dummy Health API (`networks/network/mock/health/healthSeed.ts`) gives its fictional doctors portraits and its home banners photos, all from Unsplash under the same licence. Like the shop's photos, they are loaded from Unsplash's CDN, never bundled. The Health home's own card and tile photos are bundled; see `assets/images/health/CREDITS.md`.

- **Demo profiles:** every seeded doctor is fictional. Each one's `about` ends with "(Demo profile: this doctor is fictional.)". The portraits are stock photos of real people, matched to each doctor's gender, so use them only in demo and dev data. A real doctor's own uploaded photo always replaces them.
- **Framing:** portraits ask Unsplash for a face-centred crop (`fit=facearea&facepad=3.2`); `cdn()` keeps that framing and changes only the size.
- **Banners:** each banner opens a specialty or one of Health's screens. Its photo shows that subject.

| Doctor | Name | Portrait | Photographer |
|---|---|---|---|
| `d_ayesha` | Ayesha Siddiqui | https://images.unsplash.com/photo-1659353888906-adb3e0041693 | [Fotos](https://unsplash.com/@fotospk) |
| `d_hina` | Hina Shah | https://images.unsplash.com/photo-1670191247079-f9713ae06dcf | [Kamal Hoseinianzade](https://unsplash.com/@teravis_sk) |
| `d_mariam` | Mariam Saleem | https://images.unsplash.com/photo-1757125736482-328a3cdd9743 | [Ike Ellyana](https://unsplash.com/@ikemotret20) |
| `d_farah` | Farah Naz | https://images.unsplash.com/photo-1713865467253-ce0ac8477d34 | [Look Studio](https://unsplash.com/@lookphoto) |
| `d_nida` | Nida Hussain | https://images.unsplash.com/photo-1623854767648-e7bb8009f0db | [Siednji Leon](https://unsplash.com/@siednji) |
| `d_saima` | Saima Rafiq | https://images.unsplash.com/photo-1678695972687-033fa0bdbac9 | [Ato Aikins](https://unsplash.com/@ato_aikins) |
| `d_rabia` | Rabia Qureshi | https://images.unsplash.com/photo-1559839734-2b71ea197ec2 | [Humberto Chávez](https://unsplash.com/@betoframe) |
| `d_sana_m` | Sana Mirza | https://images.unsplash.com/photo-1673865641073-4479f93a7776 | [Bermix Studio](https://unsplash.com/@bermixstudio) |
| `d_mehwish` | Mehwish Abbasi | https://images.unsplash.com/photo-1758691462651-611d730c5272 | [Vitaly Gariev](https://unsplash.com/@silverkblack) |
| `d_amna` | Amna Yousaf | https://images.unsplash.com/photo-1770134223774-13b735e29201 | [Beatriz Mendez](https://unsplash.com/@beatrizmendez) |
| `d_sadia` | Sadia Iqbal | https://images.unsplash.com/photo-1643297654416-05795d62e39c | [Eben Kassaye](https://unsplash.com/@ebengech) |
| `d_bilal` | Bilal Ahmed | https://images.unsplash.com/photo-1612349317150-e413f6a5b16d | [Usman Yousaf](https://unsplash.com/@usmanyousaf) |
| `d_usman` | Usman Tariq | https://images.unsplash.com/photo-1659353889416-fab1265eaa7f | [Fotos](https://unsplash.com/@fotospk) |
| `d_kamran` | Kamran Akhtar | https://images.unsplash.com/photo-1637059824899-a441006a6875 | [vaibhav vivian](https://unsplash.com/@vrahim11) |
| `d_imran` | Imran Chaudhry | https://images.unsplash.com/photo-1622253694242-abeb37a33e97 | [Bruno Rodrigues](https://unsplash.com/@naosouogagliasso) |
| `d_adeel` | Adeel Raza | https://images.unsplash.com/photo-1730597842283-943c7986ee2c | [Muhammad Hicham](https://unsplash.com/@drfox_) |
| `d_ahmed` | Ahmed Khan | https://images.unsplash.com/photo-1678940805950-73f2127f9d4e | [Frederick Medina](https://unsplash.com/@frederickjmedina) |
| `d_faisal` | Faisal Memon | https://images.unsplash.com/photo-1700041785712-649e859d9909 | [mohamad azaam](https://unsplash.com/@mreke88) |
| `d_zeeshan` | Zeeshan Ali | https://images.unsplash.com/photo-1769072610024-5b8a50f05c73 | [David Akinwale](https://unsplash.com/@jayex2) |
| `d_omar` | Omar Siddiqui | https://images.unsplash.com/photo-1666887360369-1901f341fdad | [Nappy](https://unsplash.com/@nappystudio) |
| `d_waqas` | Waqas Butt | https://images.unsplash.com/photo-1622902046580-2b47f47f5471 | [Dalton Ngangi](https://unsplash.com/@daltonngangi) |
| `d_tahir` | Tahir Mehmood | https://images.unsplash.com/photo-1659353888096-cc5e333db5e0 | [Fotos](https://unsplash.com/@fotospk) |
| `d_hamza` | Hamza Rauf | https://images.unsplash.com/photo-1756699279298-c89cdef354ab | [SoyBreno](https://unsplash.com/@soybrenofotografia) |

| Banner | Headline | Photo | Photographer |
|---|---|---|---|
| `hb_video` | See a doctor by video today | https://images.unsplash.com/photo-1758691463620-188ca7c1a04f | [Vitaly Gariev](https://unsplash.com/@silverkblack) |
| `hb_skin` | Skin and hair specialists | https://images.unsplash.com/photo-1688588162416-f7a7e726e0bf | [Anna Keibalo](https://unsplash.com/@anyutakejbalo) |
| `hb_symptoms` | Not sure who to see? | https://images.unsplash.com/photo-1758273241078-8eec353836be | [Vitaly Gariev](https://unsplash.com/@silverkblack) |
| `hb_child` | Gentle care for your child | https://images.unsplash.com/photo-1708687045004-a3e3c4420e6d | [Ortopediatri Çocuk Ortopedi Akademisi](https://unsplash.com/@ortopediatri) |
| `hb_family` | Your family's records, in one place | https://images.unsplash.com/photo-1632053002928-1919605ee6f7 | [CDC](https://unsplash.com/@cdc) |

## Food Court

The dummy Food Court's vendor covers and dish photos (`networks/network/mock/food/foodImages.ts`, the `FOOD_IMG` map) are also loaded from Unsplash's image CDN. Each was checked on its photo page as free under the Unsplash License (not Unsplash+). They stand in for the photos a vendor uploads.

- **Vendor names:** seeded vendor names are fictional.
- **Logos:** generated initials on the vendor's colour (placehold.co).
- **Left out:** photos showing another restaurant's name, packaging or watermark.

| Key | Subject | Photographer | Photo page |
|---|---|---|---|
| `biryani` | Bowl of biryani | Steve Tsang | https://unsplash.com/photos/OterGMpkdsM |
| `kebab` | Kebabs on a kettle grill | Z Grills Australia | https://unsplash.com/photos/n0zK35d967w |
| `kebabGrill` | Skewers on a BBQ pit | Z Grills Australia | https://unsplash.com/photos/jkP5KFVbpGg |
| `curry` | Chicken curry with naan | Mohammad Fahim | https://unsplash.com/photos/vl2y3qoKq3E |
| `tikka` | Naan, samosas and tikka | Neil Marshall | https://unsplash.com/photos/VGzwj6AXjJM |
| `burger` | Cheeseburger and fries | Hybrid Storytellers | https://unsplash.com/photos/lzKFHmEVnrM |
| `pizza` | A slice of pizza | Inna Safa | https://unsplash.com/photos/pwEDmiquo4U |
| `thali` | Rice, daal and curry on one plate | Abhishek Sanwa Limbu | https://unsplash.com/photos/5Q-7kgG7xbo |
| `shawarma` | Beef shawarma | Alexander Mils | https://unsplash.com/photos/SNLfVYmL8os |
| `noodles` | Plate of noodles | Debbie Tea | https://unsplash.com/photos/LO7rNP0LRro |
| `fries` | A box of fries | Josh Duke | https://unsplash.com/photos/PtFTpdv-aWw |
| `friesTray` | Fries with dips | henry perks | https://unsplash.com/photos/O-SfuUoZUDs |
| `chai` | A glass of tea | Mehrshad Rajabi | https://unsplash.com/photos/BRVpzGwNzzI |
| `salad` | Vegetable salad bowl | Anna Pelzer | https://unsplash.com/photos/IGfIGP5ONV0 |
| `cake` | Slice of chocolate cake | Taylor Kiser | https://unsplash.com/photos/tCnOMWITk_4 |
