'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _sighCore = require('sigh-core');

var _sighCoreLibStream = require('sigh-core/lib/stream');

function typescriptTask(opts) {
  // this function is called once for each subprocess in order to cache state,
  // it is not a closure and does not have access to the surrounding state, use
  // `require` to include any modules you need, for further info see
  // https://github.com/ohjames/process-pool
  var log = require('sigh-core').log;
  var ts = require('typescript');

  var _require = require('path');

  var basename = _require.basename;

  // this task runs inside the subprocess to transform each event
  return function (event) {
    var res = ts.transpileModule(event.data, {
      compilerOptions: {
        sourceMap: true,
        module: ts.ModuleKind.ES6,
        target: ts.ScriptTarget.ES6,
        jsx: ts.JsxEmit.Preserve
      },
      fileName: basename(event.path)
    });

    var map = JSON.parse(res.sourceMapText);
    map.sources = [event.sourcePath];

    return {
      data: res.outputText,
      sourceMap: map
    };
  };
}

function adaptEvent(compiler) {
  // data sent to/received from the subprocess has to be serialised/deserialised
  return function (event) {
    if (event.type !== 'add' && event.type !== 'change') {
      return event;
    }

    if (event.fileType !== 'ts' && event.fileType !== 'tsx') {
      return event;
    }

    return compiler(_lodash2['default'].pick(event, 'type', 'data', 'path', 'projectPath', 'basePath', 'sourcePath')).then(function (_ref) {
      var data = _ref.data;
      var sourceMap = _ref.sourceMap;

      event.data = data;

      if (sourceMap) {
        event.applySourceMap(sourceMap);
      }

      if (event.fileType === 'ts') {
        event.changeFileSuffix('js');
      }

      if (event.fileType === 'tsx') {
        event.changeFileSuffix('jsx');
      }

      return event;
    });
  };
}

var pooledProc;

exports['default'] = function (op) {
  var opts = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  if (!pooledProc) pooledProc = op.procPool.prepare(typescriptTask, Object.assign({ cwd: process.cwd() }, opts), { module: module });

  return (0, _sighCoreLibStream.mapEvents)(op.stream, adaptEvent(pooledProc));
};

module.exports = exports['default'];
//# sourceMappingURL=index.js.map