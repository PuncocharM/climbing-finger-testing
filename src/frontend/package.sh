#!/bin/bash

DIST_DIR=../../dist
STATIC_DIR=${DIST_DIR}/static

if [ -d ${DIST_DIR} ]; then
  rm -r ${DIST_DIR}
fi

mkdir -p ${DIST_DIR}
mkdir -p ${STATIC_DIR}

cp -r build/client/* ${STATIC_DIR}
cp ../backend/*.py ${DIST_DIR}
