function check(buf, offset = 0) {
  let type = buf[offset];
  let cursor = offset + 1;
  while (cursor < buf.length) {
    switch (type) {
        case 0x07:
            return false;
        case 0x00:
        case 0x01:
            cursor += 1;
            break;
        case 0x02:
            cursor += 8;
            break;
        case 0x03:
        case 0x04:
            const length = buf.readUInt32BE(cursor);
            cursor += 4;
            cursor += length;
            break;
        case 0x05:
        case 0x06:
            cursor += 4;
            break;
        default:
            break;
    }
    type = buf[cursor];
    cursor += 1
  }
  return true
}

function deserializeValue(buf, offset = 0) {
  const type = buf[offset];
  let cursor = offset + 1;

  switch (type) {
    case 0x00: return [null, cursor];
    case 0x01: return [!!buf[cursor++], cursor];
    case 0x02: return [buf.readDoubleBE(cursor), cursor + 8];
    case 0x03: {
      const len = buf.readUInt32BE(cursor);
      cursor += 4;
      const str = buf.slice(cursor, cursor + len).toString('utf8');
      return [str, cursor + len];
    }
    case 0x04: {
      const len = buf.readUInt32BE(cursor);
      cursor += 4;
      return [buf.slice(cursor, cursor + len), cursor + len];
    }
    case 0x05: {
      const len = buf.readUInt32BE(cursor);
      cursor += 4;
      const arr = [];
      for (let i = 0; i < len; i++) {
        const [val, nextCursor] = deserializeValue(buf, cursor);
        arr.push(val);
        cursor = nextCursor|0;
      }
      return [arr, cursor];
    }
    case 0x06: {
      const count = buf.readUInt32BE(cursor);
      cursor += 4;
      const obj = {};
      for (let i = 0; i < count; i++) {
        const [key, next1] = deserializeValue(buf, cursor);
        const [val, next2] = deserializeValue(buf, next1);
        obj[key] = val;
        cursor = next2;
      }
      return [obj, cursor];
    }
    case 0x07: {
      const len = buf.readUInt32BE(cursor);
      cursor += 4;
      const varName = buf.slice(cursor, cursor + len).toString('utf8');
      const variable = global[varName];
      return [variable, cursor + len];
    }
    default:
      throw new Error('Unknown type tag: ' + type);
  }
}

function deserialize(buf) {
  const [val, _] = deserializeValue(buf);
  return val;
}

module.exports = {
    deserialize,
    check
}



