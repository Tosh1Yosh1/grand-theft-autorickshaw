import type { Line } from './lines';

const d = (dirty: string, clean: string): Line => ({ dirty, clean });

export interface ChatMessage {
  from: string;
  text: Line;
}

export interface ChatThread {
  id: string;
  name: string;
  avatar: string;
  /** Messages already there when the game starts. */
  history: ChatMessage[];
  /** Messages that trickle in over time (random order). */
  drip: ChatMessage[];
}

export const CHATS: ChatThread[] = [
  {
    id: 'family',
    name: 'Pandey Parivaar 🙏🏽🌸',
    avatar: '👪',
    history: [
      { from: 'Chacha', text: '🌞🌻 GOOD MORNING 🌻🌞 Jo subah uthkar chai peeta hai, wahi asli insaan hai. Forward to 10 people!!' },
      { from: 'Mummy', text: 'Pappu khana khaya?' },
      { from: 'Papa', text: 'Pappu, EMI ki date 5 hai. Yaad hai na.' },
      { from: 'Bunty (cousin)', text: 'Bhaiyo behno, LIFE INSURANCE lo! Pappu bhaiya, aapke liye special plan. Auto ka bhi insurance.' },
      { from: 'Mummy', text: 'Pappu khana khaya?? Seen kar ke reply nahi karta.' },
    ],
    drip: [
      { from: 'Chacha', text: '🌺🙏 GOOD AFTERNOON 🙏🌺 Doodh mein haldi, zindagi mein khushi. Forward karo warna 7 din bad luck!!!' },
      { from: 'Chacha', text: '⚠️⚠️ URGENT ⚠️⚠️ Kal se WhatsApp paid ho jayega. Is message ko forward karo toh free rahega. WhatsUpp ke CEO ne khud bola.' },
      { from: 'Mummy', text: 'Beta, TV pe tumhare jaisa koi auto wala dikha. Tum toh nahi the na?' },
      { from: 'Bunty (cousin)', text: 'Bhaiya, 2 minute ka call? Ek scheme hai. Guaranteed return. Mera bhi wahi kehna hai jo sarkar nahi keh sakti.' },
      { from: 'Papa', text: 'Kisi ne mera chashma dekha?' },
      { from: 'Mummy', text: 'Papa, chashma aapke sar pe hai.' },
      { from: 'Chacha', text: '🌙✨ GOOD NIGHT ✨🌙 Jo sota hai woh khota hai. Par neend bhi zaroori hai. 🙏' },
      { from: 'Bua', text: 'Pappu ki shaadi kab? Meri saheli ki beti hai, 5 foot, gori, MBA.' },
      { from: 'Mummy', text: 'Pappu, aate waqt dhaniya aur ek kilo pyaaz.' },
      { from: 'Chacha', text: 'NASA ne bola hai aaj raat 12 se 3 phone band rakho, cosmic rays aa rahi hain. 🌌📵' },
      { from: 'Bunty (cousin)', text: 'Pappu bhaiya aapne kabhi socha hai ki auto ka bhi term plan ho sakta hai? 🤔' },
      { from: 'Papa', text: 'Chashma mil gaya.' },
      { from: 'Mummy', text: 'Khana khaya?' },
      { from: 'Chacha', text: d('Yeh video dekho, ek aadmi ne pothole mein machhli pakdi 🐟🤣🤣 bc kya talent hai', 'Yeh video dekho, ek aadmi ne pothole mein machhli pakdi 🐟🤣🤣 kya talent hai') },
    ],
  },
  {
    id: 'bro',
    name: 'Startup Bro (Kabir)',
    avatar: '🦄',
    history: [{ from: 'Kabir', text: 'Bro, loved the ride. Want to be our Chief Auto Officer? Equity only.' }],
    drip: [
      { from: 'Kabir', text: 'Bro we pivoted. Now it is AI for chai. ChaiGPT.' },
      { from: 'Kabir', text: 'Bro the funding round closed. By closed I mean the VC closed the door on me.' },
      { from: 'Kabir', text: 'Bro can I crash at yours? My co-living space is co-evicting me.' },
    ],
  },
  {
    id: 'hawaldar',
    name: 'Hawaldar Tukaram',
    avatar: '👮🏽',
    history: [{ from: 'Tukaram', text: 'Pappu, Diwali bonus ka "contribution" pending hai.' }],
    drip: [
      { from: 'Tukaram', text: 'Aaj naka Jugaadpur mein hai. Dhyaan rakhna. Ya chai lana.' },
      { from: 'Tukaram', text: 'Saheb naya hai. Imaandar hai. Do hafte mein theek ho jayega.' },
    ],
  },
  {
    id: 'emi',
    name: 'Instant Loan Wale',
    avatar: '💸',
    history: [{ from: 'Recovery Agent', text: 'Sir, aapki EMI ₹4,999 due hai. Interest: yes. Late fee: also yes.' }],
    drip: [
      { from: 'Recovery Agent', text: 'Sir, aaj pay kar dijiye. Warna hum aapke mummy ko call karenge. Woh pooch lengi khana khaya ya nahi.' },
      { from: 'Recovery Agent', text: 'Sir, special offer: EMI pe EMI. Loan chukane ke liye loan.' },
    ],
  },
];

