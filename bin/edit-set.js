/* eslint-disable no-console */

const _ = require('lodash');

const AVAILABLE_COMMANDS = ['remove', 'count'];

try {
  const { command, pairs } = readArguments(process.argv);

  run(command, pairs).catch(error => {
    console.error(error);
  });
  
} catch(error) {
  console.error(error.message);
  process.exit(1);
}

async function run(command, pairs) {

  const recordSetData = await readStdin();

  const recordSet = JSON.parse(recordSetData);

  const transformedSet = transformSet(recordSet, command, pairs);
  
  console.log(JSON.stringify(transformedSet));

}

function transformSet(recordSet, command, pairs) {

  if (command === 'remove') {
    const pairKeys = pairs.map(pairToKey);
    console.error(pairKeys);
    return recordSet.filter(item => {
      const id1 = getRecordId(item.pair.record1);
      const id2 = getRecordId(item.pair.record2);

      const key = pairToKey([id1, id2]);

      return !pairKeys.includes(key);
    });
  }
  if (command === 'count') {
    console.log(recordSet.length);
    process.exit(0);
  }
  throw new Error(`Command ${command} not implemented.`);
}

function pairToKey(pair) {
  const id1num = parseInt(pair[0]);
  const id2num = parseInt(pair[1]);

  return [id1num, id2num].sort().join('-');
}

function isSame(pair1, pair2) {
  if (pair1[0] === pair2[0] && pair1[1] === pair2[1]) {
    return true;
  }
  if (pair1[0] === pair2[1] && pair1[1] === pair2[0]) {
    return true;
  }
  return false;
}

function getRecordId(record) {
  const f001 = _.head(record.fields.filter(field => field.tag === '001'));
  return _.get(f001, 'value');
}

function readArguments(argv) {

  const command = argv[2];
  const pairs = process.argv.slice(3).map(parsePairArgument);
  
  if (!AVAILABLE_COMMANDS.includes(command)) {
    throw new Error(`Unknown command: ${command}`);
  }
  
  return { command, pairs };
}

function parsePairArgument(pairString) {
  if (!pairString.includes('-')) {
    throw new Error(`Invalid pair: ${pairString}`);
  }
  const pair = pairString.split('-');

  pair.forEach(id => {
    if (isNaN(id)) {
      throw new Error(`Invalid id: ${id}`);
    }
  });
  return pair;
}

async function readStdin() {
  return new Promise(resolve => {

    let data = '';

    process.stdin.setEncoding('utf8');

    process.stdin.on('readable', () => {
      const chunk = process.stdin.read();
      if (chunk !== null) {
        data = data + chunk;
      }
    });

    process.stdin.on('end', () => {
      resolve(data);
    });
  });
}