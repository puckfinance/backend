# Strategy Upload Feature

This document describes the implementation of the strategy upload feature that allows users to create strategies by uploading CSV files.

## Overview

The strategy upload feature enables users to:
- Create strategies with name, description, and CSV file upload
- Validate CSV files before processing
- View strategy statistics and CSV data information
- Update existing strategies (including replacing CSV files)
- Delete strategies and associated files

## API Endpoints

### POST `/api/v1/strategies`
Create a new strategy with CSV file upload.

**Headers:**
- `Authorization: Bearer <JWT_TOKEN>`
- `Content-Type: multipart/form-data`

**Body (Form Data):**
- `name` (string, required): Strategy name
- `description` (string, required): Strategy description  
- `file` (file, required): CSV file upload

**Response:**
```json
{
  "message": "Strategy created successfully",
  "strategy": {
    "id": "uuid",
    "name": "My Strategy",
    "description": "Strategy description",
    "fileUrl": "uploads/strategies/strategy-timestamp-random.csv",
    "fileName": "original-file.csv",
    "fileSize": 1024,
    "csvStats": {
      "rowCount": 100,
      "columnCount": 5,
      "headers": ["date", "signal", "price", "volume", "return"]
    },
    "owner": {
      "id": "user-id",
      "email": "user@example.com"
    },
    "createdAt": "2023-01-01T00:00:00Z",
    "updatedAt": "2023-01-01T00:00:00Z"
  }
}
```

### GET `/api/v1/strategies`
Get all strategies for the authenticated user.

**Headers:**
- `Authorization: Bearer <JWT_TOKEN>`

**Response:**
```json
{
  "strategies": [
    {
      "id": "uuid",
      "name": "My Strategy",
      "description": "Strategy description",
      "fileUrl": "uploads/strategies/strategy-timestamp-random.csv",
      "fileName": "original-file.csv",
      "connectedAccounts": 2,
      "owner": {
        "id": "user-id",
        "email": "user@example.com"
      },
      "createdAt": "2023-01-01T00:00:00Z",
      "updatedAt": "2023-01-01T00:00:00Z"
    }
  ]
}
```

### GET `/api/v1/strategies/:id`
Get a specific strategy by ID.

**Headers:**
- `Authorization: Bearer <JWT_TOKEN>`

**Response:**
```json
{
  "strategy": {
    "id": "uuid",
    "name": "My Strategy",
    "description": "Strategy description",
    "fileUrl": "uploads/strategies/strategy-timestamp-random.csv",
    "fileName": "original-file.csv",
    "owner": {
      "id": "user-id",
      "email": "user@example.com"
    },
    "tradeAccount": [],
    "createdAt": "2023-01-01T00:00:00Z",
    "updatedAt": "2023-01-01T00:00:00Z"
  }
}
```

### PUT `/api/v1/strategies/:id`
Update an existing strategy.

**Headers:**
- `Authorization: Bearer <JWT_TOKEN>`
- `Content-Type: multipart/form-data`

**Body (Form Data):**
- `name` (string, optional): Updated strategy name
- `description` (string, optional): Updated strategy description
- `file` (file, optional): New CSV file to replace existing one

### DELETE `/api/v1/strategies/:id`
Delete a strategy and its associated CSV file.

**Headers:**
- `Authorization: Bearer <JWT_TOKEN>`

**Response:**
```json
{
  "message": "Strategy deleted successfully"
}
```

### GET `/api/v1/strategies/:id/csv-stats`
Get detailed CSV statistics for a strategy.

**Headers:**
- `Authorization: Bearer <JWT_TOKEN>`

**Response:**
```json
{
  "csvStats": {
    "rowCount": 100,
    "columnCount": 5,
    "headers": ["date", "signal", "price", "volume", "return"],
    "fileSize": 1024,
    "sampleData": [
      ["2023-01-01", "BUY", "100.50", "1000", "0.05"],
      ["2023-01-02", "SELL", "102.00", "800", "0.03"]
    ]
  }
}
```

## File Upload Configuration

- **Allowed file types:** CSV only (`.csv` extension and `text/csv` MIME type)
- **File size limit:** 5MB
- **Storage location:** `uploads/strategies/`
- **Filename format:** `strategy-{timestamp}-{random}.csv`

## CSV Validation

The system validates uploaded CSV files for:
- Non-empty file content
- Presence of headers
- Data consistency (row column count matching headers)
- Reasonable file size (max 10,000 rows)
- Proper CSV format

## Error Handling

Common error responses:

**400 Bad Request:**
```json
{
  "message": "Invalid CSV file",
  "errors": [
    "CSV file must have headers",
    "Row 3 has 4 columns but expected 5"
  ]
}
```

**401 Unauthorized:**
```json
{
  "message": "Unauthorized"
}
```

**404 Not Found:**
```json
{
  "message": "Strategy not found"
}
```

**413 Payload Too Large:**
```json
{
  "message": "File too large"
}
```

## Frontend Integration

### HTML Form Example

```html
<form action="/api/v1/strategies" method="POST" enctype="multipart/form-data">
  <input type="text" name="name" placeholder="Strategy Name" required>
  <textarea name="description" placeholder="Strategy Description" required></textarea>
  <input type="file" name="file" accept=".csv" required>
  <button type="submit">Create Strategy</button>
</form>
```

### JavaScript Example

```javascript
const formData = new FormData();
formData.append('name', 'My Trading Strategy');
formData.append('description', 'A momentum-based trading strategy');
formData.append('file', csvFile); // File object from input

fetch('/api/v1/strategies', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
})
.then(response => response.json())
.then(data => console.log(data));
```

## Security Features

- JWT authentication required for all endpoints
- Users can only access their own strategies
- File type validation to prevent malicious uploads
- Automatic cleanup of invalid files
- File size limits to prevent abuse

## Database Schema

The strategy upload feature uses the existing `Strategy` model:

```prisma
model Strategy {
  id                   String         @id @default(uuid())
  createdAt            DateTime       @default(now())
  updatedAt            DateTime       @updatedAt
  name                 String
  description          String
  owner                User           @relation(fields: [ownerId], references: [id])
  ownerId              String
  fileUrl              String?        // Stores CSV file path
  averageMonthlyReturn Float?
  tradeAccount         TradeAccount[]
}
```

## Files Created/Modified

### New Files:
- `src/controllers/StrategyController.ts` - Main controller handling strategy CRUD operations
- `src/interfaces/Strategy.ts` - TypeScript interfaces for strategy DTOs
- `src/services/csvProcessor.ts` - CSV parsing and validation service

### Modified Files:
- `src/routes/index.ts` - Added strategy routes
- `.gitignore` - Added uploads directory exclusion

## Next Steps

Consider implementing:
- CSV data preview endpoint
- Strategy performance calculation from CSV data
- Bulk strategy import
- CSV format templates
- Advanced CSV validation rules based on strategy types 