BINDIR ?= /usr/bin

autolimitcpu: main.c
	gcc -Wall -Wextra -std=c11 -O2 -o autolimitcpu main.c

.PHONY: install
install: autolimitcpu
	install -m 0755 autolimitcpu $(BINDIR)/autolimitcpu
