import type { Line } from './lines';

const d = (dirty: string, clean: string): Line => ({ dirty, clean });

export const WASTED_TITLE = 'KHATAM. TATA. BYE BYE.';
export const BUSTED_TITLE = 'CHALLAN KAT GAYA';

export const WASTED_SUBS: readonly Line[] = [
  'Mummy ne haldi-doodh pila ke zinda kar diya. Hospital bill: ₹500.',
  'Doctor ne bola "kuch nahi hua". ₹500 phir bhi liye.',
  'Chai ki pyaali khaali. Phir se bharo.',
  d('Bc, phir se Pandey Niwas pe uthe. Kismat!', 'Phir se Pandey Niwas pe uthe. Kismat!'),
  'Yamraj bhi traffic mein phas gaye, isliye bach gaye.',
];

export const BUSTED_SUBS: readonly Line[] = [
  'Fine bharo, form bharo, aur "chai-paani" bhi.',
  'Hawaldar ne photo li, phir fine liya, phir selfie li.',
  'Thane mein 4 ghante, 7 forms, 1 stamp.',
  d('Saala challan bhi EMI pe milta toh!', 'Kaash challan bhi EMI pe milta!'),
  'Jail nahi, bas "samjhauta". ₹ zyada lagta hai.',
];

export const BRIBE_OFFER: readonly Line[] = [
  'Chai-paani ka kuch?',
  'Arre bhai, aise kaise chalega? Kuch "settlement" karo.',
  'Seedha bolo, kitna doge?',
  'Saheb ka mood kharab hai, kuch mithai bhej do.',
  'Challan banaun ya chai pilaoge?',
];

export const BRIBE_ACCEPT: readonly Line[] = [
  'Theek hai, jao. Aur dobara mat dikhna.',
  'Hum ne kuch nahi dekha. Tum ne kuch nahi diya.',
  'Chai ke saath samosa bhi aa jaayega isme. Jao!',
  'Imaandari ka zamana nahi raha. Jao.',
  d('Chal bhaag bc, kisi ko mat batana.', 'Chal bhaag, kisi ko mat batana.'),
];

export const BRIBE_REFUSE: readonly Line[] = [
  'Ab bahut der ho gayi. TV pe aa gaye ho!',
  'Itne mein toh chai bhi nahi aati!',
  'Upar tak baat pahunch gayi hai, ab nahi hoga.',
  'Pehle paise toh kamao, phir bribe dena.',
];

export const COP_CHASE: readonly Line[] = [
  'Ruk ja! Ruk ja Pappu!',
  'Thaam lo! Pakdo!',
  d('Abey ruk mc, lathi padegi!', 'Abey ruk, lathi padegi!'),
  'Licence dikhao! Registration dikhao! Moonchh dikhao!',
  'Sab ko control room pe bulao!',
  'Bhaag ke kahan jaayega? Mumbhai chhota hai!',
  'Aaj toh promotion pakka!',
  'Main 12 saal se is beat pe hoon, sab gali jaanta hoon!',
  d('Saala, mera lunch break kharab kar diya!', 'Mera lunch break kharab kar diya!'),
  'Wireless pe bolo: auto wala bhaag raha hai!',
];

export const NEWS_ANCHOR: readonly Line[] = [
  'BREAKING NEWS! AUTO WALA BHAAG RAHA HAI! KYA YEH DESH KA SABSE BADA KHATRA HAI?!',
  'HUMARE CAMERA MEIN LIVE! MOONCHH WALA AADMI! KAUN HAI YEH?!',
  'SAWAAL TOH BANTA HAI! METER TEZ KYUN CHALTA HAI?!',
  'HUMNE SABSE PEHLE DIKHAYA! EXCLUSIVE! SIRF HUMARE CHANNEL PE!',
  'NATION WANTS TO KNOW! PAPPU NE KHANA KHAYA YA NAHI?!',
  'DEBATE MEIN AAJ 12 EXPERTS! SAB EK SAATH CHILLAAYENGE!',
  'AAP DEKH RAHE HAIN CHEEKH TV! VOLUME KAM MAT KARIYE!',
  'KYA YEH AUTO VIDESHI SAAZISH HAI?! HUM POOCHHENGE!',
  'HUMARE REPORTER KO DHAKKA LAGA! YEH LOKTANTRA PE HAMLA HAI!',
  'BREAK KE BAAD: GAAY KA BAYAAN! MOOOO!',
];

export const MUMMY_CALL: readonly Line[] = [
  'Beta, khana khaya? TV pe tumhe dekha. Dhoop mein kyun ghoom rahe ho?',
  'Pappu! Yeh police tumhare peeche kyun hai? Kuch khaaya bhi hai ya nahi?',
  'Beta, helmet pehna hai? Aur woh drone ko hello bol do, sab dekh rahe hain.',
  'Sharma aunty bol rahi thi tum news pe ho. Kurta achha pehna tha na?',
  'Ghar aate waqt dhaniya le aana. Aur police se bach ke.',
  'Pappu, EMI wale ka phone aaya tha. Aur ab police ka. Kya chal raha hai?',
];

export const RESPRAY_LINES: readonly Line[] = [
  'Naya colour, nayi pehchaan. Police bhi confused!',
  'Denting-painting complete. Gaadi ka naam bhi badal dein?',
  'Itna shiny ho gaya, police salute karegi.',
];

export const NETA_LINES: readonly Line[] = [
  'Netaji ne ek phone kiya. Sab "settle" ho gaya.',
  'Tumhari file kho gayi. Hamesha ke liye. Vote dena!',
  'Netaji bole: "Apna aadmi hai". Case khatam.',
];

export const HIDE_LINES: readonly Line[] = [
  'Baraat mein ghus gaye. Ab sirf naachna hai.',
  'Traffic jam mein police bhi phas gayi.',
];

export const SLAP_LINES: readonly Line[] = [
  'TIGHT SLAP!',
  'DHISHOOM!',
  'THAPPAD KI GOONJ!',
  'EK CHAANTA, SAU GAANE!',
  'YEH HAATH NAHI, HATHODA HAI!',
];

export const WEAPON_NAMES: Record<string, string> = {
  fists: 'Haath (Tight Slap: hold)',
  chappal: 'Boomerang Chappal',
  bat: 'Cricket Bat',
  slingshot: 'Gulel (Slingshot)',
  belan: 'Mummy ki Belan',
};
