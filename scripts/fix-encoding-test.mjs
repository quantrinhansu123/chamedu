const corrupted = 'Ä\x90iá»ƒm danh vá»›i 5 tráº¡ng thÃ¡i';

function fix1(t) {
  try {
    return decodeURIComponent(escape(t));
  } catch {
    return null;
  }
}

function fix2(t) {
  return Buffer.from(t, 'latin1').toString('utf8');
}

const line = ' * Äiá»ƒm danh vá»›i 5 tráº¡ng thÃ¡i: ÄÐúng giá»\x9d, Trá»… giá»\x9d, Váº¯ng, Báº£o lÆ°u, ÄÐã bá»"i';
console.log('original:', line);
console.log('fix1:', fix1(line));
console.log('fix2:', fix2(line));
