# cf-list-aggregator

Compiles lists of content base on defined filtering and ordering.

## Installation

      npm install cf-list-aggregator

## Usage

```js

var aggregate = createAggregator(listService, sectionService, articleService, { logger: logger })

aggregate(listId, dedupe, limit, section, function (err, results) {})

```

### Date based previewing
To create a list aggregator which allows searching from any date perspective, pass a `date` parameter into the options object like so:

```js

var aggregate = createAggregator(listService, sectionService, articleService, { logger: logger, date: new Date() })

```

This aggregator instance now performs all operations based on this date.

## Credits
[Paul Serby](https://github.com/serby/) follow me on twitter [@serby](http://twitter.com/serby)

## Licence
Licensed under the [New BSD License](http://opensource.org/licenses/bsd-license.php)