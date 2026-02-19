import { Client } from 'ssh2';

interface SFTPTestResult {
  success: boolean;
  files?: string[];
  directories?: string[];
  error?: string;
}

/**
 * Test SFTP connection and list files in a directory
 * Useful for debugging upload issues
 */
export async function testSFTPConnection(
  host: string,
  port: number,
  username: string,
  privateKey: Buffer,
  remotePath: string = `/home/${username}/documents`
): Promise<SFTPTestResult> {
  return new Promise((resolve) => {
    const conn = new Client();
    
    conn.on('ready', () => {
      console.log('✅ SFTP connection established for testing');
      
      conn.sftp((err, sftp) => {
        if (err) {
          conn.end();
          resolve({ success: false, error: `SFTP session failed: ${err.message}` });
          return;
        }

        // List files in directory
        sftp.readdir(remotePath, (err, list) => {
          sftp.end();
          conn.end();
          
          if (err) {
            resolve({ 
              success: false, 
              error: `Failed to read directory ${remotePath}: ${err.message}` 
            });
            return;
          }

          const files: string[] = [];
          const directories: string[] = [];

          list?.forEach(item => {
            if (item.attrs.isDirectory()) {
              directories.push(item.filename);
            } else {
              files.push(item.filename);
            }
          });

          console.log(`Found ${files.length} files and ${directories.length} directories in ${remotePath}`);
          
          resolve({
            success: true,
            files,
            directories
          });
        });
      });
    });

    conn.on('error', (err) => {
      console.log(`❌ Connection error: ${err.message}`);
      resolve({ success: false, error: `Connection failed: ${err.message}` });
    });

    conn.on('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => {
      console.log('Server requires keyboard-interactive authentication');
      finish([]);
    });

    conn.on('banner', (message) => {
      console.log('Server banner:', message);
    });

    console.log(`🔗 Attempting connection to ${username}@${host}:${port}...`);
    
    conn.connect({
      host,
      port,
      username,
      privateKey,
    });
  });
}

import { config } from 'dotenv';

// Load environment variables
config();

/**
 * Simple connection test with SSH key authentication
 */
async function testBasicConnection(host: string, port: number, username: string, privateKey: Buffer): Promise<boolean> {
  return new Promise((resolve) => {
    const conn = new Client();
    
    conn.on('ready', () => {
      console.log('✅ Basic SSH connection successful');
      conn.end();
      resolve(true);
    });

    conn.on('error', (err) => {
      console.log(`❌ Basic connection failed: ${err.message}`);
      resolve(false);
    });

    console.log(`🔗 Testing basic connection to ${username}@${host}:${port}...`);
    conn.connect({
      host,
      port,
      username,
      privateKey,
    });
  });
}

// Test endpoint - you can run this directly
async function runTest() {
  console.log('Testing SFTP connection with SSH key authentication...');
  
  const { SFTP_HOST, SFTP_PORT, SFTP_USER, SFTP_PRIVATE_KEY } = process.env;
  
  console.log('Environment variables:');
  console.log(`SFTP_HOST: ${SFTP_HOST}`);
  console.log(`SFTP_PORT: ${SFTP_PORT}`);
  console.log(`SFTP_USER: ${SFTP_USER}`);
  console.log(`SFTP_PRIVATE_KEY: ${SFTP_PRIVATE_KEY ? '[SET]' : '[MISSING]'}`);
  
  if (!SFTP_HOST || !SFTP_PORT || !SFTP_USER || !SFTP_PRIVATE_KEY) {
    console.error('❌ Missing SFTP environment variables');
    return;
  }

  // Get SSH private key from environment variable
  console.log('✅ Using private key from environment variable');
  const privateKey = Buffer.from(SFTP_PRIVATE_KEY, 'utf-8');

  try {
    // First test basic SSH connection
    console.log(`\n🔍 Step 1: Testing basic SSH connection...`);
    const basicSuccess = await testBasicConnection(
      SFTP_HOST,
      parseInt(SFTP_PORT),
      SFTP_USER,
      privateKey
    );

    if (!basicSuccess) {
      console.log('\n❌ Basic SSH connection failed. Please check:');
      console.log('1. SSH key is correctly uploaded to the server');
      console.log('2. Private key in environment variable is correct');
      console.log('3. Account is active and SSH access is enabled');
      return;
    }

    // Test base directory
    console.log(`\n🔍 Step 2: Testing SFTP file access...`);
    let result = await testSFTPConnection(
      SFTP_HOST,
      parseInt(SFTP_PORT),
      SFTP_USER,
      privateKey,
      `/home/${SFTP_USER}`
    );
    
    console.log('Base directory test:', result);

    if (result.success) {
      console.log('\n✅ SFTP connection successful!');
      console.log('Files in home directory:', result.files?.slice(0, 5));
      console.log('Subdirectories:', result.directories);
      
      // Test documents directory
      console.log(`\nTesting documents directory...`);
      result = await testSFTPConnection(
        SFTP_HOST,
        parseInt(SFTP_PORT),
        SFTP_USER,
        privateKey,
        `/home/${SFTP_USER}/documents`
      );
      
      if (result.success) {
        console.log('✅ Documents directory exists');
        console.log('Document subdirectories:', result.directories);
      } else {
        console.log('⚠️ Documents directory does not exist or is not accessible');
        console.log('Error:', result.error);
      }
    } else {
      console.log('\n❌ SFTP connection failed');
      console.log('Error:', result.error);
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Auto-run the test
runTest();