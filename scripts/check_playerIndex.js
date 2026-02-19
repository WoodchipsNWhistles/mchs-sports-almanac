const idx = require("./src/_data/playersIndex.js")();
const id = "ADAALE2010";
const hit = idx.players.find((p) => p.personID === id);
console.log("playersIndex players count:", idx.players.length);
console.log("has", id + ":", !!hit);
if (hit) console.log(hit);
