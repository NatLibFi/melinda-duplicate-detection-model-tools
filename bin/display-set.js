const _ = require('lodash');
const fs = require('fs');
const MarcRecord = require('marc-record-js');
const execSync = require('child_process').execSync;
const RecordUtils = require('melinda-deduplication-common/utils/record-utils');
const LocalUtils = require('./utils');
const synaptic = require('synaptic');
const Network = synaptic.Network;
const SimilarityUtils = require('melinda-deduplication-common/similarity/utils');

const exported = JSON.parse(fs.readFileSync('/tmp/duplicate-perceptron.json', 'utf8'));
console.log('loaded /tmp/duplicate-perceptron.json');
var importedNetwork = Network.fromJSON(exported);

const recordSetFile = process.argv[2] || 'pumped-duplicates.txt';

console.log(`Displaying candidates from ${recordSetFile}`);

const items = LocalUtils.readRecordSet(recordSetFile);


items.forEach((item, i) => {
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

  const featureVector = SimilarityUtils.pairToFeatureVector(item.pair);
  const input = SimilarityUtils.featureVectorToInputVector(featureVector);
  const synapticProbability = importedNetwork.activate(input)[0];
  
  const mlpLabel = synapticProbability < 0.5 ? 'NOT_DUPLICATE' : 'IS_DUPLICATE';
 
  const features = featureVector;
  const featureList = Object.keys(features).map(key => `${key}: ${features[key]}`).map(str => '    ' + str).join('\n');
    
  return `
  pair: ${id1}-${id2}
  humanLabel: ${humanLabel}
  computerLabel: ${mlpLabel}
  numericProbability: ${synapticProbability}
  features: 
${featureList}
  `;
}
