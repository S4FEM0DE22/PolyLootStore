// In-browser ZIP inspection & image extractor using standard Web APIs
// Zero-dependency, uses DecompressionStream('deflate-raw')

const MODEL_EXTS = new Set(['.obj', '.fbx', '.gltf', '.glb', '.blend', '.dae', '.stl']);
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

function getMimeType(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  return 'application/octet-stream';
}

function cleanTitleFromFilename(filename) {
  const name = filename.replace(/\.[^/.]+$/, ''); // Remove extension
  return name
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
    .trim();
}

async function decompressSlice(compressedBytes, method, mimeType) {
  if (method === 0) {
    return new Blob([compressedBytes], { type: mimeType });
  }
  if (method === 8 && typeof DecompressionStream !== 'undefined') {
    try {
      const ds = new DecompressionStream('deflate-raw');
      const writer = ds.writable.getWriter();
      writer.write(compressedBytes);
      writer.close();
      const decompressedBuffer = await new Response(ds.readable).arrayBuffer();
      return new Blob([decompressedBuffer], { type: mimeType });
    } catch {
      return null;
    }
  }
  return null;
}

export async function inspectZipFile(file) {
  const ext = ('.' + (file.name.split('.').pop() || '')).toLowerCase();
  const baseTitle = cleanTitleFromFilename(file.name);

  if (ext !== '.zip') {
    const is3D = MODEL_EXTS.has(ext);
    return {
      isZip: false,
      name: file.name,
      size: file.size,
      totalFiles: 1,
      uncompressedBytes: file.size,
      modelCount: is3D ? 1 : 0,
      formatsDetected: is3D ? [ext.replace('.', '').toUpperCase()] : [],
      images: [],
      suggestedTitle: baseTitle
    };
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const dataView = new DataView(arrayBuffer);
    const byteLength = arrayBuffer.byteLength;

    // Locate End of Central Directory (EOCD) signature: 0x06054b50 (PK\x05\x06)
    // Scan backwards within the last 65557 bytes
    let eocdOffset = -1;
    const searchLimit = Math.max(0, byteLength - 65557);
    for (let i = byteLength - 22; i >= searchLimit; i--) {
      if (dataView.getUint32(i, true) === 0x06054b50) {
        eocdOffset = i;
        break;
      }
    }

    if (eocdOffset === -1) {
      return {
        isZip: false,
        name: file.name,
        size: file.size,
        totalFiles: 1,
        uncompressedBytes: file.size,
        modelCount: 0,
        formatsDetected: [],
        images: [],
        suggestedTitle: baseTitle
      };
    }

    const totalEntries = dataView.getUint16(eocdOffset + 10, true);
    const cdOffset = dataView.getUint32(eocdOffset + 16, true);

    const decoder = new TextDecoder('utf-8');
    let offset = cdOffset;

    const detectedFormats = new Set();
    const imageEntries = [];
    let modelCount = 0;
    let uncompressedTotal = 0;
    let validFileCount = 0;

    for (let i = 0; i < totalEntries && offset + 46 <= byteLength; i++) {
      if (dataView.getUint32(offset, true) !== 0x02014b50) break;

      const method = dataView.getUint16(offset + 10, true);
      const compSize = dataView.getUint32(offset + 20, true);
      const uncompSize = dataView.getUint32(offset + 24, true);
      const fnLen = dataView.getUint16(offset + 28, true);
      const extraLen = dataView.getUint16(offset + 30, true);
      const commentLen = dataView.getUint16(offset + 32, true);
      const localOffset = dataView.getUint32(offset + 42, true);

      const filenameBytes = new Uint8Array(arrayBuffer, offset + 46, fnLen);
      const filename = decoder.decode(filenameBytes);

      // Skip directory entries
      if (!filename.endsWith('/')) {
        validFileCount++;
        uncompressedTotal += uncompSize;

        const fileExt = ('.' + (filename.split('.').pop() || '')).toLowerCase();
        if (MODEL_EXTS.has(fileExt)) {
          modelCount++;
          detectedFormats.add(fileExt.replace('.', '').toUpperCase());
        } else if (IMAGE_EXTS.has(fileExt) && !filename.startsWith('__MACOSX')) {
          // Limit to max 12 images to avoid excessive memory usage
          if (imageEntries.length < 12 && compSize > 0 && uncompSize < 15728640) {
            imageEntries.push({
              filename,
              method,
              compSize,
              uncompSize,
              localOffset
            });
          }
        }
      }

      offset += 46 + fnLen + extraLen + commentLen;
    }

    // Sort image entries so that previews or covers appear first
    imageEntries.sort((a, b) => {
      const aLower = a.filename.toLowerCase();
      const bLower = b.filename.toLowerCase();
      const aScore = (aLower.includes('preview') ? 10 : 0) + (aLower.includes('cover') ? 8 : 0) + (aLower.includes('render') ? 5 : 0);
      const bScore = (bLower.includes('preview') ? 10 : 0) + (bLower.includes('cover') ? 8 : 0) + (bLower.includes('render') ? 5 : 0);
      return bScore - aScore;
    });

    // Extract image blobs
    const extractedImages = [];
    for (const item of imageEntries) {
      if (item.localOffset + 30 > byteLength) continue;
      const locFnLen = dataView.getUint16(item.localOffset + 26, true);
      const locExtraLen = dataView.getUint16(item.localOffset + 28, true);
      const dataStart = item.localOffset + 30 + locFnLen + locExtraLen;

      if (dataStart + item.compSize > byteLength) continue;

      const compressedSlice = new Uint8Array(arrayBuffer, dataStart, item.compSize);
      const mime = getMimeType(item.filename);
      const blob = await decompressSlice(compressedSlice, item.method, mime);

      if (blob && blob.size > 0) {
        const objectUrl = URL.createObjectURL(blob);
        const displayName = item.filename.split('/').pop() || item.filename;
        extractedImages.push({
          filename: item.filename,
          displayName,
          blob,
          objectUrl,
          size: blob.size
        });
      }
    }

    return {
      isZip: true,
      name: file.name,
      size: file.size,
      totalFiles: validFileCount,
      uncompressedBytes: uncompressedTotal,
      modelCount,
      formatsDetected: Array.from(detectedFormats),
      images: extractedImages,
      suggestedTitle: baseTitle
    };
  } catch (err) {
    console.warn('Failed to inspect zip file:', err);
    return {
      isZip: true,
      name: file.name,
      size: file.size,
      totalFiles: 1,
      uncompressedBytes: file.size,
      modelCount: 0,
      formatsDetected: [],
      images: [],
      suggestedTitle: baseTitle
    };
  }
}
