Create a syntax tree formatter in JS and HTML. Use vanilla JS.
Create the files index.html, script.js, style.css in this directory.

The page will contain a textarea, then a button for "Format" and a button for "Unformat". The formatting will operate exclusively on that textarea.

A syntax tree is a nested list expression, similar to a Lisp expression, which looks like this:

```
[category [category item] [category [category item]]]
```

where category/item is any string non-space, non-bracket characters.

Format it like this:

```
[category
  [category item]
  [category
    [category item]
  ]
]
```

- Lists that are completely flat (those that do not contain additional lists) will stay in one line.
- The category will always be next to the bracket, without newlines.
- Use 2 spaces for indent when formatting.

You will need a function to parse the list into a list of string, or a list of lists of strings, etc.

