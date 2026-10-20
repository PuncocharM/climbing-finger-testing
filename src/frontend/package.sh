#!/bin/bash

DIST_DIR=../../dist
STATIC_DIR=${DIST_DIR}/static

if [ -d ${DIST_DIR} ]; then
  rm -r ${DIST_DIR}
fi

mkdir -p ${DIST_DIR}
mkdir -p ${STATIC_DIR}

cp -r build/client/* ${STATIC_DIR}
cp -r ../backend/src/backend/* ${DIST_DIR}
cp ../backend/src/backend/config.dist.py ${DIST_DIR}/config.py
mkdir ${DIST_DIR}/../output_data
