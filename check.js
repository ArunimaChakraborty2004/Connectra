import fs from 'fs';
import postcss from 'postcss';

const css = fs.readFileSync('src/index.css', 'utf8');

try {
  postcss.parse(css);
  console.log('CSS is valid!');
} catch (error) {
  console.error('Syntax Error at line:', error.line, 'column:', error.column);
  console.error(error.reason);
  console.error(error.message);
}
