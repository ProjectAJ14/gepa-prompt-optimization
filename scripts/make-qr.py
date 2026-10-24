#!/usr/bin/env python3
"""Write a QR code as an SVG, with no dependencies.

    python3 scripts/make-qr.py "https://www.linkedin.com/in/ajaykumar2114/" src/linkedin-qr.svg
    python3 scripts/make-qr.py <text> <out.svg> --png check.png     # also a PNG, to test with a scanner

It encodes one fixed shape: version 3 (29 by 29 modules), error correction level M, byte mode, which holds up to 42 bytes.
That is enough for a profile link and keeps the modules big enough to scan from the back of a room. The layout follows the
QR Code specification (ISO/IEC 18004); the whole thing is checked by decoding the output with a real scanner, see CLAUDE.md.
"""
import struct, sys, zlib

SIZE, DATA_CW, EC_CW, CAPACITY = 29, 44, 26, 42
ALIGN = (22, 22)  # the only alignment pattern a version 3 code has


def gf_mul(x, y):
    z = 0
    for i in range(7, -1, -1):
        z = (z << 1) ^ ((z >> 7) * 0x11D)
        z ^= ((y >> i) & 1) * x
    return z


def rs_divisor(degree):
    result = [0] * (degree - 1) + [1]
    root = 1
    for _ in range(degree):
        for j in range(degree):
            result[j] = gf_mul(result[j], root)
            if j + 1 < degree:
                result[j] ^= result[j + 1]
        root = gf_mul(root, 2)
    return result


def rs_remainder(data, divisor):
    result = [0] * len(divisor)
    for b in data:
        factor = b ^ result.pop(0)
        result.append(0)
        for i, c in enumerate(divisor):
            result[i] ^= gf_mul(c, factor)
    return result


