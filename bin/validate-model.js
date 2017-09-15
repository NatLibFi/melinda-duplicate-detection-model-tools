#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');

const SimilarityUtils = require('melinda-deduplication-common/similarity/utils');
const Types = SimilarityUtils.Types;
const DuplicateClass = SimilarityUtils.DuplicateClass;

const MergeValidation = require('melinda-deduplication-common/marc-record-merge-utils/marc-record-merge-validate-service');

const synaptic = require('synaptic');
const Network = synaptic.Network;

const SAMPLE = process.env.SAMPLE || false;

const exported = JSON.parse(fs.readFileSync('/tmp/percepton.json', 'utf8'));
console.log('loaded /tmp/percepton.json');
var importedNetwork = Network.fromJSON(exported);

const recordSet = process.argv[2] || 'data-sets/testSet.json';

console.log(`Validating model with ${recordSet}`);

//const testSet = JSON.parse(fs.readFileSync('data-sets/trainingSet.json', 'utf8'));

const testSet = JSON.parse(fs.readFileSync(recordSet, 'utf8'));

const shuffledSet = shuffle(testSet);

const items = SAMPLE ? shuffledSet.slice(0,10) : shuffledSet;

run().catch(error => console.error(error));

async function run() {

  const len = items.length;
  const probabilities = items.map((item, i) => {
    if (i%10 === 0) {
      console.log(`${i}/${len}`);
    }
    const featureVector = SimilarityUtils.pairToFeatureVector(item.pair);
    const input = SimilarityUtils.featureVectorToInputVector(featureVector);
    const synapticProbability = importedNetwork.activate(input)[0];

    return Object.assign({}, item, { synapticProbability, featureVector });
  });

  for (const item of probabilities) {
    // in the trainingset the record1 is always the preferred record.

    
    const hasNegativeFeature = item.featureVector.some(feature => feature === -1);
    
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

  const PROBABILITY_THRESHOLD = 0.75;

  const guesses = probabilities.map(item => {
    let synapticLabel;
    if (item.synapticProbability > PROBABILITY_THRESHOLD) {
      synapticLabel = DuplicateClass.IS_DUPLICATE;
    } else {
      synapticLabel = DuplicateClass.NOT_DUPLICATE;
    }

    return Object.assign({}, item, { synapticLabel });
  }).map(item => {

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

  }).filter(item => item.automerge_possible);
    

  if (SAMPLE) {
    //console.log(guesses);
  }

  const labels = guesses.map(guess => `${guess.label} ${guess.synapticProbability}`);
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
  console.log(`Correct: ${correct.length}/${guesses.length} =${correctPercentage}% (Set size: ${items.length})`);
  console.log(`True negatives: ${cls.tn}`);
  console.log(`True positives: ${cls.tp}`);
  console.log(`False negatives: ${cls.fn}`);
  console.log(`False positives: ${cls.fp}`);

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