const express = require("express");
const app = express();
const http = require("node:http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const { decryptToken } = require("./lib/socket");
require("dotenv").config();
const io = new Server(server, {
	cors: {
		origin: "*",
	},
});

const connections = new Map();
const users = new Map();
const socketInGroup = new Map();
const userSocket = new Map();
const port = process.env.PORT || 3002;

const bodyParser = require("body-parser");

app.use(bodyParser.json({ limit: "50mb" }));

// TODO: ChatId should be saved on the auth

function userIsAuthenticated(socket) {
	return connections.has(socket.id);
}

async function createMessage(data) {
	const response = await fetch(
		`${process.env.MAIN_API_URL}/api/chat/messages`,
		{
			body: JSON.stringify(data),
			method: "POST",
		}
	);

	if (response.ok) {
		const data = await response.json();
		return data;
	}
}

function sendNotificationToDisconnectedSockets(io, data, response) {
	io.fetchSockets().then((aliveClients) => {
		// Extract client IDs from aliveClients
		const aliveClientIds = aliveClients.map((client) => client.id);

		// Filter out clients that are already in the room
		const filteredClientIds = aliveClientIds.filter(
			(clientId) =>
				!io.sockets.adapter.rooms.get(data.chatId)?.has(clientId)
		);

		// Send notification to connected members not in the room
		for (let i = 0; i < filteredClientIds.length; i++) {
			const client = filteredClientIds[i];

			io.to(client).emit("notificationMessage", {
				message: response.message,
			});
		}
	});
}

io.on("connect", (socket) => {
	socket.on("auth", (data) => {
		const decryptedToken = decryptToken(data.token);
		if (!decryptedToken) return;

		connections.set(socket.id, socket);
		userSocket.set(decryptedToken.userId, socket.id);
		users.set(socket.id, { ...decryptedToken, socketId: socket.id });
	});

	socket.on("joinRoom", (data) => {
		socket.join(data.chatId);
		socketInGroup.set(socket.id, data.chatId);
	});

	socket.on("sendMessage", async (data) => {
		if (!userIsAuthenticated(socket)) return;

		// Pass the createdAt value to the createMessage function
		const response = await createMessage(data);

		if (response.message) {
			io.to(data.chatId).emit("receiveMessage", {
				...response.message,
				createdAt: data.createdAt,
			});
		}
		if (response.groupUsers) {
			sendNotificationToDisconnectedSockets(io, data, response);
		}
	});

	socket.on("setTyping", (data) => {
		if (!userIsAuthenticated(socket)) return;

		const userId = users.get(socket.id).id;

		io.to(data.chatId).emit("typing", { userId });
	});

	socket.on("serverForwardNotification", (data) => {
		io.to(userSocket.get(data.receiverUserId)).emit("newNotification", {
			message: data.message,
		});
	});

	socket.on("disconnect", () => {
		if (userIsAuthenticated(socket)) {
			connections.delete(socket.id);
			userSocket.delete(users.get(socket.id).id);
			users.delete(socket.id);
			socketInGroup.delete(socket.id);
		}
	});
});

server.listen(port, () => {});
