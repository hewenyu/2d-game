// 生物群系 = 一套调色板 + 背景母题。颜色字符串 'r,g,b' 用于拼接透明度。
export type BiomeId = 'crypt' | 'abyss';

export interface Biome {
  id: BiomeId;
  sky: [string, string];
  haze: string;      // 'r,g,b'
  far: string;
  mid: string;
  near: string;
  rock: string;
  rockTex: string;
  rim: string;
  rimHi: string;
  moss: string;
  plat: string;
  platHi: string;
  light: string;     // 'r,g,b' 光束/尘埃
  window: string;    // 'r,g,b' 远景窗光
  fog: string;       // 'r,g,b'
  grade: string;     // 最终叠色 'r,g,b'
}

// 沉钟寺：墨色与旧木，灯火是暖橙；渊：铜绿与青苔，灯火是冷的。
export const BIOMES: Record<BiomeId, Biome> = {
  crypt: {
    id: 'crypt',
    sky: ['#080605', '#1c150f'],
    haze: '52,38,26',
    far: '#211913',
    mid: '#15100c',
    near: '#0b0807',
    rock: '#070605',
    rockTex: 'rgba(120,92,60,0.10)',
    rim: '#3a2c20',
    rimHi: 'rgba(240,196,130,0.5)',
    moss: 'rgba(150,120,70,0.6)',
    plat: '#3a1f16',
    platHi: 'rgba(230,150,90,0.55)',
    light: '230,170,110',
    window: '255,170,90',
    fog: '140,104,70',
    grade: '46,28,14',
  },
  abyss: {
    id: 'abyss',
    sky: ['#040907', '#11241f'],
    haze: '30,62,52',
    far: '#152d27',
    mid: '#0d1d18',
    near: '#06100d',
    rock: '#040807',
    rockTex: 'rgba(90,140,110,0.10)',
    rim: '#2a4237',
    rimHi: 'rgba(170,220,180,0.5)',
    moss: 'rgba(110,170,120,0.7)',
    plat: '#3a2c1a',
    platHi: 'rgba(210,170,100,0.5)',
    light: '180,240,210',
    window: '150,230,190',
    fog: '80,140,120',
    grade: '12,40,32',
  },
};
