// Optional: Database storage for file metadata
// This complements the SFTP upload by storing file information in your database

export interface FileUploadRecord {
  id: string;
  filename: string;
  original_filename: string;
  document_type: string;
  file_size: number;
  file_extension: string;
  upload_date: string;
  sftp_path: string;
  uploaded_by?: string; // Add user ID if you have authentication
}

/**
 * Save file metadata to database after successful SFTP upload
 * Add this to your upload route after SFTP upload succeeds
 */
export async function saveFileMetadata(
  supabaseClient: any, // Your Supabase client
  metadata: Omit<FileUploadRecord, 'id' | 'upload_date'>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseClient
      .from('uploaded_files')
      .insert({
        ...metadata,
        upload_date: new Date().toISOString(),
      });

    if (error) {
      console.error('Database insert error:', error);
      return { success: false, error: error.message };
    }

    console.log('File metadata saved to database:', metadata.filename);
    return { success: true };
  } catch (error) {
    console.error('Database operation failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Database error' 
    };
  }
}

/**
 * Get list of uploaded files from database
 */
export async function getUploadedFiles(
  supabaseClient: any,
  documentType?: string,
  limit: number = 50
): Promise<{ success: boolean; files?: FileUploadRecord[]; error?: string }> {
  try {
    let query = supabaseClient
      .from('uploaded_files')
      .select('*')
      .order('upload_date', { ascending: false })
      .limit(limit);

    if (documentType) {
      query = query.eq('document_type', documentType);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, files: data };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Database error' 
    };
  }
}

/* 
SQL for creating the table in Supabase:

CREATE TABLE uploaded_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  filename VARCHAR NOT NULL,
  original_filename VARCHAR NOT NULL,
  document_type VARCHAR NOT NULL CHECK (document_type IN ('contracts', 'photos', 'client-files', 'condition-reports', 'supplier-reports')),
  file_size BIGINT NOT NULL,
  file_extension VARCHAR NOT NULL,
  upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sftp_path VARCHAR NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for common queries
CREATE INDEX idx_uploaded_files_document_type ON uploaded_files(document_type);
CREATE INDEX idx_uploaded_files_upload_date ON uploaded_files(upload_date);
CREATE INDEX idx_uploaded_files_uploaded_by ON uploaded_files(uploaded_by);

-- Enable RLS (Row Level Security)
ALTER TABLE uploaded_files ENABLE ROW LEVEL SECURITY;

-- Example RLS policy (adjust based on your authentication setup)
CREATE POLICY "Users can view their own files" ON uploaded_files
  FOR SELECT USING (auth.uid() = uploaded_by);

CREATE POLICY "Users can insert their own files" ON uploaded_files
  FOR INSERT WITH CHECK (auth.uid() = uploaded_by);
*/