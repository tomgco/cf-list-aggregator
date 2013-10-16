module.exports = tasks

function tasks(pliers) {
  pliers.filesets('tests', [ 'test/**/*.test.js' ])

  pliers('test', function (done) {
    var Mocha = require('mocha')
    require('should')

    var mocha = new Mocha()

    // set a timeout
    mocha.timeout(5000)

    pliers.filesets.tests.forEach(function (test) {
      mocha.addFile(test)
    })

    mocha.reporter('spec').ui('bdd');

    mocha.run(done)
  })

  pliers('lint', function (done) {
    pliers.exec('./node_modules/jshint/bin/jshint .', done)
  })
}