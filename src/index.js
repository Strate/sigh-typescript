import _ from 'lodash'
import Promise from 'bluebird'
import { Bacon } from 'sigh-core'
import { mapEvents } from 'sigh-core/lib/stream'

function typescriptTask(opts) {
  // this function is called once for each subprocess in order to cache state,
  // it is not a closure and does not have access to the surrounding state, use
  // `require` to include any modules you need, for further info see
  // https://github.com/ohjames/process-pool
  var log = require('sigh-core').log
  var ts = require('typescript');

  // this task runs inside the subprocess to transform each event
  return event => {
    var res = ts.transpileModule(
      event.data,
      {
        compilerOptions: {
          module: ts.ModuleKind.ES6,
          target: ts.ScriptTarget.ES6,
          jsx: ts.JsxEmit.Preserve
        },
        fileName: event.sourcePath
      }
    )

    return {
      data: res.outputText,
      sourceMap: res.sourceMapText
    }
  }
}

function adaptEvent(compiler) {
  // data sent to/received from the subprocess has to be serialised/deserialised
  return event => {
    if (event.type !== 'add' && event.type !== 'change') {
      return event
    }

    if (event.fileType !== 'ts' && event.fileType !== 'tsx') {
      return event
    }

    return compiler(_.pick(event, 'type', 'data', 'path', 'projectPath', 'sourcePath')).then(result => {
      event.data = result.data

      if (result.sourceMap) {
        event.applySourceMap(JSON.parse(result.sourceMap))
      }

      if (event.fileType === 'ts') {
        event.changeFileSuffix('js')
      }

      if (event.fileType === 'tsx') {
        event.changeFileSuffix('jsx')
      }

      return event
    })
  }
}

var pooledProc

export default function(op, opts = {}) {
  if (! pooledProc)
    pooledProc = op.procPool.prepare(typescriptTask, opts, { module })

  return mapEvents(op.stream, adaptEvent(pooledProc))
}
