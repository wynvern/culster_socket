const { createHash, createDecipheriv } = require("crypto");

const ENCRYPTION_KEY = "iiiiiiiiiiiiiiiiiiiiiiiiiiiiii";

function decryptToken(encryptedToken) {
	// Check if the token is missing or empty
	if (!encryptedToken) {
		return false;
	}

	try {
		let [iv, encryptedText] = encryptedToken.split(":");
		if (!iv || !encryptedText) {
			// If the token format is violated (missing parts)
			return false;
		}

		let ivBuffer = Buffer.from(iv, "hex");
		let hash = createHash("sha256")
			.update(String(ENCRYPTION_KEY))
			.digest("base64")
			.substr(0, 32);
		let decipher = createDecipheriv(
			"aes-256-cbc",
			Buffer.from(hash, "utf-8"),
			ivBuffer
		);
		let decrypted = decipher.update(Buffer.from(encryptedText, "hex"));
		decrypted = Buffer.concat([decrypted, decipher.final()]);

		return JSON.parse(decrypted.toString());
	} catch (error) {
		// If decryption fails or any other error occurs
		return false;
	}
}

module.exports = { decryptToken };
