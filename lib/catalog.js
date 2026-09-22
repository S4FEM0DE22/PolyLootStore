export const assets = [
  {
    "id": "blocky-characters",
    "title": "Blocky Characters",
    "subtitle": "Characters · Kenney CC0",
    "description": "แคแรกเตอร์บล็อก 18 โมเดล สำหรับเกมสไตล์ low poly",
    "price": 199,
    "author": "Kenney",
    "cover": "/assets/previews/blocky-characters.png",
    "file": "blocky-characters.zip",
    "active": true,
    "category": "Characters",
    "formats": [
      "OBJ",
      "FBX",
      "GLB"
    ],
    "engines": [
      "Unity",
      "Unreal",
      "Godot"
    ],
    "version": "2.0",
    "file_size_bytes": 2148510,
    "license": "CC0 1.0",
    "preview": "/assets/previews/blocky-characters.png",
    "source_url": "https://kenney.nl/assets/blocky-characters"
  },
  {
    "id": "modular-dungeon-kit",
    "title": "Modular Dungeon Kit",
    "subtitle": "Environments · Kenney CC0",
    "description": "ชิ้นส่วนดันเจียนแบบโมดูลาร์ 39 โมเดล สำหรับประกอบฉากและด่าน",
    "price": 149,
    "author": "Kenney",
    "cover": "/assets/previews/modular-dungeon-kit.png",
    "file": "modular-dungeon-kit.zip",
    "active": true,
    "category": "Environments",
    "formats": [
      "OBJ",
      "FBX",
      "GLB"
    ],
    "engines": [
      "Unity",
      "Unreal",
      "Godot"
    ],
    "version": "2.1",
    "file_size_bytes": 6886434,
    "license": "CC0 1.0",
    "preview": "/assets/previews/modular-dungeon-kit.png",
    "source_url": "https://kenney.nl/assets/modular-dungeon-kit"
  },
  {
    "id": "blaster-kit",
    "title": "Blaster Kit",
    "subtitle": "Weapons · Kenney CC0",
    "description": "ชุดอาวุธ blaster และอุปกรณ์ประกอบ 40 โมเดล",
    "price": 129,
    "author": "Kenney",
    "cover": "/assets/previews/blaster-kit.png",
    "file": "blaster-kit.zip",
    "active": true,
    "category": "Weapons",
    "formats": [
      "OBJ",
      "FBX",
      "GLB"
    ],
    "engines": [
      "Unity",
      "Unreal",
      "Godot"
    ],
    "version": "2.1",
    "file_size_bytes": 1724676,
    "license": "CC0 1.0",
    "preview": "/assets/previews/blaster-kit.png",
    "source_url": "https://kenney.nl/assets/blaster-kit"
  },
  {
    "id": "car-kit",
    "title": "Car Kit",
    "subtitle": "Vehicles · Kenney CC0",
    "description": "ชุดรถและอุปกรณ์ยานพาหนะ 50 โมเดล",
    "price": 179,
    "author": "Kenney",
    "cover": "/assets/previews/car-kit.png",
    "file": "car-kit.zip",
    "active": true,
    "category": "Vehicles",
    "formats": [
      "OBJ",
      "FBX",
      "GLB"
    ],
    "engines": [
      "Unity",
      "Unreal",
      "Godot"
    ],
    "version": "3.1",
    "file_size_bytes": 4814237,
    "license": "CC0 1.0",
    "preview": "/assets/previews/car-kit.png",
    "source_url": "https://kenney.nl/assets/car-kit"
  },
  {
    "id": "furniture-kit",
    "title": "Furniture Kit",
    "subtitle": "Props · Kenney CC0",
    "description": "ชุดเฟอร์นิเจอร์และของตกแต่งฉาก 140 โมเดล",
    "price": 99,
    "author": "Kenney",
    "cover": "/assets/previews/furniture-kit.png",
    "file": "furniture-kit.zip",
    "active": true,
    "category": "Props",
    "formats": [
      "OBJ",
      "FBX",
      "GLB",
      "DAE",
      "STL"
    ],
    "engines": [
      "Unity",
      "Unreal",
      "Godot"
    ],
    "version": "2.0",
    "file_size_bytes": 5130729,
    "license": "CC0 1.0",
    "preview": "/assets/previews/furniture-kit.png",
    "source_url": "https://kenney.nl/assets/furniture-kit"
  }
];
export function findAsset(id) { return assets.find(asset => asset.id === id); }
