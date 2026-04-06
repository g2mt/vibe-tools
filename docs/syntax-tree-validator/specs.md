Create a syntax tree validator in JS and HTML. Use vanilla JS.
Create the files index.html, script.js, style.css in this directory.

It will have a textbox and parse bracketed X-bar syntax trees like this:

```
[TP [NP This] [T' [T pres] [VP [V' [V is] [DP [D' [D a] [NP [N' [N wug]]]]]]]]]
```

Put the tree on top into the textarea as text.

Add a "Parse" button to parse it.

A word is a string of non-whitespace, non-bracket characters.

A phrase has the category that ends with the character "P". You can find its bar level by replacing the final P with an apostrophe: `TP -> T'`. You can find its head by removing the final P: `TP -> T`.

Remember the schema:

- X' = head X and complement phrases
- X' = X' and adjunct phrases
- XP = specifier and X'

The validator then shows the constituents and their heads/specifiers/complements/adjuncts in this format. Wrap each constituent and subconstituent in brackets, and show the table (with 2 columns):

**Constituent**: This is a wug
Type: TP
Head: [pres]
Specifier: [This]
Complements: [is a wug]
Adjuncts: --

Show every possible constiuents within the sentence..
