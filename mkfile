#!/usr/bin/env bash

set -xe

fmt:
  pnpm run fmt

cs:
  pnpm changeset

t:
  pnpm run test $@

b:
  pnpm run build

d:
  pnpm run dev

h:
  mk -P targets "*"
