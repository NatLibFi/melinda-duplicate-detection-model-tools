data <- read.table('table.txt')

png(file="training-plot.png", bg="white")


plot(data, type="n")
lines(data)

dev.off()