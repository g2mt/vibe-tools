Create an IPA quiz application in CSS, JS and HTML. Use vanilla JS.

Load word-ipa mapping from data/en_US_processed.json. It looks like this:

```json
{"'bout":"baʊt","'cause":"kəz","'course":"kɔɹs","'cuse":"kjuz","'em":"əm","'frisco":"fɹɪskoʊ","'gain":"ɡɛn","'kay":"keɪ","'m":"əm","'n":"ən","'round":"ɹaʊnd","'s":"ɛs",...}
```

The mapping is ~3 MB in size. Please add a short loading screen to fetch it.

At the center of the page show:

- The word in English `'kay`, etc.
- An input box to take in IPA's.
- A consonant table, with labels for place and manner of articulations (see docs/ipa-selector/consonants.webp). Add in `<a>` elements for each consonant. Clicking on the links will add the consonant to the input box. Do not add every column, only add those present in English.
- A vowel table. Just have 1 row titled "Vowels" and another row for all the vowels. The vowels should be `<a>` tags like in the consonant tables.

The table `<a>` tags should be put in the HTML, not generated in JS.

Refer to the docs/ipa-quiz/data/chars.json file for all the phonemes of English.

Show the back link on the top left. On the top right show the questions correct/questions answered and time elapsed (MM:SS)

The user gets it correct only if they succeeded the first time. Otherwise, allow infinite tries.

If the IPA for does not start with the user input being typed (i.e. if you type /cəz/ instead of /kəz/) then make the input box red. If the user succeeded, then show visible feedback: a "+1" flying up and make the input box green for a moment.


