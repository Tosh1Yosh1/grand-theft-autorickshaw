import type { Line } from './lines';
import type { DialogueLine } from './missions';

const d = (dirty: string, clean: string): Line => ({ dirty, clean });
const L = (who: string, line: Line): DialogueLine => ({ who, line });

// ---------- Mission 4: Form No. 47-B ----------
export const M4 = {
  title: 'Form No. 47-B',
  tagline: 'Ek stamp chahiye. Uske liye paanch aur stamp chahiye.',
  intro: [
    L('Babu (Window 3)', 'Agla! ... Haan, kya chahiye?'),
    L('Pappu', 'Auto ka permit renew karna hai. Form 47-B.'),
    L('Babu (Window 3)', 'Form 47-B pe stamp lagega. Par pehle paanch stamp aur chahiye.'),
    L('Pappu', 'Paanch?'),
    L('Babu (Window 3)', 'Ration office, Bijli board, Police NOC, Notary uncle, aur Peon ka signature. Peon lunch pe hai.'),
    L('Babu (Window 3)', 'Office 5 baje band. Aaj nahi hua toh agle janam mein aana. Agla!'),
  ],
  stops: [
    { key: 'ration', name: 'Ration Office', who: 'Ration Clerk', lines: ['Address proof? Bijli ka bill? Bijli ka bill ke liye ration card? Theek hai, theek hai, stamp lo.'] },
    { key: 'bijli', name: 'Bijli Board', who: 'Bijli Babu', lines: ['Aapka meter fast chalta hai? Humara bhi. Chai-paani ₹100, stamp free.'] },
    { key: 'police', name: 'Police NOC', who: 'Hawaldar Tukaram', lines: ['NOC chahiye? Tumhare naam pe 3 challan hain. Mazak tha. Ya nahi. Stamp lo, jao.'] },
    { key: 'notary', name: 'Notary Uncle', who: 'Notary Uncle', lines: ['Photocopy laaye ho? Nahi? Main bhi nahi karta. Chalo, haath se likh deta hoon. Stamp!'] },
    { key: 'peon', name: 'Peon (lunch pe)', who: 'Peon Ramu', lines: ['Lunch 1 se 2. Phir 2 se 2:30 digestion. Abhi 2:10 hai. Ruko... chalo theek hai, ₹50.'] },
  ],
  bribe: 'Chai-paani diya: ',
  peonWait: 'Peon lunch pe hai. Ruko ya ₹50 do (F).',
  outro: [
    L('Babu (Window 3)', 'Paanch stamp. Achha. Ab mera stamp... ek minute.'),
    L('Babu (Window 3)', 'Arre, yeh toh purana form hai. Naya form 47-B(ii) aaya hai kal se.'),
    L('Pappu', 'BHAI SAHAB.'),
    L('Babu (Window 3)', d('Mazak kar raha tha. Stamp laga diya. Bc, aapka chehra dekhne laayak tha.', 'Mazak kar raha tha. Stamp laga diya. Aapka chehra dekhne laayak tha.')),
    L('Pappu', 'Sarkari kaam: jeet ke bhi haar jaisa lagta hai.'),
  ],
  closed: 'Office band ho gaya. 5 baj gaye. Kal aana. Ya parso. Ya kabhi nahi.',
};

// ---------- Mission 5: Item Number ----------
export const M5 = {
  title: 'Item Number',
  tagline: 'Junior artiste ko bachao. Director ka "CUT!" sab ko rok deta hai.',
  intro: [
    L('Pinky (phone)', 'Pappu bhaiya! Main Pinky, junior artiste. Studio 7 pe producer ke bouncers ne pakad rakha hai. Contract 18 ghante ka hai!'),
    L('Pappu', 'Arre, main aa raha hoon.'),
    L('Pinky (phone)', 'Dhyaan se. Director Bhansode jab "CUT!" bolta hai, sab ruk jaate hain. Jo hila, woh pakda gaya.'),
    L('Pappu', 'Matlab "ACTION" pe chalo, "CUT" pe statue. Bachpan ka khel hai.'),
  ],
  action: ['ACTION!', 'ROLLING! ACTION!', 'ENERGY! ACTION!'],
  cut: ['CUT! CUT! CUT!', 'CUT! Sab freeze!', 'CUT! Kisi ne frame kharab kiya!'],
  spotted: ['Kaun hila?! Bouncers, pakdo usko!', 'Frame mein moonchh wala kaun hai?!', 'Retake! Aur usko bahar nikaalo!'],
  reached: [L('Pinky', 'Bhaiya! Aap aa gaye! Chalo, mera ghar Sarkari Colony mein hai.'), L('Pappu', 'Auto bahar hai. Retake nahi hoga.')],
  chase: ['Bouncers peeche hain!', 'Bhaiya, unke paas Thaar hai!', 'Director ne bola "chase scene, take one"!'],
  outro: [L('Pinky', 'Thank you bhaiya! Aap hero ho. Main aapko next film mein role dilaungi. Background mein. Blur.'), L('Pappu', 'Blur hi sahi. Shuruaat hai.')],
};

