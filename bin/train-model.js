/* eslint-disable no-console */

const fs = require('fs');
const synaptic = require('synaptic');

const _ = require('lodash');

const SimilarityUtils = require('melinda-deduplication-common/similarity/utils');

const featuresFromCompositeExtractors = 8; // Extractor F008
const INPUTS = SimilarityUtils.DefaultStrategy.length + featuresFromCompositeExtractors;
const OUTPUTS = 1;
const LAYER_1 = Math.round(Math.sqrt((OUTPUTS+2)*INPUTS)) + Math.round(2 * Math.sqrt(INPUTS/(OUTPUTS+2)));
const LAYER_2 = OUTPUTS * Math.round(Math.sqrt(INPUTS/(OUTPUTS+2)));

const architecture = [INPUTS, INPUTS/4*3, INPUTS/4*2, INPUTS/4*1, OUTPUTS].map(Math.round);
console.log('Architecture: ' , architecture);
const model = new synaptic.Architect.Perceptron(...architecture);

const trainer = new synaptic.Trainer(model);
const opts = {
  rate: [0.03, 0.01, 0.005, 0.001, 0.0005],
  iterations: 9000,
  error: .01,
  shuffle: true,
  log: 10,
  cost: synaptic.Trainer.cost.MSE
};

const isParsedAlready = fs.existsSync('/tmp/parsed-training-data.json');
let trainingSet;

if (!isParsedAlready) {
  console.log('Parsing data-sets/trainingSet.json');
  const trainingSetData = JSON.parse(fs.readFileSync('data-sets/trainingSet.json', 'utf8'));
  const len = trainingSetData.length;
  trainingSet = _.flatMap(trainingSetData, (item, i) => {
    if (i%10 === 0) {
      console.log(`${i}/${len}`);
    }
    
    const { featureVector, input, output } = createVectors(item.label, item.pair);

    // set record1 as both sides of the check
    const identityItem = createVectors('positive', {record1: item.pair.record1, record2: item.pair.record1}); 

    return [
      { input, output, _featureVector: featureVector, pair: item.pair },
      { 
        input: identityItem.input,
        output: identityItem.output,
        _featureVector: identityItem.featureVector,
        pair: {record1: item.pair.record1, record2: item.pair.record1}
      }
    ];
  });
  fs.writeFileSync('/tmp/parsed-training-data.json', JSON.stringify(trainingSet), 'utf8');
  console.log('Wrote /tmp/parsed-training-data.json');
} else {
  trainingSet = JSON.parse(fs.readFileSync('/tmp/parsed-training-data.json', 'utf8'));
  console.log('Loaded /tmp/parsed-training-data.json');
}

const filteredTrainingSet = trainingSet.filter(item => {
  return item.input.every(val => val !== -1);
});

const result = trainer.train(filteredTrainingSet, opts);
console.log(result);

const exported = model.toJSON();
fs.writeFileSync('/tmp/duplicate-perceptron.json', JSON.stringify(exported), 'utf8');
console.log('wrote /tmp/duplicate-perceptron.json');


function createVectors(label, pair) {

  const featureVector = SimilarityUtils.pairToFeatureVector(pair);
  const input = SimilarityUtils.featureVectorToInputVector(featureVector);
  const output = Array.of(label === 'positive' ? 1 : 0);

  return {featureVector, input, output };
}
