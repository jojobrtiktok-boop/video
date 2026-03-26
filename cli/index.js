#!/usr/bin/env node
const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

const program = new Command();
program
  .command('upload <file>')
  .option('--mode <mode>', 'mode: blur|ai', 'blur')
  .description('Upload video to server')
  .action(async (file, opts) => {
    const server = process.env.SERVER_URL || 'http://localhost:3000';
    if (!fs.existsSync(file)) return console.error('file not found');
    const fd = new FormData();
    fd.append('video', fs.createReadStream(file));
    fd.append('mode', opts.mode);
    try {
      const resp = await axios.post(server + '/api/process', fd, { headers: fd.getHeaders(), maxContentLength: Infinity, maxBodyLength: Infinity });
      console.log('Response:', resp.data);
    } catch (err) {
      console.error('Upload error', err.response ? err.response.data : err.message);
    }
  });

program.parse(process.argv);
