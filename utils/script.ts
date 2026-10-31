// MetroMatrix — Which way a piece of text reads.
// The app's copy is English, but some content is Urdu: what a cook says to
// the board, an Urdu dish description, a recipe asked for in Urdu. Text in
// Arabic script reads right to left; everything else left to right.

/** Arabic-script letters (Urdu uses the Arabic block and its extensions). */
const ARABIC_SCRIPT = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g;
const LETTERS = /[A-Za-z؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g;

/** True when most of the letters are Urdu script ("5 کلو ٹماٹر" is Urdu; "FC-NBNWXT" is not). */
export const isUrduScript = (text: string): boolean => {
  const arabic = text.match(ARABIC_SCRIPT)?.length ?? 0;
  const letters = text.match(LETTERS)?.length ?? 0;
  return arabic > 0 && arabic * 2 >= letters;
};

export type TextDirection = 'rtl' | 'ltr';

export const directionOf = (text: string): TextDirection => (isUrduScript(text) ? 'rtl' : 'ltr');