// ---------- Mission 6: Kachra Ghat Showdown ----------
export const M6 = {
  title: 'Kachra Ghat Showdown',
  tagline: 'Don Babloo Botalwala. Aur uska 3 minute ka monologue.',
  intro: [L('Chhota Chetan', 'Pappu bhai, Babloo Botalwala ko pata chal gaya. Thaar uski thi. Woh godown pe bula raha hai. Akele.'), L('Pappu', 'Akele? Mummy ki belan ke saath.')],
  monologue: [
    L('Babloo Botalwala', 'Aao Pappu, aao. Baitho. Nahi, khade raho. Villain ke saamne koi baithta nahi.'),
    L('Babloo Botalwala', 'Jaante ho main kaun hoon? Main woh hoon jisne Kachra Ghat ko Kachra Ghat banaya.'),
    L('Babloo Botalwala', 'Bachpan mein main bhi tumhari tarah tha. Garib. Masoom. Moonchh nahi thi, par sapne the.'),
    L('Babloo Botalwala', 'Ek din maine ek botal dekhi. Khaali botal. Aur maine socha... isme kya bharoon?'),
    L('Babloo Botalwala', 'Paani? Nahi. Hawa? Nahi. Maine bhara... SAPNA. Aur becha ₹20 mein.'),
    L('Babloo Botalwala', 'Aaj Mumbhai ki har botal pe mera naam hai. BOTALWALA. 100% botal, paani optional.'),
    L('Babloo Botalwala', 'Tumne meri Thaar churaai. Thaar sirf gaadi nahi thi. Woh mera... emotion thi.'),
    L('Babloo Botalwala', 'Aur us Thaar ka Loud Boy... woh mera bhatija hai. Tumne parivaar tod diya.'),
    L('Babloo Botalwala', 'Jab main chhota tha, mere baap ne kaha tha: "Babloo, duniya mein do tarah ke log hain..."'),
    L('Babloo Botalwala', '"...ek jo botal bharte hain, aur ek jo botal khareedte hain." Main pehla tha. Tum doosre ho.'),
    L('Babloo Botalwala', 'Tumhe pata hai yeh godown kyun hai? Kyunki "warehouse" bolne mein bahut English lagti hai.'),
    L('Babloo Botalwala', 'Maine 1997 mein pehli gaadi kharidi. Maruti. Usme bhi AC nahi tha. Tab se main garam hoon.'),
    L('Babloo Botalwala', 'Log kehte hain Babloo villain hai. Main kehta hoon, Babloo... entrepreneur hai. Startup Bro se bada.'),
    L('Babloo Botalwala', 'Tumhari mummy ne kabhi tumhe belan se maara? Mujhe meri mummy ne maara tha. Isliye main aisa hoon.'),
    L('Babloo Botalwala', 'Aaj yahan, is container yard mein, jahan suraj bhi permission lekar aata hai...'),
    L('Babloo Botalwala', '...hum faisla karenge. Kaun asli bhai hai. Kaun asli bhaukaal hai.'),
    L('Babloo Botalwala', 'Mere aadmi tayyar hain. Mera dil tayyar hai. Meri botal... hamesha tayyar hai.'),
    L('Babloo Botalwala', 'Aakhri baat. Jab tum haaroge, toh yaad rakhna: tum Babloo se nahi, ek idea se haare.'),
    L('Babloo Botalwala', 'Ab... (dramatic pause)... (aur lamba pause)... (background music)...'),
    L('Babloo Botalwala', 'MAARO ISKO!'),
  ],
  skipped: [L('Babloo Botalwala', d('MONOLOGUE SKIP KIYA?! Bc, maine 3 hafte practice kiya tha! AB TOH TU GAYA!', 'MONOLOGUE SKIP KIYA?! Maine 3 hafte practice kiya tha! AB TOH TU GAYA!'))],
  fight: ['Botal lo!', 'Ek aur botal! Khaali hai, par dil se phenki hai!', 'Tujhe pata hai yeh botal kitne ki hai?! ₹20!', 'Mere aadmi kahan hain?!'],
  outro: [
    L('Babloo Botalwala', d('Bc... belan... mummy... mujhe yaad aa gaya...', 'Belan... mummy... mujhe yaad aa gaya...')),
    L('Hawaldar Tukaram', 'Haath upar! Babloo Botalwala, tum arrest ho! Credit: Hawaldar Tukaram.'),
    L('Pappu', 'Credit tum le lo. Cash mujhe do.'),
    L('Mummy (phone)', 'Beta, TV pe tum aaye! Khana khaya? Aur ab tum Mumbhai ke bade bhai ho. Rajma bana hai.'),
  ],
};