def codewords(payload: bytes):
    if len(payload) > CAPACITY:
        sys.exit(f"{len(payload)} bytes is too long: this encoder holds {CAPACITY}")
    bits = "0100" + format(len(payload), "08b") + "".join(format(b, "08b") for b in payload)
    bits += "0" * min(4, DATA_CW * 8 - len(bits))
    bits += "0" * (-len(bits) % 8)
    data = [int(bits[i:i + 8], 2) for i in range(0, len(bits), 8)]
    pad = (0xEC, 0x11)
    while len(data) < DATA_CW:
        data.append(pad[(len(data) - len(bits) // 8) % 2])
    return data + rs_remainder(data, rs_divisor(EC_CW))


MASKS = [
    lambda i, j: (i + j) % 2 == 0, lambda i, j: i % 2 == 0, lambda i, j: j % 3 == 0, lambda i, j: (i + j) % 3 == 0,
    lambda i, j: (i // 2 + j // 3) % 2 == 0, lambda i, j: (i * j) % 2 + (i * j) % 3 == 0,
    lambda i, j: ((i * j) % 2 + (i * j) % 3) % 2 == 0, lambda i, j: ((i + j) % 2 + (i * j) % 3) % 2 == 0,
]


def build(payload: bytes):
    cws = codewords(payload)
    best = None
    for mask in range(8):
        m = [[False] * SIZE for _ in range(SIZE)]
        fn = [[False] * SIZE for _ in range(SIZE)]

        def put(x, y, dark):  # x is the column, y the row
            m[y][x] = dark
            fn[y][x] = True

        for i in range(SIZE):  # timing patterns
            put(6, i, i % 2 == 0)
            put(i, 6, i % 2 == 0)
        for cx, cy in ((3, 3), (SIZE - 4, 3), (3, SIZE - 4)):  # finder patterns with their light borders
            for dy in range(-4, 5):
                for dx in range(-4, 5):
                    x, y = cx + dx, cy + dy
                    if 0 <= x < SIZE and 0 <= y < SIZE:
                        put(x, y, max(abs(dx), abs(dy)) not in (2, 4))
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                put(ALIGN[0] + dx, ALIGN[1] + dy, max(abs(dx), abs(dy)) != 1)
        # Format bits: error correction level M is 00, then the mask number, with a BCH code and a fixed XOR.
        data5 = (0b00 << 3) | mask
        rem = data5
        for _ in range(10):
            rem = (rem << 1) ^ ((rem >> 9) * 0x537)
        fb = ((data5 << 10) | rem) ^ 0x5412
        bit = lambda i: ((fb >> i) & 1) != 0
        for i in range(6):
            put(8, i, bit(i))
        put(8, 7, bit(6)); put(8, 8, bit(7)); put(7, 8, bit(8))
        for i in range(9, 15):
            put(14 - i, 8, bit(i))
        for i in range(8):
            put(SIZE - 1 - i, 8, bit(i))
        for i in range(8, 15):
            put(8, SIZE - 15 + i, bit(i))
        put(8, SIZE - 8, True)  # the one always-dark module
        # Data, zigzag from the bottom right, two columns at a time, skipping the vertical timing column.
        k, total = 0, len(cws) * 8
        right = SIZE - 1
        while right >= 1:
            if right == 6:
                right = 5
            for vert in range(SIZE):
                for j in range(2):
                    x = right - j
                    y = SIZE - 1 - vert if ((right + 1) & 2) == 0 else vert
                    if not fn[y][x] and k < total:
                        m[y][x] = ((cws[k >> 3] >> (7 - (k & 7))) & 1) != 0
                        k += 1
            right -= 2
        for y in range(SIZE):
            for x in range(SIZE):
                if not fn[y][x] and MASKS[mask](y, x):
                    m[y][x] = not m[y][x]
        score = penalty(m)
        if best is None or score < best[0]:
            best = (score, m, mask)
    return best[1], best[2]


def penalty(m):
    s = 0
    lines = ["".join("1" if c else "0" for c in row) for row in m] + ["".join("1" if m[y][x] else "0" for y in range(SIZE)) for x in range(SIZE)]
    for line in lines:
        run = 1
        for a, b in zip(line, line[1:]):
            run = run + 1 if a == b else 1
            if run == 5:
                s += 3
            elif run > 5:
                s += 1
        padded = "0000" + line + "0000"
        s += 40 * (padded.count("10111010000") + padded.count("00001011101"))
    for y in range(SIZE - 1):
        for x in range(SIZE - 1):
            if m[y][x] == m[y][x + 1] == m[y + 1][x] == m[y + 1][x + 1]:
                s += 3
    dark = sum(c for row in m for c in row)
    total = SIZE * SIZE
    s += 10 * (((abs(dark * 20 - total * 10) + total - 1) // total) - 1)
    return s


def svg(m, border=4, dark="#000", light="#fff"):
    n = SIZE + 2 * border
    d = []
    for y, row in enumerate(m):
        x = 0
        while x < SIZE:
            if row[x]:
                w = 1
                while x + w < SIZE and row[x + w]:
                    w += 1
                d.append(f"M{x + border} {y + border}h{w}v1h-{w}z")
                x += w
            else:
                x += 1
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n} {n}" shape-rendering="crispEdges" role="img" aria-label="QR code">'
            f'<rect width="{n}" height="{n}" fill="{light}"/><path fill="{dark}" d="{"".join(d)}"/></svg>\n')


def png(m, scale=12, border=4):
    n = (SIZE + 2 * border) * scale
    rows = []
    for py in range(n):
        y = py // scale - border
        row = bytearray([0])
        for px in range(n):
            x = px // scale - border
            row.append(0 if 0 <= x < SIZE and 0 <= y < SIZE and m[y][x] else 255)
        rows.append(bytes(row))
    raw = b"".join(rows)
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", n, n, 8, 0, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    text, out = sys.argv[1], sys.argv[2]
    matrix, mask = build(text.encode("utf-8"))
    open(out, "w").write(svg(matrix))
    if "--png" in sys.argv:
        open(sys.argv[sys.argv.index("--png") + 1], "wb").write(png(matrix))
    print(f"{out}: {SIZE}x{SIZE} modules, mask {mask}, {len(text.encode())} bytes")
