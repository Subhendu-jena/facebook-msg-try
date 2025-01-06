const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.status(200).json({ message: "App is running successfully" })
})

// Verify Webhook
app.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Handle Webhook Events
app.post('/webhook', (req, res) => {
  const body = req.body;
  let senderId
  if (body.object === 'page') {
    body.entry.forEach(entry => {
      const event = entry.messaging[0];
      if (event.message) {
        senderId = event.sender.id;
        console.log(`Received message from User ID: ${senderId} `);
        handleMessage(event.sender.id, event.message);
      }
    });
    res.status(200).send(`EVENT_RECEIVED: ${senderId}`);
  } else {
    res.sendStatus(404);
  }
});

// Send Messages
async function handleMessage(senderId, receivedMessage) {
  console.log(`Received message from User ID: ${senderId}`);
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

  let response;

  if (receivedMessage.text) {
    response = {
      text: `You said: "${receivedMessage.text}"`
    };
  }

  await axios.post(
    `https://graph.facebook.com/v12.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
    {
      recipient: { id: senderId },
      message: response,
    }
  );
}

// Helper function to fetch messages for a thread ID
async function fetchMessages(threadId) {
  try {
    // Fetch the list of message IDs for the given thread
    const threadResponse = await axios.get(`https://graph.facebook.com/v12.0/${threadId}/messages`, {
      params: {
        access_token: PAGE_ACCESS_TOKEN,
      },
    });

    const messagesData = threadResponse.data.data;
    const formattedMessages = [];

    // Fetch details for each message ID
    for (const message of messagesData) {
      const messageDetails = await axios.get(`https://graph.facebook.com/v12.0/${message.id}`, {
        params: {
          fields: 'message,attachments,from,created_time',
          access_token: PAGE_ACCESS_TOKEN,
        },
      });

      formattedMessages.push(messageDetails.data);
    }

    return formattedMessages;
  } catch (error) {
    console.error('Error fetching messages:', error.response?.data || error.message);
    throw new Error('Failed to fetch messages.');
  }
}

// API route to fetch and return formatted messages
app.get('/messages/:threadId', async (req, res) => {
  const { threadId } = req.params;

  try {
    const messages = await fetchMessages(threadId);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
