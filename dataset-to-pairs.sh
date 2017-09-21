#!/bin/bash
cat - | grep "^001\|^245" | sed 'N;s/\n/ /g' | sed '0~2 a\\'
