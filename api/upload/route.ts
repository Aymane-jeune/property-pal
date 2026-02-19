import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'ssh2';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// Configuration constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_DOCUMENT_TYPES = [
  'contracts',
  'photos',
  'client-files',
  'condition-reports',
  'supplier-reports',
] as const;

const ALLOWED_EXTENSIONS = {
  general: ['pdf', 'docx'],
  photos: ['pdf', 'docx', 'jpg', 'jpeg', 'png'],
};

type DocumentType = typeof ALLOWED_DOCUMENT_TYPES[number];

interface UploadResponse {
  success: boolean;
  filename?: string;
  documentType?: string;
  error?: string;
}

// Helper function to get file extension
function getFileExtension(filename: string): string {
  return path.extname(filename).toLowerCase().slice(1);
}

// Helper function to validate file
function validateFile(file: File, documentType: DocumentType): { isValid: boolean; error?: string } {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return { isValid: false, error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` };
  }

  // Check document type
  if (!ALLOWED_DOCUMENT_TYPES.includes(documentType)) {
    return { isValid: false, error: 'Invalid document type' };
  }

  // Check file extension
  const extension = getFileExtension(file.name);
  const allowedExtensions = documentType === 'photos' 
    ? ALLOWED_EXTENSIONS.photos 
    : ALLOWED_EXTENSIONS.general;

  if (!allowedExtensions.includes(extension)) {
    return { 
      isValid: false, 
      error: `Invalid file extension. Allowed: ${allowedExtensions.join(', ')}` 
    };
  }

  return { isValid: true };
}

// Helper function to create SFTP directory
function createRemoteDirectory(sftp: any, remotePath: string, uploadId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`[${uploadId}] Creating remote directory: ${remotePath}`);
    sftp.mkdir(remotePath, { mode: 0o755 }, (err: any) => {
      if (err && err.code !== 4) { // Code 4 means directory already exists
        console.error(`[${uploadId}] Failed to create directory: ${err.message}`);
        reject(err);
      } else {
        if (err && err.code === 4) {
          console.log(`[${uploadId}] Directory already exists: ${remotePath}`);
        } else {
          console.log(`[${uploadId}] Directory created successfully: ${remotePath}`);
        }
        resolve();
      }
    });
  });
}

// Helper function to upload file via SFTP
function uploadToSFTP(
  host: string,
  port: number,
  username: string,
  privateKey: Buffer,
  localPath: string,
  remotePath: string,
  remoteDir: string,
  uploadId: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`[${uploadId}] Connecting to SFTP server: ${username}@${host}:${port}`);
    const conn = new Client();

    conn.on('ready', () => {
      console.log(`[${uploadId}] SFTP connection established`);
      conn.sftp((err, sftp) => {
        if (err) {
          console.error(`[${uploadId}] Failed to create SFTP session: ${err.message}`);
          conn.end();
          reject(err);
          return;
        }

        console.log(`[${uploadId}] SFTP session created`);

        // Create directory if it doesn't exist
        createRemoteDirectory(sftp, remoteDir, uploadId)
          .then(() => {
            console.log(`[${uploadId}] Starting file transfer from ${localPath} to ${remotePath}`);
            // Upload file
            sftp.fastPut(localPath, remotePath, (err) => {
              sftp.end();
              conn.end();
              if (err) {
                console.error(`[${uploadId}] File upload failed: ${err.message}`);
                reject(err);
              } else {
                console.log(`[${uploadId}] File uploaded successfully to ${remotePath}`);
                resolve();
              }
            });
          })
          .catch((dirErr) => {
            console.error(`[${uploadId}] Directory creation failed: ${dirErr.message}`);
            sftp.end();
            conn.end();
            reject(dirErr);
          });
      });
    });

    conn.on('error', (err) => {
      console.error(`[${uploadId}] SFTP connection error: ${err.message}`);
      reject(err);
    });

    conn.on('close', () => {
      console.log(`[${uploadId}] SFTP connection closed`);
    });

    console.log(`[${uploadId}] Attempting SFTP connection with SSH key...`);
    conn.connect({
      host,
      port,
      username,
      privateKey,
    });
  });
}

// Helper function to clean up temp file
async function cleanupTempFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
    console.log(`Temp file cleaned up: ${filePath}`);
  } catch (error) {
    console.error('Failed to cleanup temp file:', error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<UploadResponse>> {
  const uploadId = randomUUID().slice(0, 8); // Short ID for logging
  let tempFilePath: string | null = null;

  console.log(`[${uploadId}] Starting file upload process`);

  try {
    // Validate environment variables
    const { SFTP_HOST, SFTP_PORT, SFTP_USER, SFTP_PRIVATE_KEY } = process.env;
    
    console.log(`[${uploadId}] Environment check - Host: ${SFTP_HOST}, Port: ${SFTP_PORT}, User: ${SFTP_USER}, PrivateKey: ${SFTP_PRIVATE_KEY ? '[SET]' : '[MISSING]'}`);
    
    if (!SFTP_HOST || !SFTP_PORT || !SFTP_USER || !SFTP_PRIVATE_KEY) {
      console.error(`[${uploadId}] Missing SFTP configuration`);
      return NextResponse.json(
        { success: false, error: 'Missing SFTP configuration' },
        { status: 500 }
      );
    }

    // Get SSH private key from environment variable
    console.log(`[${uploadId}] Using SSH private key from environment variable`);
    const privateKey = Buffer.from(SFTP_PRIVATE_KEY, 'utf-8');
    console.log(`[${uploadId}] Private key loaded successfully`);

    // Parse form data
    console.log(`[${uploadId}] Parsing form data`);
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const documentType = formData.get('documentType') as string | null;

    console.log(`[${uploadId}] Received file: ${file?.name || 'null'}, size: ${file?.size || 0} bytes`);
    console.log(`[${uploadId}] Document type: ${documentType}`);

    if (!file) {
      console.error(`[${uploadId}] No file provided`);
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!documentType) {
      console.error(`[${uploadId}] No document type provided`);
      return NextResponse.json(
        { success: false, error: 'No document type provided' },
        { status: 400 }
      );
    }

    // Validate file and document type
    console.log(`[${uploadId}] Validating file`);
    const validation = validateFile(file, documentType as DocumentType);
    if (!validation.isValid) {
      console.error(`[${uploadId}] Validation failed: ${validation.error}`);
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }
    console.log(`[${uploadId}] File validation passed`);

    // Generate unique filename
    const fileExtension = getFileExtension(file.name);
    const newFilename = `${randomUUID()}.${fileExtension}`;
    console.log(`[${uploadId}] Generated filename: ${newFilename}`);

    // Save file temporarily
    const tempDir = os.tmpdir();
    tempFilePath = path.join(tempDir, newFilename);
    console.log(`[${uploadId}] Temp file path: ${tempFilePath}`);
    
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(tempFilePath, Buffer.from(arrayBuffer));
    console.log(`[${uploadId}] File saved to temp directory`);

    // Prepare remote paths
    const remoteDir = `/home/${SFTP_USER}/documents/${documentType}`;
    const remotePath = `${remoteDir}/${newFilename}`;
    console.log(`[${uploadId}] Remote directory: ${remoteDir}`);
    console.log(`[${uploadId}] Remote file path: ${remotePath}`);

    // Upload to SFTP
    console.log(`[${uploadId}] Starting SFTP upload`);
    await uploadToSFTP(
      SFTP_HOST,
      parseInt(SFTP_PORT),
      SFTP_USER,
      privateKey,
      tempFilePath,
      remotePath,
      remoteDir,
      uploadId
    );
    console.log(`[${uploadId}] SFTP upload completed successfully`);

    // Clean up temp file
    console.log(`[${uploadId}] Cleaning up temp file`);
    await cleanupTempFile(tempFilePath);

    // Return success response
    console.log(`[${uploadId}] Upload process completed successfully`);
    return NextResponse.json({
      success: true,
      filename: newFilename,
      documentType,
    });

  } catch (error) {
    console.error(`[${uploadId}] Upload error:`, error);
    
    if (error instanceof Error) {
      console.error(`[${uploadId}] Error details: ${error.message}`);
      console.error(`[${uploadId}] Stack trace:`, error.stack);
    }

    // Clean up temp file on error
    if (tempFilePath) {
      console.log(`[${uploadId}] Cleaning up temp file after error`);
      await cleanupTempFile(tempFilePath);
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Upload failed' 
      },
      { status: 500 }
    );
  }
}

// Only allow POST method
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}