export interface Contact {
  id: string;
  name: string;
  emoji: string;
  /** What happens on call: handled in Phone. */
  kind: 'mummy' | 'dispatcher' | 'netaji' | 'mechanic' | 'bunty' | 'chacha';
}

export const CONTACTS: Contact[] = [
  { id: 'mummy', name: 'Mummy', emoji: '👩🏽‍🍳', kind: 'mummy' },
  { id: 'dispatcher', name: 'Dispatcher (kaam)', emoji: '📻', kind: 'dispatcher' },
  { id: 'mechanic', name: 'Raju Mechanic (gaadi mangao)', emoji: '🔧', kind: 'mechanic' },
  { id: 'netaji', name: 'Netaji ka PA', emoji: '🧥', kind: 'netaji' },
  { id: 'bunty', name: 'Bunty (insurance)', emoji: '📋', kind: 'bunty' },
  { id: 'chacha', name: 'Chacha', emoji: '🌻', kind: 'chacha' },
];

export const CALL_LINES: Record<Contact['kind'], readonly Line[]> = {
  mummy: [
    'Haan beta, khana khaya? Nahi? Ghar aao, rajma bana hai.',
    'Beta, tum theek ho? Tumhari awaaz thaki hui lag rahi hai. Chai piyo.',
    'Pappu, Sharma ji ka beta phir se promote ho gaya. Tum kab?',
    'Beta, auto dheere chalaya karo. Aur EMI time pe bharo. Aur shaadi kar lo.',
  ],
  dispatcher: ['Kaam chahiye? Map pe orange khambe dekho, wahin kaam hai.', 'Sawari chahiye toh auto ke saath ghoomo. Log haath dikhayenge.'],
  netaji: ['Netaji abhi "public service" mein busy hain. Setting ke liye office aao. Cash only.', 'Phone pe setting nahi hoti. Office aao, chai bhi milegi. Bill bhi.'],
  mechanic: ['Raju bol raha hoon. Kaunsi gaadi chahiye? ₹500 delivery charge, aaj hi.'],
  bunty: [
    'Bhaiya! Aapke liye "Pappu Suraksha Yojana". Premium sirf ₹999 mahina. Claim? Woh dekh lenge.',
    'Bhaiya, insurance lo, warna main roz call karunga. Yeh bhi ek tarah ka insurance hai.',
  ],
  chacha: [
    'Pappu! Maine tujhe 47 forward bheje, ek bhi padha? 🌻',
    d('Beta, ek video bheja hai, bc dekh ke hasoge. Matlab, dekh ke hasoge.', 'Beta, ek video bheja hai, dekh ke hasoge.'),
  ],
};

/** BOLX: classifieds where everything sells for ₹20. */
export const BOLX_JUNK: readonly string[] = [
  'Kisi ka chappal (left only)',
  'Tiffin (dal missing)',
  'Startup Bro ka business card',
  'Hawaldar ki seeti',
  'Phone (screen mein crack, Good Morning images intact)',
  'Baraat ka ek note (₹10, nakli)',
  'Netaji ka poster (chehra 3x bada)',
  'Gully cricket ball (window-tested)',
  'Selfie stick (toota)',
  'Aunty ka rishta biodata',
  'Delivery bag (khushboo: biryani)',
  'Gym Bhai ka protein dabba (khaali)',
];

export const BOLX_LISTINGS: readonly [string, string][] = [
  ['Auto meter, "fast" mode built-in', '₹20'],
  ['Kidney (slightly used), serious buyers only', 'Price on request (₹20)'],
  ['1 BHK in Startup Nagar (balcony = window)', '₹5 Cr or ₹20 nakad'],
  ['Flyover ka adhoora hissa', '₹20 (pick-up only)'],
  ['Pre-owned NFT of a cutting chai', '₹20 (no refunds)'],
];

export const NOTIFY_TOASTS: readonly string[] = ['WhatsUpp', 'BOLX', 'Instant Loan', 'Chacha'];
