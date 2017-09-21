const fs = require('fs');
const Utils = require('melinda-deduplication-common/similarity/utils');
const items = JSON.parse(fs.readFileSync('/tmp/guesses.json'));

const filename = 'falsePositives.json';

const falsePositives = items.filter(item => item.type === Utils.Types.FALSE_POSITIVE);
console.log(falsePositives.length);

fs.writeFileSync(filename, JSON.stringify(falsePositives));
console.log(`Wrote ${filename}`);

