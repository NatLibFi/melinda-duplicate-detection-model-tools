tail training.txt
cat training.txt | grep "^iter" | cut -f2,4 -d' ' > table.txt && Rscript plot.r 
