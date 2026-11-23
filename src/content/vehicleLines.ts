import type { Line } from './lines';

export const POTHOLE_LINES: readonly Line[] = [
  { dirty: 'Arre bc, yeh road hai ya chand ki satah?', clean: 'Arre yaar, yeh road hai ya chand ki satah?' },
  'Municipal wale, tumhara swimming pool mil gaya!',
  { dirty: 'Gaddha! Saala har saal naya budget, wahi gaddha.', clean: 'Gaddha! Har saal naya budget, wahi gaddha.' },
  'Meri kamar! Mera suspension! Meri EMI!',
  'Yeh pothole nahi, heritage site hai.',
  { dirty: 'Kis chutiye ne road banaya?', clean: 'Kis genius ne road banaya?' },
  'Auto ka shocker gaya, ab mera bhi jaayega.',
  'Gaddhe mein gaadi, gaadi mein gaddha.',
  'Smart City ka Smart Gaddha.',
  { dirty: 'Abe gadhe, dekh ke! Oh wait, main hi chala raha hoon.', clean: 'Arre dekh ke! Oh wait, main hi chala raha hoon.' },
];

export const EXIT_MOVING_LINES: readonly Line[] = [
  'Chalti gaadi se kudega? Pagal hai kya?',
  'Pehle brake, phir bhaukaal.',
  { dirty: 'Ruk ja ullu ke patthe, gaadi toh rok!', clean: 'Ruk ja bhai, gaadi toh rok!' },
];

export const TAMPER_LINES: readonly Line[] = [
  'Meter ab 3x speed pe. Bhagwan maaf kare.',
  'Fast meter on. Aaj Startup Bro ka bill pakka.',
  { dirty: 'Meter tez. Imaandari gayi tel lene, bc.', clean: 'Meter tez. Imaandari gayi tel lene.' },
];

export const UNTAMPER_LINES: readonly Line[] = ['Meter normal. Aaj imaandari ka din hai.', 'Theek hai theek hai, honest meter.'];

export const CRASH_LINES: readonly Line[] = [
  { dirty: 'Bc! Mera auto!', clean: 'Arre! Mera auto!' },
  'EMI abhi baaki hai mere dost!',
  'Insurance expire ho gaya tha kya?',
  { dirty: 'Saala, denting-painting ka kharcha!', clean: 'Uff, denting-painting ka kharcha!' },
  'Yeh dent bhi EMI pe jayega.',
];

export const WRECKED_LINES: readonly Line[] = ['Auto ki aatma nikal gayi.', 'Engine ne bola: "Bas Pappu, ab nahi".'];
