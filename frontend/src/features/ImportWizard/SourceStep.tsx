import { useRef, useState } from 'react';
import { Box, Card, CardActionArea, CircularProgress, Typography } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import { api } from '../../api/client';
import type { ImportParseResponse } from '../../api/types';

interface SourceStepProps {
  parseUrl: string;
  onFileLoaded: (rows: string[][]) => void;
  onPasteSelected: () => void;
  onError: (message: string) => void;
}

export default function SourceStep({ parseUrl, onFileLoaded, onPasteSelected, onError }: SourceStepProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be re-selected.
    e.target.value = '';

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await api.upload<ImportParseResponse>(parseUrl, formData);
      onFileLoaded(result.rows);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to parse file');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', py: 4, px: 2 }}>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.csv,.txt"
        hidden
        onChange={handleFileChange}
      />

      <Card variant="outlined" sx={{ width: 200 }}>
        <CardActionArea
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 3, height: '100%' }}
        >
          {uploading ? (
            <CircularProgress size={40} />
          ) : (
            <UploadFileIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
          )}
          <Typography variant="subtitle1" fontWeight={600}>
            Upload file
          </Typography>
          <Typography variant="caption" color="text.secondary">
            .xlsx or .csv
          </Typography>
        </CardActionArea>
      </Card>

      <Card variant="outlined" sx={{ width: 200 }}>
        <CardActionArea
          onClick={onPasteSelected}
          sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 3, height: '100%' }}
        >
          <ContentPasteIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
          <Typography variant="subtitle1" fontWeight={600}>
            Paste text
          </Typography>
          <Typography variant="caption" color="text.secondary">
            From clipboard
          </Typography>
        </CardActionArea>
      </Card>
    </Box>
  );
}
