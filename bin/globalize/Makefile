DEBUG   ?= 0

CFLAGS  := $(shell pkg-config --cflags raylib) -Wall -Wextra
LDFLAGS := $(shell pkg-config --libs raylib) -lm
TARGET  := globalize

ifeq ($(DEBUG),1)
  CFLAGS += -g -fsanitize=address
  LDFLAGS += -fsanitize=address
else
  CFLAGS += -O2
endif

all: $(TARGET)

$(TARGET): main.c
	$(CC) $(CFLAGS) -o $@ $^ $(LDFLAGS)

clean:
	rm -f $(TARGET)

.PHONY: all clean
