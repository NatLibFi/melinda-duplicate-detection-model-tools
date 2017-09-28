const amqp = require('amqplib');

const utils = require('melinda-deduplication-common/utils/utils');
const logger = require('melinda-deduplication-common/utils/logger');

const DuplidateQueueConnector = require('melinda-deduplication-common/utils/duplicate-queue-connector');
const MelindaConnector = require('melinda-deduplication-common/utils/melinda-record-service');
const DataStoreConnector = require('melinda-deduplication-common/utils/datastore-connector');

const DUPLICATE_QUEUE_AMQP_URL = utils.readEnvironmentVariable('DUPLICATE_QUEUE_AMQP_URL');
const DATASTORE_API = utils.readEnvironmentVariable('DATASTORE_API', 'http://localhost:1337');

const MELINDA_API = utils.readEnvironmentVariable('MELINDA_API', 'http://libtest1.csc.fi:8992/API');
const X_SERVER = utils.readEnvironmentVariable('X_SERVER', 'http://libtest1.csc.fi:8992/X');
const MELINDA_CREDENTIALS = { };

const loadRecordOptions = { handle_deleted: 1, no_rerouting: 1 };

start().catch(e => logger.log('error', e));

const silentLogger = {
  log: () => {}
};

async function start() {
  logger.log('info', `Connecting to ${DUPLICATE_QUEUE_AMQP_URL}`);
  const duplicateQueueConnection = await amqp.connect(DUPLICATE_QUEUE_AMQP_URL);
  const duplicateChannel = await duplicateQueueConnection.createChannel();
  const duplicateQueueConnector = DuplidateQueueConnector.createDuplicateQueueConnector(duplicateChannel);
  logger.log('info', 'Connected');

  const melindaConnector = MelindaConnector.createMelindaRecordService(MELINDA_API, X_SERVER, MELINDA_CREDENTIALS);
  const dataStoreService = DataStoreConnector.createDataStoreConnector(DATASTORE_API, { logger: silentLogger });
  
  duplicateQueueConnector.listenForDuplicates(async (duplicate, done) => {
    const base = duplicate.first.base;
    
    //const firstRecord = await melindaConnector.loadRecord(base, duplicate.first.id, loadRecordOptions);
    //const secondRecord = await melindaConnector.loadRecord(base, duplicate.second.id, loadRecordOptions);
    
    const firstRecord = await dataStoreService.loadRecord(base, duplicate.first.id);
    const secondRecord = await dataStoreService.loadRecord(base, duplicate.second.id);

    console.log(`LABEL: positive\n\n${firstRecord.toString()}\n\n${secondRecord.toString()}\n\n`);
    done();
  });

}
