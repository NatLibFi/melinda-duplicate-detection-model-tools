/* eslint-disable no-console */

const fs = require('fs');
const synaptic = require('synaptic');

const SimilarityUtils = require('melinda-deduplication-common/similarity/utils');

const INPUTS = SimilarityUtils.DefaultStrategy.length;
const OUTPUTS = 1;
const LAYER_1 = Math.round(Math.sqrt((OUTPUTS+2)*INPUTS)) + Math.round(2 * Math.sqrt(INPUTS/(OUTPUTS+2)));
const LAYER_2 = OUTPUTS * Math.round(Math.sqrt(INPUTS/(OUTPUTS+2)));

const model = new synaptic.Architect.Perceptron(INPUTS, LAYER_1, LAYER_2, OUTPUTS);

const trainer = new synaptic.Trainer(model);
const opts = {
  rate: [0.05, 0.03, 0.01, 0.005],
  iterations: 5000,
  error: .0135,
  shuffle: true,
  log: 100,
  cost: synaptic.Trainer.cost.MSE
};

const isParsedAlready = fs.existsSync('/tmp/parsed-training-data.json');
let trainingSet;

if (!isParsedAlready) {
  const trainingSetData = JSON.parse(fs.readFileSync('data-sets/trainingSet.json', 'utf8'));
  const len = trainingSetData.length;
  trainingSet = trainingSetData.map((item, i) => {
    if (i%10 === 0) {
      console.log(`${i}/${len}`);
    }
    
    const featureVector = SimilarityUtils.pairToFeatureVector(item.pair);
    const input = SimilarityUtils.featureVectorToInputVector(featureVector);
    
    const output = Array.of(item.label === 'positive' ? 1 : 0);
    
    return { input, output, _featureVector: featureVector };
  });
  fs.writeFileSync('/tmp/parsed-training-data.json', JSON.stringify(trainingSet), 'utf8');
  console.log('Wrote /tmp/parsed-training-data.json');
} else {
  trainingSet = JSON.parse(fs.readFileSync('/tmp/parsed-training-data.json', 'utf8'));
  console.log('Loaded /tmp/parsed-training-data.json');
}

const result = trainer.train(trainingSet, opts);
console.log(result);

const exported = model.toJSON();
fs.writeFileSync('/tmp/percepton.json', JSON.stringify(exported), 'utf8');
console.log('wrote /tmp/percepton.json');
