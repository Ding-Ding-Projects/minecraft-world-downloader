import { a11y, el } from './a11y';
import { i18n } from './i18n';
import type { Catalogue, FunnyLadder, TranslationEntry } from './registry';
import type { DimSumDraw } from '../../shared/api';

/**
 * The dim sum surprise: its data layer, its photograph cache and its surface.
 *
 * The main process draws once per launch, ten times in a hundred, and hands the
 * roll and the probability across so the odds stay auditable rather than
 * asserted. This module owns everything after that: which dish, what it is
 * called, where its photograph comes from, and the small card that shows it.
 *
 * Four things are worth knowing before editing this file.
 *
 * **No photograph is stored in this repository.** Not a PNG, not a JPEG, not a
 * base64 blob pretending to be a constant. The public dim sum photo catalogue
 * owns the pictures, and this application resolves them from that project's
 * published release assets at runtime. What is bundled here is metadata text
 * only: an identifier, the dish's two names, its alternative text and the asset
 * filename, copied from the public catalogue index with the source URL and the
 * fetch date recorded beside it.
 *
 * **It cannot be turned off.** There is no setting, no hidden flag and no
 * environment variable that disables it, and there never will be. That is only
 * polite because the surface is so careful: it never gates startup, never takes
 * focus, never appears during a first run, an error path, an update or while the
 * user is mid-task, and it dismisses itself.
 *
 * **The named study mode suppresses it entirely.** While that mode is on, every
 * dim sum capability behaves as though it were not installed — no surface, no
 * copy, no photograph request, no trace of it anywhere.
 *
 * **An unavailable photograph is said out loud.** Offline, a removed asset, a
 * truncated download or a cache that no longer parses all end the same way: the
 * dish's real name is shown and the card says plainly that the picture could not
 * be fetched. Nothing is ever substituted for it.
 */

/* ------------------------------------------------------------------ */
/* Where the data came from                                            */
/* ------------------------------------------------------------------ */

/**
 * Provenance for the bundled snapshot below.
 *
 * `indexUrl` is the only authority for dish names. `assetBaseUrl` plus a release
 * tag and an asset filename is the only authority for a photograph. Neither is
 * re-derived, guessed or mirrored anywhere else in this repository.
 */
export const DIM_SUM_CATALOG_SOURCE = {
  /** The public catalogue project. Photographs are generated and published there, never here. */
  repository: 'https://github.com/Ding-Ding-Projects/dim-sum-photos',
  /** The catalogue index the snapshot below was copied from. */
  indexUrl: 'https://raw.githubusercontent.com/Ding-Ding-Projects/dim-sum-photos/main/catalog/index.json',
  /** Release-asset download prefix. A photograph URL is `${assetBaseUrl}/${releaseTag}/${assetFileName}`. */
  assetBaseUrl: 'https://github.com/Ding-Ding-Projects/dim-sum-photos/releases/download',
  /** `schemaVersion` as the index reported it when the snapshot was taken. */
  schemaVersion: '1.0.0',
  /** `catalogStatus` as the index reported it. The catalogue is still growing. */
  catalogStatus: 'in-progress',
  /** `total` as the index reported it: the number of dishes the catalogue held. */
  catalogTotal: 2866,
  /** The date the index was read, in UTC. */
  fetchedAt: '2026-08-13',
  /** The published photo releases the snapshot's assets live in. */
  releaseTags: ['catalog-v1', 'catalog-v1-part-002', 'catalog-v1-part-003'],
  /**
   * The snapshot is a verified subset, not the whole catalogue: every entry below
   * was checked against its published release asset on the fetch date, and the
   * subset is spread evenly across the catalogue rather than taken from the
   * front of it. The full catalogue stays where it belongs — in the public
   * project — and is never copied here.
   */
  snapshotIsSubset: true
} as const;

/* ------------------------------------------------------------------ */
/* The bundled metadata snapshot                                       */
/* ------------------------------------------------------------------ */

export interface DimSumDish {
  /** Stable catalogue identifier, e.g. `hk-dish-0001`. */
  id: string;
  /** Catalogue slug, e.g. `classic-har-gow`. */
  slug: string;
  /** English name exactly as the catalogue records it. */
  nameEn: string;
  /** Traditional Chinese name exactly as the catalogue records it. */
  nameZhHant: string;
  /** Catalogue category, e.g. `steamed-dim-sum`. */
  category: string;
  /** Which published photo release carries this dish's asset. */
  releaseTag: string;
  /** The asset filename inside that release. */
  assetFileName: string;
  /** The catalogue's own English alternative text for the photograph. */
  altEn: string;
  /** The catalogue's own Cantonese alternative text for the photograph. */
  altYue: string;
}

function d(
  id: string,
  slug: string,
  nameEn: string,
  nameZhHant: string,
  category: string,
  releaseTag: string,
  assetFileName: string,
  altEn: string,
  altYue: string
): DimSumDish {
  return { id, slug, nameEn, nameZhHant, category, releaseTag, assetFileName, altEn, altYue };
}

/**
 * Dishes, names only.
 *
 * Every row is a real catalogue record. Nothing here is invented, and no image
 * bytes live in this file or anywhere else in this repository.
 */
