# File Upload System - Debugging Guide

## Current Issue Analysis

You mentioned that files are not appearing in your storage VPS. Here's how to debug:

## Storage System Clarification

**The current implementation:**
- ✅ Uploads files to SFTP storage VPS only
- ❌ Does NOT store in database (unless you add the optional database features)

Files should appear at: `/home/{your-sftp-username}/documents/{document-type}/`

## Debugging Steps

### 1. Test SFTP Connection
Run this to test your connection:

```bash
cd d:\property-pal
node -r ts-node/register api/upload/test-sftp.ts
```

### 2. Check Environment Variables
Verify your `.env` file has correct values:
```env
SFTP_HOST=your_sftp_host
SFTP_USER=your_sftp_username
SFTP_PASS=your_sftp_password
SFTP_PORT=22
```

### 3. Check Logs
With the new logging added, you'll see detailed logs like:
```
[a1b2c3d4] Starting file upload process
[a1b2c3d4] Environment check - Host: your_host, Port: 22, User: your_user, Pass: [SET]
[a1b2c3d4] Received file: test.pdf, size: 12345 bytes
[a1b2c3d4] Document type: contracts
[a1b2c3d4] File validation passed
[a1b2c3d4] Generated filename: 123e4567-e89b-12d3-a456-426614174000.pdf
[a1b2c3d4] Remote directory: /home/your_username/documents/contracts
[a1b2c3d4] Connecting to SFTP server: your_username@your_host:22
[a1b2c3d4] SFTP connection established
[a1b2c3d4] SFTP session created
[a1b2c3d4] Creating remote directory: /home/your_username/documents/contracts
[a1b2c3d4] Directory created successfully: /home/your_username/documents/contracts
[a1b2c3d4] Starting file transfer to /home/your_username/documents/contracts/filename.pdf
[a1b2c3d4] File uploaded successfully to /home/your_username/documents/contracts/filename.pdf
```

### 4. Check for Error Logs
Look for errors in console like:
- Connection timeouts
- Authentication failures
- Permission issues
- Directory creation failures

### 5. Manual SFTP Test
Test manually with an SFTP client:
```bash
sftp your_username@your_host
# Enter password
cd /home/your_username/documents
ls -la
```

### 6. Check Server-side
SSH into your VPS and check:
```bash
ssh your_username@your_host
ls -la /home/your_username/documents/
ls -la /home/your_username/documents/contracts/
```

## Common Issues

### 1. **Authentication Problems**
- Double-check username/password
- Some VPS providers require key-based auth instead of password

### 2. **Path Issues**
- The directory structure might be different
- Try uploading to root first: `/home/your_username/test.txt`

### 3. **Permissions**
- The user might not have write permissions to `/home/your_username/documents/`
- Try creating the directory manually first

### 4. **Network/Firewall**
- Port 22 might be blocked
- Try different port if provider uses non-standard SSH port

## Optional: Add Database Storage

If you want to track uploaded files in your database as well, use the database functions in `src/lib/fileDatabase.ts`.

Add this to your upload route after successful SFTP upload:

```typescript
// Optional: Store file info in database
await saveFileRecord({
  fileName: generatedFileName,
  category: docType as DocumentCategory,
  cloudPath: remotePath,
  uploadedBy: 'user@example.com',
  fileSize: formatFileSize(file.size)
});
```

## Security Notes

- Never commit actual credentials to version control
- Use environment variables for all sensitive information
- Rotate credentials periodically
- Use SSH keys instead of passwords when possible

```typescript
// After successful SFTP upload
await saveFileMetadata(supabaseClient, {
  filename: newFilename,
  original_filename: file.name,
  document_type: documentType,
  file_size: file.size,
  file_extension: fileExtension,
  sftp_path: remotePath
});
```

## Test the Upload

1. Start your development server
2. Use the upload form 
3. Check console for detailed logs
4. Check your VPS for the uploaded file

Let me know what the logs show and we can debug from there!