const _ = require('lodash');
const fs = require('fs-extra');
const path = require('path');
const bunyan = require('bunyan');
const bunyanDebugStream = require('bunyan-debug-stream');
const argparse = require('./argparse');

function adaptOlderLogLevelName(level) {
  switch (level) {
    case 'fatal':
    case 'error':
    case 'warn':
    case 'info':
    case 'debug':
    case 'trace':
      return level;

    case 'verbose':
      return 'debug';

    case 'wss':
    case 'silly':
      return 'trace';

    default:
      return 'info';
  }
}

function createPlainBunyanStream({ logPath, level }) {
  const options = {
    showDate: false,
    showLoggerName: true,
    showPid: false,
    showMetadata: false,
    basepath: __dirname,
    prefixers: {
      '__filename': (filename, { entry }) => {
        const suffix = entry.event ? `/${entry.event}` : '';
        return path.basename(filename) + suffix;
      },
      'trackingId': id => ` #${id}`,
    },
  };

  if (logPath) {
    options.colors = false;
    options.out = fs.createWriteStream(logPath, {
      flags: 'a',
    });
  }

  return {
    level,
    type: 'raw',
    stream: bunyanDebugStream(options),
    serializers: bunyanDebugStream.serializers,
  };
}

function init() {
  const level = adaptOlderLogLevelName(argparse.getArgValue('loglevel'));
  const logBaseFilename = path.join(argparse.getArgValue('artifacts-location') || '', 'detox');
  const shouldRecordLogs = ['failing', 'all'].indexOf(argparse.getArgValue('record-logs')) >= 0;

  const bunyanStreams = [createPlainBunyanStream({ level })];
  if (shouldRecordLogs) {
    const jsonFileStreamPath = logBaseFilename + '.json.log';
    const plainFileStreamPath = logBaseFilename + '.log';

    fs.ensureFileSync(jsonFileStreamPath);
    fs.ensureFileSync(plainFileStreamPath);

    bunyanStreams.push({
      level,
      path: jsonFileStreamPath,
    });

    bunyanStreams.push(createPlainBunyanStream({
      level,
      logPath: plainFileStreamPath,
    }));
  }

  return ['detox', 'detox-server'].map(name => bunyan.createLogger({
    name,
    streams: bunyanStreams,
  }));
}

const [detoxLogger, detoxServerLogger] = init();
detoxLogger.server = detoxServerLogger;

module.exports = detoxLogger;
