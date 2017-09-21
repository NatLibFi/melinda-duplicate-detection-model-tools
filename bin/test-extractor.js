const MarcRecord = require('marc-record-js');
const readline = require('readline');
const _ = require('lodash');

const title = require('./melinda-deduplication-common/similarity/feature-extractors/feature-title');

const createExtractor = title;

const rl = readline.createInterface({
  input: process.stdin
});

let lineNumber = 0;
rl.on('line', function (line) {
  const [label, r1, r2] = line.split('\t');
  const record1 = MarcRecord.fromString(r1);
  const record2 = MarcRecord.fromString(r2);
  
  const norm = (str) => str && str.replace(/\W/g, '').replace(/\s+/g, '').toUpperCase();
  const same = norm(r1) === norm(r2);

  const extractor = createExtractor(toWeirdFormat(record1), toWeirdFormat(record2));
  const result = extractor.check();

  const labelValue = label === 'positive' ? 1 : 0;

  lineNumber++;
  if (result === 0.3 && !same) {
    console.log(`${lineNumber}\t${labelValue}\t${result}\t${r1}\t${r2}`);
  }
});


function toWeirdFormat(record) {

  return {
    controlfield: record.getControlfields().map(convertControlField),
    datafield: record.getDatafields().map(convertDataField),
  };

  function convertControlField(field) {
    return {
      $: {
        tag: field.tag
      },
      _: field.value
    };
  }
  function convertDataField(field) {
    return {
      $: {
        tag: field.tag,
        ind1: field.ind1,
        ind2: field.ind2,
      },
      subfield: field.subfields.map(convertSubfield)
    };

    function convertSubfield(subfield) {
      return {
        $: {
          code: subfield.code
        },
        _: subfield.value
      };
    }
  }
}

function stringToField(fieldStr) {
  const tag = fieldStr.substr(0,3);
  if (parseInt(tag) < 10) {
    const value = fieldStr.substr(7);
    return { tag, value };
  }
  const ind1 = fieldStr.substr(4,1);
  const ind2 = fieldStr.substr(5,1);
  const subfieldsStr = fieldStr.substr(6);
  
  const subfields = _.tail(subfieldsStr.split('‡')).map(subfieldStr => ({
    code: subfieldStr.substr(0,1),
    value: subfieldStr.substr(1)
  }));

  return { tag, ind1, ind2, subfields };
}