# Smart Banking Copilot

An enterprise-grade AI banking assistant leveraging Retrieval-Augmented Generation (RAG) to provide accurate, context-aware financial information and customer support. 

## Overview

This project is designed to simulate a modern banking chatbot. It uses Google's Gemini AI combined with a custom vector search implementation to ensure that the bot only answers specific banking questions (like interest rates and policies) based on verified local documents, avoiding hallucinations. General banking queries are handled dynamically using the model's core intelligence.

## Features

- Custom RAG Implementation: Reads from local text databases, computes cosine similarity, and feeds verified context to the LLM.
- Strict Safety Guidelines: Refuses to provide illegal investment advice and adheres to financial compliance rules.
- Analytics Dashboard: A secure, basic auth protected administrative panel to monitor chat history, user feedback, and API metrics.
- Resiliency: Implements exponential backoff and rate limiting to gracefully handle API quotas and server downtimes.
- Markdown Support: Renders complex data such as insurance plans and pricing tables cleanly in the frontend.

## Tech Stack

- Backend: Node.js, Express.js
- Database: SQLite3
- AI Integration: Google GenAI SDK
- Frontend: Vanilla JS, HTML, CSS, Marked.js

## Installation

1. Clone the repository:
   git clone https://github.com/SudeDemirci/Smart_Banking_Copilot.git
   cd Smart_Banking_Copilot

2. Install dependencies:
   npm install

3. Configure environment variables:
   Create a .env file in the root directory and add your Google API Key:
   GEMINI_API_KEY=your_api_key_here

4. Start the server:
   node server.js

5. Access the application:
   - Chatbot UI: http://localhost:4000
   - Admin Dashboard: http://localhost:4000/dashboard.html

## Security

The .env file and local SQLite databases are ignored by Git. Do not commit sensitive API keys.
