#!/usr/bin/env node
'use strict'

const fs = require('fs-extra');

fs.removeSync('node_modules/eager');
fs.symlinkSync('../tests/dummy/lib/eager', 'node_modules/eager');

fs.removeSync('node_modules/lazy');
fs.symlinkSync('../tests/dummy/lib/lazy', 'node_modules/lazy');
