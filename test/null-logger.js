function noop() {
}

// A null logger for use in testing.
module.exports =
{ info: noop
, log: noop
, error: noop
, warn: noop
}