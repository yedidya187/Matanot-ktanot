// Built-in defaults for each branch settings. The live values are the Firestore
// documents branches/<id>. This file is loaded on demand only: by the admin
// button that creates those documents, and as a fallback when a document is
// missing or unreadable - normal visitors never download it.
const DONATION_URL = 'https://links.payboxapp.com/9iwLc0XEV1b';

export const BRANCH_SEED = {
  'mitzpe': {
    address: 'רחוב המוריה 21 מצפה יריחו (ביחידת דיור מעל משפחת סידס, נכנסים ועולים במדרגות שבגינה)',
    wazeAddress: 'המוריה 21 מצפה יריחו',
    pickupNote: 'בתוך ארון במרפסת שלנו',
    phone: '0534303104',
    whatsapp: '972534303104',
    donationUrl: DONATION_URL
  },
  'eilat': {
    address: 'קידר 7 אילת (משפחת קאפח)',
    wazeAddress: 'קידר 7 אילת',
    pickupNote: 'בתוך ארון בגינה שלנו',
    phone: '0587006633',
    whatsapp: '972587006633',
    donationUrl: DONATION_URL
  },
  'hafetz-haim': {
    address: 'הנחלים 9 חפץ חיים (משפחת שרעבי)',
    wazeAddress: 'הנחלים 9 חפץ חיים',
    pickupNote: 'בתוך ארון בגינה שלנו',
    phone: '0544773388',
    whatsapp: '972544773388',
    donationUrl: DONATION_URL
  }
};
