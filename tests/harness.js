/* Зарежда скриптовете на играта в Node (без браузър) за тестове на логиката */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
global.window = global;
const files = ['rng', 'data', 'data2', 'pathfind', 'mapgen', 'world', 'battle', 'ai', 'campaign'];
files.forEach((f) => {
  const p = path.join(__dirname, '..', 'web', 'js', f + '.js');
  if (!fs.existsSync(p)) return;
  vm.runInThisContext(fs.readFileSync(p, 'utf8'), { filename: p });
});
module.exports = global.MK;
