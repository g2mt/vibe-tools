const fs = require("fs");
const data = JSON.parse(fs.readFileSync("./en_US.json", "utf8"));

const vocab = data["en_US"][0];
const chars = {};
const exceptions = "/ˈ,";
const newVocab = {};
for (const word in vocab) {
  const ipa = vocab[word];
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
fs.writeFileSync("./freq.json", JSON.stringify(chars), "utf8");
fs.writeFileSync("./chars.json", JSON.stringify(Object.keys(chars)), "utf8");
fs.writeFileSync("./en_US_processed.json", JSON.stringify(newVocab), "utf8");
