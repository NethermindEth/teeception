#! /bin/bash

set -e

KO_DOCKER_REPO=ko.local ko build ./cmd/agent
