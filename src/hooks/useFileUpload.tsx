import React from 'react';

interface UploadParams {
  file: File;
  documentType: 'contracts' | 'photos' | 'client-files' | 'condition-reports' | 'supplier-reports';
}

interface UploadResponse {
  success: boolean;
  filename?: string;
  documentType?: string;
  error?: string;
}

interface UploadProgressCallback {
  (progress: number): void;
}

/**
 * Uploads a file to the SFTP server via the Next.js API route
 * @param params - Upload parameters containing file and document type
 * @param onProgress - Optional callback for upload progress (note: actual progress tracking requires more complex setup)
 * @returns Promise resolving to upload response
 */
export async function uploadFile(
  params: UploadParams,
  onProgress?: UploadProgressCallback
): Promise<UploadResponse> {
  try {
    const { file, documentType } = params;

    // Validate inputs on client side
    if (!file) {
      throw new Error('No file provided');
    }

    if (!documentType) {
      throw new Error('No document type provided');
    }

    // Create FormData
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', documentType);

    // Optional progress tracking (basic version)
    if (onProgress) {
      onProgress(0);
    }

    // Make request to API
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (onProgress) {
      onProgress(100);
    }

    const result: UploadResponse = await response.json();

    if (!response.ok) {
      throw new Error(result.error || `HTTP ${response.status}`);
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Upload failed';
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * React hook for file uploads with state management
 */
export function useFileUpload() {
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  const upload = async (params: UploadParams): Promise<UploadResponse> => {
    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const result = await uploadFile(params, setUploadProgress);
      
      if (!result.success) {
        setError(result.error || 'Upload failed');
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setIsUploading(false);
    }
  };

  const reset = () => {
    setError(null);
    setUploadProgress(0);
  };

  return {
    upload,
    reset,
    isUploading,
    uploadProgress,
    error,
  };
}

/**
 * Example usage component
 */
export function FileUploadExample() {
  const { upload, isUploading, uploadProgress, error, reset } = useFileUpload();
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [documentType, setDocumentType] = React.useState<UploadParams['documentType']>('contracts');

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      reset(); // Clear any previous errors
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      return;
    }

    const result = await upload({
      file: selectedFile,
      documentType,
    });

    if (result.success) {
      console.log('Upload successful:', result);
      // Handle success (e.g., show success message, clear form)
      setSelectedFile(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="documentType" className="block text-sm font-medium text-gray-700">
          Document Type
        </label>
        <select
          id="documentType"
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value as UploadParams['documentType'])}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
        >
          <option value="contracts">Contracts</option>
          <option value="photos">Photos</option>
          <option value="client-files">Client Files</option>
          <option value="condition-reports">Condition Reports</option>
          <option value="supplier-reports">Supplier Reports</option>
        </select>
      </div>

      <div>
        <label htmlFor="file" className="block text-sm font-medium text-gray-700">
          File
        </label>
        <input
          id="file"
          type="file"
          onChange={handleFileSelect}
          accept={
            documentType === 'photos' 
              ? '.pdf,.docx,.jpg,.jpeg,.png' 
              : '.pdf,.docx'
          }
          className="mt-1 block w-full"
          disabled={isUploading}
        />
      </div>

      {selectedFile && (
        <div className="text-sm text-gray-600">
          Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
        </div>
      )}

      {isUploading && (
        <div className="space-y-2">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-200"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <div className="text-sm text-gray-600">Uploading... {uploadProgress}%</div>
        </div>
      )}

      {error && (
        <div className="text-red-600 text-sm">
          Error: {error}
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!selectedFile || isUploading}
        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-md"
      >
        {isUploading ? 'Uploading...' : 'Upload File'}
      </button>
    </div>
  );
}