
const utils = require('./utils');

utils.readLinesFromStdin((line) => {
  const [word, frequency] = line.split(' ');
  if (word === undefined || frequency === undefined) {
    return;
  }
  if (word.length === 0) {
    return;
  }
  
  if (frequency < 400) {
    return;
  }
  console.log(frequency, word);
});