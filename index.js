const express = require("express");
const app = express();
const http = require("node:http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const { decryptToken } = require("./lib/socket");
const io = new Server(server);

const connections = new Map();
const users = new Map();

const bodyParser = require("body-parser");

app.use(bodyParser.json({ limit: "50mb" }));

// TODO: ChatId should be saved on the auth

function userIsAuthenticated(socket) {
	return connections.has(socket.id);
}

async function createMessage(data) {
	const response = await fetch("http://localhost:3000/api/chat/messages", {
		body: JSON.stringify(data),
		method: "POST",
	});

	if (response.ok) {
		const message = await response.json();
		io.to(data.chatId).emit("receiveMessage", message);
	}
}

io.on("connect", (socket) => {
	socket.on("auth", (data) => {
		const decryptedToken = decryptToken(data.token);
		if (!decryptedToken) return;

		connections.set(socket.id, socket);
		users.set(socket.id, decryptedToken);
		socket.join(data.chatId);
	});

	socket.on("sendMessage", async (data) => {
		if (!userIsAuthenticated(socket)) return;

		const message = await createMessage(data);
		if (message) {
			io.to(data.chatId).emit("receiveMessage", message);
		}
	});

	socket.on("setTyping", (data) => {
		if (!userIsAuthenticated(socket)) return;

		console.log("typing", data);

		const userId = users.get(socket.id).id;

		io.to(data.chatId).emit("typing", { userId });
	});

	socket.on("disconnect", () => {
		if (userIsAuthenticated(socket)) {
			connections.delete(socket.id);
			users.delete(socket.id);
		}
	});
});

server.listen(3002, () => {
	console.log("listening on *:3002");
});
