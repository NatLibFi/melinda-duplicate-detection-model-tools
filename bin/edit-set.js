/* eslint-disable no-console */
const fs = require('fs');
const _ = require('lodash');
const MarcRecord = require('marc-record-js');

const Utils = require('./utils');

const AVAILABLE_COMMANDS = ['remove', 'count', 'tostring', 'fromstring', 'labels', 'field', 'partition', 'halve'];

try {
  const { command, param } = readArguments(process.argv);

  run(command, param).catch(error => {
    console.error(error);
  });
  
} catch(error) {
  console.error(error.message);
  process.exit(1);
}

async function run(command, param) {

  const recordSetData = await readStdin();

  let recordSet;
  try {
    recordSet = JSON.parse(recordSetData);
  } catch(e) {
    recordSet = Utils.parseRecordSet(recordSetData);
  }

  const transformedSet = transformSet(recordSet, command, param);
  
  console.log(Utils.serializeRecordSet(transformedSet));
  
}

function transformSet(recordSet, command, param) {

  if (command === 'remove') {
    const pairs = param.map(parsePairArgument);
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

  if (command === 'tostring') {

    return recordSet.map(item => {
      
      const record1 = new MarcRecord(item.pair.record1).toString();
      const record2 = new MarcRecord(item.pair.record2).toString();

      return `LABEL: ${item.label}\n\n${record1}\n\n${record2}`;
    }).join('\n\n\n');
  }
  if (command === 'fromstring') {
    return Utils.readRecordSet(recordSet);
  }

  if (command === 'labels') {

    return recordSet.map(item => {
      
      const id1 = getRecordId(item.pair.record1);
      const id2 = getRecordId(item.pair.record2);

      return `${item.label}\t${id1}\t${id2}`;
    }).join('\n');
  }

  if (command === 'field') {
    
    const tag = _.head(param);
    const code = param[1];
    const selectValue = code ? _.flow(getField(tag), getSubfield(code)): getField(tag);
   
    
    recordSet.forEach(item => {
      
      const field1 = selectValue(item.pair.record1);
      const field2 = selectValue(item.pair.record2);

      const str1 = field1 ? fieldToString(field1) : '';
      const str2 = field2 ? fieldToString(field2) : '';
      
      console.log(`${item.label}\t${str1}\t--\t${str2}`);
    });
    process.exit(0);
  }

  if (command === 'partition') {

    shuffle(recordSet);

    const setSize = Math.floor(recordSet.length * 0.15);

    const crossValidationSet = recordSet.splice(0,setSize);
    const testSet = recordSet.splice(0,setSize);
    const trainingSet = recordSet;

    fs.writeFileSync('crossValidationSet.json', JSON.stringify(crossValidationSet));
    fs.writeFileSync('testSet.json', JSON.stringify(testSet));
    fs.writeFileSync('trainingSet.json', JSON.stringify(trainingSet));
    
    process.exit(0);
  }

  if (command === 'halve') {

    const half = Math.floor(recordSet.length * 0.5);
    return recordSet.splice(0, half);
  
  }

  throw new Error(`Command ${command} not implemented.`);
}

function pairToKey(pair) {
  const id1num = parseInt(pair[0]);
  const id2num = parseInt(pair[1]);

  return [id1num, id2num].sort().join('-');
}

function getRecordId(record) {
  const f001 = _.head(record.fields.filter(field => field.tag === '001'));
  return _.get(f001, 'value');
}
const getField = tag => record => _.head(record.fields.filter(field => field.tag === tag));

const getSubfield = code => field => {
  const filteredSubs = _.get(field, 'subfields', []).filter(sub => sub.code === code);
  return _.set(field, 'subfields', filteredSubs);
};

function readArguments(argv) {

  const command = argv[2];
  const param = process.argv.slice(3);

  if (!AVAILABLE_COMMANDS.includes(command)) {
    throw new Error(`Unknown command: ${command}`);
  }
  
  return { command, param };
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



function fieldToString(field) {
  if (field && field.subfields) {
    return dataFieldToString(field);
  } else {
    return controlfieldToString(field);
  }

  function dataFieldToString(field) {
    const ind1 = field.ind1 || ' ';
    const ind2 = field.ind2 || ' ';
    const subfields = field.subfields.map(subfield => `‡${subfield.code}${subfield.value}`).join('');
    return `${field.tag} ${ind1}${ind2} ${subfields}`;
  }

  function controlfieldToString(field) {
    return `${field.tag}    ${field.value}`;
  }
}

function shuffle(array) {
  let currentIndex = array.length, temporaryValue, randomIndex;

  while (0 !== currentIndex) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}