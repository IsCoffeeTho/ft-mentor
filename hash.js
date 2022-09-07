function Uint32ArrayAs(arr)
{
	var ints = new Uint32Array(arr.length);
	for (var i = 0; i < arr.length; i++)
	{
		ints[i] = arr[i];
	}
	return ints;
}

function hash(text="")
{	
	/*
		SHA-2 Wikipedia pseudo code implementation

		Note 1: All variables are 32 bit unsigned integers and addition is calculated modulo 2^(32)
		Note 2: For each round, there is one round constant k[i] and one entry in the message schedule array w[i], 0 <= i <= 63
		Note 3: The compression function uses 8 working variables, a through h
		Note 4: Big-endian convention is used when expressing the constants in this pseudocode,
			and when parsing message block data from bytes to words, for example,
			the first word of the input message "abc" after padding is 0x61626380
	*/

	var message = new Uint32Array(Math.ceil(text.length/4)).fill(0);

	// Initialize hash values:
	// (first 32 bits of the fractional parts of the square roots of the first 8 primes 2..19):
	for (var i = 0; i < text.length/4; i++)
		for (var j = 0; j < 4; j++)
			message[i] = (message[i] << 8) | (text.charCodeAt((i*4)+j) || 0x00);

	var H = Uint32ArrayAs([
		0x6a09e667,
		0xbb67ae85,
		0x3c6ef372,
		0xa54ff53a,
		0x510e527f,
		0x9b05688c,
		0x1f83d9ab,
		0x5be0cd19
	]);

	// Initialize array of round constants:
	// (first 32 bits of the fractional parts of the cube roots of the first 64 primes 2..311):
	var k = Uint32ArrayAs([
		0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
		0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
		0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
		0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
		0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
		0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
		0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
		0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
	]);

	// Pre-processing (Padding):
	var padded = new Uint32Array(Math.ceil((message.length+3)/16)*16).fill(0);
	for (var i = 0; i < message.length; i++)
		padded[i] = message[i];
	if ((text.length % 4) == 0)
		padded[message.length] = 0x80000000;
	else
		padded[message.length-1] = padded[message.length-1] | (0x80 << (3-(text.length % 4))*8);
	padded[padded.length-2] = text.length >> 29;
	padded[padded.length-1] = text.length << 3;

	// Process the message in successive 512-bit chunks:
	var blocks = [];
	for (var i = 0; i < (padded.length/16); i++)
	{
		blocks.push(new Uint32Array(16).fill(0));
		for (var j = 0; j < 16; j++)
			blocks[i][j] = padded[(i*16)+j];
	}
	for (var bi = 0; bi < blocks.length; bi++)
	{
		var w = new Uint32Array(64).fill(0);
		for (var i = 0; i < 16; i++)
			w[i] = blocks[bi][i];
		
		// Extend the first 16 words into the remaining 48 words w[16..63] of the message schedule array:
		for (var i = 16; i < 64; i++) 
		{
			var s0 = (w[i-15] >> 7) ^ (w[i-15] >> 18) ^ (w[i-15] >>> 3);
			var s1 = (w[i-2] >> 17) ^ (w[i-2] >> 19) ^ (w[i-2] >>> 10);
			w[i] = w[i-16] + s0 + w[i-7] + s1;
		}

		// Initialize working variables to current hash value:
		var a = H[0];
		var b = H[1];
		var c = H[2];
		var d = H[3];
		var e = H[4];
		var f = H[5];
		var g = H[6];
		var h = H[7];

		// Compression function main loop:
		for (var i = 0; i < 64; i++)
		{
			var S1 = (e >> 6) ^ (e >> 11) ^ (e >> 25);
			var ch = (e & f) ^ ((~e) & g);
			var temp1 = h + S1 + ch + k[i] + w[i];
			var S0 = (a >> 2) ^ (a >> 13) ^ (a >> 22);
			var maj = (a & b) ^ (a & c) ^ (b & c);
			var temp2 = S0 + maj;
			
			h = g;
			g = f;
			f = e;
			e = (d + temp1) >>> 0;
			d = c;
			c = b;
			b = a;
			a = (temp1 + temp2) >>> 0;
		}

		// Add the compressed chunk to the current hash value:
		H[0] = (H[0]+a) >>> 0;
		H[1] = (H[1]+b) >>> 0;
		H[2] = (H[2]+c) >>> 0;
		H[3] = (H[3]+d) >>> 0;
		H[4] = (H[4]+e) >>> 0;
		H[5] = (H[5]+f) >>> 0;
		H[6] = (H[6]+g) >>> 0;
		H[7] = (H[7]+h) >>> 0;
	}

	// Produce the final hash value (big-endian):
	return `${H[0].toString(16)}${H[1].toString(16)}${H[2].toString(16)}${H[3].toString(16)}${H[4].toString(16)}${H[5].toString(16)}${H[6].toString(16)}${H[7].toString(16)}`;
}

module.exports = hash;