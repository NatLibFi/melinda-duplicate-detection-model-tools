#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const cluster = require('cluster');
const synaptic = require('synaptic');
const Network = synaptic.Network;

const LocalUtils = require('./utils');
const {hrtimeToMs, msToTime} = require('melinda-deduplication-common/utils/utils');

const SimilarityUtils = require('melinda-deduplication-common/similarity/utils');
const Types = SimilarityUtils.Types;
const DuplicateClass = SimilarityUtils.DuplicateClass;
const MergeValidation = require('melinda-deduplication-common/marc-record-merge-utils/marc-record-merge-validate-service');

const NUMBER_OF_WORKERS = 3;
const SAMPLE = process.env.SAMPLE || false;

if (cluster.isMaster) {
  const recordSetFile = process.argv[2] || 'data-sets/testSet';
  console.log(`Validating model with ${recordSetFile}`);

  const testSet = LocalUtils.readRecordSet(recordSetFile);
  const shuffledSet = shuffle(testSet);
  const items = SAMPLE ? shuffledSet.slice(0,10) : shuffledSet;

  run(items).catch(error => console.error(error));

  // Fork workers.
  for (let i = 0; i < NUMBER_OF_WORKERS; i++) {
    cluster.fork();
  }

} else {
  runWorker().catch(error => console.error(error));
}

async function run(items) {

  const probabilities = await sendTasksToWorkers(items);
  
  for (const item of probabilities) {
    // in the trainingset the record1 is always the preferred record.

    const hasNegativeFeature = Object.keys(item.featureVector).map(key => item.featureVector[key]).some(feature => feature === -1);
    
    if (hasNegativeFeature) {
      item.automerge_possible = false;
    } else {   
      try {
        await MergeValidation.validateMergeCandidates(MergeValidation.preset.melinda_host_automerge, item.pair.record1, item.pair.record2);
        item.automerge_possible = true;
      } catch(error) {
        item.automerge_possible = false;
      }
    }
  }

  const guesses = probabilities
    .map(addSynapticLabel)
    .map(addTypeLabel)
    .filter(item => item.automerge_possible);
  
  if (SAMPLE) {
    //console.log(guesses);
  }

  const rnd = num => Math.round(num * 1E6) / 1E6;
  
  const labels = guesses.map(guess => `${guess.label} ${rnd(guess.synapticProbability)}`).join('\n');
  fs.writeFileSync('/tmp/guessLabels.txt', labels, 'utf8');
  console.log('wrote /tmp/guessLabels.txt');

  const correct = guesses.filter(item => {
    const guessLabel = getLabel(item);
    return guessLabel === item.label;
  });

  const cls = guesses.reduce((stats, item) => {
    switch (item.type) {
      case Types.TRUE_NEGATIVE: stats.tn++; break;
      case Types.FALSE_NEGATIVE: stats.fn++; break;
      case Types.TRUE_POSITIVE: stats.tp++; break;
      case Types.FALSE_POSITIVE: stats.fp++; break;
      default: throw new Error('unknown type');
    }
    return stats;
  }, {tn: 0, tp:0, fn: 0, fp: 0});

  const guessesWithCls = guesses.map((guess, i) => {
    return Object.assign({}, guess, { cls: cls[i] });
  });

  fs.writeFileSync('/tmp/guesses.json', JSON.stringify(guessesWithCls), 'utf8');
  console.log('wrote /tmp/guesses.json');

  const correctPercentage = Math.round(correct.length/guesses.length*1000)/1000 * 100;
  console.log(`Correct: ${correct.length}/${guesses.length} =${correctPercentage}% (Set size: ${probabilities.length})`);
  console.log(`True negatives: ${cls.tn}`);
  console.log(`True positives: ${cls.tp}`);
  console.log(`False negatives: ${cls.fn}`);
  console.log(`False positives: ${cls.fp}`);

}

async function runWorker() {

  const exported = JSON.parse(fs.readFileSync('/tmp/duplicate-perceptron.json', 'utf8'));
  console.log('loaded /tmp/duplicate-perceptron.json');
  const importedNetwork = Network.fromJSON(exported);
  
  const taskHandler = (message) => {
    
    const item = message.task;

    const featureVector = SimilarityUtils.pairToFeatureVector(item.pair);
    const input = SimilarityUtils.featureVectorToInputVector(featureVector);
    const synapticProbability = importedNetwork.activate(input)[0];

    const response = {
      result: Object.assign({}, item, { synapticProbability, featureVector })
    };

    process && process.send(response);
  };

  process && process.on('message', taskHandler);
  
  process && process.send('READY');
}

const PROBABILITY_THRESHOLD = 0.75;

function addSynapticLabel(item) {
  let synapticLabel;
  if (item.synapticProbability > PROBABILITY_THRESHOLD) {
    synapticLabel = DuplicateClass.IS_DUPLICATE;
  } else {
    synapticLabel = DuplicateClass.NOT_DUPLICATE;
  }

  return Object.assign({}, item, { synapticLabel });
}

function addTypeLabel(item) {

  let type;
  const guessLabel = getLabel(item);
  if (guessLabel === 'positive') {
    if (item.label === 'positive') {
      type = Types.TRUE_POSITIVE;
    } else {
      type = Types.FALSE_POSITIVE;
    }
  }
  if (guessLabel === 'negative') {
    if (item.label === 'negative') {
      type = Types.TRUE_NEGATIVE;
    } else {
      type = Types.FALSE_NEGATIVE;
    }
  }

  return Object.assign({}, item, { type });

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

function getLabel(item) {
  let guessLabel;
  switch (item.synapticLabel) {
    case DuplicateClass.IS_DUPLICATE: guessLabel = 'positive'; break;
    case DuplicateClass.MAYBE_DUPLICATE : guessLabel = 'positive'; break;
    case DuplicateClass.NOT_DUPLICATE : guessLabel = 'negative'; break;   
  }
  return guessLabel;
}


function sendTasksToWorkers(tasks) {

  const tasksTotal = tasks.length;
  let completedTasks = 0;
  let start = hrtimeToMs(process.hrtime());
  
  return new Promise(resolve => {

    const results = [];
    let tasksRunning = 0;

    cluster.on('message', (worker, message) => {

      if (message.result) {
        results.push(message.result);
        tasksRunning--;

        completedTasks++;
        if (completedTasks % 10 === 0) {

          let now = hrtimeToMs(process.hrtime());
          
          const delta = now - start;
          const perItem = delta / completedTasks;
          const totalTime = perItem * tasksTotal;


          console.log(`${completedTasks}/${tasksTotal}, estimated runtime: ${msToTime(totalTime)}, time left: ${msToTime(totalTime - delta)}`);
        }
      }

      const nextTask = tasks.shift();

      if (nextTask) {
        worker.send({ task: nextTask });
        tasksRunning++;
      } else {
        worker.kill();

        if (tasksRunning === 0) {
          resolve(results);
        }
      }
          
    });
  });
}
