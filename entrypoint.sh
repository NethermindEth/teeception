#!/bin/bash

# Start twitter client in background
cd /app/twitter
npm start &

# Start agent in foreground
/app/agent
