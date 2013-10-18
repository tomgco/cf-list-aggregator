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

## Types of list
There are two types of list:

### 1. Automatic
Automatic lists are used to auto-generate list content based on a number of properties:

- tags
- sections
- articletypes
- articleSubTypes

They can be sorted by:

- recent
- most comments
- popular
- alphabetical

### 2. Manual
Manual lists are specific lists of articles or content.

## Types of list content
There are three types of content that can be present in a list:

**Warning: some fields below are omitted for brevity**

### 1. Article
This is a standard article, obtained directly from the article collection.
These can be present in both automatic and manual lists.
They are stored in the list entity under the `articles` array like so:

```js
"articles" : [
    {
      "articleId" : "52551b0bd50e51ce03000002",
      "type" : "offer"
    },
    {
      "articleId" : "51ed3d294ca3ce512f00000a",
      "type" : "offer"
    }
  ]
```

### 2. Overridden article
This is a standard article with some fields overridden.
For example if an article title was "My amazing article", but you wanted it to appear in a list with the title "Click to see my amazing title".

These fields are also stored in the articles array alongside normal articles like so:

```js
"articles" : [
    {
      "articleId" : "52551b0bd50e51ce03000002",
      "type" : "offer"
    },
    {
      "articleId" : "51ed3d294ca3ce512f00000a",
      "shortTitle" : "New overridden title",
      "type" : "offer",
      "customId": null
    }
  ]
```

They are differentiated from custom articles by having a `customId` value of `null` and an `articleId` relating to an actual article.

Date fields (`liveDate` and `expiryDate`) can also be overridden to effect the articles visibility within a list.
This does not affect an article's visibility anywhere but this list.

### 3. Custom item
Custom items are pieces of content which have no related article.
They can be used to put arbitrary data within a list.
They also appear in the articles array like so:

```js
"articles" : [
    {
      "articleId" : "52551b0bd50e51ce03000002",
      "type" : "offer"
    },
    {
      "articleId" : null,
      "shortTitle" : "asddsa",
      "type" : "custom",
      "customId" : 1
    }
  ]
```

They always have a `customId` integer, an `articleId` of `null` and a `type` of `custom` to differentiate from overridden articles.

## Credits
[Paul Serby](https://github.com/serby/) follow me on twitter [@serby](http://twitter.com/serby)

## Licence
Licensed under the [New BSD License](http://opensource.org/licenses/bsd-license.php)
