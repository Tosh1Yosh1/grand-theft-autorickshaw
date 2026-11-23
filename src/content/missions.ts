import type { Line } from './lines';

const d = (dirty: string, clean: string): Line => ({ dirty, clean });

export interface DialogueLine {
  who: string;
  line: Line;
}
const L = (who: string, line: Line): DialogueLine => ({ who, line });

export const RANKS: { name: string; respect: number }[] = [
  { name: 'Pappu', respect: 0 },
  { name: 'Bhai', respect: 100 },
  { name: 'Don', respect: 300 },
  { name: 'MLA', respect: 600 },
];

export const MISSION_TEXT = {
  passed: 'MISSION PASSED',
  failed: 'MISSION FAIL',
  retry: 'Marker pe wapas jao aur F dabao. Zindagi second chance deti hai, EMI nahi.',
};

// ---------- Mission 1: Meter Down ----------
export const M1 = {
  title: 'Meter Down',
  tagline: 'Drunk Startup Bro, crypto pitch, aur auto ki izzat.',
  intro: [
    L('Pappu', 'Mere paas EMI hai. Teen. Aur ek auto. Aur ek sapna: Mumbhai ka sabse bada bhai banna.'),
    L('Pappu', 'Par sapne petrol se nahi chalte. Sawari chahiye.'),
    L('Dispatcher', 'Pappu, DisruptX tower pe ek "founder" khada hai. Party se aa raha hai. Bahut... khush hai.'),
    L('Pappu', 'Khush matlab?'),
    L('Dispatcher', d('Matlab tight hai bc. Auto mein ulti mat karne dena, warna seat tum saaf karoge.', 'Matlab bahut tight hai. Auto mein ulti mat karne dena, warna seat tum saaf karoge.')),
    L('Pappu', 'Meter down. Mood up. Chalo.'),
  ],
  pickup: [
    L('Startup Bro', 'BRO. Bro bro bro. You are an auto? I LOVE autos. Very analog. Very authentic.'),
    L('Startup Bro', 'Take me to Club Pivot in Filmistan. And listen to my pitch. It is crypto. But for chai.'),
    L('Pappu', 'Baitho. Aur please, dheere bolo. Aur dheere... saans lo.'),
  ],
  pitch: [
    'Bro, imagine: ChaiCoin. Every cutting chai is an NFT.',
    'We tokenize the tapri, bro. Decentralized adrak.',
    'My valuation is 400 crore. My bank balance is 400 rupees. Same thing.',
    'Bro, slow down, my portfolio is spinning. And my stomach.',
    'What if... auto... but on the blockchain?',
    'I will give you 5% equity. In my next startup. After this one fails.',
    'Bro, the pothole just disrupted my lunch.',
    d('Bro bc, sharp turn mat le, I am fragile.', 'Bro, sharp turn mat le, I am fragile.'),
    'Do you know what web3 is? Me neither. Raised 2 crore though.',
    'My therapist says I talk too much. I fired him. Now he is my co-founder.',
  ],
  warn: [
    'Bro... bro... I am feeling the market crash... inside me.',
    d('Rok bc, rok! Mera IPO bahar aa raha hai!', 'Rok, rok! Mera IPO bahar aa raha hai!'),
    'Bro, smooth driving please, I am pre-vomit.',
  ],
  puked: 'Bro ne auto mein ulti kar di. Seat gayi, izzat gayi, mission gaya.',
  arrive: [
    L('Startup Bro', 'Bro. You are a legend. A unicorn. A uni-auto.'),
    L('Startup Bro', 'Here is your fare. And a tip. And a 5-star rating. Maybe 4. Depends on the market.'),
    L('Pappu', 'Rating se EMI nahi bharti, bro. Cash do.'),
  ],
  needAuto: 'Pehle auto lao. Sawari bina auto ke? Godi mein uthaoge kya?',
};

