/* eslint-disable no-console */

const _ = require('lodash');
const MarcRecord = require('marc-record-js');

const AVAILABLE_COMMANDS = ['remove', 'count', 'tostring', 'fromstring', 'labels'];

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


  let recordSet;
  try {
    recordSet = JSON.parse(recordSetData);
  } catch(e) {
    recordSet = recordSetData;
  }

  const transformedSet = transformSet(recordSet, command, pairs);
  if (_.isObject(transformedSet)) {
    console.log(JSON.stringify(transformedSet));
  } else {
    console.log(transformedSet);
  }
  
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
    return recordSet.length;
  }

  if (command === 'tostring') {

    return recordSet.map(item => {
      
      const record1 = new MarcRecord(item.pair.record1).toString();
      const record2 = new MarcRecord(item.pair.record2).toString();

      return `LABEL: ${item.label}\n\n${record1}\n\n${record2}`;
    }).join('\n\n\n');
  }
  if (command === 'fromstring') {
    return recordSet.split('\n\n\n').map(itemStr => {
      const [labelLine, record1Str, record2Str] = itemStr.split('\n\n');
      const label = labelLine.substr(7);
      const record1 = MarcRecord.fromString(record1Str.trim());
      const record2 = MarcRecord.fromString(record2Str.trim());
      return {
        label,
        pair: { record1, record2 }
      };
    });
  }

  if (command === 'labels') {

    return recordSet.map(item => {
      
      const id1 = getRecordId(item.pair.record1);
      const id2 = getRecordId(item.pair.record2);

      return `${item.label}\t${id1}\t${id2}`;
    }).join('\n');
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