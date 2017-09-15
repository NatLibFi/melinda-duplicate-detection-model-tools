
const utils = require('./utils');
const { nfc, upperCase, trim, collapse, toSpace, delChars, removeDiacritics } = utils;

const kept_subfields = ['a','b'];

const frequencies = {};

utils.readLinesFromStdin((line) => {
  const data = line.substr(18);
  const subfields = utils.tail(data.split('$$')).map(sub => ({
    code: sub.substr(0,1),
    value: sub.substr(1)
  }));

  const fieldValues = subfields
    .filter(sub => kept_subfields.includes(sub.code))
    .map(sub => sub.value)
    .join(' ');

  const words = normalize(fieldValues).split(' ');
  words.forEach(word => {
    if (!frequencies[word]) { 
      frequencies[word] = 0;
    }
    frequencies[word]++;
  });
}, () => {
  Object.keys(frequencies).forEach(key => {
    console.log(key, frequencies[key]);
  });
});

function normalize(str) {
  
  return [
    nfc,
    removeDiacritics,
    toSpace('-()[]!?<>*%½+¡'),
    delChars('\'/,.:\\"'),
    trim,
    collapse,
    upperCase
  ].reduce((str, fn) => fn(str), str);
}
