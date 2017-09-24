const _ = require('lodash');
const fs = require('fs');
const MarcRecord = require('marc-record-js');
const execSync = require('child_process').execSync;
const RecordUtils = require('melinda-deduplication-common/utils/record-utils');
const SimilarityUtils = require('melinda-deduplication-common/similarity/utils');
const debug = require('debug')('display-false-positives');

const skip = parseInt(process.argv[2] || 0);

const items = JSON.parse(fs.readFileSync('./tmp/falsePositives.json'));

items.slice(skip).forEach((item, i) => {
  const pair = item.pair;

  const record1 = MarcRecord.clone(pair.record1);
  const record2 = MarcRecord.clone(pair.record2);

  fs.writeFileSync('/tmp/rec1', record1.toString());
  fs.writeFileSync('/tmp/rec2', record2.toString());

  console.log(`Item ${i+1}/${items.length}`);
  console.log(readableMeta(item));
  execSync('/usr/bin/meld /tmp/rec1 /tmp/rec2');
});

function readableMeta(item) {
  const id1 = RecordUtils.selectRecordId(item.pair.record1);
  const id2 = RecordUtils.selectRecordId(item.pair.record2);

  const humanLabel = item.label === 'negative' ? 'NOT_DUPLICATE' : 'IS_DUPLICATE';
  const mlpLabel = item.synapticLabel;
 
  const features = item.featureVector;
  const featureList = Object.keys(features).map(key => `${key}: ${features[key]}`).map(str => '    ' + str).join('\n');

  const generatedfeatureVector = SimilarityUtils.pairToFeatureVector(item.pair);
  const generatedFeatureList = Object.keys(generatedfeatureVector).map(key => `${key}: ${generatedfeatureVector[key]}`).map(str => '    ' + str).join('\n');
  debug(generatedFeatureList);
  
  return `
  pair: ${id1}-${id2}
  humanLabel: ${humanLabel}
  computerLabel: ${mlpLabel}
  numericProbability: ${item.synapticProbability}
  features: 
${featureList}
  `;
}
