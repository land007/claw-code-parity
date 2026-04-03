#!/usr/bin/env node

const { installAndRun } = require("../lib/install");

installAndRun(process.argv.slice(2)).catch((error) => {
  console.error(error && error.message ? error.message : String(error));
  process.exit(1);
});
