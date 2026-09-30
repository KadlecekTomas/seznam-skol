import { readFile } from 'node:fs/promises';
import { buildPilot } from './evidence.mjs';
import { writePilot } from './export.mjs';

const options = Object.fromEntries(process.argv.slice(2).map(arg => {
  if (!arg.startsWith('--') || !arg.includes('=')) throw new Error('Use --input=... --output=... [--previous=...].');
  const index = arg.indexOf('=');
  return [arg.slice(2,index),arg.slice(index+1)];
}));
try {
  if (!options.input || !options.output || Object.keys(options).some(k => !['input','output','previous'].includes(k))) throw new Error('Use --input=... --output=... [--previous=...].');
  const input = JSON.parse(await readFile(options.input,'utf8'));
  const previous = options.previous ? JSON.parse(await readFile(options.previous,'utf8')) : undefined;
  const result = buildPilot(input,previous);
  const delivery = await writePilot(result,options.output);
  console.log(JSON.stringify({...result.summary,...delivery},null,2));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Pilot export failed.');
  process.exitCode = 1;
}
