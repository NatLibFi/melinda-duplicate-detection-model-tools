/* eslint-disable no-console */

const readline = require('readline');
const fs = require('fs');
const synaptic = require('synaptic');
const _ = require('lodash');

const {hrtimeToMs, msToTime} = require('melinda-deduplication-common/utils/utils');

const trainingSetFile = '/tmp/parsed-training-data';

let start = hrtimeToMs(process.hrtime());

const TRAINER_ITERATIONS = 25000;

const TRAINER_SETTINGS = {
  rate: [0.03, 0.01, 0.005, 0.001, 0.0005, 0.00005],
  iterations: TRAINER_ITERATIONS,
  error: .0001,
  shuffle: true,
  cost: synaptic.Trainer.cost.MSE,
  schedule: {
    every: 10,
    do: function(data) {

      let now = hrtimeToMs(process.hrtime());
      
      const delta = now - start;
      const perItem = delta / data.iterations;
      const totalTime = perItem * TRAINER_ITERATIONS;
      
      console.log(`iterations ${data.iterations} error ${data.error} rate ${data.rate} estimated runtime: ${msToTime(totalTime)}, time left: ${msToTime(totalTime - delta)}`);
    }
  }
};

run().catch(e => console.error(e));

async function run() {
  console.log(`Loading training set from ${trainingSetFile}`);
  const trainingSet = await readTrainingSet();
  console.log('Training set loaded');

  const filteredTrainingSet = trainingSet.filter(item => {
    return item.input.every(val => val !== -1);
  });

  const featureCount = _.get(filteredTrainingSet, '[0].input', []).length;
  if (featureCount === 0) {
    throw new Error('Could not determine feature count from trainingSet');
  }
  console.log(featureCount);

  const INPUTS = featureCount;
  const OUTPUTS = 1;
  const LAYER_1 = Math.round(Math.sqrt((OUTPUTS+2)*INPUTS)) + Math.round(2 * Math.sqrt(INPUTS/(OUTPUTS+2)));
  const LAYER_2 = OUTPUTS * Math.round(Math.sqrt(INPUTS/(OUTPUTS+2)));

  const architecture = [INPUTS, LAYER_1, LAYER_1/2, OUTPUTS].map(Math.round);
  console.log('Architecture: ' , architecture);
  const model = new synaptic.Architect.Perceptron(...architecture);

  const trainer = new synaptic.Trainer(model);


  const result = trainer.train(filteredTrainingSet, TRAINER_SETTINGS);
  console.log(result);

  const exported = model.toJSON();
  fs.writeFileSync('/tmp/duplicate-perceptron.json', JSON.stringify(exported), 'utf8');
  console.log('wrote /tmp/duplicate-perceptron.json');
}



function readTrainingSet() {
  return new Promise(resolve => {

    const trainingSet = [];
    let count = 0;

    const rl = readline.createInterface({
      input: fs.createReadStream(trainingSetFile)
    });

    rl.on('line', function (line) {
     
      if (count % 100 === 0) {
        console.log(count);
      }

      if (line.startsWith('{')) {
        const parsed = JSON.parse(line);  
        trainingSet.push(parsed);
        count++;
      } else {
        console.log('Skipped line:', line);
      }
    });

    rl.on('close', () => resolve(trainingSet));
  });
}
