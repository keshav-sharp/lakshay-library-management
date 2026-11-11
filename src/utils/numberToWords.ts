/**
 * Converts a numerical amount in Indian Rupees (INR) to words.
 * Handles up to Crores, Lakhs, Thousands, Hundreds, and Tens.
 * Example: 1200 -> "One Thousand Two Hundred Rupees Only"
 */

const ONES = [
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

const TENS = [
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

const convertLessThanThousand = (num: number): string => {
  if (num === 0) return '';
  if (num < 20) return ONES[num];
  const tensVal = TENS[Math.floor(num / 10)];
  const onesVal = ONES[num % 10];
  return onesVal ? `${tensVal} ${onesVal}` : tensVal;
};

export const amountToWordsINR = (amount: number): string => {
  if (isNaN(amount) || amount === 0) {
    return 'Zero Rupees Only';
  }

  const rounded = Math.floor(Math.abs(amount));
  if (rounded === 0) {
    return 'Zero Rupees Only';
  }

  let crore = Math.floor(rounded / 10000000);
  let remainder = rounded % 10000000;
  let lakh = Math.floor(remainder / 100000);
  remainder = remainder % 100000;
  let thousand = Math.floor(remainder / 1000);
  remainder = remainder % 1000;
  let hundred = Math.floor(remainder / 100);
  let tens = remainder % 100;

  const parts: string[] = [];

  if (crore > 0) {
    parts.push(`${convertLessThanThousand(crore)} Crore`);
  }
  if (lakh > 0) {
    parts.push(`${convertLessThanThousand(lakh)} Lakh`);
  }
  if (thousand > 0) {
    parts.push(`${convertLessThanThousand(thousand)} Thousand`);
  }
  if (hundred > 0) {
    parts.push(`${ONES[hundred]} Hundred`);
  }
  if (tens > 0) {
    parts.push(convertLessThanThousand(tens));
  }

  const result = parts.join(' ').trim();
  return result ? `${result} Rupees Only` : 'Zero Rupees Only';
};
