/* Зарежда скриптовете на играта в Node (без браузър) за тестове на логиката */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
global.window = global;
const files = ['rng', 'data', 'pathfind', 'mapgen', 'world', 'battle', 'ai'];
files.forEach((f) => {
  const p = path.join(__dirname, '..', 'web', 'js', f + '.js');
  if (!fs.existsSync(p)) return;
  vm.runInThisContext(fs.readFileSync(p, 'utf8'), { filename: p });
});
module.exports = global.MK;
