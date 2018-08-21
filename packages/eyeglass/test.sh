#!/bin/sh

if [ "$COVERAGE" = "true" ]
then
  ./node_modules/.bin/gulp coverage
else
  ./node_modules/.bin/gulp test
fi
