const { HttpsError } = require('firebase-functions/v2/https');
const Anthropic = require('@anthropic-ai/sdk');

// Reads a grocery receipt photo with Claude and sorts each line into a food group.
// The Anthropic API key lives in Firestore at config/anthropic { key }, like the
// other API keys: clients can't read config/, only functions via the Admin SDK.

// Keep in sync with GROCERY_GROUPS in src/utils/budget.js (frozen was merged into prepared)
const GROUPS = ['fruits', 'vegetables', 'meat', 'dairy', 'bakery', 'pantry', 'snacks', 'sweets', 'drinks', 'alcohol', 'prepared', 'household', 'pets', 'personal', 'health', 'other'];

const SCHEMA = {
  type: 'object',
  properties: {
    store: { type: 'string' },
    date: { type: 'string', description: 'YYYY-MM-DD, or empty if not printed' },
    total: { type: 'number', description: 'Grand total paid' },
    tax: { type: 'number', description: 'All tax lines added up, 0 if none' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          price: { type: 'number' },
          group: { type: 'string', enum: GROUPS },
        },
        required: ['name', 'price', 'group'],
        additionalProperties: false,
      },
    },
  },
  required: ['store', 'date', 'total', 'tax', 'items'],
  additionalProperties: false,
};

const PROMPT = `This is a photo of a shopping receipt. Read every purchased line item.

For each item give:
- name: a short readable name (expand abbreviations like "ORG BNLS CHKN BRST" → "Organic boneless chicken breast")
- price: what was paid for that line after any discount or coupon printed right under it (fold the discount into the item; don't list discounts, deposits or bag fees as items unless they can't be tied to an item — then list them as group "other" with a negative or positive price)
- group, one of:
  fruits (fresh fruit and berries)
  vegetables (fresh vegetables, herbs, salad greens, potatoes, mushrooms)
  meat (meat, poultry, fish, seafood, tofu and other proteins — fresh or frozen raw, e.g. frozen fish fillets or frozen chicken)
  dairy (milk, cheese, yogurt, butter, cream, eggs, plant milks)
  bakery (bread, buns, bagels, tortillas, pastries)
  pantry (rice, pasta, flour, cereal, oats, canned and jarred food, sauces, condiments, oils, spices, nuts, baking supplies, baby food and formula)
  snacks (savory snacks: chips, crackers, pretzels, popcorn, granola and protein bars)
  sweets (candy, chocolate, cookies, cakes, desserts, ice cream of every kind including bars and frozen novelties)
  drinks (non-alcoholic: water, soda, juice, sports drinks, coffee including beans and grounds, tea)
  alcohol (beer, wine, spirits, hard seltzer, cider)
  prepared (deli counter, rotisserie chicken, ready-to-eat meals, sushi, counter salads, and frozen ready meals like frozen pizza, frozen dinners, frozen dumplings)
  household (cleaning supplies, paper towels, toilet paper, trash bags, foil, food storage, light bulbs, batteries)
  pets (pet food, treats, litter and pet supplies)
  personal (toiletries and cosmetics: shampoo, soap, toothpaste, deodorant, razors, makeup, diapers and wipes)
  health (medicine, pain relief, cold and allergy, vitamins and supplements, first aid, prescriptions, contact lens solution, anything pharmacy-only)
  other (anything that fits none of these)

Also give the store name, the purchase date as YYYY-MM-DD (empty string if not printed), the grand total, and the tax (sum of all tax lines, 0 if none).
If the photo isn't a receipt or can't be read, return an empty items list and total 0.`;

async function scanReceipt(db, request) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Must be signed in');
  const image = String(request.data?.image || '');
  const mediaType = ['image/jpeg', 'image/png', 'image/webp'].includes(request.data?.mediaType) ? request.data.mediaType : 'image/jpeg';
  if (!image || image.length > 8e6) throw new HttpsError('invalid-argument', 'Send one receipt photo under 6 MB');

  const snap = await db.doc('config/anthropic').get();
  const apiKey = snap.exists ? snap.data().key : null;
  if (!apiKey) throw new HttpsError('failed-precondition', 'Receipt scanning needs an Anthropic API key at config/anthropic in Firestore.');

  const client = new Anthropic({ apiKey });
  let response;
  try {
    response = await client.messages.create({
      model: 'claude-haiku-5-5', // cheapest model; receipts are a simple read. Switch back to claude-opus-5-5 if it makes mistakes
      max_tokens: 16000,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
          { type: 'text', text: PROMPT },
        ],
      }],
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new HttpsError('failed-precondition', 'The Anthropic API key was rejected.');
    if (e instanceof Anthropic.RateLimitError) throw new HttpsError('resource-exhausted', 'Too many scans right now. Try again in a minute.');
    if (e instanceof Anthropic.APIError) throw new HttpsError('unavailable', `Receipt reader error (${e.status}). Try again.`);
    throw new HttpsError('unavailable', 'Could not reach the receipt reader. Try again.');
  }
  if (response.stop_reason === 'refusal') throw new HttpsError('failed-precondition', "That photo couldn't be read as a receipt.");
  const text = response.content.find(b => b.type === 'text')?.text;
  let out;
  try { out = JSON.parse(text); } catch { throw new HttpsError('internal', "Couldn't read that receipt. Try a sharper photo."); }

  const round = n => Math.round((Number(n) || 0) * 100) / 100;
  return {
    store: String(out.store || '').slice(0, 80),
    date: /^\d{4}-\d{2}-\d{2}$/.test(out.date) ? out.date : '',
    total: round(out.total),
    tax: round(out.tax),
    items: (out.items || []).slice(0, 300).map(i => ({
      name: String(i.name || '').slice(0, 80),
      price: round(i.price),
      group: GROUPS.includes(i.group) ? i.group : 'other',
    })),
  };
}

module.exports = { scanReceipt };
