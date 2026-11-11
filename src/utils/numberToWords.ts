/**
 * Converts a numerical amount in Indian Rupees (INR) to words following
 * standard Indian financial and banking standards.
 * 
 * Features:
 * - Proper Indian numbering: Crores, Lakhs, Thousands, Hundreds, Tens, and Units.
 * - Accurate Rupees and Paise calculation.
 * - Strict monetary validation: rejects negative numbers, NaN, and Infinity.
 * - Consistent two-decimal rounding (paise).
 * - Exact test case conformity:
 *   ₹0.00         -> "Zero Rupees Only"
 *   ₹1.00         -> "One Rupee Only"
 *   ₹10.50        -> "Ten Rupees and Fifty Paise Only"
 *   ₹999.99       -> "Nine Hundred Ninety Nine Rupees and Ninety Nine Paise Only"
 *   ₹1,000.00     -> "One Thousand Rupees Only"
 *   ₹1,23,456.78  -> "One Lakh Twenty Three Thousand Four Hundred Fifty Six Rupees and Seventy Eight Paise Only"
 *   ₹1,00,00,000  -> "One Crore Rupees Only"
 */

const ONES: string[] = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS: string[] = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];

const convertChunkLessThanThousand = (num: number): string => {
  let str = '';
  if (num >= 100) {
    str += `${ONES[Math.floor(num / 100)]} Hundred `;
    num %= 100;
  }
  if (num >= 20) {
    str += `${TENS[Math.floor(num / 10)]} `;
    num %= 10;
  }
  if (num > 0) {
    str += `${ONES[num]} `;
  }
  return str.trim();
};

export const amountToWordsINR = (amount: number): string => {
  // Strict numeric validation
  if (
    typeof amount !== 'number' ||
    Number.isNaN(amount) ||
    !Number.isFinite(amount) ||
    amount < 0
  ) {
    return 'Invalid Amount';
  }

  // Integer paise conversion to prevent floating point inaccuracies
  const totalPaise = Math.round(amount * 100);
  const rupees = Math.floor(totalPaise / 100);
  const paise = totalPaise % 100;

  if (rupees === 0 && paise === 0) {
    return 'Zero Rupees Only';
  }

  let words = '';
  let rem = rupees;

  const crore = Math.floor(rem / 10000000);
  rem %= 10000000;
  const lakh = Math.floor(rem / 100000);
  rem %= 100000;
  const thousand = Math.floor(rem / 1000);
  rem %= 1000;
  const hundredAndTens = rem;

  if (crore > 0) {
    words += `${convertChunkLessThanThousand(crore)} Crore `;
  }
  if (lakh > 0) {
    words += `${convertChunkLessThanThousand(lakh)} Lakh `;
  }
  if (thousand > 0) {
    words += `${convertChunkLessThanThousand(thousand)} Thousand `;
  }
  if (hundredAndTens > 0) {
    words += `${convertChunkLessThanThousand(hundredAndTens)} `;
  }

  words = words.trim();
  let rupeePart = '';
  if (rupees > 0) {
    rupeePart = `${words} ${rupees === 1 ? 'Rupee' : 'Rupees'}`;
  }

  let paisePart = '';
  if (paise > 0) {
    const paiseWords = convertChunkLessThanThousand(paise);
    paisePart = `${paiseWords} ${paise === 1 ? 'Paisa' : 'Paise'}`;
  }

  if (rupeePart && paisePart) {
    return `${rupeePart} and ${paisePart} Only`;
  } else if (rupeePart) {
    return `${rupeePart} Only`;
  } else if (paisePart) {
    return `${paisePart} Only`;
  }

  return 'Zero Rupees Only';
};
