var falafel = require('falafel')
  , fs = require('fs')

module.exports = tasks

function tasks(pliers) {
  pliers.filesets('js', [ 'lib/**/*.js', '*.js' ])

  pliers('test', function (done) {
    pliers.exec('./node_modules/.bin/mocha ', done)
  })

  pliers('lint', function (done) {
    //pliers.exec('./node_modules/jshint/bin/jshint .', done)
    pliers.filesets.js.forEach(badFunctions)
  })

  function countLines(text) {
    var count = 1
      , pos = 0
      , found = 0
    while ((found = text.indexOf('\n', pos)) !== -1) {
      count++
      pos = found + 1
    }
    return count
  }

  function badFunctions(file) {
    var src = fs.readFileSync(file).toString()
    falafel(src, function (node) {
      if ((node.type === 'MemberExpression') && (node.object.name === 'console'))   {
        console.log(file, node.object.name, node.source(), countLines(src.substring(0, node.property.range[0])))
      }
    })
  }
}