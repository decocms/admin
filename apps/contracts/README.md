# Smart Contract System

A Smart Contract system for marketplace apps that enables contract signing, authorization, and settlement of payments for app usage.

## Overview

This smart contract app allows business users to:
1. **Install apps** from the marketplace that expose contract terms
2. **Authorize charges** based on contract clauses using transactionId
3. **Settle payments** for authorized charges

## Contract Structure

### State Schema
The contract maintains minimal state with just:
- `clauses`: Array of contract clauses with pricing

### Clause Structure
Each clause contains:
- `id`: Unique clause identifier
- `price`: Price per unit (in cents/smallest currency unit)
- `description`: Human-readable description
- `usedByTools`: Array of tool names that use this clause

## Tools

### AUTHORIZE
Creates a payment authorization for a contract clause with transactionId.

**Input:**
```json
{
  "clauseId": "api_calls",
  "amount": 100
}
```

**Output:**
```json
{
  "transactionId": "txn_1234567890_api_calls",
  "clauseId": "api_calls",
  "amount": 100,
  "calculatedPrice": 500,
  "timestamp": 1234567890,
  "success": true,
  "message": "Successfully authorized clause api_calls for amount: 500"
}
```

### SETTLE
Processes payment for an authorized charge using transactionId.

**Input:**
```json
{
  "transactionId": "txn_1234567890_api_calls"
}
```

**Output:**
```json
{
  "transactionId": "txn_1234567890_api_calls",
  "success": true,
  "message": "Successfully settled transaction txn_1234567890_api_calls"
}
```

## Usage Flow

1. **App Installation**: Business user installs app with contract clauses
2. **Authorization**: App calls `AUTHORIZE` tool when features are used (creates transactionId)
3. **Settlement**: App calls `SETTLE` tool with transactionId to process payment

## Key Features

- **Simple State**: Only stores contract clauses, no complex state management
- **Transaction ID**: Each authorization gets a unique transactionId for wallet integration
- **Stateless Operations**: Authorization and settlement are handled by wallet API
- **Wallet Ready**: Designed to integrate with wallet API using transactionId

## Development

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Deploy
npm run deploy
```
