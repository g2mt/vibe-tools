const fs = require("fs");
const data = fs.readFileSync("./cmudict-0.7b-ipa.txt", "utf8");

const chars = {};
const exceptions = "/ˈˌ,ː";
const newVocab = {};
for (let line of data.split("\n")) {
  line = line.trimRight();
  if (!line)break;
  let cols = line.split("\t");
  let word = cols[0];
  if (/^[^A-Za-z0-9']/.test(word)) continue;
  word = word.toLowerCase();
  const ipa = cols[1].split(", ")[0];
  let newIpa = "";
  for (const ch of ipa) {
    if (exceptions.indexOf(ch) > -1)
      continue;
    if (ch === " ")
      break;
    if(typeof chars[ch] === "undefined")
      chars[ch] = 0;
    chars[ch] += 1;
    newIpa += ch;
  }
  newVocab[word]=newIpa;
}

fs.writeFileSync("./chars.json", JSON.stringify(Object.keys(chars)), "utf8");
fs.writeFileSync("./en_US_processed.json", JSON.stringify(newVocab), "utf8");
