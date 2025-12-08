#!/bin/bash
set -e

export DISPLAY=:99

rm -rf /tmp/.X99-lock

Xvfb ${DISPLAY} -screen 0 1280x720x24 &

sleep 1

exec npm start