// ---------- Mission 2: Dabba Dash ----------
export const M2 = {
  title: 'Dabba Dash',
  tagline: '10 tiffin, 4 minute, ek bhi dal nahi girni chahiye.',
  intro: [
    L('Dabbawala Kaka', 'Pappu! Mera cycle puncture ho gaya. Aaj ke 10 dabbe tumhe pahunchane hain.'),
    L('Pappu', 'Kaka, main auto wala hoon, delivery boy nahi.'),
    L('Dabbawala Kaka', 'Lunch ka time khatam hua toh 10 office waale bhookhe. Bhookha office = danger.'),
    L('Dabbawala Kaka', 'Aur sun: dal girni nahi chahiye. Ek ek boond ki reputation hai.'),
    L('Pappu', 'Dal bachaenge, lunch bachaenge, aur shayad desh bhi.'),
  ],
  delivered: ['Dabba mil gaya! Thank you bhaiya!', 'Aaj rajma hai? Waah!', 'Dal giri hui hai... chalega.', 'Mummy ka khana! Ro dunga.', 'Late ho gaye, par chalega.'],
  spill: ['Arre, dal gir gayi!', 'Sambhaal ke! Tiffin hil raha hai!', 'Pothole ne dal ko azaad kar diya.'],
  timeout: 'Lunch khatam! Office waale bhookhe aur gusse mein. Kaka ki izzat gayi.',
  allSpilled: 'Saari dal gir gayi. Ab dabbe mein sirf dukh hai.',
  outro: [L('Dabbawala Kaka', 'Shaabaash Pappu! Dabbawala ka system Harvard padhata hai. Ab tum bhi syllabus mein ho.')],
};

// ---------- Mission 3: Shaadi Mein Zaroor Aana ----------
export const M3 = {
  title: 'Shaadi Mein Zaroor Aana',
  tagline: 'Dulhe ki Thaar churao. Baraat naachte hue peeche aayegi.',
  intro: [
    L('Chhota Chetan', 'Pappu bhai, ek kaam hai. Dulha Rocky ki shaadi hai aaj. Uski Thaar chahiye.'),
    L('Pappu', 'Shaadi se gaadi churaun? Mummy kya kahegi?'),
    L('Chhota Chetan', 'Mummy kahegi "beta khana kha ke jaana". Bas. Thaar Kachra Ghat godown pe chhod dena.'),
    L('Chhota Chetan', 'Ek problem hai. Thaar mein ek Loud Boy baitha hai. Woh utarta nahi.'),
    L('Pappu', 'Kaunsa loud boy?'),
    L('Chhota Chetan', 'Har Thaar ke saath free aata hai, bhai. Warranty mein.'),
  ],
  loudBoy: [
    'BHAI! YEH MERI THAAR HAI! MATLAB ROCKY KI! MATLAB AB TERI?!',
    'Bhai music laga! Bass badha!',
    'Bhai, jaldi chala, reel banani hai!',
    d('Bhai bc, baraat peeche hai! Naach rahe hain! Daudte hue!', 'Bhai, baraat peeche hai! Naach rahe hain! Daudte hue!'),
    'Bhai, main utrunga nahi. Main Thaar ka hissa hoon.',
    'Bhai, sunroof khol. Nahi hai? Bana!',
    'Bhai tu cool hai. Rocky boring tha.',
    'Bhai, ek selfie. Chalti gaadi mein. Haan haan.',
  ],
  stolen: 'Thaar churaa li! Baraat naachte hue peeche aa rahi hai!',
  lose: 'Baraat se door bhaago (150 m) aur Kachra Ghat godown pahuncho.',
  outro: [
    L('Chhota Chetan', 'Waah Pappu bhai! Thaar mil gayi. Loud Boy bhi... free mein.'),
    L('Loud Boy', 'BHAI MAIN YAHIN RAHUNGA.'),
    L('Mummy (phone)', 'Beta, shaadi mein gaye the? Khana khaya? Aur yeh lo, meri belan. Ab tum bade ho gaye.'),
    L('Pappu', 'Mummy ki belan... Mumbhai, ab darr.'),
  ],
  mummyCall: 'Beta, shaadi mein ho? Paneer khaana, chicken mat khaana, kal tumhara pet kharab tha.',
};
