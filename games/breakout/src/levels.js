// Hand-drawn themed levels for 打砖块 BREAKOUT.
// Each level is an array of 13-character rows ('.' = empty).
// Letters map to candy colors in config.js CANDY; 'S' = hard candy (2 hits).
// Difficulty ramps from simple rainbow rows to dense pictures with hard candies.

export const LEVELS = [
  {
    name: '彩虹糖',
    rows: [
      'RRRRRRRRRRRRR',
      'OOOOOOOOOOOOO',
      'YYYYYYYYYYYYY',
      'GGGGGGGGGGGGG',
      'BBBBBBBBBBBBB',
    ],
  },
  {
    name: '爱心',
    rows: [
      '..RR.....RR..',
      '.RRRRR.RRRRR.',
      'RRRRRRRRRRRRR',
      'RRRRRRRRRRRRR',
      '.RRRRRRRRRRR.',
      '..RRRRRRRRR..',
      '....RRRRR....',
      '......R......',
    ],
  },
  {
    name: '钻石',
    rows: [
      '......V......',
      '.....VVV.....',
      '....VVVVV....',
      '...VVVVVVV...',
      '..VVVVVVVVV..',
      '...VVVVVVV...',
      '....VVVVV....',
      '.....VVV.....',
      '......V......',
    ],
  },
  {
    name: '星星',
    rows: [
      '......Y......',
      '......Y......',
      '.YYYYYYYYYYY.',
      '..YYYYYYYYY..',
      '...YYYYYYY...',
      '..YYYYYYYYY..',
      '..YYY...YYY..',
      '.YY.......YY.',
    ],
  },
  {
    name: '笑脸',
    rows: [
      '...YYYYYYY...',
      '..YYYYYYYYY..',
      '.YYYYYYYYYYY.',
      '.YYBYYYYYBYY.',
      '.YYYYYYYYYYY.',
      '.YYRYYYYYRYY.',
      '..YYRRRRRYY..',
      '...YYYYYYY...',
    ],
  },
  {
    name: '小花',
    rows: [
      '....P...P....',
      '...PPP.PPP...',
      '...PPPPPPP...',
      '....PPPPP....',
      '......G......',
      '.....GGG.....',
      '......G......',
      '......G......',
    ],
  },
  {
    name: '小猫',
    rows: [
      '.OO.......OO.',
      '.OOOO...OOOO.',
      '..OOOOOOOOO..',
      '..OOGOOOGOO..',
      '..OOOORROOO..',
      '..OOOOOOOOO..',
      '...OOOOOOO...',
    ],
  },
  {
    name: '糖果格',
    rows: [
      'RYRYRYRYRYRYR',
      'GBGBGBGBGBGBG',
      'RYRYRYRYRYRYR',
      'GBGBGBGBGBGBG',
      'RYRYRYRYRYRYR',
      'GBGBGBGBGBGBG',
    ],
  },
  {
    name: '皇冠',
    rows: [
      'Y...Y...Y...Y',
      '.YYYYYYYYYYY.',
      '.YYYSYYYSYYY.',
      '.YYYYYYYYYYY.',
      '.YYYYYYYYYYY.',
    ],
  },
  {
    name: '糖果王国',
    rows: [
      'SVSVSVSVSVSVS',
      'VRYRYRYRYRYRV',
      'SYGBGBGBGBGYS',
      'VRYRYRYRYRYRV',
      'SVSVSVSVSVSVS',
    ],
  },
];
