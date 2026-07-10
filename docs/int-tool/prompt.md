Write an integer/float visualization tool in plain HTML, CSS and JS into this directory's index.html, style.css, script.js.

The page has the following rows in the central widget:

row 1: an input box that takes in a decimal int/float, or hexadecimal (starting with 0x), or octal (starting with 0o). if you cant parse it, then keep showing the last result as is and highlight the input box as red.

row 2: a "binary visualization area" showing the above number as its binary representation.
  - each column will be a bit. at the bottom of each bit, show the column index as a single decimal number (0th bit at the right most column). separate columns in groups of 8 bits with left/right margin to distinguish the bytes. pad the number with 0-bits to the nearest multiple of 8.

row 3:

  - column 1: data structure. here the user can choose which data structure to represent and reinterpret the bits of number as. these include: unsigned/signed 8/16/32/64 bit integers, float (f32) and double (f64).
      when chosen, highlight the important bits of chosen structure in the "binary visualization area" : the sign bit for integers, or the sign/exponent/fraction bits for floats

  - column 2: based on the chosen structure, show a human representation list with theses variants:
    - decimal (int/float)
    - hex (int only)
    - octal (int only)
    - little endian (both): make it look like this: 00 11 22 A8
    - big endian: same as little endian

