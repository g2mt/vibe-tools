BINDIR ?= /usr/bin

autolimitcpu: main.go
	go build -o autolimitcpu .

.PHONY: install
install: autolimitcpu
	install -m 0755 autolimitcpu $(BINDIR)/autolimitcpu