export const DISHES: DimSumDish[] = [
  d('hk-dish-0001', 'classic-har-gow', 'Classic Har Gow', '蝦餃', 'steamed-dim-sum', 'catalog-v1', 'hk-dish-0001-classic-har-gow.png', 'Warm tea-house photograph of Classic Har Gow', '港式茶樓木枱上嘅蝦餃'),
  d('hk-dish-0018', 'fish-maw-siu-mai', 'Fish Maw Siu Mai', '花膠燒賣', 'steamed-dim-sum', 'catalog-v1', 'hk-dish-0018-fish-maw-siu-mai.png', 'Warm tea-house photograph of Fish Maw Siu Mai', '港式茶樓木枱上嘅花膠燒賣'),
  d('hk-dish-0035', 'fish-stuffed-bitter-melon', 'Steamed Bitter Melon Stuffed with Fish', '鯪魚釀苦瓜', 'steamed-dim-sum', 'catalog-v1', 'hk-dish-0035-fish-stuffed-bitter-melon.png', 'Warm tea-house photograph of Steamed Bitter Melon Stuffed with Fish', '港式茶樓木枱上嘅鯪魚釀苦瓜'),
  d('hk-dish-0052', 'snowy-char-siu-bao', 'Snowy Char Siu Bao', '雪山叉燒包', 'buns-and-cakes', 'catalog-v1', 'hk-dish-0052-snowy-char-siu-bao.png', 'Warm tea-house photograph of Snowy Char Siu Bao', '港式茶樓木枱上嘅雪山叉燒包'),
  d('hk-dish-0069', 'hedgehog-red-bean-bao', 'Hedgehog Red Bean Bao', '刺蝟豆沙包', 'buns-and-cakes', 'catalog-v1', 'hk-dish-0069-hedgehog-red-bean-bao.png', 'Warm tea-house photograph of Hedgehog Red Bean Bao', '港式茶樓木枱上嘅刺蝟豆沙包'),
  d('hk-dish-0086', 'red-date-cake', 'Red Date Cake', '紅棗糕', 'buns-and-cakes', 'catalog-v1', 'hk-dish-0086-red-date-cake.png', 'Warm tea-house photograph of Red Date Cake', '港式茶樓木枱上嘅紅棗糕'),
  d('hk-dish-0103', 'taro-spring-rolls', 'Taro Spring Rolls', '芋絲春卷', 'fried-and-baked', 'catalog-v1', 'hk-dish-0103-taro-spring-rolls.png', 'Warm tea-house photograph of Taro Spring Rolls', '港式茶樓木枱上嘅芋絲春卷'),
  d('hk-dish-0120', 'orange-chocolate-bao', 'Orange Chocolate Bao', '香橙朱古力包', 'buns-and-cakes', 'catalog-v1', 'hk-dish-0120-orange-chocolate-bao.png', 'Warm tea-house photograph of Orange Chocolate Bao', '港式茶樓木枱上嘅香橙朱古力包'),
  d('hk-dish-0137', 'pan-fried-stuffed-peppers', 'Pan-Fried Stuffed Green Peppers', '煎釀青椒', 'fried-and-baked', 'catalog-v1', 'hk-dish-0137-pan-fried-stuffed-peppers.png', 'Warm tea-house photograph of Pan-Fried Stuffed Green Peppers', '港式茶樓木枱上嘅煎釀青椒'),
  d('hk-dish-0154', 'char-siu-rice-noodle-rolls', 'Char Siu Rice Noodle Rolls', '叉燒腸粉', 'rice-rolls-and-dumplings', 'catalog-v1', 'hk-dish-0154-char-siu-rice-noodle-rolls.png', 'Warm tea-house photograph of Char Siu Rice Noodle Rolls', '港式茶樓木枱上嘅叉燒腸粉'),
  d('hk-dish-0171', 'cantonese-wontons', 'Cantonese Shrimp Wontons', '鮮蝦雲吞', 'rice-rolls-and-dumplings', 'catalog-v1', 'hk-dish-0171-cantonese-wontons.png', 'Warm tea-house photograph of Cantonese Shrimp Wontons', '港式茶樓木枱上嘅鮮蝦雲吞'),
  d('hk-dish-0188', 'steamed-lotus-root-dumplings', 'Steamed Lotus Root Dumplings', '蓮藕素餃', 'rice-rolls-and-dumplings', 'catalog-v1', 'hk-dish-0188-steamed-lotus-root-dumplings.png', 'Warm tea-house photograph of Steamed Lotus Root Dumplings', '港式茶樓木枱上嘅蓮藕素餃'),
  d('hk-dish-0205', 'beef-congee', 'Beef Congee', '牛肉粥', 'rice-and-congee', 'catalog-v1', 'hk-dish-0205-beef-congee.png', 'Warm tea-house photograph of Beef Congee', '港式茶樓木枱上嘅牛肉粥'),
  d('hk-dish-0222', 'stockfish-peanut-congee', 'Dried Stockfish and Peanut Congee', '柴魚花生粥', 'rice-and-congee', 'catalog-v1', 'hk-dish-0222-stockfish-peanut-congee.png', 'Warm tea-house photograph of Dried Stockfish and Peanut Congee', '港式茶樓木枱上嘅柴魚花生粥'),
  d('hk-dish-0239', 'steamed-milk-pudding', 'Steamed Milk Pudding', '燉奶', 'tea-house-sweets', 'catalog-v1', 'hk-dish-0239-steamed-milk-pudding.png', 'Warm tea-house photograph of Steamed Milk Pudding', '港式茶樓木枱上嘅燉奶'),
  d('hk-dish-0256', 'crispy-roast-pork-belly', 'Crispy Roast Pork Belly', '燒肉', 'Siu mei and roast meats', 'catalog-v1', 'hk-dish-0256-crispy-roast-pork-belly.png', 'Close catalog photograph of Crispy Roast Pork Belly served on Hong Kong restaurant tableware.', '港式「燒肉」用餐廳器皿上枱嘅近鏡菜式相。'),
  d('hk-dish-0273', 'salt-and-pepper-pork-chop', 'Salt and Pepper Pork Chop', '椒鹽豬扒', 'Pork', 'catalog-v1', 'hk-dish-0273-salt-and-pepper-pork-chop.png', 'Close catalog photograph of Salt and Pepper Pork Chop served on Hong Kong restaurant tableware.', '港式「椒鹽豬扒」用餐廳器皿上枱嘅近鏡菜式相。'),
  d('hk-dish-0290', 'stir-fried-pork-neck-with-xo-sauce', 'Stir-Fried Pork Neck with XO Sauce', 'XO醬炒豬頸肉', 'Pork', 'catalog-v1', 'hk-dish-0290-stir-fried-pork-neck-with-xo-sauce.png', 'Close catalog photograph of Stir-Fried Pork Neck with XO Sauce served on Hong Kong restaurant tableware.', '港式「XO醬炒豬頸肉」用餐廳器皿上枱嘅近鏡菜式相。'),
  d('hk-dish-0307', 'honey-pepper-beef-short-ribs', 'Honey Pepper Beef Short Ribs', '蜜椒牛仔骨', 'Beef', 'catalog-v1', 'hk-dish-0307-honey-pepper-beef-short-ribs.png', 'Close catalog photograph of Honey Pepper Beef Short Ribs served on Hong Kong restaurant tableware.', '港式「蜜椒牛仔骨」用餐廳器皿上枱嘅近鏡菜式相。'),
  d('hk-dish-0324', 'kung-pao-chicken', 'Kung Pao Chicken', '宮保雞丁', 'Poultry', 'catalog-v1', 'hk-dish-0324-kung-pao-chicken.png', 'Close catalog photograph of Kung Pao Chicken served on Hong Kong restaurant tableware.', '港式「宮保雞丁」用餐廳器皿上枱嘅近鏡菜式相。'),
  d('hk-dish-0341', 'steamed-grouper-with-ginger-and-scallion', 'Steamed Grouper with Ginger and Scallion', '清蒸石斑', 'Seafood', 'catalog-v1', 'hk-dish-0341-steamed-grouper-with-ginger-and-scallion.png', 'Close catalog photograph of Steamed Grouper with Ginger and Scallion served on Hong Kong restaurant tableware.', '港式「清蒸石斑」用餐廳器皿上枱嘅近鏡菜式相。'),
  d('hk-dish-0358', 'fried-dace-with-salted-black-beans', 'Fried Dace with Salted Black Beans', '豆豉鯪魚', 'Seafood', 'catalog-v1', 'hk-dish-0358-fried-dace-with-salted-black-beans.png', 'Close catalog photograph of Fried Dace with Salted Black Beans served on Hong Kong restaurant tableware.', '港式「豆豉鯪魚」用餐廳器皿上枱嘅近鏡菜式相。'),
  d('hk-dish-0375', 'scallops-with-black-bean-sauce', 'Scallops with Black Bean Sauce', '豉汁炒帶子', 'Seafood', 'catalog-v1', 'hk-dish-0375-scallops-with-black-bean-sauce.png', 'Close catalog photograph of Scallops with Black Bean Sauce served on Hong Kong restaurant tableware.', '港式「豉汁炒帶子」用餐廳器皿上枱嘅近鏡菜式相。'),
  d('hk-dish-0392', 'home-style-tofu', 'Home-Style Tofu', '家常豆腐', 'Tofu and vegetables', 'catalog-v1', 'hk-dish-0392-home-style-tofu.png', 'Close catalog photograph of Home-Style Tofu served on Hong Kong restaurant tableware.', '港式「家常豆腐」用餐廳器皿上枱嘅近鏡菜式相。'),
  d('hk-dish-0409', 'claypot-rice-with-salted-fish-and-pork-patty', 'Claypot Rice with Salted Fish and Pork Patty', '薑香鹹魚肉餅煲仔飯', 'Claypot and banquet', 'catalog-v1', 'hk-dish-0409-claypot-rice-with-salted-fish-and-pork-patty.png', 'Close catalog photograph of Claypot Rice with Salted Fish and Pork Patty served on Hong Kong restaurant tableware.', '港式「薑香鹹魚肉餅煲仔飯」用餐廳器皿上枱嘅近鏡菜式相。'),
  d('hk-dish-0426', 'old-cucumber-pork-bone-soup', 'Old Cucumber Pork Bone Soup', '老黃瓜煲豬骨', 'Soup', 'catalog-v1', 'hk-dish-0426-old-cucumber-pork-bone-soup.png', 'Close catalog photograph of Old Cucumber Pork Bone Soup served on Hong Kong restaurant tableware.', '港式「老黃瓜煲豬骨」用餐廳器皿上枱嘅近鏡菜式相。'),
  d('hk-dish-0443', 'double-boiled-ginseng-silkie-chicken-soup', 'Double-Boiled Ginseng Silkie Chicken Soup', '花旗參燉竹絲雞', 'Soup', 'catalog-v1', 'hk-dish-0443-double-boiled-ginseng-silkie-chicken-soup.png', 'Close catalog photograph of Double-Boiled Ginseng Silkie Chicken Soup served on Hong Kong restaurant tableware.', '港式「花旗參燉竹絲雞」用餐廳器皿上枱嘅近鏡菜式相。'),
  d('hk-dish-0460', 'raspberry-chocolate-fried-wonton', 'Raspberry Chocolate Fried Wonton', '紅莓朱古力炸雲吞', 'Chocolate dim sum', 'catalog-v1', 'hk-dish-0460-raspberry-chocolate-fried-wonton.png', 'Close catalog photograph of chocolate-filled Raspberry Chocolate Fried Wonton served on Hong Kong restaurant tableware.', '朱古力餡「紅莓朱古力炸雲吞」用港式餐廳器皿上枱嘅近鏡點心相。'),
  d('hk-dish-0477', 'two-choice-siu-mei-rice', 'Two-Choice Siu Mei Rice', '燒味雙拼飯', 'Rice', 'catalog-v1', 'hk-dish-0477-two-choice-siu-mei-rice.png', 'Close catalog photograph of Two-Choice Siu Mei Rice served on Hong Kong restaurant tableware.', '港式「燒味雙拼飯」用餐廳器皿上枱嘅近鏡菜式相。'),
  d('hk-dish-0494', 'claypot-rice-with-preserved-duck-and-sausage', 'Claypot Rice with Preserved Duck and Sausage', '臘鴨臘腸煲仔飯', 'Rice', 'catalog-v1', 'hk-dish-0494-claypot-rice-with-preserved-duck-and-sausage.png', 'Close catalog photograph of Claypot Rice with Preserved Duck and Sausage served on Hong Kong restaurant tableware.', '港式「臘鴨臘腸煲仔飯」用餐廳器皿上枱嘅近鏡菜式相。'),
  d('hk-dish-0511', 'chocolate-egg-waffles', 'Chocolate Egg Waffles', '朱古力雞蛋仔', 'Street Food', 'catalog-v1', 'hk-dish-0511-chocolate-egg-waffles.png', 'A single serving of Chocolate Egg Waffles, a cocoa-brown bubble waffle with evenly formed crisp bubbles.', '一份擺喺香港雞蛋仔小檔嘅朱古力雞蛋仔。'),
  d('hk-dish-0528', 'dai-pai-dong-style-typhoon-shelter-crab', 'Dai Pai Dong-Style Typhoon Shelter Crab', '大牌檔式避風塘炒蟹', 'Dai Pai Dong', 'catalog-v1', 'hk-dish-0528-dai-pai-dong-style-typhoon-shelter-crab.png', 'A single serving of Dai Pai Dong-Style Typhoon Shelter Crab, cracked crab pieces buried in a generous mound of crisp fried garlic and chilli crumbs.', '一份擺喺香港大牌檔嘅舊雲石枱嘅大牌檔式避風塘炒蟹。'),
  d('hk-dish-0545', 'satay-vermicelli-seafood-claypot', 'Satay Vermicelli Seafood Claypot', '沙爹海鮮粉絲煲', 'Dai Pai Dong', 'catalog-v1', 'hk-dish-0545-satay-vermicelli-seafood-claypot.png', 'A single serving of Satay Vermicelli Seafood Claypot, glass noodles tangled with shrimp and squid in a fragrant satay claypot.', '一份擺喺香港大牌檔嘅舊雲石枱嘅沙爹海鮮粉絲煲。'),
  d('hk-dish-0562', 'hong-kong-fujian-fried-rice', 'Hong Kong Fujian Fried Rice', '港式福建炒飯', 'Cha Chaan Teng', 'catalog-v1', 'hk-dish-0562-hong-kong-fujian-fried-rice.png', 'A single serving of Hong Kong Fujian Fried Rice, egg fried rice covered with a glossy seafood chicken and mushroom gravy.', '一份擺喺懷舊香港茶餐廳入面嘅綠邊枱嘅港式福建炒飯。'),
  d('hk-dish-0579', 'ovaltine-french-toast', 'Ovaltine French Toast', '阿華田西多士', 'Cha Chaan Teng', 'catalog-v1', 'hk-dish-0579-ovaltine-french-toast.png', 'A single serving of Ovaltine French Toast, crisp French toast filled and dusted with malted chocolate drink powder.', '一份擺喺懷舊香港茶餐廳入面嘅綠邊枱嘅阿華田西多士。'),
  d('hk-dish-0596', 'tomato-and-egg-sandwich', 'Tomato and Egg Sandwich', '番茄蛋治', 'Cha Chaan Teng', 'catalog-v1', 'hk-dish-0596-tomato-and-egg-sandwich.png', 'A single serving of Tomato and Egg Sandwich, soft bread triangles filled with fluffy egg and fresh red tomato slices.', '一份擺喺懷舊香港茶餐廳入面嘅綠邊枱嘅番茄蛋治。'),
  d('hk-dish-0613', 'black-sesame-swiss-roll', 'Black Sesame Swiss Roll', '黑芝麻瑞士卷', 'Hong Kong Bakery', 'catalog-v1', 'hk-dish-0613-black-sesame-swiss-roll.png', 'A single serving of Black Sesame Swiss Roll, soft grey sesame-flecked sponge rolled around contrasting pale cream.', '一份擺喺傳統香港餅店入面嘅玻璃面陳列盤嘅黑芝麻瑞士卷。'),
  d('hk-dish-0630', 'hong-kong-dessert-shop-red-bean-sweet-soup', 'Hong Kong Dessert-Shop Red Bean Sweet Soup', '香港糖水舖陳皮紅豆沙', 'Hong Kong Dessert', 'catalog-v1', 'hk-dish-0630-hong-kong-dessert-shop-red-bean-sweet-soup.png', 'A single serving of Hong Kong Dessert-Shop Red Bean Sweet Soup, a thick burgundy red-bean soup with softened beans and a curl of tangerine peel.', '一份喺溫暖嘅香港糖水舖大理石枱上擺好嘅香港糖水舖陳皮紅豆沙。'),
  d('hk-dish-0647', 'bean-curd-sheet-and-egg-sweet-soup', 'Bean Curd Sheet and Egg Sweet Soup', '腐竹雞蛋糖水', 'Hong Kong Dessert', 'catalog-v1', 'hk-dish-0647-bean-curd-sheet-and-egg-sweet-soup.png', 'A single serving of Bean Curd Sheet and Egg Sweet Soup, pale silky bean-curd-sheet soup with soft ribbons of egg and ginkgo nuts.', '一份喺溫暖嘅香港糖水舖大理石枱上擺好嘅腐竹雞蛋糖水。'),
  d('hk-dish-0664', 'alkaline-rice-dumpling', 'Alkaline Rice Dumpling', '鹼水糉', 'Festival Food', 'catalog-v1', 'hk-dish-0664-alkaline-rice-dumpling.png', 'A single serving of Alkaline Rice Dumpling, a translucent golden triangular rice dumpling unwrapped beside a small pool of syrup.', '一份擺喺香港端午節家庭餐枱嘅鹼水糉。'),
  d('hk-dish-0681', 'hong-kong-red-bean-ice', 'Hong Kong Red Bean Ice', '港式紅豆冰', 'Hong Kong Drinks', 'catalog-v1', 'hk-dish-0681-hong-kong-red-bean-ice.png', 'A single serving of Hong Kong Red Bean Ice, a tall glass layered with red beans crushed ice and milky syrup.', '一份擺喺懷舊香港茶餐廳入面嘅綠邊枱嘅港式紅豆冰。'),
  d('hk-dish-0698', 'grass-jelly-ice-cream-float', 'Grass Jelly Ice Cream Float', '涼粉雪糕冰', 'Hong Kong Drinks', 'catalog-v1', 'hk-dish-0698-grass-jelly-ice-cream-float.png', 'A single serving of Grass Jelly Ice Cream Float, black grass-jelly cubes and crushed ice topped with one vanilla ice-cream scoop.', '一份擺喺懷舊香港茶餐廳入面嘅綠邊枱嘅涼粉雪糕冰。'),
  d('hk-dish-0715', 'crispy-sugar-rings', 'Crispy Sugar Rings', '糖環', 'Nostalgic Hong Kong', 'catalog-v1', 'hk-dish-0715-crispy-sugar-rings.png', 'A single serving of Crispy Sugar Rings, delicate lattice-patterned fried rings with a pale crisp sugar glaze.', '一份擺喺懷舊香港街坊舖入面嘅斑點櫃枱嘅糖環。'),
  d('hk-dish-0732', 'three-treasure-roast-meat-rice', 'Three-Treasure Roast Meat Rice', '燒味三寶飯', 'Roast Meat and Staples', 'catalog-v1', 'hk-dish-0732-three-treasure-roast-meat-rice.png', 'A single serving of Three-Treasure Roast Meat Rice, three distinct roast meats fanned over rice with bright green vegetables.', '一份擺喺香港燒味舖入面嘅細枱嘅燒味三寶飯。'),
  d('hk-dish-0749', 'cha-chaan-teng-roast-goose-rice', 'Cha Chaan Teng Roast Goose Rice', '茶記燒鵝飯', 'Roast Meat and Staples', 'catalog-v1', 'hk-dish-0749-cha-chaan-teng-roast-goose-rice.png', 'A single serving of Cha Chaan Teng Roast Goose Rice, lacquered chopped roast goose laid over rice with bright blanched greens.', '一份擺喺香港燒味舖入面嘅細枱嘅茶記燒鵝飯。'),
  d('hk-dish-0766', 'classic-crystal-beetroot-and-lotus-root-dumpling', 'Classic Crystal Beetroot and Lotus Root Dumpling', '水晶紅菜頭蓮藕餃', 'vegetarian-dim-sum', 'catalog-v1', 'hk-dish-0766-classic-crystal-beetroot-and-lotus-root-dumpling.png', 'Classic Crystal Beetroot and Lotus Root Dumpling presented as one freshly prepared Hong Kong dish on a ceramic plate.', '一碟新鮮整好嘅水晶紅菜頭蓮藕餃，用陶瓷碟上枱。'),
  d('hk-dish-0783', 'pumpkin-curry-potato-steamed-bun', 'Pumpkin Curry Potato Steamed Bun', '南瓜皮咖喱薯仔包', 'vegetarian-dim-sum', 'catalog-v1', 'hk-dish-0783-pumpkin-curry-potato-steamed-bun.png', 'Pumpkin Curry Potato Steamed Bun presented as one freshly prepared Hong Kong dish on a ceramic plate.', '一碟新鮮整好嘅南瓜皮咖喱薯仔包，用陶瓷碟上枱。'),
  d('hk-dish-0800', 'matcha-white-chocolate-lava-bun', 'Matcha White Chocolate Lava Bun', '抹茶白巧克力流心包', 'chocolate-filled-dim-sum', 'catalog-v1', 'hk-dish-0800-matcha-white-chocolate-lava-bun.png', 'Matcha White Chocolate Lava Bun with one piece opened to show its chocolate filling.', '抹茶白巧克力流心包切開一件，清楚見到入面嘅巧克力餡。'),
  d('hk-dish-0817', 'baked-puff-with-lotus-root-and-snow-pea-filling', 'Baked Puff with Lotus Root and Snow Pea Filling', '蓮藕荷蘭豆焗酥', 'vegetarian-dim-sum', 'catalog-v1', 'hk-dish-0817-baked-puff-with-lotus-root-and-snow-pea-filling.png', 'Baked Puff with Lotus Root and Snow Pea Filling presented as one freshly prepared Hong Kong dish on a ceramic plate.', '一碟新鮮整好嘅蓮藕荷蘭豆焗酥，用陶瓷碟上枱。'),
  d('hk-dish-0834', 'ginger-mushroom-stuffed-tofu', 'Ginger Mushroom Stuffed Tofu', '薑汁雜菌釀豆腐', 'vegetarian-main-dishes', 'catalog-v1', 'hk-dish-0834-ginger-mushroom-stuffed-tofu.png', 'Ginger Mushroom Stuffed Tofu presented as one freshly prepared Hong Kong dish on a ceramic plate.', '一碟新鮮整好嘅薑汁雜菌釀豆腐，用陶瓷碟上枱。'),
  d('hk-dish-0851', 'steamed-ginger-mushroom-and-bamboo-shoot-bean-curd-sheet-roll', 'Steamed Ginger Mushroom and Bamboo Shoot Bean Curd Sheet Roll', '薑汁蒸冬菇竹筍腐皮卷', 'vegetarian-main-dishes', 'catalog-v1', 'hk-dish-0851-steamed-ginger-mushroom-and-bamboo-shoot-bean-curd-sheet-roll.png', 'Steamed Ginger Mushroom and Bamboo Shoot Bean Curd Sheet Roll presented as one freshly prepared Hong Kong dish on a ceramic plate.', '一碟新鮮整好嘅薑汁蒸冬菇竹筍腐皮卷，用陶瓷碟上枱。'),
  d('hk-dish-0868', 'salt-and-pepper-crispy-water-chestnut-and-celery-bean-curd-sheet-roll', 'Salt-and-Pepper Crispy Water Chestnut and Celery Bean Curd Sheet Roll', '椒鹽脆炸馬蹄西芹腐皮卷', 'vegetarian-main-dishes', 'catalog-v1', 'hk-dish-0868-salt-and-pepper-crispy-water-chestnut-and-celery-bean-curd-sheet-roll.png', 'Salt-and-Pepper Crispy Water Chestnut and Celery Bean Curd Sheet Roll presented as one freshly prepared Hong Kong dish on a ceramic plate.', '一碟新鮮整好嘅椒鹽脆炸馬蹄西芹腐皮卷，用陶瓷碟上枱。'),
  d('hk-dish-0885', 'three-mushroom-choy-sum', 'Three-Mushroom Choy Sum', '三菇扒菜心', 'vegetarian-main-dishes', 'catalog-v1', 'hk-dish-0885-three-mushroom-choy-sum.png', 'Three-Mushroom Choy Sum presented as one freshly prepared Hong Kong dish on a ceramic plate.', '一碟新鮮整好嘅三菇扒菜心，用陶瓷碟上枱。'),
  d('hk-dish-0902', 'ginger-scallion-king-oyster-mushroom', 'Ginger Scallion King Oyster Mushroom', '薑蔥杏鮑菇', 'vegetarian-main-dishes', 'catalog-v1', 'hk-dish-0902-ginger-scallion-king-oyster-mushroom.png', 'Ginger Scallion King Oyster Mushroom presented as one freshly prepared Hong Kong dish on a ceramic plate.', '一碟新鮮整好嘅薑蔥杏鮑菇，用陶瓷碟上枱。'),
  d('hk-dish-0919', 'claypot-shimeji-mushroom', 'Claypot Shimeji Mushroom', '啫啫煲鴻喜菇', 'vegetarian-main-dishes', 'catalog-v1', 'hk-dish-0919-claypot-shimeji-mushroom.png', 'Claypot Shimeji Mushroom presented as one freshly prepared Hong Kong dish on a ceramic plate.', '一碟新鮮整好嘅啫啫煲鴻喜菇，用陶瓷碟上枱。'),
  d('hk-dish-0936', 'mixed-mushroom-rice-congee', 'Mixed Mushroom Rice Congee', '雜菌粥', 'vegetarian-staples', 'catalog-v1', 'hk-dish-0936-mixed-mushroom-rice-congee.png', 'Mixed Mushroom Rice Congee presented as one freshly prepared Hong Kong dish on a ceramic plate.', '一碟新鮮整好嘅雜菌粥，用陶瓷碟上枱。'),
  d('hk-dish-0953', 'plant-based-char-siu-lo-mein', 'Plant-Based Char Siu Lo Mein', '植物叉燒撈麵', 'plant-based-hong-kong-classics', 'catalog-v1', 'hk-dish-0953-plant-based-char-siu-lo-mein.png', 'Plant-Based Char Siu Lo Mein presented as one freshly prepared Hong Kong dish on a ceramic plate.', '一碟新鮮整好嘅植物叉燒撈麵，用陶瓷碟上枱。'),
  d('hk-dish-0970', 'plant-based-curry-beef-claypot', 'Plant-Based Curry Beef Claypot', '植物咖喱牛肉煲仔', 'plant-based-hong-kong-classics', 'catalog-v1', 'hk-dish-0970-plant-based-curry-beef-claypot.png', 'Plant-Based Curry Beef Claypot presented as one freshly prepared Hong Kong dish on a ceramic plate.', '一碟新鮮整好嘅植物咖喱牛肉煲仔，用陶瓷碟上枱。'),
  d('hk-dish-0987', 'salt-and-pepper-eggplant', 'Salt-and-Pepper Eggplant', '椒鹽茄子', 'contemporary-hong-kong-small-plates', 'catalog-v1', 'hk-dish-0987-salt-and-pepper-eggplant.png', 'Salt-and-Pepper Eggplant presented as one freshly prepared Hong Kong dish on a ceramic plate.', '一碟新鮮整好嘅椒鹽茄子，用陶瓷碟上枱。'),
  d('hk-dish-1004', 'preserved-lemon-shrimp-and-yellow-chive-dumpling', 'Preserved-Lemon Shrimp and Yellow Chive Dumpling', '鹹檸蝦仁韭黃餃', 'seafood-dim-sum', 'catalog-v1-part-002', 'hk-dish-1004-preserved-lemon-shrimp-and-yellow-chive-dumpling.png', 'Preserved-Lemon Shrimp and Yellow Chive Dumpling presented as one freshly prepared Hong Kong dish.', '一份新鮮整好嘅鹹檸蝦仁韭黃餃，按傳統港式擺法上枱。'),
  d('hk-dish-1021', 'tea-house-crystal-dace-and-tangerine-peel-dumpling', 'Tea-House Crystal Dace and Tangerine Peel Dumpling', '茶樓水晶鯪魚陳皮餃', 'seafood-dim-sum', 'catalog-v1-part-002', 'hk-dish-1021-tea-house-crystal-dace-and-tangerine-peel-dumpling.png', 'Tea-House Crystal Dace and Tangerine Peel Dumpling presented as one freshly prepared Hong Kong dish.', '一份新鮮整好嘅茶樓水晶鯪魚陳皮餃，按傳統港式擺法上枱。'),
  d('hk-dish-1038', 'tangerine-peel-beef-and-water-chestnut-open-top-siu-mai', 'Tangerine-Peel Beef and Water Chestnut Open-Top Siu Mai', '陳皮牛肉馬蹄開口燒賣', 'meat-dim-sum', 'catalog-v1-part-002', 'hk-dish-1038-tangerine-peel-beef-and-water-chestnut-open-top-siu-mai.png', 'Tangerine-Peel Beef and Water Chestnut Open-Top Siu Mai presented as one freshly prepared Hong Kong dish.', '一份新鮮整好嘅陳皮牛肉馬蹄開口燒賣，按傳統港式擺法上枱。'),
  d('hk-dish-1055', 'first-draw-soy-char-siu-and-chinese-chive-rice-noodle-roll', 'First-Draw Soy Char Siu and Chinese Chive Rice Noodle Roll', '頭抽叉燒韭菜腸粉', 'rice-noodle-dim-sum', 'catalog-v1-part-002', 'hk-dish-1055-first-draw-soy-char-siu-and-chinese-chive-rice-noodle-roll.png', 'First-Draw Soy Char Siu and Chinese Chive Rice Noodle Roll presented as one freshly prepared Hong Kong dish.', '一份新鮮整好嘅頭抽叉燒韭菜腸粉，按傳統港式擺法上枱。'),
  d('hk-dish-1072', 'sesame-hoisin-mushroom-and-bamboo-shoot-rice-noodle-roll', 'Sesame-Hoisin Mushroom and Bamboo Shoot Rice Noodle Roll', '麻醬海鮮醬冬菇竹筍腸粉', 'rice-noodle-dim-sum', 'catalog-v1-part-002', 'hk-dish-1072-sesame-hoisin-mushroom-and-bamboo-shoot-rice-noodle-roll.png', 'Sesame-Hoisin Mushroom and Bamboo Shoot Rice Noodle Roll presented as one freshly prepared Hong Kong dish.', '一份新鮮整好嘅麻醬海鮮醬冬菇竹筍腸粉，按傳統港式擺法上枱。'),
  d('hk-dish-1089', 'oyster-sauce-braised-shrimp-and-bamboo-shoot-bean-curd-sheet-parcel', 'Oyster-Sauce Braised Shrimp and Bamboo Shoot Bean Curd Sheet Parcel', '蠔油炆鮮蝦竹筍腐皮包', 'bean-curd-sheet-dim-sum', 'catalog-v1-part-002', 'hk-dish-1089-oyster-sauce-braised-shrimp-and-bamboo-shoot-bean-curd-sheet-parcel.png', 'Oyster-Sauce Braised Shrimp and Bamboo Shoot Bean Curd Sheet Parcel presented as one freshly prepared Hong Kong dish.', '一份新鮮整好嘅蠔油炆鮮蝦竹筍腐皮包，按傳統港式擺法上枱。'),
  d('hk-dish-1106', 'flaky-lattice-char-siu-and-pineapple-tea-house-pastry', 'Flaky-Lattice Char Siu and Pineapple Tea-House Pastry', '叉燒菠蘿格仔酥', 'baked-dim-sum', 'catalog-v1-part-002', 'hk-dish-1106-flaky-lattice-char-siu-and-pineapple-tea-house-pastry.png', 'Flaky-Lattice Char Siu and Pineapple Tea-House Pastry presented as one freshly prepared Hong Kong dish.', '一份新鮮整好嘅叉燒菠蘿格仔酥，按傳統港式擺法上枱。'),
  d('hk-dish-1123', 'golden-puff-crab-meat-and-sweet-corn-tea-house-pastry', 'Golden-Puff Crab Meat and Sweet Corn Tea-House Pastry', '蟹肉粟米黃金酥', 'baked-dim-sum', 'catalog-v1-part-002', 'hk-dish-1123-golden-puff-crab-meat-and-sweet-corn-tea-house-pastry.png', 'Golden-Puff Crab Meat and Sweet Corn Tea-House Pastry presented as one freshly prepared Hong Kong dish.', '一份新鮮整好嘅蟹肉粟米黃金酥，按傳統港式擺法上枱。'),
  d('hk-dish-1140', 'coconut-chocolate-lotus-leaf-sticky-rice-parcel', 'Coconut Chocolate Lotus Leaf Sticky Rice Parcel', '椰香巧克力荷葉糯米包', 'chocolate-filled-dim-sum', 'catalog-v1-part-002', 'hk-dish-1140-coconut-chocolate-lotus-leaf-sticky-rice-parcel.png', 'Coconut Chocolate Lotus Leaf Sticky Rice Parcel with one piece opened to show its enclosed chocolate filling.', '椰香巧克力荷葉糯米包切開一件，清楚見到完整包喺入面嘅巧克力餡。'),
  d('hk-dish-1157', 'black-pepper-ho-fun-with-beef-brisket-and-daikon', 'Black-Pepper Ho Fun with Beef Brisket and Daikon', '牛腩蘿蔔黑椒河粉', 'noodle-dishes', 'catalog-v1-part-002', 'hk-dish-1157-black-pepper-ho-fun-with-beef-brisket-and-daikon.png', 'Black-Pepper Ho Fun with Beef Brisket and Daikon presented as one freshly prepared Hong Kong dish.', '一份新鮮整好嘅牛腩蘿蔔黑椒河粉，按傳統港式擺法上枱。'),
  d('hk-dish-1174', 'ginger-scallion-e-fu-noodles-with-chicken-and-shiitake', 'Ginger-Scallion E-Fu Noodles with Chicken and Shiitake', '雞絲冬菇薑蔥伊麵', 'noodle-dishes', 'catalog-v1-part-002', 'hk-dish-1174-ginger-scallion-e-fu-noodles-with-chicken-and-shiitake.png', 'Ginger-Scallion E-Fu Noodles with Chicken and Shiitake presented as one freshly prepared Hong Kong dish.', '一份新鮮整好嘅雞絲冬菇薑蔥伊麵，按傳統港式擺法上枱。'),
  d('hk-dish-1191', 'lotus-leaf-steamed-beef-patty-and-water-chestnut-cantonese-plate', 'Lotus-Leaf Steamed Beef Patty and Water Chestnut Cantonese Plate', '荷葉蒸牛肉餅馬蹄', 'cantonese-main-dishes', 'catalog-v1-part-002', 'hk-dish-1191-lotus-leaf-steamed-beef-patty-and-water-chestnut-cantonese-plate.png', 'Lotus-Leaf Steamed Beef Patty and Water Chestnut Cantonese Plate presented as one freshly prepared Hong Kong dish.', '一份新鮮整好嘅荷葉蒸牛肉餅馬蹄，按傳統港式擺法上枱。'),
  d('hk-dish-1208', 'curry-rice-with-chicken-steak-and-cream-sauce', 'Curry Rice with Chicken Steak and Cream Sauce', '雞扒白汁咖喱飯', 'cha-chaan-teng-dishes', 'catalog-v1-part-002', 'hk-dish-1208-curry-rice-with-chicken-steak-and-cream-sauce.png', 'Curry Rice with Chicken Steak and Cream Sauce presented as one freshly prepared Hong Kong dish.', '一份新鮮整好嘅雞扒白汁咖喱飯，按傳統港式擺法上枱。'),
  d('hk-dish-1225', 'portuguese-sauce-rice-with-fish-fillet-and-spinach', 'Portuguese-Sauce Rice with Fish Fillet and Spinach', '魚柳菠菜葡汁飯', 'cha-chaan-teng-dishes', 'catalog-v1-part-002', 'hk-dish-1225-portuguese-sauce-rice-with-fish-fillet-and-spinach.png', 'Portuguese-Sauce Rice with Fish Fillet and Spinach presented as one freshly prepared Hong Kong dish.', '一份新鮮整好嘅魚柳菠菜葡汁飯，按傳統港式擺法上枱。'),
  d('hk-dish-1242', 'osmanthus-taro-and-sago-sweet-soup', 'Osmanthus Taro and Sago Sweet Soup', '桂花芋頭西米糖水', 'hong-kong-desserts', 'catalog-v1-part-002', 'hk-dish-1242-osmanthus-taro-and-sago-sweet-soup.png', 'Osmanthus Taro and Sago Sweet Soup presented as one freshly prepared Hong Kong dish.', '一份新鮮整好嘅桂花芋頭西米糖水，按傳統港式擺法上枱。'),
  d('hk-dish-1259', 'hong-kong-banquet-pickled-mustard-supreme-broth-poached-golden-pomfret', 'Hong Kong Banquet Pickled-Mustard Supreme-Broth Poached Golden Pomfret', '港式宴席酸菜上湯浸金鯧魚', 'hong-kong-banquet', 'catalog-v1-part-002', 'hk-dish-1259-hong-kong-banquet-pickled-mustard-supreme-broth-poached-golden-pomfret.png', 'Hong Kong Banquet Pickled-Mustard Supreme-Broth Poached Golden Pomfret, showing a whole golden pomfret with silvery-gold skin and delicate flaky flesh, served in one long white porcelain fish platter.', '港式宴席酸菜上湯浸金鯧魚用一隻長形白瓷魚碟上枱，清楚見到指定主菜同配料。'),
  d('hk-dish-1276', 'hong-kong-banquet-garlic-vermicelli-steamed-king-prawns', 'Hong Kong Banquet Garlic-Vermicelli Steamed King Prawns', '港式宴席蒜蓉粉絲蒸大蝦', 'hong-kong-banquet', 'catalog-v1-part-002', 'hk-dish-1276-hong-kong-banquet-garlic-vermicelli-steamed-king-prawns.png', 'Hong Kong Banquet Garlic-Vermicelli Steamed King Prawns, showing large shell-on king prawns arranged in one neat serving, served in one oval white porcelain seafood platter.', '港式宴席蒜蓉粉絲蒸大蝦用一隻橢圓白瓷海鮮碟上枱，清楚見到指定主菜同配料。'),
  d('hk-dish-1293', 'hong-kong-banquet-black-bean-chili-wok-fried-razor-clams', 'Hong Kong Banquet Black-Bean-Chili Wok-Fried Razor Clams', '港式宴席豉椒炒聖子', 'hong-kong-banquet', 'catalog-v1-part-002', 'hk-dish-1293-hong-kong-banquet-black-bean-chili-wok-fried-razor-clams.png', 'Hong Kong Banquet Black-Bean-Chili Wok-Fried Razor Clams, showing opened razor-clam shells holding tender clam meat, served in one oval white porcelain seafood platter.', '港式宴席豉椒炒聖子用一隻橢圓白瓷海鮮碟上枱，清楚見到指定主菜同配料。'),
  d('hk-dish-1310', 'hong-kong-banquet-cordyceps-flower-double-boiled-winter-melon-and-dried-scallop-soup', 'Hong Kong Banquet Cordyceps-Flower Double-Boiled Winter Melon and Dried Scallop Soup', '港式宴席蟲草花冬瓜瑤柱瘦肉燉湯', 'hong-kong-banquet', 'catalog-v1-part-002', 'hk-dish-1310-hong-kong-banquet-cordyceps-flower-double-boiled-winter-melon-and-dried-scallop-soup.png', 'Hong Kong Banquet Cordyceps-Flower Double-Boiled Winter Melon and Dried Scallop Soup, showing clear broth with translucent winter melon and whole dried-scallop strands, served in one open lidded porcelain soup tureen.', '港式宴席蟲草花冬瓜瑤柱瘦肉燉湯用一個打開蓋嘅瓷湯盅上枱，清楚見到指定主菜同配料。'),
  d('hk-dish-1327', 'hong-kong-banquet-dried-scallop-oyster-sauce-sea-cucumber-claypot', 'Hong Kong Banquet Dried-Scallop Oyster-Sauce Sea Cucumber Claypot', '港式宴席瑤柱蠔皇海參煲', 'hong-kong-banquet', 'catalog-v1-part-002', 'hk-dish-1327-hong-kong-banquet-dried-scallop-oyster-sauce-sea-cucumber-claypot.png', 'Hong Kong Banquet Dried-Scallop Oyster-Sauce Sea Cucumber Claypot, showing thick glossy sea-cucumber pieces with a springy braised texture, served in one dark-brown Cantonese claypot.', '港式宴席瑤柱蠔皇海參煲用一個深啡色廣東砂煲上枱，清楚見到指定主菜同配料。'),
  d('hk-dish-1344', 'hong-kong-banquet-roast-garlic-black-pepper-goose-web-claypot', 'Hong Kong Banquet Roast-Garlic Black-Pepper Goose Web Claypot', '港式宴席蒜子黑椒鵝掌煲', 'hong-kong-banquet', 'catalog-v1-part-002', 'hk-dish-1344-hong-kong-banquet-roast-garlic-black-pepper-goose-web-claypot.png', 'Hong Kong Banquet Roast-Garlic Black-Pepper Goose Web Claypot, showing braised goose webs arranged neatly in the claypot, served in one dark-brown Cantonese claypot.', '港式宴席蒜子黑椒鵝掌煲用一個深啡色廣東砂煲上枱，清楚見到指定主菜同配料。'),
  d('hk-dish-1361', 'hong-kong-banquet-maltose-lacquered-roast-pigeon', 'Hong Kong Banquet Maltose-Lacquered Roast Pigeon', '港式宴席麥芽糖脆皮燒乳鴿', 'hong-kong-banquet', 'catalog-v1-part-002', 'hk-dish-1361-hong-kong-banquet-maltose-lacquered-roast-pigeon.png', 'Hong Kong Banquet Maltose-Lacquered Roast Pigeon, showing one small roast pigeon portioned neatly with lacquered skin, served in one large oval white porcelain roast-meat platter.', '港式宴席麥芽糖脆皮燒乳鴿用一隻大型橢圓白瓷燒味碟上枱，清楚見到指定主菜同配料。'),
  d('hk-dish-1378', 'hong-kong-banquet-whole-abalone-braised-with-bamboo-pith', 'Hong Kong Banquet Whole Abalone Braised with Bamboo Pith', '港式宴席竹笙炆原隻鮑魚', 'hong-kong-banquet', 'catalog-v1-part-002', 'hk-dish-1378-hong-kong-banquet-whole-abalone-braised-with-bamboo-pith.png', 'Hong Kong Banquet Whole Abalone Braised with Bamboo Pith, showing small whole abalone with a tender scored surface, served in one shallow lidded white porcelain casserole.', '港式宴席竹笙炆原隻鮑魚用一個淺身有蓋白瓷砂鍋上枱，清楚見到指定主菜同配料。'),
  d('hk-dish-1395', 'hong-kong-banquet-dried-oyster-braised-with-chestnut', 'Hong Kong Banquet Dried Oyster Braised with Chestnut', '港式宴席栗子炆蠔豉', 'hong-kong-banquet', 'catalog-v1-part-002', 'hk-dish-1395-hong-kong-banquet-dried-oyster-braised-with-chestnut.png', 'Hong Kong Banquet Dried Oyster Braised with Chestnut, showing plump rehydrated dried oysters glazed in banquet sauce, served in one shallow lidded white porcelain casserole.', '港式宴席栗子炆蠔豉用一個淺身有蓋白瓷砂鍋上枱，清楚見到指定主菜同配料。'),
  d('hk-dish-1412', 'hong-kong-banquet-crab-meat-and-egg-white-rice-vermicelli', 'Hong Kong Banquet Crab-Meat-and-Egg-White Rice Vermicelli', '港式宴席蟹肉蛋白米粉', 'hong-kong-banquet', 'catalog-v1-part-002', 'hk-dish-1412-hong-kong-banquet-crab-meat-and-egg-white-rice-vermicelli.png', 'Hong Kong Banquet Crab-Meat-and-Egg-White Rice Vermicelli, showing fine rice vermicelli wok-tossed into a loose mound, served in one broad white porcelain noodle platter.', '港式宴席蟹肉蛋白米粉用一隻闊身白瓷麵碟上枱，清楚見到指定主菜同配料。'),
  d('hk-dish-1430', 'hong-kong-banquet-fujian-seafood-gravy-fried-rice', 'Hong Kong Banquet Fujian-Seafood-Gravy Fried Rice', '港式宴席福建海鮮汁炒飯', 'hong-kong-banquet', 'catalog-v1-part-002', 'hk-dish-1430-hong-kong-banquet-fujian-seafood-gravy-fried-rice.png', 'Hong Kong Banquet Fujian-Seafood-Gravy Fried Rice, showing separate wok-charred grains of jasmine rice, served in one broad white porcelain rice platter or covered rice casserole appropriate to the preparation.', '港式宴席福建海鮮汁炒飯用一隻配合做法嘅闊身白瓷飯碟或有蓋飯煲上枱，清楚見到指定主菜同配料。'),
  d('hk-dish-1447', 'hong-kong-banquet-abalone-and-shiitake-glutinous-rice', 'Hong Kong Banquet Abalone-and-Shiitake Glutinous Rice', '港式宴席鮑魚北菇糯米飯', 'hong-kong-banquet', 'catalog-v1-part-002', 'hk-dish-1447-hong-kong-banquet-abalone-and-shiitake-glutinous-rice.png', 'Hong Kong Banquet Abalone-and-Shiitake Glutinous Rice, showing glossy separate grains of savoury glutinous rice, served in one broad white porcelain rice platter or covered rice casserole appropriate to the preparation.', '港式宴席鮑魚北菇糯米飯用一隻配合做法嘅闊身白瓷飯碟或有蓋飯煲上枱，清楚見到指定主菜同配料。'),
  d('hk-dish-1464', 'hong-kong-banquet-roast-goose-rice-vermicelli-in-supreme-broth', 'Hong Kong Banquet Roast-Goose Rice Vermicelli in Supreme Broth', '港式宴席上湯燒鵝米粉', 'hong-kong-banquet', 'catalog-v1-part-002', 'hk-dish-1464-hong-kong-banquet-roast-goose-rice-vermicelli-in-supreme-broth.png', 'Hong Kong Banquet Roast-Goose Rice Vermicelli in Supreme Broth, showing fine white rice vermicelli gathered loosely in the bowl, served in one deep white porcelain noodle bowl.', '港式宴席上湯燒鵝米粉用一隻深身白瓷麵碗上枱，清楚見到指定主菜同配料。'),
  d('hk-dish-1481', 'hong-kong-banquet-supreme-broth-braised-seafood-bird-s-nest', 'Hong Kong Banquet Supreme-Broth Braised Seafood Bird’s Nest', '港式宴席上湯扒海鮮雀巢', 'hong-kong-banquet', 'catalog-v1-part-002', 'hk-dish-1481-hong-kong-banquet-supreme-broth-braised-seafood-bird-s-nest.png', 'Hong Kong Banquet Supreme-Broth Braised Seafood Bird’s Nest, showing mixed seafood held in one crisp woven potato nest, served in one large white porcelain celebration platter or casserole.', '港式宴席上湯扒海鮮雀巢用一隻大型白瓷節慶拼盤或砂鍋上枱，清楚見到指定主菜同配料。'),
  d('hk-dish-1498', 'hong-kong-banquet-xo-sauce-wok-fried-golden-garlic-seafood-basket', 'Hong Kong Banquet XO-Sauce Wok-Fried Golden-Garlic Seafood Basket', '港式宴席XO醬炒金蒜海鮮籃', 'hong-kong-banquet', 'catalog-v1-part-002', 'hk-dish-1498-hong-kong-banquet-xo-sauce-wok-fried-golden-garlic-seafood-basket.png', 'Hong Kong Banquet XO-Sauce Wok-Fried Golden-Garlic Seafood Basket, showing mixed seafood and golden garlic held in one crisp taro basket, served in one large white porcelain celebration platter or casserole.', '港式宴席XO醬炒金蒜海鮮籃用一隻大型白瓷節慶拼盤或砂鍋上枱，清楚見到指定主菜同配料。'),
  d('hk-dish-1515', 'milk-crust-cream-bun', 'Milk-Crust Cream Bun', '奶香酥皮忌廉包', 'hong-kong-bakery', 'catalog-v1-part-002', 'hk-dish-1515-milk-crust-cream-bun.png', 'Milk-Crust Cream Bun presented as one complete Hong Kong dessert or drink serving.', '一份完整上枱嘅奶香酥皮忌廉包。'),
  d('hk-dish-1532', 'osmanthus-scented-white-sugar-sponge-cake', 'Osmanthus-Scented White Sugar Sponge Cake', '桂花香白糖糕', 'tea-house-sweets', 'catalog-v1-part-002', 'hk-dish-1532-osmanthus-scented-white-sugar-sponge-cake.png', 'Osmanthus-Scented White Sugar Sponge Cake presented as one complete Hong Kong dessert or drink serving.', '一份完整上枱嘅桂花香白糖糕。'),
  d('hk-dish-1549', 'fresh-ginger-brown-sugar-rice-cake', 'Fresh-Ginger Brown Sugar Rice Cake', '鮮薑片糖年糕', 'tea-house-sweets', 'catalog-v1-part-002', 'hk-dish-1549-fresh-ginger-brown-sugar-rice-cake.png', 'Fresh-Ginger Brown Sugar Rice Cake presented as one complete Hong Kong dessert or drink serving.', '一份完整上枱嘅鮮薑片糖年糕。'),
  d('hk-dish-1566', 'old-school-walnut-sweet-soup', 'Old-School Walnut Sweet Soup', '懷舊合桃糊', 'sweet-soups', 'catalog-v1-part-002', 'hk-dish-1566-old-school-walnut-sweet-soup.png', 'Old-School Walnut Sweet Soup presented as one complete Hong Kong dessert or drink serving.', '一份完整上枱嘅懷舊合桃糊。'),
  d('hk-dish-1583', 'flower-stamped-red-bean-mini-mooncake', 'Flower-Stamped Red Bean Mini Mooncake', '花印豆沙迷你月餅', 'festive-pastries', 'catalog-v1-part-002', 'hk-dish-1583-flower-stamped-red-bean-mini-mooncake.png', 'Flower-Stamped Red Bean Mini Mooncake presented as one complete Hong Kong dessert or drink serving.', '一份完整上枱嘅花印豆沙迷你月餅。'),
  d('hk-dish-1600', 'ginger-milk-chocolate-crystal-pudding-bun', 'Ginger Milk Chocolate Crystal Pudding Bun', '薑汁奶巧克力水晶布甸包', 'chocolate-filled-dim-sum', 'catalog-v1-part-002', 'hk-dish-1600-ginger-milk-chocolate-crystal-pudding-bun.png', 'Ginger Milk Chocolate Crystal Pudding Bun with one piece opened to show the enclosed chocolate filling.', '薑汁奶巧克力水晶布甸包切開一件，清楚見到入面完整包住嘅巧克力餡。'),
  d('hk-dish-1617', 'brown-sugar-grass-jelly', 'Brown-Sugar Grass Jelly', '黑糖仙草涼粉', 'puddings-and-jellies', 'catalog-v1-part-002', 'hk-dish-1617-brown-sugar-grass-jelly.png', 'Brown-Sugar Grass Jelly presented as one complete Hong Kong dessert or drink serving.', '一份完整上枱嘅黑糖仙草涼粉。'),
  d('hk-dish-1634', 'roasted-soy-flour-coconut-lo-mai-chi', 'Roasted-Soy-Flour Coconut Lo Mai Chi', '炒黃豆粉椰絲糯米糍', 'glutinous-rice-sweets', 'catalog-v1-part-002', 'hk-dish-1634-roasted-soy-flour-coconut-lo-mai-chi.png', 'Roasted-Soy-Flour Coconut Lo Mai Chi presented as one complete Hong Kong dessert or drink serving.', '一份完整上枱嘅炒黃豆粉椰絲糯米糍。'),
  d('hk-dish-1651', 'mini-tea-house-shortcrust-egg-tart', 'Mini Tea-House Shortcrust Egg Tart', '茶樓迷你牛油皮蛋撻', 'bakery-tarts-and-puffs', 'catalog-v1-part-002', 'hk-dish-1651-mini-tea-house-shortcrust-egg-tart.png', 'Mini Tea-House Shortcrust Egg Tart presented as one complete Hong Kong dessert or drink serving.', '一份完整上枱嘅茶樓迷你牛油皮蛋撻。'),
  d('hk-dish-1668', 'black-sesame-crust-lotus-paste-puff', 'Black-Sesame-Crust Lotus Paste Puff', '黑芝麻酥面蓮蓉酥', 'bakery-tarts-and-puffs', 'catalog-v1-part-002', 'hk-dish-1668-black-sesame-crust-lotus-paste-puff.png', 'Black-Sesame-Crust Lotus Paste Puff presented as one complete Hong Kong dessert or drink serving.', '一份完整上枱嘅黑芝麻酥面蓮蓉酥。'),
  d('hk-dish-1685', 'herbal-shop-sour-plum-drink', 'Herbal-Shop Sour Plum Drink', '涼茶舖酸梅湯', 'traditional-drinks', 'catalog-v1-part-002', 'hk-dish-1685-herbal-shop-sour-plum-drink.png', 'Herbal-Shop Sour Plum Drink presented as one complete Hong Kong dessert or drink serving.', '一份完整上枱嘅涼茶舖酸梅湯。'),
  d('hk-dish-1702', 'cha-chaan-teng-less-sweet-hong-kong-milk-tea', 'Cha-Chaan-Teng Less-Sweet Hong Kong Milk Tea', '茶餐廳少甜港式奶茶', 'cha-chaan-teng-drinks', 'catalog-v1-part-002', 'hk-dish-1702-cha-chaan-teng-less-sweet-hong-kong-milk-tea.png', 'Cha-Chaan-Teng Less-Sweet Hong Kong Milk Tea presented as one complete Hong Kong dessert or drink serving.', '一份完整上枱嘅茶餐廳少甜港式奶茶。'),
  d('hk-dish-1719', 'cha-chaan-teng-longan-honey-red-bean-ice', 'Cha-Chaan-Teng Longan-Honey Red Bean Ice', '茶餐廳龍眼蜜紅豆冰', 'cha-chaan-teng-drinks', 'catalog-v1-part-002', 'hk-dish-1719-cha-chaan-teng-longan-honey-red-bean-ice.png', 'Cha-Chaan-Teng Longan-Honey Red Bean Ice presented as one complete Hong Kong dessert or drink serving.', '一份完整上枱嘅茶餐廳龍眼蜜紅豆冰。'),
  d('hk-dish-1736', 'summer-dessert-shop-classic-red-bean-crushed-ice', 'Summer Dessert-Shop Classic Red Bean Crushed Ice', '夏日糖水舖經典紅豆碎冰', 'iced-desserts', 'catalog-v1-part-002', 'hk-dish-1736-summer-dessert-shop-classic-red-bean-crushed-ice.png', 'Summer Dessert-Shop Classic Red Bean Crushed Ice presented as one complete Hong Kong dessert or drink serving.', '一份完整上枱嘅夏日糖水舖經典紅豆碎冰。'),
  d('hk-dish-1753', 'new-territories-tea-house-fermented-chilli-water-chestnut-and-shiitake-crystal-dumpling', 'New Territories Tea-House Fermented-Chilli Water Chestnut and Shiitake Crystal Dumpling', '新界茶樓發酵辣椒馬蹄冬菇水晶餃', 'regional-tea-house-dim-sum', 'catalog-v1-part-002', 'hk-dish-1753-new-territories-tea-house-fermented-chilli-water-chestnut-and-shiitake-crystal-dumpling.png', 'One serving of New Territories Tea-House Fermented-Chilli Water Chestnut and Shiitake Crystal Dumpling, four translucent pleated crystal dumplings in one bamboo steamer.', '一份新界茶樓發酵辣椒馬蹄冬菇水晶餃，以新界茶樓傳統器皿上枱。'),
  d('hk-dish-1770', 'new-territories-tea-house-black-bean-pumpkin-and-cashew-crystal-dumpling', 'New Territories Tea-House Black-Bean Pumpkin and Cashew Crystal Dumpling', '新界茶樓豉汁南瓜腰果水晶餃', 'regional-tea-house-dim-sum', 'catalog-v1-part-002', 'hk-dish-1770-new-territories-tea-house-black-bean-pumpkin-and-cashew-crystal-dumpling.png', 'One serving of New Territories Tea-House Black-Bean Pumpkin and Cashew Crystal Dumpling, four translucent pleated crystal dumplings in one bamboo steamer.', '一份新界茶樓豉汁南瓜腰果水晶餃，以新界茶樓傳統器皿上枱。'),
  d('hk-dish-1787', 'new-territories-tea-house-white-pepper-preserved-olive-and-pea-shoot-crystal-dumpling', 'New Territories Tea-House White-Pepper Preserved Olive and Pea Shoot Crystal Dumpling', '新界茶樓白胡椒欖菜豆苗水晶餃', 'regional-tea-house-dim-sum', 'catalog-v1-part-002', 'hk-dish-1787-new-territories-tea-house-white-pepper-preserved-olive-and-pea-shoot-crystal-dumpling.png', 'One serving of New Territories Tea-House White-Pepper Preserved Olive and Pea Shoot Crystal Dumpling, four translucent pleated crystal dumplings in one bamboo steamer.', '一份新界茶樓白胡椒欖菜豆苗水晶餃，以新界茶樓傳統器皿上枱。'),
  d('hk-dish-1804', 'new-territories-tea-house-mandarin-peel-water-chestnut-and-shiitake-pan-fried-chive-pocket', 'New Territories Tea-House Mandarin-Peel Water Chestnut and Shiitake Pan-Fried Chive Pocket', '新界茶樓陳皮馬蹄冬菇香煎韭菜盒', 'regional-tea-house-dim-sum', 'catalog-v1-part-002', 'hk-dish-1804-new-territories-tea-house-mandarin-peel-water-chestnut-and-shiitake-pan-fried-chive-pocket.png', 'One serving of New Territories Tea-House Mandarin-Peel Water Chestnut and Shiitake Pan-Fried Chive Pocket, four round chive pockets with crisp golden bases on one ceramic plate.', '一份新界茶樓陳皮馬蹄冬菇香煎韭菜盒，以新界茶樓傳統器皿上枱。'),
  d('hk-dish-1821', 'new-territories-tea-house-ginger-scallion-chive-and-tofu-pan-fried-chive-pocket', 'New Territories Tea-House Ginger-Scallion Chive and Tofu Pan-Fried Chive Pocket', '新界茶樓薑蔥韭菜豆腐香煎韭菜盒', 'regional-tea-house-dim-sum', 'catalog-v1-part-002', 'hk-dish-1821-new-territories-tea-house-ginger-scallion-chive-and-tofu-pan-fried-chive-pocket.png', 'One serving of New Territories Tea-House Ginger-Scallion Chive and Tofu Pan-Fried Chive Pocket, four round chive pockets with crisp golden bases on one ceramic plate.', '一份新界茶樓薑蔥韭菜豆腐香煎韭菜盒，以新界茶樓傳統器皿上枱。'),
  d('hk-dish-1838', 'new-territories-tea-house-fermented-chilli-preserved-olive-and-pea-shoot-pan-fried-chive-pocket', 'New Territories Tea-House Fermented-Chilli Preserved Olive and Pea Shoot Pan-Fried Chive Pocket', '新界茶樓發酵辣椒欖菜豆苗香煎韭菜盒', 'regional-tea-house-dim-sum', 'catalog-v1-part-002', 'hk-dish-1838-new-territories-tea-house-fermented-chilli-preserved-olive-and-pea-shoot-pan-fried-chive-pocket.png', 'One serving of New Territories Tea-House Fermented-Chilli Preserved Olive and Pea Shoot Pan-Fried Chive Pocket, four round chive pockets with crisp golden bases on one ceramic plate.', '一份新界茶樓發酵辣椒欖菜豆苗香煎韭菜盒，以新界茶樓傳統器皿上枱。'),
  d('hk-dish-1855', 'new-territories-tea-house-black-bean-water-chestnut-and-shiitake-baked-flaky-puff', 'New Territories Tea-House Black-Bean Water Chestnut and Shiitake Baked Flaky Puff', '新界茶樓豉汁馬蹄冬菇焗酥', 'regional-tea-house-dim-sum', 'catalog-v1-part-002', 'hk-dish-1855-new-territories-tea-house-black-bean-water-chestnut-and-shiitake-baked-flaky-puff.png', 'One serving of New Territories Tea-House Black-Bean Water Chestnut and Shiitake Baked Flaky Puff, four small laminated golden puffs, with one cleanly opened to show the savoury filling.', '一份新界茶樓豉汁馬蹄冬菇焗酥，以新界茶樓傳統器皿上枱。'),
  d('hk-dish-1872', 'new-territories-tea-house-white-pepper-chive-and-tofu-baked-flaky-puff', 'New Territories Tea-House White-Pepper Chive and Tofu Baked Flaky Puff', '新界茶樓白胡椒韭菜豆腐焗酥', 'regional-tea-house-dim-sum', 'catalog-v1-part-002', 'hk-dish-1872-new-territories-tea-house-white-pepper-chive-and-tofu-baked-flaky-puff.png', 'One serving of New Territories Tea-House White-Pepper Chive and Tofu Baked Flaky Puff, four small laminated golden puffs, with one cleanly opened to show the savoury filling.', '一份新界茶樓白胡椒韭菜豆腐焗酥，以新界茶樓傳統器皿上枱。'),
  d('hk-dish-1889', 'new-territories-tea-house-mandarin-peel-preserved-olive-and-pea-shoot-baked-flaky-puff', 'New Territories Tea-House Mandarin-Peel Preserved Olive and Pea Shoot Baked Flaky Puff', '新界茶樓陳皮欖菜豆苗焗酥', 'regional-tea-house-dim-sum', 'catalog-v1-part-002', 'hk-dish-1889-new-territories-tea-house-mandarin-peel-preserved-olive-and-pea-shoot-baked-flaky-puff.png', 'One serving of New Territories Tea-House Mandarin-Peel Preserved Olive and Pea Shoot Baked Flaky Puff, four small laminated golden puffs, with one cleanly opened to show the savoury filling.', '一份新界茶樓陳皮欖菜豆苗焗酥，以新界茶樓傳統器皿上枱。'),
  d('hk-dish-1906', 'new-territories-tea-house-ginger-scallion-taro-and-ginkgo-crispy-rice-paper-roll', 'New Territories Tea-House Ginger-Scallion Taro and Ginkgo Crispy Rice-Paper Roll', '新界茶樓薑蔥芋頭白果脆炸米紙卷', 'regional-tea-house-dim-sum', 'catalog-v1-part-002', 'hk-dish-1906-new-territories-tea-house-ginger-scallion-taro-and-ginkgo-crispy-rice-paper-roll.png', 'One serving of New Territories Tea-House Ginger-Scallion Taro and Ginkgo Crispy Rice-Paper Roll, four slender blistered rice-paper rolls on one tea-house plate.', '一份新界茶樓薑蔥芋頭白果脆炸米紙卷，以新界茶樓傳統器皿上枱。'),
  d('hk-dish-1923', 'new-territories-tea-house-fermented-chilli-chive-and-tofu-crispy-rice-paper-roll', 'New Territories Tea-House Fermented-Chilli Chive and Tofu Crispy Rice-Paper Roll', '新界茶樓發酵辣椒韭菜豆腐脆炸米紙卷', 'regional-tea-house-dim-sum', 'catalog-v1-part-002', 'hk-dish-1923-new-territories-tea-house-fermented-chilli-chive-and-tofu-crispy-rice-paper-roll.png', 'One serving of New Territories Tea-House Fermented-Chilli Chive and Tofu Crispy Rice-Paper Roll, four slender blistered rice-paper rolls on one tea-house plate.', '一份新界茶樓發酵辣椒韭菜豆腐脆炸米紙卷，以新界茶樓傳統器皿上枱。'),
  d('hk-dish-1940', 'new-territories-tea-house-ginger-chocolate-rice-paper-parcel', 'New Territories Tea-House Ginger Chocolate Rice-Paper Parcel', '新界茶樓薑汁朱古力米紙包', 'chocolate-filled-dim-sum', 'catalog-v1-part-002', 'hk-dish-1940-new-territories-tea-house-ginger-chocolate-rice-paper-parcel.png', 'One serving of New Territories Tea-House Ginger Chocolate Rice-Paper Parcel, four crisp rice-paper parcels, one opened to show enclosed ginger chocolate filling.', '新界茶樓薑汁朱古力米紙包切開一件，清楚見到入面嘅朱古力餡。'),
  d('hk-dish-1957', 'new-territories-tea-house-white-pepper-taro-and-ginkgo-steamed-bao', 'New Territories Tea-House White-Pepper Taro and Ginkgo Steamed Bao', '新界茶樓白胡椒芋頭白果蒸包', 'regional-tea-house-dim-sum', 'catalog-v1-part-002', 'hk-dish-1957-new-territories-tea-house-white-pepper-taro-and-ginkgo-steamed-bao.png', 'One serving of New Territories Tea-House White-Pepper Taro and Ginkgo Steamed Bao, three soft pleated steamed buns in one bamboo steamer, with one opened to show the filling.', '一份新界茶樓白胡椒芋頭白果蒸包，以新界茶樓傳統器皿上枱。'),
  d('hk-dish-1974', 'new-territories-tea-house-mandarin-peel-chive-and-tofu-steamed-bao', 'New Territories Tea-House Mandarin-Peel Chive and Tofu Steamed Bao', '新界茶樓陳皮韭菜豆腐蒸包', 'regional-tea-house-dim-sum', 'catalog-v1-part-002', 'hk-dish-1974-new-territories-tea-house-mandarin-peel-chive-and-tofu-steamed-bao.png', 'One serving of New Territories Tea-House Mandarin-Peel Chive and Tofu Steamed Bao, three soft pleated steamed buns in one bamboo steamer, with one opened to show the filling.', '一份新界茶樓陳皮韭菜豆腐蒸包，以新界茶樓傳統器皿上枱。'),
  d('hk-dish-1991', 'new-territories-tea-house-ginger-scallion-black-garlic-and-cauliflower-steamed-bao', 'New Territories Tea-House Ginger-Scallion Black Garlic and Cauliflower Steamed Bao', '新界茶樓薑蔥黑蒜椰菜花蒸包', 'regional-tea-house-dim-sum', 'catalog-v1-part-003', 'hk-dish-1991-new-territories-tea-house-ginger-scallion-black-garlic-and-cauliflower-steamed-bao.png', 'One serving of New Territories Tea-House Ginger-Scallion Black Garlic and Cauliflower Steamed Bao, three soft pleated steamed buns in one bamboo steamer, with one opened to show the filling.', '一份新界茶樓薑蔥黑蒜椰菜花蒸包，以新界茶樓傳統器皿上枱。'),
  d('hk-dish-2008', 'hong-kong-classic-taro-sago-classic-dessert-bowl', 'Hong Kong Classic Taro Sago Classic Dessert Bowl', '香港經典芋頭西米露經典甜品碗', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2008-hong-kong-classic-taro-sago-classic-dessert-bowl.png', 'One serving of Hong Kong Classic Taro Sago Classic Dessert Bowl, presented in a shallow white ceramic dessert bowl.', '一份香港經典芋頭西米露經典甜品碗，用茶樓甜品器皿上枱。'),
  d('hk-dish-2025', 'hong-kong-classic-grass-jelly-chilled-glass-cup', 'Hong Kong Classic Grass Jelly Chilled Glass Cup', '香港經典仙草凍冰鎮玻璃杯', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2025-hong-kong-classic-grass-jelly-chilled-glass-cup.png', 'One serving of Hong Kong Classic Grass Jelly Chilled Glass Cup, presented in a clear chilled glass dessert cup.', '一份香港經典仙草凍冰鎮玻璃杯，用冰涼玻璃杯上枱。'),
  d('hk-dish-2042', 'hong-kong-classic-red-bean-soup-ceramic-dessert-plate', 'Hong Kong Classic Red Bean Soup Ceramic Dessert Plate', '香港經典紅豆沙陶瓷甜品碟', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2042-hong-kong-classic-red-bean-soup-ceramic-dessert-plate.png', 'One serving of Hong Kong Classic Red Bean Soup Ceramic Dessert Plate, presented in a small glazed ceramic dessert plate.', '一份香港經典紅豆沙陶瓷甜品碟，用茶樓甜品器皿上枱。'),
  d('hk-dish-2059', 'hong-kong-classic-coconut-tapioca-ceramic-dessert-plate', 'Hong Kong Classic Coconut Tapioca Ceramic Dessert Plate', '香港經典椰汁西米陶瓷甜品碟', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2059-hong-kong-classic-coconut-tapioca-ceramic-dessert-plate.png', 'One serving of Hong Kong Classic Coconut Tapioca Ceramic Dessert Plate, presented in a small glazed ceramic dessert plate.', '一份香港經典椰汁西米陶瓷甜品碟，用茶樓甜品器皿上枱。'),
  d('hk-dish-2076', 'hong-kong-classic-egg-custard-pudding-osmanthus-garnish-bowl', 'Hong Kong Classic Egg Custard Pudding Osmanthus Garnish Bowl', '香港經典蛋奶布甸桂花甜品碗', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2076-hong-kong-classic-egg-custard-pudding-osmanthus-garnish-bowl.png', 'One serving of Hong Kong Classic Egg Custard Pudding Osmanthus Garnish Bowl, presented in a white ceramic bowl with a few osmanthus blossoms.', '一份香港經典蛋奶布甸桂花甜品碗，用茶樓甜品器皿上枱。'),
  d('hk-dish-2093', 'hong-kong-classic-taro-balls-coconut-cream-dessert-bowl', 'Hong Kong Classic Taro Balls Coconut Cream Dessert Bowl', '香港經典芋圓椰香甜品碗', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2093-hong-kong-classic-taro-balls-coconut-cream-dessert-bowl.png', 'One serving of Hong Kong Classic Taro Balls Coconut Cream Dessert Bowl, presented in a pale ceramic bowl with a restrained coconut cream finish.', '一份香港經典芋圓椰香甜品碗，用茶樓甜品器皿上枱。'),
  d('hk-dish-2110', 'hong-kong-classic-sweet-potato-cake-brown-sugar-syrup-dessert-bowl', 'Hong Kong Classic Sweet Potato Cake Brown Sugar Syrup Dessert Bowl', '香港經典番薯糕黑糖糖漿甜品碗', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2110-hong-kong-classic-sweet-potato-cake-brown-sugar-syrup-dessert-bowl.png', 'One serving of Hong Kong Classic Sweet Potato Cake Brown Sugar Syrup Dessert Bowl, presented in a ceramic bowl with a small glossy brown-sugar syrup pool.', '一份香港經典番薯糕黑糖糖漿甜品碗，用茶樓甜品器皿上枱。'),
  d('hk-dish-2127', 'hong-kong-classic-coconut-jelly-condensed-milk-dessert-cup', 'Hong Kong Classic Coconut Jelly Condensed Milk Dessert Cup', '香港經典椰汁糕煉奶甜品杯', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2127-hong-kong-classic-coconut-jelly-condensed-milk-dessert-cup.png', 'One serving of Hong Kong Classic Coconut Jelly Condensed Milk Dessert Cup, presented in a clear dessert cup with a modest condensed-milk ribbon.', '一份香港經典椰汁糕煉奶甜品杯，用茶樓甜品器皿上枱。'),
  d('hk-dish-2144', 'hong-kong-classic-almond-tofu-pudding-mini-tong-yuen-dessert-bowl', 'Hong Kong Classic Almond Tofu Pudding Mini Tong-Yuen Dessert Bowl', '香港經典杏仁豆腐迷你湯圓甜品碗', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2144-hong-kong-classic-almond-tofu-pudding-mini-tong-yuen-dessert-bowl.png', 'One serving of Hong Kong Classic Almond Tofu Pudding Mini Tong-Yuen Dessert Bowl, presented in a small ceramic bowl with three tiny glutinous rice balls.', '一份香港經典杏仁豆腐迷你湯圓甜品碗，用茶樓甜品器皿上枱。'),
  d('hk-dish-2161', 'hong-kong-classic-mango-pomelo-sago-cha-chaan-teng-dessert-glass', 'Hong Kong Classic Mango Pomelo Sago Cha Chaan Teng Dessert Glass', '香港經典芒果西柚西米露茶記甜品玻璃杯', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2161-hong-kong-classic-mango-pomelo-sago-cha-chaan-teng-dessert-glass.png', 'One serving of Hong Kong Classic Mango Pomelo Sago Cha Chaan Teng Dessert Glass, presented in a classic Hong Kong cha chaan teng style glass dessert cup.', '一份香港經典芒果西柚西米露茶記甜品玻璃杯，用茶樓甜品器皿上枱。'),
  d('hk-dish-2178', 'hong-kong-classic-red-bean-rice-cake-cha-chaan-teng-dessert-glass', 'Hong Kong Classic Red Bean Rice Cake Cha Chaan Teng Dessert Glass', '香港經典紅豆糕茶記甜品玻璃杯', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2178-hong-kong-classic-red-bean-rice-cake-cha-chaan-teng-dessert-glass.png', 'One serving of Hong Kong Classic Red Bean Rice Cake Cha Chaan Teng Dessert Glass, presented in a classic Hong Kong cha chaan teng style glass dessert cup.', '一份香港經典紅豆糕茶記甜品玻璃杯，用茶樓甜品器皿上枱。'),
  d('hk-dish-2195', 'hong-kong-classic-milk-tea-pudding-new-territories-tea-house-dessert-bowl', 'Hong Kong Classic Milk Tea Pudding New Territories Tea-House Dessert Bowl', '香港經典奶茶布甸新界茶樓甜品碗', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2195-hong-kong-classic-milk-tea-pudding-new-territories-tea-house-dessert-bowl.png', 'One serving of Hong Kong Classic Milk Tea Pudding New Territories Tea-House Dessert Bowl, presented in a restrained New Territories tea-house ceramic dessert bowl.', '一份香港經典奶茶布甸新界茶樓甜品碗，用茶樓甜品器皿上枱。'),
  d('hk-dish-2212', 'hong-kong-brown-sugar-peanut-soup-classic-dessert-bowl', 'Hong Kong Brown Sugar Peanut Soup Classic Dessert Bowl', '香港黑糖花生糊經典甜品碗', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2212-hong-kong-brown-sugar-peanut-soup-classic-dessert-bowl.png', 'One serving of Hong Kong Brown Sugar Peanut Soup Classic Dessert Bowl, presented in a shallow white ceramic dessert bowl.', '一份香港黑糖花生糊經典甜品碗，用茶樓甜品器皿上枱。'),
  d('hk-dish-2229', 'hong-kong-brown-sugar-osmanthus-rice-cake-chilled-glass-cup', 'Hong Kong Brown Sugar Osmanthus Rice Cake Chilled Glass Cup', '香港黑糖桂花糕冰鎮玻璃杯', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2229-hong-kong-brown-sugar-osmanthus-rice-cake-chilled-glass-cup.png', 'One serving of Hong Kong Brown Sugar Osmanthus Rice Cake Chilled Glass Cup, presented in a clear chilled glass dessert cup.', '一份香港黑糖桂花糕冰鎮玻璃杯，用冰涼玻璃杯上枱。'),
  d('hk-dish-2246', 'hong-kong-brown-sugar-guilinggao-ceramic-dessert-plate', 'Hong Kong Brown Sugar Guilinggao Ceramic Dessert Plate', '香港黑糖龜苓膏陶瓷甜品碟', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2246-hong-kong-brown-sugar-guilinggao-ceramic-dessert-plate.png', 'One serving of Hong Kong Brown Sugar Guilinggao Ceramic Dessert Plate, presented in a small glazed ceramic dessert plate.', '一份香港黑糖龜苓膏陶瓷甜品碟，用茶樓甜品器皿上枱。'),
  d('hk-dish-2263', 'hong-kong-brown-sugar-black-sesame-soup-osmanthus-garnish-bowl', 'Hong Kong Brown Sugar Black Sesame Soup Osmanthus Garnish Bowl', '香港黑糖黑芝麻糊桂花甜品碗', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2263-hong-kong-brown-sugar-black-sesame-soup-osmanthus-garnish-bowl.png', 'One serving of Hong Kong Brown Sugar Black Sesame Soup Osmanthus Garnish Bowl, presented in a white ceramic bowl with a few osmanthus blossoms.', '一份香港黑糖黑芝麻糊桂花甜品碗，用茶樓甜品器皿上枱。'),
  d('hk-dish-2280', 'hong-kong-brown-sugar-dark-chocolate-mango-pudding-osmanthus-garnish-bowl', 'Hong Kong Brown Sugar Dark Chocolate Mango Pudding Osmanthus Garnish Bowl', '香港黑糖黑朱古力芒果布甸桂花甜品碗', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2280-hong-kong-brown-sugar-dark-chocolate-mango-pudding-osmanthus-garnish-bowl.png', 'One serving of Hong Kong Brown Sugar Dark Chocolate Mango Pudding Osmanthus Garnish Bowl, with one portion opened to show the enclosed chocolate centre.', '香港黑糖黑朱古力芒果布甸桂花甜品碗切開一件，清楚見到入面嘅朱古力餡。'),
  d('hk-dish-2297', 'hong-kong-brown-sugar-sesame-tang-yuan-coconut-cream-dessert-bowl', 'Hong Kong Brown Sugar Sesame Tang Yuan Coconut Cream Dessert Bowl', '香港黑糖芝麻湯圓椰香甜品碗', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2297-hong-kong-brown-sugar-sesame-tang-yuan-coconut-cream-dessert-bowl.png', 'One serving of Hong Kong Brown Sugar Sesame Tang Yuan Coconut Cream Dessert Bowl, presented in a pale ceramic bowl with a restrained coconut cream finish.', '一份香港黑糖芝麻湯圓椰香甜品碗，用茶樓甜品器皿上枱。'),
  d('hk-dish-2314', 'hong-kong-brown-sugar-winter-melon-jelly-brown-sugar-syrup-dessert-bowl', 'Hong Kong Brown Sugar Winter Melon Jelly Brown Sugar Syrup Dessert Bowl', '香港黑糖冬瓜糕黑糖糖漿甜品碗', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2314-hong-kong-brown-sugar-winter-melon-jelly-brown-sugar-syrup-dessert-bowl.png', 'One serving of Hong Kong Brown Sugar Winter Melon Jelly Brown Sugar Syrup Dessert Bowl, presented in a ceramic bowl with a small glossy brown-sugar syrup pool.', '一份香港黑糖冬瓜糕黑糖糖漿甜品碗，用茶樓甜品器皿上枱。'),
  d('hk-dish-2331', 'hong-kong-brown-sugar-mung-bean-soup-condensed-milk-dessert-cup', 'Hong Kong Brown Sugar Mung Bean Soup Condensed Milk Dessert Cup', '香港黑糖綠豆沙煉奶甜品杯', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2331-hong-kong-brown-sugar-mung-bean-soup-condensed-milk-dessert-cup.png', 'One serving of Hong Kong Brown Sugar Mung Bean Soup Condensed Milk Dessert Cup, presented in a clear dessert cup with a modest condensed-milk ribbon.', '一份香港黑糖綠豆沙煉奶甜品杯，用茶樓甜品器皿上枱。'),
  d('hk-dish-2348', 'hong-kong-brown-sugar-taro-sago-mini-tong-yuen-dessert-bowl', 'Hong Kong Brown Sugar Taro Sago Mini Tong-Yuen Dessert Bowl', '香港黑糖芋頭西米露迷你湯圓甜品碗', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2348-hong-kong-brown-sugar-taro-sago-mini-tong-yuen-dessert-bowl.png', 'One serving of Hong Kong Brown Sugar Taro Sago Mini Tong-Yuen Dessert Bowl, presented in a small ceramic bowl with three tiny glutinous rice balls.', '一份香港黑糖芋頭西米露迷你湯圓甜品碗，用茶樓甜品器皿上枱。'),
  d('hk-dish-2365', 'hong-kong-brown-sugar-grass-jelly-cha-chaan-teng-dessert-glass', 'Hong Kong Brown Sugar Grass Jelly Cha Chaan Teng Dessert Glass', '香港黑糖仙草凍茶記甜品玻璃杯', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2365-hong-kong-brown-sugar-grass-jelly-cha-chaan-teng-dessert-glass.png', 'One serving of Hong Kong Brown Sugar Grass Jelly Cha Chaan Teng Dessert Glass, presented in a classic Hong Kong cha chaan teng style glass dessert cup.', '一份香港黑糖仙草凍茶記甜品玻璃杯，用茶樓甜品器皿上枱。'),
  d('hk-dish-2382', 'hong-kong-brown-sugar-red-bean-soup-new-territories-tea-house-dessert-bowl', 'Hong Kong Brown Sugar Red Bean Soup New Territories Tea-House Dessert Bowl', '香港黑糖紅豆沙新界茶樓甜品碗', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2382-hong-kong-brown-sugar-red-bean-soup-new-territories-tea-house-dessert-bowl.png', 'One serving of Hong Kong Brown Sugar Red Bean Soup New Territories Tea-House Dessert Bowl, presented in a restrained New Territories tea-house ceramic dessert bowl.', '一份香港黑糖紅豆沙新界茶樓甜品碗，用茶樓甜品器皿上枱。'),
  d('hk-dish-2399', 'hong-kong-brown-sugar-coconut-tapioca-new-territories-tea-house-dessert-bowl', 'Hong Kong Brown Sugar Coconut Tapioca New Territories Tea-House Dessert Bowl', '香港黑糖椰汁西米新界茶樓甜品碗', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2399-hong-kong-brown-sugar-coconut-tapioca-new-territories-tea-house-dessert-bowl.png', 'One serving of Hong Kong Brown Sugar Coconut Tapioca New Territories Tea-House Dessert Bowl, presented in a restrained New Territories tea-house ceramic dessert bowl.', '一份香港黑糖椰汁西米新界茶樓甜品碗，用茶樓甜品器皿上枱。'),
  d('hk-dish-2416', 'hong-kong-osmanthus-egg-custard-pudding-classic-dessert-bowl', 'Hong Kong Osmanthus Egg Custard Pudding Classic Dessert Bowl', '香港桂花蛋奶布甸經典甜品碗', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2416-hong-kong-osmanthus-egg-custard-pudding-classic-dessert-bowl.png', 'One serving of Hong Kong Osmanthus Egg Custard Pudding Classic Dessert Bowl, presented in a shallow white ceramic dessert bowl.', '一份香港桂花蛋奶布甸經典甜品碗，用茶樓甜品器皿上枱。'),
  d('hk-dish-2433', 'hong-kong-osmanthus-taro-balls-chilled-glass-cup', 'Hong Kong Osmanthus Taro Balls Chilled Glass Cup', '香港桂花芋圓冰鎮玻璃杯', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2433-hong-kong-osmanthus-taro-balls-chilled-glass-cup.png', 'One serving of Hong Kong Osmanthus Taro Balls Chilled Glass Cup, presented in a clear chilled glass dessert cup.', '一份香港桂花芋圓冰鎮玻璃杯，用冰涼玻璃杯上枱。'),
  d('hk-dish-2450', 'hong-kong-osmanthus-sweet-potato-cake-ceramic-dessert-plate', 'Hong Kong Osmanthus Sweet Potato Cake Ceramic Dessert Plate', '香港桂花番薯糕陶瓷甜品碟', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2450-hong-kong-osmanthus-sweet-potato-cake-ceramic-dessert-plate.png', 'One serving of Hong Kong Osmanthus Sweet Potato Cake Ceramic Dessert Plate, presented in a small glazed ceramic dessert plate.', '一份香港桂花番薯糕陶瓷甜品碟，用茶樓甜品器皿上枱。'),
  d('hk-dish-2467', 'hong-kong-osmanthus-coconut-jelly-osmanthus-garnish-bowl', 'Hong Kong Osmanthus Coconut Jelly Osmanthus Garnish Bowl', '香港桂花椰汁糕桂花甜品碗', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2467-hong-kong-osmanthus-coconut-jelly-osmanthus-garnish-bowl.png', 'One serving of Hong Kong Osmanthus Coconut Jelly Osmanthus Garnish Bowl, presented in a white ceramic bowl with a few osmanthus blossoms.', '一份香港桂花椰汁糕桂花甜品碗，用茶樓甜品器皿上枱。'),
  d('hk-dish-2484', 'hong-kong-osmanthus-almond-tofu-pudding-coconut-cream-dessert-bowl', 'Hong Kong Osmanthus Almond Tofu Pudding Coconut Cream Dessert Bowl', '香港桂花杏仁豆腐椰香甜品碗', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2484-hong-kong-osmanthus-almond-tofu-pudding-coconut-cream-dessert-bowl.png', 'One serving of Hong Kong Osmanthus Almond Tofu Pudding Coconut Cream Dessert Bowl, presented in a pale ceramic bowl with a restrained coconut cream finish.', '一份香港桂花杏仁豆腐椰香甜品碗，用茶樓甜品器皿上枱。'),
  d('hk-dish-2501', 'hong-kong-osmanthus-mango-pomelo-sago-brown-sugar-syrup-dessert-bowl', 'Hong Kong Osmanthus Mango Pomelo Sago Brown Sugar Syrup Dessert Bowl', '香港桂花芒果西柚西米露黑糖糖漿甜品碗', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2501-hong-kong-osmanthus-mango-pomelo-sago-brown-sugar-syrup-dessert-bowl.png', 'One serving of Hong Kong Osmanthus Mango Pomelo Sago Brown Sugar Syrup Dessert Bowl, presented in a ceramic bowl with a small glossy brown-sugar syrup pool.', '一份香港桂花芒果西柚西米露黑糖糖漿甜品碗，用茶樓甜品器皿上枱。'),
  d('hk-dish-2518', 'hong-kong-osmanthus-red-bean-rice-cake-brown-sugar-syrup-dessert-bowl', 'Hong Kong Osmanthus Red Bean Rice Cake Brown Sugar Syrup Dessert Bowl', '香港桂花紅豆糕黑糖糖漿甜品碗', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2518-hong-kong-osmanthus-red-bean-rice-cake-brown-sugar-syrup-dessert-bowl.png', 'One serving of Hong Kong Osmanthus Red Bean Rice Cake Brown Sugar Syrup Dessert Bowl, presented in a ceramic bowl with a small glossy brown-sugar syrup pool.', '一份香港桂花紅豆糕黑糖糖漿甜品碗，用茶樓甜品器皿上枱。'),
  d('hk-dish-2535', 'hong-kong-osmanthus-milk-tea-pudding-condensed-milk-dessert-cup', 'Hong Kong Osmanthus Milk Tea Pudding Condensed Milk Dessert Cup', '香港桂花奶茶布甸煉奶甜品杯', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2535-hong-kong-osmanthus-milk-tea-pudding-condensed-milk-dessert-cup.png', 'One serving of Hong Kong Osmanthus Milk Tea Pudding Condensed Milk Dessert Cup, presented in a clear dessert cup with a modest condensed-milk ribbon.', '一份香港桂花奶茶布甸煉奶甜品杯，用茶樓甜品器皿上枱。'),
  d('hk-dish-2552', 'hong-kong-osmanthus-peanut-soup-mini-tong-yuen-dessert-bowl', 'Hong Kong Osmanthus Peanut Soup Mini Tong-Yuen Dessert Bowl', '香港桂花花生糊迷你湯圓甜品碗', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2552-hong-kong-osmanthus-peanut-soup-mini-tong-yuen-dessert-bowl.png', 'One serving of Hong Kong Osmanthus Peanut Soup Mini Tong-Yuen Dessert Bowl, presented in a small ceramic bowl with three tiny glutinous rice balls.', '一份香港桂花花生糊迷你湯圓甜品碗，用茶樓甜品器皿上枱。'),
  d('hk-dish-2569', 'hong-kong-osmanthus-osmanthus-rice-cake-cha-chaan-teng-dessert-glass', 'Hong Kong Osmanthus Osmanthus Rice Cake Cha Chaan Teng Dessert Glass', '香港桂花桂花糕茶記甜品玻璃杯', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2569-hong-kong-osmanthus-osmanthus-rice-cake-cha-chaan-teng-dessert-glass.png', 'One serving of Hong Kong Osmanthus Osmanthus Rice Cake Cha Chaan Teng Dessert Glass, presented in a classic Hong Kong cha chaan teng style glass dessert cup.', '一份香港桂花桂花糕茶記甜品玻璃杯，用茶樓甜品器皿上枱。'),
  d('hk-dish-2586', 'hong-kong-osmanthus-guilinggao-new-territories-tea-house-dessert-bowl', 'Hong Kong Osmanthus Guilinggao New Territories Tea-House Dessert Bowl', '香港桂花龜苓膏新界茶樓甜品碗', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2586-hong-kong-osmanthus-guilinggao-new-territories-tea-house-dessert-bowl.png', 'One serving of Hong Kong Osmanthus Guilinggao New Territories Tea-House Dessert Bowl, presented in a restrained New Territories tea-house ceramic dessert bowl.', '一份香港桂花龜苓膏新界茶樓甜品碗，用茶樓甜品器皿上枱。'),
  d('hk-dish-2603', 'hong-kong-coconut-cream-black-sesame-soup-classic-dessert-bowl', 'Hong Kong Coconut Cream Black Sesame Soup Classic Dessert Bowl', '香港椰香黑芝麻糊經典甜品碗', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2603-hong-kong-coconut-cream-black-sesame-soup-classic-dessert-bowl.png', 'One serving of Hong Kong Coconut Cream Black Sesame Soup Classic Dessert Bowl, presented in a shallow white ceramic dessert bowl.', '一份香港椰香黑芝麻糊經典甜品碗，用茶樓甜品器皿上枱。'),
  d('hk-dish-2620', 'hong-kong-coconut-cream-dark-chocolate-mango-pudding-classic-dessert-bowl', 'Hong Kong Coconut Cream Dark Chocolate Mango Pudding Classic Dessert Bowl', '香港椰香黑朱古力芒果布甸經典甜品碗', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2620-hong-kong-coconut-cream-dark-chocolate-mango-pudding-classic-dessert-bowl.png', 'One serving of Hong Kong Coconut Cream Dark Chocolate Mango Pudding Classic Dessert Bowl, with one portion opened to show the enclosed chocolate centre.', '香港椰香黑朱古力芒果布甸經典甜品碗切開一件，清楚見到入面嘅朱古力餡。'),
  d('hk-dish-2637', 'hong-kong-coconut-cream-sesame-tang-yuan-chilled-glass-cup', 'Hong Kong Coconut Cream Sesame Tang Yuan Chilled Glass Cup', '香港椰香芝麻湯圓冰鎮玻璃杯', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2637-hong-kong-coconut-cream-sesame-tang-yuan-chilled-glass-cup.png', 'One serving of Hong Kong Coconut Cream Sesame Tang Yuan Chilled Glass Cup, presented in a clear chilled glass dessert cup.', '一份香港椰香芝麻湯圓冰鎮玻璃杯，用冰涼玻璃杯上枱。'),
  d('hk-dish-2654', 'hong-kong-coconut-cream-winter-melon-jelly-ceramic-dessert-plate', 'Hong Kong Coconut Cream Winter Melon Jelly Ceramic Dessert Plate', '香港椰香冬瓜糕陶瓷甜品碟', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2654-hong-kong-coconut-cream-winter-melon-jelly-ceramic-dessert-plate.png', 'One serving of Hong Kong Coconut Cream Winter Melon Jelly Ceramic Dessert Plate, presented in a small glazed ceramic dessert plate.', '一份香港椰香冬瓜糕陶瓷甜品碟，用茶樓甜品器皿上枱。'),
  d('hk-dish-2671', 'hong-kong-coconut-cream-mung-bean-soup-osmanthus-garnish-bowl', 'Hong Kong Coconut Cream Mung Bean Soup Osmanthus Garnish Bowl', '香港椰香綠豆沙桂花甜品碗', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2671-hong-kong-coconut-cream-mung-bean-soup-osmanthus-garnish-bowl.png', 'One serving of Hong Kong Coconut Cream Mung Bean Soup Osmanthus Garnish Bowl, presented in a white ceramic bowl with a few osmanthus blossoms.', '一份香港椰香綠豆沙桂花甜品碗，用茶樓甜品器皿上枱。'),
  d('hk-dish-2688', 'hong-kong-coconut-cream-taro-sago-coconut-cream-dessert-bowl', 'Hong Kong Coconut Cream Taro Sago Coconut Cream Dessert Bowl', '香港椰香芋頭西米露椰香甜品碗', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2688-hong-kong-coconut-cream-taro-sago-coconut-cream-dessert-bowl.png', 'One serving of Hong Kong Coconut Cream Taro Sago Coconut Cream Dessert Bowl, presented in a pale ceramic bowl with a restrained coconut cream finish.', '一份香港椰香芋頭西米露椰香甜品碗，用茶樓甜品器皿上枱。'),
  d('hk-dish-2705', 'hong-kong-coconut-cream-grass-jelly-brown-sugar-syrup-dessert-bowl', 'Hong Kong Coconut Cream Grass Jelly Brown Sugar Syrup Dessert Bowl', '香港椰香仙草凍黑糖糖漿甜品碗', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2705-hong-kong-coconut-cream-grass-jelly-brown-sugar-syrup-dessert-bowl.png', 'One serving of Hong Kong Coconut Cream Grass Jelly Brown Sugar Syrup Dessert Bowl, presented in a ceramic bowl with a small glossy brown-sugar syrup pool.', '一份香港椰香仙草凍黑糖糖漿甜品碗，用茶樓甜品器皿上枱。'),
  d('hk-dish-2722', 'hong-kong-coconut-cream-red-bean-soup-condensed-milk-dessert-cup', 'Hong Kong Coconut Cream Red Bean Soup Condensed Milk Dessert Cup', '香港椰香紅豆沙煉奶甜品杯', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2722-hong-kong-coconut-cream-red-bean-soup-condensed-milk-dessert-cup.png', 'One serving of Hong Kong Coconut Cream Red Bean Soup Condensed Milk Dessert Cup, presented in a clear dessert cup with a modest condensed-milk ribbon.', '一份香港椰香紅豆沙煉奶甜品杯，用茶樓甜品器皿上枱。'),
  d('hk-dish-2739', 'hong-kong-coconut-cream-coconut-tapioca-condensed-milk-dessert-cup', 'Hong Kong Coconut Cream Coconut Tapioca Condensed Milk Dessert Cup', '香港椰香椰汁西米煉奶甜品杯', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2739-hong-kong-coconut-cream-coconut-tapioca-condensed-milk-dessert-cup.png', 'One serving of Hong Kong Coconut Cream Coconut Tapioca Condensed Milk Dessert Cup, presented in a clear dessert cup with a modest condensed-milk ribbon.', '一份香港椰香椰汁西米煉奶甜品杯，用茶樓甜品器皿上枱。'),
  d('hk-dish-2756', 'hong-kong-coconut-cream-egg-custard-pudding-mini-tong-yuen-dessert-bowl', 'Hong Kong Coconut Cream Egg Custard Pudding Mini Tong-Yuen Dessert Bowl', '香港椰香蛋奶布甸迷你湯圓甜品碗', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2756-hong-kong-coconut-cream-egg-custard-pudding-mini-tong-yuen-dessert-bowl.png', 'One serving of Hong Kong Coconut Cream Egg Custard Pudding Mini Tong-Yuen Dessert Bowl, presented in a small ceramic bowl with three tiny glutinous rice balls.', '一份香港椰香蛋奶布甸迷你湯圓甜品碗，用茶樓甜品器皿上枱。'),
  d('hk-dish-2773', 'hong-kong-coconut-cream-taro-balls-cha-chaan-teng-dessert-glass', 'Hong Kong Coconut Cream Taro Balls Cha Chaan Teng Dessert Glass', '香港椰香芋圓茶記甜品玻璃杯', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2773-hong-kong-coconut-cream-taro-balls-cha-chaan-teng-dessert-glass.png', 'One serving of Hong Kong Coconut Cream Taro Balls Cha Chaan Teng Dessert Glass, presented in a classic Hong Kong cha chaan teng style glass dessert cup.', '一份香港椰香芋圓茶記甜品玻璃杯，用茶樓甜品器皿上枱。'),
  d('hk-dish-2790', 'hong-kong-coconut-cream-sweet-potato-cake-new-territories-tea-house-dessert-bowl', 'Hong Kong Coconut Cream Sweet Potato Cake New Territories Tea-House Dessert Bowl', '香港椰香番薯糕新界茶樓甜品碗', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2790-hong-kong-coconut-cream-sweet-potato-cake-new-territories-tea-house-dessert-bowl.png', 'One serving of Hong Kong Coconut Cream Sweet Potato Cake New Territories Tea-House Dessert Bowl, presented in a restrained New Territories tea-house ceramic dessert bowl.', '一份香港椰香番薯糕新界茶樓甜品碗，用茶樓甜品器皿上枱。'),
  d('hk-dish-2807', 'hong-kong-salted-caramel-coconut-jelly-classic-dessert-bowl', 'Hong Kong Salted Caramel Coconut Jelly Classic Dessert Bowl', '香港海鹽焦糖椰汁糕經典甜品碗', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2807-hong-kong-salted-caramel-coconut-jelly-classic-dessert-bowl.png', 'One serving of Hong Kong Salted Caramel Coconut Jelly Classic Dessert Bowl, presented in a shallow white ceramic dessert bowl.', '一份香港海鹽焦糖椰汁糕經典甜品碗，用茶樓甜品器皿上枱。'),
  d('hk-dish-2824', 'hong-kong-salted-caramel-almond-tofu-pudding-chilled-glass-cup', 'Hong Kong Salted Caramel Almond Tofu Pudding Chilled Glass Cup', '香港海鹽焦糖杏仁豆腐冰鎮玻璃杯', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2824-hong-kong-salted-caramel-almond-tofu-pudding-chilled-glass-cup.png', 'One serving of Hong Kong Salted Caramel Almond Tofu Pudding Chilled Glass Cup, presented in a clear chilled glass dessert cup.', '一份香港海鹽焦糖杏仁豆腐冰鎮玻璃杯，用冰涼玻璃杯上枱。'),
  d('hk-dish-2841', 'hong-kong-salted-caramel-mango-pomelo-sago-ceramic-dessert-plate', 'Hong Kong Salted Caramel Mango Pomelo Sago Ceramic Dessert Plate', '香港海鹽焦糖芒果西柚西米露陶瓷甜品碟', 'hong-kong-desserts', 'catalog-v1-part-003', 'hk-dish-2841-hong-kong-salted-caramel-mango-pomelo-sago-ceramic-dessert-plate.png', 'One serving of Hong Kong Salted Caramel Mango Pomelo Sago Ceramic Dessert Plate, presented in a small glazed ceramic dessert plate.', '一份香港海鹽焦糖芒果西柚西米露陶瓷甜品碟，用茶樓甜品器皿上枱。')
];

/** Builds the public download URL for a dish's photograph. */
export function assetUrlFor(dish: DimSumDish): string {
  return `${DIM_SUM_CATALOG_SOURCE.assetBaseUrl}/${dish.releaseTag}/${encodeURIComponent(dish.assetFileName)}`;
}

/** Looks a dish up by its catalogue identifier. */
export function dishById(id: string): DimSumDish | null {
  return DISHES.find((dish) => dish.id === id) ?? null;
}

/* ------------------------------------------------------------------ */
/* Copy                                                                */
/* ------------------------------------------------------------------ */

function ladder(...steps: string[]): FunnyLadder {
  if (steps.length === 0) throw new Error('A ladder needs at least one string.');
  if (steps.length === 5) return steps as unknown as FunnyLadder;
  if (steps.length === 1) return [steps[0], steps[0], steps[0], steps[0], steps[0]];
  if (steps.length === 2) return [steps[0], steps[0], steps[0], steps[1], steps[1]];
  if (steps.length === 3) return [steps[0], steps[0], steps[1], steps[2], steps[2]];
  if (steps.length === 4) return [steps[0], steps[1], steps[2], steps[3], steps[3]];
  throw new Error(`A ladder takes 1, 2, 3, 4 or 5 strings; ${steps.length} were given.`);
}

function entry(en: FunnyLadder, yue: FunnyLadder): TranslationEntry {
  return { en, yue };
}

/**
 * The copy around the dish.
 *
 * The humour level styles these sentences. It never touches the dish's own name,
 * which is printed from the catalogue record verbatim at every level and in
 * every language mode, because a joke that renames the food has stopped being a
 * joke about the food.
 */
const DIM_SUM_STRINGS: Catalogue = {
  'core.dimsum.lede': entry(
    ladder(
      'From the public dim sum photo catalogue.',
      'From the public dim sum photo catalogue.',
      'Today the tea trolley stopped here.',
      'The trolley squeaked over and stopped at your desk.',
      'The trolley squeaked over, stopped at your desk, and refused to move on.'
    ),
    ladder(
      '嚟自公開嘅點心相冊。',
      '嚟自公開嘅點心相冊。',
      '今日架點心車停咗喺呢度。',
      '架點心車軋軋聲推到埋嚟，停咗喺你張枱前面。',
      '架點心車軋軋聲推到埋嚟，停咗喺你張枱前面，仲唔肯走。'
    )
  ),
  'core.dimsum.photoLoading': entry(
    ladder(
      'Fetching the photograph…',
      'Fetching the photograph…',
      'Fetching the photograph from the catalogue…',
      'Going to get the photograph…',
      'Off to the kitchen for the photograph…'
    ),
    ladder(
      '攞緊張相…',
      '攞緊張相…',
      '喺相冊度攞緊張相…',
      '行緊去攞張相…',
      '入咗廚房攞張相…'
    )
  ),
  'core.dimsum.photoUnavailable': entry(
    ladder(
      'The photograph could not be fetched, so only the name is shown. Reason: {reason}',
      'The photograph could not be fetched, so only the name is shown. Reason: {reason}',
      'No photograph this time, so the name will have to do. Reason: {reason}',
      'The photograph did not arrive, so you get the name and an honest apology. Reason: {reason}',
      'The photograph never made it out of the kitchen, so here is the name instead — no substitute picture, because that would be lying. Reason: {reason}'
    ),
    ladder(
      '攞唔到張相，所以淨係顯示個名。原因：{reason}',
      '攞唔到張相，所以淨係顯示個名。原因：{reason}',
      '今次冇相，唯有睇個名。原因：{reason}',
      '張相冇到，唯有畀個名你，順便講聲對唔住。原因：{reason}',
      '張相出唔到廚房，所以淨係得個名 —— 唔會求其搵第二張呃你。原因：{reason}'
    )
  ),
  'core.dimsum.offline': entry(
    ladder('this computer is offline'),
    ladder('部電腦而家冇網絡')
  ),
  'core.dimsum.photoRefused': entry(
    ladder('the catalogue answered {status}'),
    ladder('相冊回覆咗 {status}')
  ),
  'core.dimsum.photoTruncated': entry(
    ladder('the download was cut off before the picture was complete'),
    ladder('張相未落完就斷咗')
  ),
  'core.dimsum.source': entry(
    ladder('Photograph from the public dim sum photo catalogue'),
    ladder('相片嚟自公開嘅點心相冊')
  ),
  'core.dimsum.openCatalogue': entry(ladder('Open the catalogue'), ladder('打開相冊')),
  'core.dimsum.altUnavailable': entry(
    ladder('{dish}. The photograph could not be fetched; the dish name is shown instead.'),
    ladder('{dish}。攞唔到張相，所以淨係顯示個菜名。')
  )
};

i18n.register(DIM_SUM_STRINGS);

/* ------------------------------------------------------------------ */
/* Suppression                                                         */
/* ------------------------------------------------------------------ */

/**
 * Reasons the surprise stays out of the way.
 *
 * These are not preferences and they are not an off switch: each one is a moment
 * where a cheerful card would be rude, and every one of them is temporary except
 * `error`, which lasts for the rest of the launch because an application that has
 * already failed once should not follow it with a picture of a dumpling.
 */
const suppressions = new Set<string>();
let sawError = false;

/**
 * Holds the surprise back while something more important is happening.
 *
 * Returns the release function. An updater, a long-running task, a wizard or any
 * other flow that owns the user's attention calls this on entry and calls the
 * returned function on exit.
 */
export function suppressDimSum(reason: string): () => void {
  const key = String(reason || 'unspecified');
  suppressions.add(key);
  return () => {
    suppressions.delete(key);
  };
}

/** The reasons currently holding the surprise back. Useful when reporting state. */
export function dimSumSuppressedBy(): string[] {
  const active = [...suppressions];
  if (sawError) active.push('error');
  return active.sort();
}

/**
 * True when the user is visibly in the middle of something.
 *
 * A modal dialog is open, or the destructive-action gate is up. This is a
 * deliberate heuristic over the DOM rather than a guess: those are the two
 * surfaces in this application that demand an answer before anything else
 * happens, and both mark themselves as modal for assistive technology already.
 */
function midTask(): boolean {
  if (typeof document === 'undefined') return false;
  return Boolean(document.querySelector('dialog[open], [aria-modal="true"]'));
}

if (typeof window !== 'undefined') {
  // Installed at import time so a failure that happens before the draw arrives
  // is still remembered when it does.
  window.addEventListener('error', () => {
    sawError = true;
  });
  window.addEventListener('unhandledrejection', () => {
    sawError = true;
  });
}

/* ------------------------------------------------------------------ */
/* First run                                                           */
/* ------------------------------------------------------------------ */

const DIM_SUM_DIR_NAME = 'dim-sum';
const FIRST_RUN_MARKER = 'first-launch-complete.json';
/** A photo is a couple of megabytes; base64 adds a third. Twelve is generous and still bounded. */
const MAX_CACHE_BYTES = 12 * 1024 * 1024;

function separator(path: string): string {
  return path.includes('\\') ? '\\' : '/';
}

function dimSumDir(): string {
  const base = window.studio.info.userDataDir;
  return `${base}${separator(base)}${DIM_SUM_DIR_NAME}`;
}

function join(dir: string, name: string): string {
  return `${dir}${separator(dir)}${name}`;
}

/**
 * Reports whether this is the very first launch, and records that it happened.
 *
 * The marker is a file in the application data directory rather than a setting,
 * because a setting would be exportable, resettable and visible — and this is
 * not something the user chooses, it is something the application remembers. If
 * the marker cannot be read or written, the launch is treated as a first run:
 * staying quiet is the safe direction to fail in.
 */
async function isFirstLaunch(): Promise<boolean> {
  const dir = dimSumDir();
  const marker = join(dir, FIRST_RUN_MARKER);
  const read = await window.studio.fs.readText(marker, 64 * 1024);
  if (read.ok) {
    try {
      const parsed = JSON.parse(read.value) as { firstLaunchAt?: unknown };
      if (typeof parsed.firstLaunchAt === 'string' && parsed.firstLaunchAt.length > 0) return false;
    } catch {
      // A corrupt marker is treated as "seen it before" rather than replaying the
      // first-run suppression forever; it is rewritten below.
    }
    await writeMarker(dir, marker);
    return false;
  }
  await writeMarker(dir, marker);
  return true;
}

async function writeMarker(dir: string, marker: string): Promise<void> {
  const ensured = await window.studio.fs.ensureDirectory(dir);
  if (!ensured.ok) return;
  await window.studio.fs.writeText(
    marker,
    JSON.stringify({ firstLaunchAt: new Date().toISOString(), note: 'Written once, on the first launch.' }, null, 2)
  );
}

/* ------------------------------------------------------------------ */
/* The photograph                                                      */
/* ------------------------------------------------------------------ */

export type DimSumPhoto =
  | { available: true; dataUri: string; fromCache: boolean; assetUrl: string }
  | { available: false; reasonKey: string; values?: Record<string, string | number>; assetUrl: string };

interface CacheRecord {
  assetUrl: string;
  mediaType: string;
  fetchedAt: string;
  base64: string;
}

let allowed = false;

/**
 * Registers the outbound rules this feature needs, naming itself and its reason.
 *
 * Outbound HTTP is deny-by-default, so without this the request is refused. The
 * asset URL redirects to a signed download host, which is why the second rule
 * exists: the redirect is followed only because that host is allowed in its own
 * right, not because a redirect was trusted.
 */
async function ensureAllowed(): Promise<void> {
  if (allowed) return;
  await window.studio.http.allow({
    host: 'github.com',
    schemes: ['https'],
    owner: 'Dim sum surprise',
    reason: 'Fetches one dish photograph from the public dim sum photo catalogue release assets.'
  });
  await window.studio.http.allow({
    host: '.githubusercontent.com',
    schemes: ['https'],
    owner: 'Dim sum surprise',
    reason: 'The catalogue release asset URL redirects to this signed download host.'
  });
  allowed = true;
}

function cachePathFor(dish: DimSumDish): string {
  // The identifier is catalogue-issued and matches `hk-dish-0000`, so it cannot
  // carry a separator, but it is filtered anyway rather than trusted.
  const safe = dish.id.replace(/[^a-z0-9-]/gi, '_');
  return join(dimSumDir(), `${safe}.photo.json`);
}

async function readCachedPhoto(dish: DimSumDish, assetUrl: string): Promise<string | null> {
  const read = await window.studio.fs.readText(cachePathFor(dish), MAX_CACHE_BYTES);
  if (!read.ok) return null;
  try {
    const record = JSON.parse(read.value) as Partial<CacheRecord>;
    if (record.assetUrl !== assetUrl) return null;
    if (typeof record.base64 !== 'string' || record.base64.length === 0) return null;
    if (!/^[A-Za-z0-9+/=\s]+$/.test(record.base64)) return null;
    const mediaType = typeof record.mediaType === 'string' && record.mediaType ? record.mediaType : 'image/png';
    return `data:${mediaType};base64,${record.base64.replace(/\s+/g, '')}`;
  } catch {
    return null;
  }
}

async function writeCachedPhoto(dish: DimSumDish, record: CacheRecord): Promise<void> {
  const dir = dimSumDir();
  const ensured = await window.studio.fs.ensureDirectory(dir);
  if (!ensured.ok) return;
  await window.studio.fs.writeText(cachePathFor(dish), JSON.stringify(record));
}

const inFlight = new Map<string, Promise<DimSumPhoto>>();

/**
 * Resolves one dish's photograph: cache first, then the public asset.
 *
 * The cache is an ordinary application-data directory holding at most one file
 * per dish that has actually been shown, which is at most one per launch. There
 * is no pruning schedule and none is needed; deleting the application data
 * directory clears it, exactly as it clears everything else.
 */
export function loadDishPhoto(dish: DimSumDish): Promise<DimSumPhoto> {
  const existing = inFlight.get(dish.id);
  if (existing) return existing;
  const work = resolvePhoto(dish);
  inFlight.set(dish.id, work);
  return work;
}

async function resolvePhoto(dish: DimSumDish): Promise<DimSumPhoto> {
  const assetUrl = assetUrlFor(dish);

  const cached = await readCachedPhoto(dish, assetUrl);
  if (cached) return { available: true, dataUri: cached, fromCache: true, assetUrl };

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { available: false, reasonKey: 'core.dimsum.offline', assetUrl };
  }

  try {
    await ensureAllowed();
  } catch (error) {
    return {
      available: false,
      reasonKey: 'core.dimsum.photoRefused',
      values: { status: error instanceof Error ? error.message : String(error) },
      assetUrl
    };
  }

  const response = await window.studio.http.request({
    url: assetUrl,
    method: 'GET',
    responseEncoding: 'base64',
    // github.com hands the download to a signed host; three hops is ample and
    // every hop is re-checked against the allow rules.
    maxRedirects: 3,
    maxBytes: MAX_CACHE_BYTES,
    timeoutMs: 20_000
  });

  if (!response.ok) {
    return { available: false, reasonKey: 'core.dimsum.photoRefused', values: { status: response.error }, assetUrl };
  }
  if (response.value.status !== 200) {
    return {
      available: false,
      reasonKey: 'core.dimsum.photoRefused',
      values: { status: `${response.value.status} ${response.value.statusText}`.trim() },
      assetUrl
    };
  }
  if (response.value.truncated || response.value.body.length === 0) {
    return { available: false, reasonKey: 'core.dimsum.photoTruncated', assetUrl };
  }

  const mediaType = dish.assetFileName.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  const record: CacheRecord = {
    assetUrl,
    mediaType,
    fetchedAt: new Date().toISOString(),
    base64: response.value.body
  };
  await writeCachedPhoto(dish, record);
  return { available: true, dataUri: `data:${mediaType};base64,${record.base64}`, fromCache: false, assetUrl };
}

/* ------------------------------------------------------------------ */
/* Naming                                                              */
/* ------------------------------------------------------------------ */

export interface DishNaming {
  /** The name the active language mode leads with. */
  primary: string;
  /** The other language's name. Never empty: the dish is always named in both. */
  secondary: string;
  /** Both names joined, for one-line contexts such as an announcement. */
  combined: string;
}

/**
 * Names a dish in both languages, led by whichever the active mode prefers.
 *
 * Both names are always present, because the dish is a Hong Kong dish and half
 * its name is the Chinese one. What the mode decides is which one leads, so an
 * English reader is not made to parse Chinese first and a Cantonese reader is
 * not made to parse English first.
 */
export function nameDish(dish: DimSumDish): DishNaming {
  const mode = i18n.snapshot().mode;
  const primary = mode === 'yue' ? dish.nameZhHant : dish.nameEn;
  const secondary = mode === 'yue' ? dish.nameEn : dish.nameZhHant;
  return { primary, secondary, combined: `${primary} · ${secondary}` };
}

/** The alternative text for a dish's photograph, in the active mode's language. */
export function altTextFor(dish: DimSumDish): string {
  const mode = i18n.snapshot().mode;
  const naming = nameDish(dish);
  const base = mode === 'yue' ? dish.altYue : dish.altEn;
  return mode === 'both' ? `${dish.altEn} · ${dish.altYue}` : `${base} (${naming.combined})`;
}

/* ------------------------------------------------------------------ */
/* The surface                                                         */
/* ------------------------------------------------------------------ */

const DISMISS_AFTER_MS = 12_000;
let shownThisLaunch = false;

/** Picks the dish for a draw. Exported so the choice can be checked rather than assumed. */
export function dishForDraw(draw: DimSumDraw): DimSumDish {
  const selector = Number.isFinite(draw.selector) ? Math.min(Math.max(draw.selector, 0), 0.999999) : 0;
  return DISHES[Math.floor(selector * DISHES.length) % DISHES.length];
}

/**
 * Shows the surprise, if this launch won it and the moment is a polite one.
 *
 * `won` is the main process's decision and is never re-rolled here, so the
 * surface can neither fire more than once per launch nor more often than the
 * stated one launch in ten.
 */
export function showDimSum(draw: DimSumDraw): void {
  void present(draw);
}

async function present(draw: DimSumDraw): Promise<void> {
  if (!draw.won) return;
  if (shownThisLaunch) return;
  // While the named study mode is on, this behaves as though it is not
  // installed: no surface, no request, no trace of it anywhere.
  if (i18n.schoolModeActive()) return;
  if (sawError || suppressions.size > 0 || midTask()) return;

  // Read before drawing anything, so a first run is quiet rather than
  // interrupted a moment after it started.
  if (await isFirstLaunch()) return;

  // The state can have changed while that file was read.
  if (shownThisLaunch || i18n.schoolModeActive() || sawError || suppressions.size > 0 || midTask()) return;
  shownThisLaunch = true;

  const dish = dishForDraw(draw);
  draw.dishId = dish.id;
  const naming = nameDish(dish);

  const card = el('div', {
    className: 'md-dimsum',
    // `status`, never `alert`: it must not steal focus and must not interrupt.
    attrs: { role: 'status', 'aria-live': 'polite', 'data-dish-id': dish.id }
  });

  const figure = el('div', { className: 'md-dimsum__art' });
  const placeholder = el('span', { attrs: { 'aria-hidden': 'true' }, text: '🥟' });
  figure.append(placeholder);

  const text = el('div', { className: 'md-dimsum__text' });
  text.append(
    el('p', {
      className: 'md-typescale-title-small',
      text: i18n.t('core.dimsum.title', 'A dim sum appeared', { dialog: true })
    })
  );
  // The dish's own name, verbatim from the catalogue. No humour level and no
  // language mode ever rewrites this line.
  text.append(el('p', { className: 'md-typescale-body-large md-dimsum__name', text: naming.primary }));
  text.append(el('p', { className: 'md-typescale-body-medium md-dimsum__name-alt', text: naming.secondary }));
  const lede = el('p', {
    className: 'md-typescale-body-small md-dimsum__lede',
    text: i18n.t('core.dimsum.lede', 'From the public dim sum photo catalogue.')
  });
  text.append(lede);

  const dismiss = el('button', {
    className: 'md-toast__action',
    text: i18n.t('core.dimsum.dismiss', 'Lovely'),
    attrs: { type: 'button' }
  });
  let timer: number | null = null;
  const close = (): void => {
    if (timer !== null) window.clearTimeout(timer);
    card.remove();
  };
  dismiss.addEventListener('click', close);

  card.append(figure, text, dismiss);
  document.body.append(card);
  // Announced, never focused: a screen-reader user gets the same small delight
  // without having their place taken away from them.
  a11y.announce(naming.combined);

  timer = window.setTimeout(close, DISMISS_AFTER_MS);

  // The photograph arrives afterwards or not at all. Either way the card is
  // already complete and already correct.
  const photo = await loadDishPhoto(dish);
  if (!card.isConnected) return;
  if (photo.available) {
    const image = el('img', {
      className: 'md-dimsum__photo',
      attrs: { src: photo.dataUri, alt: altTextFor(dish), decoding: 'async', draggable: 'false' }
    });
    figure.textContent = '';
    figure.append(image);
  } else {
    const reason = i18n.t(photo.reasonKey, photo.reasonKey, { values: photo.values });
    lede.textContent = i18n.t(
      'core.dimsum.photoUnavailable',
      'The photograph could not be fetched, so only the name is shown. Reason: {reason}',
      { values: { reason } }
    );
    placeholder.setAttribute('role', 'img');
    placeholder.removeAttribute('aria-hidden');
    placeholder.setAttribute(
      'aria-label',
      i18n.t('core.dimsum.altUnavailable', '{dish}. The photograph could not be fetched; the dish name is shown instead.', {
        values: { dish: naming.combined }
      })
    );
  }
}

/** Subscribes to the launch draw. Returns an unsubscribe function. */
export function subscribeDimSum(listener: (draw: DimSumDraw) => void): () => void {
  return window.studio.events.on('dimsum:surprise', listener);
}
