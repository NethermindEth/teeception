#!/bin/bash

# Start twitter client in background and redirect logs
cd /app/twitter
npm start > /dev/stdout 2>&1 &

sleep 5

# Start agent in foreground
/app/agent
