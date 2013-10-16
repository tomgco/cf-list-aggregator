module.exports = tasks

function tasks(pliers) {
  pliers.filesets('tests', [ 'test/**/*.test.js' ])

  pliers('test', function (done) {
    var Mocha = require('mocha')

    require('should')

    var mocha = new Mocha()
      , counts =
        { total: 0
        , pass: 0
        , fail: 0
        }

    // set a timeout
    mocha.timeout(5000)

    pliers.filesets.tests.forEach(function (test) {
      mocha.addFile(test)
    })

    mocha.reporter('spec').ui('bdd');

    var runner = mocha.run(function () {
      console.log('Finished', counts)
      done()
    })

    runner.on('pass', function () {
      counts.total += 1
      counts.pass += 1
    })

    runner.on('fail', function () {
      counts.total += 1
      counts.fail += 1
    })

  })

  pliers('lint', function (done) {
    pliers.exec('./node_modules/jshint/bin/jshint .', done)
  })
}