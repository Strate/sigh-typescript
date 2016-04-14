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
  let {basename} = require('path')

  // this task runs inside the subprocess to transform each event
  return event => {
    var res = ts.transpileModule(
      event.data,
      {
        compilerOptions: {
          sourceMap: true,
          module: ts.ModuleKind.ES6,
          target: ts.ScriptTarget.ES6,
          jsx: ts.JsxEmit.Preserve
        },
        fileName: basename(event.path)
      }
    )

    var map = JSON.parse(res.sourceMapText)
    map.sources = [event.sourcePath]

    return {
      data: res.outputText,
      sourceMap: map
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

    return compiler(_.pick(event, 'type', 'data', 'path', 'projectPath', 'basePath', 'sourcePath')).then(({data, sourceMap}) => {
      event.data = data

      if (sourceMap) {
        event.applySourceMap(sourceMap)
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
    pooledProc = op.procPool.prepare(typescriptTask, Object.assign({cwd: process.cwd()}, opts), { module })

  return mapEvents(op.stream, adaptEvent(pooledProc))
}
