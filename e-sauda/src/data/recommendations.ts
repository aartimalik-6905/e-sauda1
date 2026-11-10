import { Category } from '../types'

// A few illustrative complementary items per category — not exhaustive, just enough
// to surface genuinely useful cross-sells (buying an AC? you'll likely also need a
// mounting bracket). Matched against other listings' title/sub-category, so results
// are only ever real, currently-active listings someone else has actually posted —
// never fabricated suggestions.
export const complementaryKeywords: Partial<Record<Category, string[]>> = {
  Appliances: ['mounting bracket', 'copper pipe', 'stabilizer', 'stand'],
  Mobiles: ['case', 'screen protector', 'charger', 'earphones'],
  Electronics: ['cable', 'stand', 'cover', 'adapter'],
  Vehicles: ['helmet', 'cover', 'lock', 'battery'],
  Furniture: ['cushion', 'polish', 'cover'],
  Fashion: ['belt', 'wallet', 'shoes'],
  Books: ['bookshelf', 'bookmark'],
  Sports: ['bag', 'gloves', 'net'],
}

// Sub-category is free text a seller types in (see Sell.tsx), not a fixed enum, so this
// is matched as a case-insensitive substring against the listing's own title/sub-category
// rather than an exact key lookup. Checked in addition to the broader per-category list
// above -- lets "buying a scooter" surface a scooter cover/cleaner specifically, rather
// than only the generic Vehicles list, without needing a rigid sub-category taxonomy.
export const specificComplementaryTriggers: { matches: string[]; keywords: string[] }[] = [
  {
    matches: ['scooty', 'scooter', 'activa', 'vespa'],
    keywords: ['scooty cover', 'scooter cover', 'helmet', 'phone mount', 'scooty cleaner', 'lock'],
  },
  {
    matches: ['bike', 'motorcycle', 'bullet', 'royal enfield'],
    keywords: ['bike cover', 'helmet', 'bike lock', 'saddle bag', 'riding gloves'],
  },
  {
    matches: ['shirt', 't-shirt', 'tshirt'],
    keywords: ['trousers', 'jeans', 'belt', 'shoes', 'buttons', 'blazer'],
  },
  {
    matches: ['jeans', 'trousers', 'pant', 'chinos'],
    keywords: ['shirt', 't-shirt', 'belt', 'shoes'],
  },
  {
    matches: ['laptop'],
    keywords: ['laptop bag', 'laptop sleeve', 'mouse', 'laptop stand', 'cooling pad'],
  },
  {
    matches: ['sofa', 'couch'],
    keywords: ['cushion', 'throw blanket', 'coffee table'],
  },
  {
    matches: ['cricket bat'],
    keywords: ['cricket ball', 'batting gloves', 'pads', 'cricket kit bag'],
  },
]