// ---------- Side hustles ----------
export const RATINGS: { stars: number; text: string }[] = [
  { stars: 5, text: 'Driver ki moonchh 10/10' },
  { stars: 5, text: 'Radio pe Astro Aunty chal rahi thi, life badal gayi' },
  { stars: 4, text: 'Achha tha, par gaddhe mein meri chai gir gayi' },
  { stars: 3, text: 'Driver ne EMI ki kahani sunayi. Roya bhi.' },
  { stars: 2, text: 'Meter tez lag raha tha. Ya main slow tha.' },
  { stars: 1, text: 'Auto mein AC nahi tha. Auto mein AC nahi hota? Toh?' },
  { stars: 1, text: 'Driver ne gaay ke liye break maara, mujhe chot lagi' },
  { stars: 5, text: 'Free mein life advice mili' },
];

export const FARE_LINES = {
  hail: ['Bhaiya! Auto! Chaloge?', 'Bhaiya, meter se chaloge ya "kitna doge"?', 'Auto! Auto! Haan tum, moonchh wale!'],
  board: ['Station ke paas jaana hai. Haan, woh wala nahi, doosra wala.', 'Jaldi chalo, meeting hai. Zoom pe. Auto se join karunga.', 'Bhaiya, AC chala do. Nahi hai? Theek hai, khidki khol do. Nahi hai? Theek hai.'],
  tampered: ['Bhaiya, meter bahut tez chal raha hai... complaint karungi!', 'Yeh meter hai ya rocket?'],
};

export const GODMAN = {
  title: 'Pappu Baba ka Darbar',
  tagline: 'Fake baba ban ke chanda jama karo. Pakde gaye toh mob.',
  intro: [
    L('Pappu', 'Aaj se main Pappu Baba. Chamatkar ka rate fixed hai. EMI bhi bharni hai.'),
    L('Pappu', 'Baba ka asli chamatkar: logon ko yakeen dilana ki mujhe kuch pata hai.'),
  ],
  devotee: ['Baba, mera startup chalega?', 'Baba, meri saas kab sudhregi?', 'Baba, mera auto ka permit?', 'Baba, mera crush mujhe seen pe chhodta hai.', 'Baba, mera WhatsApp forward viral hoga?'],
  blessing: ['Chalega. Agle mahine. Shayad. ₹500 dakshina.', 'Haan beta, sab theek hoga. EMI maaf (terms apply).', 'Teri problem Mercury hai. Mercury ka ilaaj ₹200.', 'Aankh band karo... kholo... ₹100.'],
  busted: 'Arre! Yeh toh auto wala Pappu hai! Nakli baba! PAKDO!',
};

export const RACE = {
  title: 'Flyover Race',
  tagline: 'Adhoore flyover pe race. Finish line ke baad bhi race chalti hai (neeche).',
  intro: [L('Racer Rocket Raju', 'Flyover pe race. Upar jao, end se kooddo, aur finish line pe pahuncho. Haarne wala chai pilayega.')],
  win: 'Jeet gaye! Rocket Raju ab tumhe chai pilayega. Aur ₹3000.',
  lose: 'Haar gaye. Chai tum pilaoge. Aur izzat bhi gayi.',
};

export const DELIVERY = {
  title: 'Amazin Pandey Delivery',
  tagline: 'Garam khana, thanda customer, 2 minute.',
  intro: [L('Amazin Pandey App', 'Naya order! Biryani. Customer ne likha "jaldi aao, warna 1 star". Timer shuru.')],
  done: ['Customer: "Thanda kyun hai?" Tip: ₹0. Rating: 4 star. Samjho.', 'Customer: "Waah, garam!" Tip: ₹50!', 'Customer ne "neeche aa jao" bola tha. Aap upar gaye. Phir bhi tip mila.'],
};
