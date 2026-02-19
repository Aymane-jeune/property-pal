# File Upload System Documentation

## Overview
This system provides secure file uploads to your InterServer ST-100 storage VPS using SFTP. Files are organized by document type and stored with unique filenames to prevent collisions.

## Setup

### 1. Environment Variables
Ensure your `.env` file contains:
```env
SFTP_HOST=your_sftp_host
SFTP_USER=your_sftp_username  
SFTP_PASS=your_actual_password
SFTP_PORT=22
```

### 2. Dependencies
The system uses the following packages:
- `ssh2` - SFTP client for Node.js
- `@types/ssh2` - TypeScript types for ssh2

## Document Types
The system supports 5 document types:
- `contracts` - PDF, DOCX files
- `photos` - PDF, DOCX, JPG, PNG files  
- `client-files` - PDF, DOCX files
- `condition-reports` - PDF, DOCX files
- `supplier-reports` - PDF, DOCX files

## File Structure
Files are uploaded to:
```
/home/{username}/documents/{documentType}/
```

## API Route

### Endpoint: `POST /api/upload`

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  - `file` (File) - The file to upload
  - `documentType` (string) - One of the allowed document types

**Response:**
```json
{
  "success": true,
  "filename": "generated-uuid.pdf",
  "documentType": "contracts"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error message"
}
```

## React Usage

### Basic Upload Function
```typescript
import { uploadFile } from '@/hooks/useFileUpload';

const handleUpload = async (file: File, documentType: string) => {
  const result = await uploadFile({ file, documentType });
  
  if (result.success) {
    console.log('Uploaded:', result.filename);
  } else {
    console.error('Upload failed:', result.error);
  }
};
```

### Hook with State Management
```typescript
import { useFileUpload } from '@/hooks/useFileUpload';

function MyComponent() {
  const { upload, isUploading, error } = useFileUpload();
  
  const handleSubmit = async () => {
    await upload({ file, documentType: 'contracts' });
  };
  
  return (
    <div>
      {isUploading && <div>Uploading...</div>}
      {error && <div>Error: {error}</div>}
      <button onClick={handleSubmit}>Upload</button>
    </div>
  );
}
```

## Validation Rules

### File Size
- Maximum: 10MB per file

### File Types
- **All document types:** PDF, DOCX
- **Photos only:** Additionally allows JPG, JPEG, PNG

### Security Features
- Files are renamed using crypto.randomUUID() to prevent collisions
- File type validation on both client and server
- SFTP connection properly closed after each operation
- Temporary files are cleaned up after upload

## Error Handling
The system handles:
- Missing credentials
- Invalid file types
- File size limits
- SFTP connection errors
- Directory creation failures
- File upload failures

All errors are properly logged and returned to the client with appropriate HTTP status codes.

## Production Considerations
1. Ensure SFTP credentials are kept secure
2. Monitor disk space on the storage server
3. Consider implementing file cleanup policies
4. Add logging/monitoring for upload failures
5. Consider rate limiting for the API endpoint
6. Verify SSL/TLS configuration for production deployments