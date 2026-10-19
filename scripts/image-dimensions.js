// Reads intrinsic width/height from the header bytes of a PNG, JPEG, WebP,
// GIF or SVG image. Returns { width, height } or null when the format isn't
// recognised. Only the first few KB are needed for every raster format, which
// is what lets scripts/image-sizes.js read remote images with a Range request.
function getImageDimensions(buf) {
    if (!buf || buf.length < 24) return null;

    // PNG: IHDR chunk follows the 8-byte signature.
    if (buf.readUInt32BE(0) === 0x89504e47) {
        return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }

    // GIF
    if (buf.toString('ascii', 0, 3) === 'GIF') {
        return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
    }

    // WebP: RIFF container with a VP8 / VP8L / VP8X first chunk.
    if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
        const chunk = buf.toString('ascii', 12, 16);
        if (chunk === 'VP8X') {
            return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
        }
        if (chunk === 'VP8 ') {
            return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
        }
        if (chunk === 'VP8L') {
            const bits = buf.readUInt32LE(21);
            return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
        }
        return null;
    }

    // JPEG: walk the markers until a start-of-frame (SOFn) segment.
    if (buf[0] === 0xff && buf[1] === 0xd8) {
        let offset = 2;
        while (offset + 9 < buf.length) {
            if (buf[offset] !== 0xff) return null;
            const marker = buf[offset + 1];
            const length = buf.readUInt16BE(offset + 2);
            const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
            if (isSof) {
                return { width: buf.readUInt16BE(offset + 7), height: buf.readUInt16BE(offset + 5) };
            }
            offset += 2 + length;
        }
        return null;
    }

    // SVG: width/height attributes, falling back to the viewBox.
    const text = buf.toString('utf-8', 0, Math.min(buf.length, 4096));
    const svgTag = text.match(/<svg\b[^>]*>/i);
    if (svgTag) {
        const attr = name => {
            const m = svgTag[0].match(new RegExp(`\\s${name}="([\\d.]+)(px)?"`));
            return m ? Math.round(parseFloat(m[1])) : null;
        };
        const width = attr('width');
        const height = attr('height');
        if (width && height) return { width, height };
        const viewBox = svgTag[0].match(/viewBox="[\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)[\s,]+([\d.]+)"/);
        if (viewBox) return { width: Math.round(parseFloat(viewBox[1])), height: Math.round(parseFloat(viewBox[2])) };
    }

    return null;
}

module.exports = { getImageDimensions };
