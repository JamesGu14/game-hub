// data/chapterThemes.js — [背景spec §2/§4] 5 章地貌主题纯数据。
// 铁律:render-free、零随机、加载期无 Math.random/Date。painter 取色只准经 colors(+ground.js LANDMARK_COLORS)。
export const CHAPTER_THEMES = {
  1: {
    name: '翠野平原',
    grass: ['#4f7a39', '#568740'], jitter: ['#538040', '#4b7536', '#5c8f42'],
    road: { edge: '#5d4626', outer: '#7a5e34', inner: '#b58f54', worn: '#caa66c' },
    patches: ['meadow', 'flowerField', 'grove'],
    decors: ['tuft', 'flower', 'haystack', 'stone'],
    landmarks: ['beacon', 'tent'],
    accent: 'flowerTwinkle', accentPatch: 'flowerField', vignette: 'rgba(15,25,5,.24)', waterAffinity: [],
    colors: {
      meadow: '#44702f', meadowHi: '#538040',
      field: '#5a8a3e', fieldB: '#548339', petal: '#f6f2dc', flowerCore: '#f0c84e', stem: '#6fa04a',
      groveBase: '#3f6a2b', crownA: '#3a652c', crownB: '#477837', crownOutline: '#2a4f1f',
      crownHi: '#5a8f47', trunk: '#6b4e30', trunkOutline: '#4a3520',
      tuft: '#8fbf5e', haystack: '#c9a85c', haystackOutline: '#8f7338',
      stone: '#9a9484', stoneHi: '#b5b0a2', stoneOutline: '#6f6a5c',
    },
  },
  2: {
    name: '官渡河滩',
    grass: ['#6e7c42', '#74834a'], jitter: ['#73824a', '#67753c', '#7b8a52'],
    road: { edge: '#6b5436', outer: '#8a7348', inner: '#b59a64', worn: '#c9ad78' },
    patches: ['sandbar', 'reedCluster', 'dryField'],
    decors: ['stone', 'deadBranch', 'tuft'],
    landmarks: ['watchtower', 'stele'],
    accent: 'reedSway', accentPatch: 'reedCluster', vignette: 'rgba(25,22,8,.22)', waterAffinity: ['sandbar', 'reedCluster'],
    colors: {
      sandbar: '#a89263', sandbarHi: '#b5a071',
      reedBase: '#7d8a4f', reed: '#c9c27a', reedHead: '#b3a45f',
      dryField: '#8a7a4e', furrow: '#6e6038',
      stone: '#9a9484', stoneHi: '#b5b0a2', stoneOutline: '#6f6a5c',
      deadBranch: '#7a6648', tuft: '#a3b35e',
    },
  },
  3: {
    name: '江东水乡',
    grass: ['#41775f', '#488468'], jitter: ['#457e65', '#3c6f58', '#4d8a6f'],
    road: { edge: '#52521f', outer: '#6b6a34', inner: '#a8a154', worn: '#bdb56e' },
    patches: ['bamboo', 'paddy', 'wetland'],
    decors: ['lotus', 'bambooShoot', 'tuft'],
    landmarks: ['pavilion', 'raft'],
    accent: 'bambooSway', accentPatch: 'bamboo', vignette: 'rgba(8,25,18,.22)', waterAffinity: [],
    colors: {
      bambooBase: '#2f5d46', stalk: '#7fc06a',
      paddy: '#6a8f3c', waterLine: '#9ec7c0', sprout: '#cfe8a0',
      wetland: '#3a6653', wetDot: '#9ec7c0',
      lotus: '#4f8f5e', lotusOutline: '#36704a', shoot: '#8fc07a', tuft: '#6fae84',
    },
  },
  4: {
    name: '蜀道松山',
    grass: ['#45663c', '#4b6e41'], jitter: ['#4a6c40', '#406036', '#507546'],
    road: { edge: '#544938', outer: '#75674f', inner: '#a39379', worn: '#b5a78c' },
    patches: ['pineWood', 'rockSlope', 'meadow'],
    decors: ['lonePine', 'rock', 'fern'],
    landmarks: ['stoneTower', 'trestle'],
    accent: 'smokeRise', accentPatch: null, vignette: 'rgba(10,18,10,.26)', waterAffinity: [],
    colors: {
      pineWoodBase: '#2f4e30', pineA: '#1f3d24', pineB: '#24452a', pineOutline: '#3a6038',
      trunk: '#5a4632', trunkOutline: '#3d2f22',
      rockSlope: '#7e7668', rock: '#8d887c', rockOutline: '#5f5a4e',
      meadow: '#557a47', meadowHi: '#618853', fern: '#6f9a55', tuft: '#6f9a55',
    },
  },
  5: {
    name: '夷陵焦土',
    grass: ['#7a7444', '#817b4a'], jitter: ['#7f7948', '#736d3e', '#878150'],
    road: { edge: '#523e2e', outer: '#6e5440', inner: '#9b7d5c', worn: '#b39676' },
    patches: ['mapleWood', 'scorch', 'dryGrass'],
    decors: ['charStump', 'leaf', 'tuft'],
    landmarks: ['brokenFlag', 'burntCamp'],
    accent: 'leafDrift', accentPatch: null, vignette: 'rgba(25,12,5,.26)', waterAffinity: [],
    colors: {
      mapleBase: '#6e4630', crownA: '#a85a38', crownB: '#c06a40', crownC: '#8a4530', crownOutline: '#7a3f28',
      scorch: '#4a4038', ash: '#6e645a', dryGrass: '#98905c', dryGrassHi: '#a59c66',
      charStump: '#3f352c', leaf: '#c06a40', tuft: '#a39a60',
    },
  },
};

// 取章主题(越界/缺参回退章1;render 层唯一入口)
export function themeOf(chapter) {
  return CHAPTER_THEMES[chapter] || CHAPTER_THEMES[1];
}
