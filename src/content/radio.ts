import type { Line } from './lines';

const d = (dirty: string, clean: string): Line => ({ dirty, clean });

export type MusicStyle = 'filmy' | 'stadium' | 'drone' | 'sitarish' | 'lofi' | 'jingle';

export interface Station {
  id: string;
  name: string;
  freq: string;
  color: string;
  style: MusicStyle;
  /** Shown as "Now playing" (original parody songs). */
  songs?: { title: string; artist: string; lyrics: Line[] }[];
  /** Host banter, read out between songs. */
  host: string;
  lines: Line[];
}

export const STATIONS: Station[] = [
  {
    id: 'bhaukaal',
    name: 'Bhaukaal FM',
    freq: '98.3',
    color: '#ff9f1c',
    style: 'filmy',
    host: 'RJ Chulbuli',
    songs: [
      {
        title: 'Mera Auto, Meri Marzi',
        artist: 'Bhaukaal Boys',
        lyrics: ['Meter mera down hai, mood mera up!', 'Gaddhe mein bhi naachun, signal pe bhi jump!', 'Mera auto, meri marzi, teri gaadi, teri arzi!', 'Horn OK Please, aur dil bhi OK please!'],
      },
      {
        title: 'EMI Waali Raat',
        artist: 'Sad Sonu',
        lyrics: ['Paanch tareekh aayi, dil mera ghabraya', 'Bank ne message bheja, maine phone chhupaya', 'EMI waali raat hai, neend nahi aati', 'Sapne mein bhi recovery agent ki baarat aati'],
      },
      {
        title: 'Thaar Pe Baitha Loud Boy',
        artist: 'DJ Bass Badha',
        lyrics: ['Bass badha, bass badha, sunroof khol!', 'Thaar pe baitha loud boy, bole bina mol', 'Reel banegi, views aayenge, mummy ko mat bol', 'Bass badha, bass badha, life hai golmol!'],
      },
      {
        title: 'Chai Mein Doobi Shaam',
        artist: 'Mausami Sur',
        lyrics: ['Cutting chai, cutting dil, aadhi aadhi baat', 'Tapri pe mili thi tum, baarish wali raat', 'Udhaar mein chai pi, udhaar mein pyaar', 'Dono ka hisaab baaki, dono pe interest char'],
      },
    ],
    lines: [
      'Good evening Mumbhaiiii! Aap sun rahe hain Bhaukaal FM, 98.3, jahan gaane kam aur dedication zyada!',
      'Aaj ka dedication: Pinky ne Bunty ko bheja hai, saath mein message: "EMI time pe bharo, phir baat karenge."',
      'Agla gaana un sab ke liye jo traffic mein phase hain. Yaani poore Mumbhai ke liye.',
      'Caller number 1, aap live hain! ... Hello? ... Arre, yeh toh auto mein baithe baithe so gaye.',
      d('Kya bolte Mumbhai! Garmi itni ki bc pothole bhi pighal raha hai!', 'Kya bolte Mumbhai! Garmi itni ki pothole bhi pighal raha hai!'),
      'Ek dedication Pappu bhai ke liye, sender hai "Mummy". Message: "Khana khaya?"',
      'Traffic update: Jugaadpur mein gaay, Startup Nagar mein startup, Filmistan mein shooting. Matlab sab normal.',
    ],
  },
  {
    id: 'cricket',
    name: 'Cricket Kranti',
    freq: '104.0',
    color: '#06d6a0',
    style: 'stadium',
    host: 'Commentator Bolte-Raho Bhatia',
    lines: [
      'Aur yeh match chal raha hai... teesre din se... over number 412... aur ab bhi koi nahi jaanta kaun jeet raha hai!',
      'Bowler daudta hua aaya... aaya... aaya... ruka... chai peene chala gaya!',
      'Yeh SIX! Ball stadium ke bahar, Jugaadpur mein kisi ki windshield pe! Sorry uncle!',
      'Rain break. Phir lunch break. Phir strategic break. Phir chai break. Cricket bhi ek break hai.',
      'Third umpire ne review kiya... phir review ka review... phir unka net pack khatam ho gaya.',
      'Aur yeh match 2027 tak chalega, sponsor: Instant Loan, interest: yes!',
      'Captain ne toss jeeta, aur khushi mein toss phir se karwaya.',
      d('Kya shot hai! Bc, mera chai gir gaya excitement mein!', 'Kya shot hai! Mera chai gir gaya excitement mein!'),
      'Fielder ne catch pakda... aur selfie le li. Batsman abhi bhi run le raha hai.',
      'Score update: bahut zyada runs, kaafi wickets, aur ek gaay jo pitch pe baithi hai.',
    ],
  },
  {
    id: 'astro',
    name: 'Astro Aunty Live',
    freq: '91.1',
    color: '#9d4edd',
    style: 'drone',
    host: 'Astro Aunty',
    lines: [
      'Namaste beta. Aapki samasya kya hai? EMI? Mercury retrograde hai. Sab Mercury ki galti.',
      'Caller ka sawaal: "Aunty, auto baar baar band hota hai." Jawab: saas ka asar hai beta. Saas ko chai pilao.',
      'Mesh raashi: aaj paisa aayega. Phir jaayega. Phir EMI aayegi.',
      'Kark raashi: aaj traffic mein phasoge. Upaay: ghar se mat niklo. Ya nikal ke phas jao, kismet hai.',
      'Beta, aapki kundli mein "pothole yog" hai. Shocker badalwa lo.',
      'Sab samasya ki jad do cheezein hain: Mercury, aur aapki saas. Kabhi kabhi dono ek saath.',
      'Aaj ka lucky colour: wahi jo aapke auto ka hai. Lucky number: aapka challan number.',
      'Caller: "Aunty, shaadi kab hogi?" Aunty: "Jab Mercury aur aunty dono maanenge."',
    ],
  },
  {
    id: 'uncle',
    name: 'Uncle Gyaan Radio',
    freq: '88.8',
    color: '#ffd60a',
    style: 'sitarish',
    host: 'Gyaan Uncle',
    lines: [
      'Doston, aaj ka gyaan: moon pe bhi potholes hain. Wahi contractor hai. Socho.',
      'Kya aap jaante hain? Flyover isliye adhoora hai kyunki uspe aliens ka signal tower lagega.',
      'Forward aaya hai: haldi + Wi-Fi = immunity. Maine khud try kiya. Net slow ho gaya, immunity badh gayi.',
      'Pigeons sarkari jasoos hain. Isliye har sarkari building pe baithte hain.',
      'Aaj ki breaking: kal suraj 2 baar ugega. Agar nahi uga, toh woh bhi saazish hai.',
      'Startup wale hoodie kyun pehente hain? Socho. Main batata hoon: AC ka bill bachane ke liye. Ya kuch aur. Socho.',
      'Mere 47 WhatsApp groups mein se 46 kehte hain yeh sach hai. 47th group mein sirf main hoon.',
      'Doston, signal red isliye hota hai taaki hum ruk ke WhatsApp padh sakein. System samjho.',
    ],
  },
  {
    id: 'startup',
    name: 'Startup Sutra Podcast',
    freq: '107.7',
    color: '#4cc9f0',
    style: 'lofi',
    host: 'Kabir & Vihaan',
    lines: [
      'Kabir: Welcome back to Startup Sutra. Vihaan: Bro. Kabir: Bro. Both: Disrupt.',
      'Vihaan: Today we discuss how to disrupt sleep. Kabir: Bro, I have not slept since Series A.',
      'Kabir: Our new app tells you when to drink water. Vihaan: Revolutionary. Kabir: It costs ₹999 a month.',
      'Vihaan: Bro, what is profit? Kabir: An outdated metric, bro. Like sleep. Or rent.',
      'Kabir: Hustle tip: put "visionary" in your bio. Vihaan: Done. Kabir: Now you are a visionary.',
      'Vihaan: We are disrupting autos. Kabir: How? Vihaan: An app that calls an auto. Kabir: Like... a phone call? Vihaan: But with a logo.',
      'Kabir: This episode is sponsored by our own startup. Vihaan: Which one? Kabir: The one that is still alive.',
      'Vihaan: Bro, synergy. Kabir: Synergy, bro. Vihaan: Okay that was the episode.',
    ],
  },
];

/** Ads that play between segments on every station. */
export const ADS: readonly Line[] = [
  'FAIR & HAPPY cream! Gora nahi karegi, par khush zaroor karegi. Side effects: confidence.',
  'INSTANT LOAN! 2 minute mein approval! Interest? Yes! Kitna? Haan! Call now: 1800-PAISA-WAPAS.',
  'IIT COACHING for your unborn child! Garbh se hi JEE ki taiyaari. Batch full, waiting list mein kundli bhejo.',
  'AMAZIN PANDEY DELIVERY! Same day delivery! Kaunsa day, yeh hum bhi nahi jaante!',
  'BOTALWALA WATER! 100% botal! Paani optional! Botalwala: pyaas ka business.',
  'SHAADI.COMPROMISE.COM! Mummy ne pasand kiya hai. Aap bas haan bolo.',
  'DENTING-PAINTING by Raju! Naya colour, nayi pehchaan. Police bhi pehchaan nahi paayegi! (Legal disclaimer: mazak tha.)',
  'Netaji ke liye vote do! Gaddha-mukt Mumbhai! Terms and conditions mein gaddhe included hain.',
];
