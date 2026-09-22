import { extraProductDetails } from './product-gallery-extra.js';
// These product photos are extracted from the original Kenney ZIP packages in fixtures/.
// Counts are unique model names, verified against one 3D format in each ZIP.
const sprite = (id, name, label) => ({ src: `/assets/gallery/${id}/${name}.png`, label });
const image = (id, name, label) => ({ kind: 'image', src: `/assets/gallery/${id}/${name}.png`, label });
const sheet = (label, items) => ({ kind: 'sheet', label, items });

export const productDetails = {
  ...extraProductDetails,
  'blocky-characters': {
    count: 18, noun: 'ตัวละคร', highlights: ['ตัวละครทรงบล็อกหลายสีและหลายสไตล์', 'เหมาะกับต้นแบบเกมแนวผจญภัยและ low poly', 'มีภาพพรีวิวแยกสำหรับเลือกโมเดล'],
    slides: [
      sheet('ตัวละครตัวอย่าง ชุดที่ 1', ['character-a','character-c','character-f','character-h','character-k','character-r'].map(name => sprite('blocky-characters', name, name))),
      sheet('ตัวละครตัวอย่าง ชุดที่ 2', ['character-b','character-d','character-g','character-j','character-n','character-p'].map(name => sprite('blocky-characters', name, name)))
    ]
  },
  'modular-dungeon-kit': {
    count: 39, noun: 'ชิ้นส่วน', highlights: ['ห้อง ทางเดิน ประตู และบันไดสำหรับประกอบฉาก', 'ชิ้นส่วนแบบโมดูลาร์ช่วยต่อพื้นที่ในเกม', 'มีตัวอย่างฉากและภาพโมเดลแต่ละชิ้น'],
    slides: [
      image('modular-dungeon-kit', 'Preview (Variation A)', 'ตัวอย่างฉากดันเจียน แบบ A'),
      image('modular-dungeon-kit', 'Preview (Variation B)', 'ตัวอย่างฉากดันเจียน แบบ B'),
      image('modular-dungeon-kit', 'Sample', 'ฉากตัวอย่างที่ประกอบจากชุดโมเดล'),
      sheet('ตัวอย่างชิ้นส่วนดันเจียน', ['corridor','corridor-corner','gate','room-large','stairs','room-small'].map(name => sprite('modular-dungeon-kit', name, name)))
    ]
  },
  'blaster-kit': {
    count: 40, noun: 'โมเดล', highlights: ['ปืน Blaster หลายรูปทรง พร้อมชิ้นส่วนประกอบ', 'มีอุปกรณ์ เช่น กล้องเล็งและระเบิด', 'เหมาะกับเกมไซไฟหรือฉากต้นแบบ'],
    slides: [
      image('blaster-kit', 'Preview (Variation A)', 'ภาพรวม Blaster Kit อีกมุมหนึ่ง'),
      sheet('ตัวอย่างอาวุธและอุปกรณ์', ['blaster-a','blaster-c','blaster-g','blaster-j','grenade-a','scope-large-a'].map(name => sprite('blaster-kit', name, name)))
    ]
  },
  'car-kit': {
    count: 50, noun: 'โมเดล', highlights: ['รถหลายประเภทสำหรับฉากเมืองและเกมแข่งรถ', 'มีรถฉุกเฉิน รถแข่ง และรถใช้งานทั่วไป', 'มีอุปกรณ์ประกอบฉากในชุดเดียวกัน'],
    slides: [
      sheet('รถตัวอย่าง ชุดที่ 1', ['ambulance','firetruck','hatchback-sports','police','race-future','suv'].map(name => sprite('car-kit', name, name))),
      sheet('รถและอุปกรณ์ ชุดที่ 2', ['delivery','garbage-truck','race','sedan','kart-oobi','cone'].map(name => sprite('car-kit', name, name)))
    ]
  },
  'furniture-kit': {
    count: 140, noun: 'โมเดล', highlights: ['เฟอร์นิเจอร์สำหรับห้องนอน ห้องน้ำ และพื้นที่ทั่วไป', 'มีภาพ Isometric หลายทิศทางสำหรับดูรูปทรง', 'เหมาะกับการตกแต่งฉากภายในเกม'],
    slides: [
      image('furniture-kit', 'Sample', 'ตัวอย่างการจัดวาง Furniture Kit'),
      sheet('ตัวอย่างเฟอร์นิเจอร์', ['bedDouble_NE','chairModernCushion_NE','tableCoffee_NE','bathroomSink_NE','chairRounded_NE','tableRound_NE'].map(name => sprite('furniture-kit', name, name)))
    ]
  }
};
