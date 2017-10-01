/* eslint-disable no-console */
const cluster = require('cluster');
const fs = require('fs');
const LocalUtils = require('./utils');
const _ = require('lodash');

const NUMBER_OF_WORKERS = 3;

const trainingSetPath = 'data-sets/trainingSet';

const SimilarityUtils = require('melinda-deduplication-common/similarity/utils');
const {hrtimeToMs, msToTime} = require('melinda-deduplication-common/utils/utils');

const trainingDataFile = '/tmp/parsed-training-data';


if (fs.existsSync(trainingDataFile)) {
  const renamed = `${trainingDataFile}-${Date.now()}`;
  fs.renameSync(trainingDataFile, renamed);
  console.log(`Renamed ${trainingDataFile} to ${renamed}`);
}

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);

  console.log('Parsing data-sets/trainingSet');
  const trainingSetData = LocalUtils.readRecordSet(trainingSetPath);

  const len = trainingSetData.length;
  console.log(`Total size of trainingSet: ${len}`);

  let i=0;
  let start = hrtimeToMs(process.hrtime());

  cluster.on('message', (worker, message) => {

    if (message.type === 'RESULT') {
      i++;
      if (i%10 === 0) {
        let now = hrtimeToMs(process.hrtime());

        const delta = now - start;
        const perItem = delta / i;
        const totalTime = perItem * len;

        console.log(`${new Date()} ${i}/${len}, estimated runtime: ${msToTime(totalTime)}, time left: ${msToTime(totalTime - delta)}`);
      }

      message.items.forEach(item => {
        fs.appendFileSync(trainingDataFile, `${JSON.stringify(item)}\n`, 'utf8');
      });
    }

    const nextItem = trainingSetData.shift();

    if (nextItem) {
      worker.send({
        type: 'WORK',
        item: nextItem
      });
    } else {
      worker.send({
        type: 'TERMINATE'
      });
    }


  });

  // Fork workers.
  for (let i = 0; i < NUMBER_OF_WORKERS; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker) => {
    console.log(`worker ${worker.process.pid} died`);
  });
} else {

  const messageHandler = (message) => {
    if (message.type === 'TERMINATE') {
      process.exit(0);
    }

    if (message.type !== 'WORK') {
      return;
    }

    const item = message.item;

    const { featureVector, input, output } = createVectors(item.label, item.pair);
  
    const items = [
      { input, output, _featureVector: featureVector, pair: item.pair },
    ];
  
    if (Math.random() < 0.1) {
      // set record1 as both sides of the check
      const identityItem = createVectors('positive', {record1: item.pair.record1, record2: item.pair.record1});   
      items.push({ 
        input: identityItem.input,
        output: identityItem.output,
        _featureVector: identityItem.featureVector,
        pair: {record1: item.pair.record1, record2: item.pair.record1}
      });
    }
  

    const response = {
      type: 'RESULT',
      items
    };

    process && process.send(response);
  };

  process && process.on('message', messageHandler);

  process.send({TYPE: 'READY'});
}

function createVectors(label, pair) {

  const featureVector = SimilarityUtils.pairToFeatureVector(pair);
  const input = SimilarityUtils.featureVectorToInputVector(featureVector);
  const output = Array.of(label === 'positive' ? 1 : 0);

  return {featureVector, input, output };
}
