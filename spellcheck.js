const fs = require('fs');
const yaml = require('js-yaml');
const { execSync } = require('child_process');
const Typo = require('typo-js');
const excludedWords = require('./excludedWords.js');


const red = "\x1b[31m";
const yellow = "\x1b[33m";
const blue = "\x1b[34m";
const reset = "\x1b[0m";
const green = "\x1b[32m";

const dictionary = new Typo('en_US');
let errors = 0;

String.prototype.splitByMultipleDelimiters = function(delimiters) {
  let str = this.toString();
  const regexPattern = new RegExp(delimiters.map(delimiter => `\\${delimiter}`).join('|'), 'g');
  return str.split(regexPattern);
}

const hasNumbers = (word) => {
  return /\d/.test(word);
}

const isValidWord = (word) => {
  return (
    word.length > 3 &&
    !hasNumbers(word) &&
    !excludedWords.some(excludedWord => word.toLowerCase().includes(excludedWord))
  )
}

const spellcheckFields = (yamlObj, lines) => {
  const delimiters = [' ', '{', '}', '$', '.', ',', '-', '|', '%', '"', '/', '(', ')', '+', '#', '>', '<', ':', '_', '=', '?', '*', '@', '!'];

  const rulesGroup = yamlObj.spec?.groups[0]?.rules;
  if (!rulesGroup) return;
  const dynamicKeys = ['alert', 'description', 'summary'];
  const dynamicObject = {};
  let result = [];

  for (let i = 0; i < rulesGroup.length; i++) {
    for (const key of dynamicKeys) {
      const dynamicKey = `${key}${i + 1}`;
      let value;
      try {
        value = rulesGroup[i][key] || rulesGroup[i].annotations[key];
      } catch(e) {}
      dynamicObject[dynamicKey] = value;
    }
  }
  for (const field in dynamicObject) {
    const fieldValue = dynamicObject[field] ?? 'empty';
    const words = fieldValue.splitByMultipleDelimiters(delimiters);
    const filteredWords = words.filter(word => word !== '' && isValidWord(word));
    
    result = filteredWords.reduce((acc, word) => {
      if (!dictionary.check(word.toLowerCase())) {
        const alreadyCheckedIndex = [];
        lines.forEach((line, index) => {
          if (line.toLowerCase().includes(word.toLowerCase()) && !alreadyCheckedIndex.includes(index)) {
            alreadyCheckedIndex.push(index + 1);
          }
        });
        acc = [...acc, `\n Check Spelling: ${red}${word}${reset}, Field Name: ${yellow}${field}${reset}, At Line/s: ${green}${alreadyCheckedIndex}${reset}`];
        return acc;
      }
      return acc;
    },result);
  }
  if (result.length) {
    errors += 1;
    throw new Error(result);
  }
}

const spellcheckYAMLFile = (filePath) => {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n');
    const yamlObj = yaml.load(fileContent);
    spellcheckFields(yamlObj, lines);
  } catch (error) {
    console.error(`Spellchecking failed for ${blue}${filePath}${reset}: \n ${error} \n`);
  }
}

const getYAMLFiles = (dir = '..', files = []) => {
  // console.log('yoyoyoyoy', fs.readdirSync('../'));
  const fileList = fs.readdirSync(dir);
  fileList.map(file => {
    const filePath = `${dir}/${file}`;
    fs.statSync(filePath).isDirectory() ? getYAMLFiles(filePath, files) : files.push(filePath);
  });
  return files.filter(file => file.endsWith('.yaml'));
}

const spellcheckYAMLFiles = () => {
  const yamlFiles = getYAMLFiles();
  for (const file of yamlFiles) {
    spellcheckYAMLFile(file);
  }
}

spellcheckYAMLFiles();

if (errors > 0) process.exit(1);
