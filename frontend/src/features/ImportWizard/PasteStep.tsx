import { useState } from 'react';
import { Box, Button, FormControl, FormControlLabel, Radio, RadioGroup, TextField, Typography } from '@mui/material';

interface PasteStepProps {
  onParsed: (rows: string[][]) => void;
  onBack: () => void;
}

type Delimiter = 'tab' | 'semicolon' | 'comma' | 'custom';

const DELIMITER_MAP: Record<Exclude<Delimiter, 'custom'>, string> = {
  tab: '\t',
  semicolon: ';',
  comma: ',',
};

export default function PasteStep({ onParsed, onBack }: PasteStepProps) {
  const [text, setText] = useState('');
  const [delimiter, setDelimiter] = useState<Delimiter>('tab');
  const [customDelimiter, setCustomDelimiter] = useState('');

  const handleNext = () => {
    const delim = delimiter === 'custom' ? customDelimiter : DELIMITER_MAP[delimiter];
    if (!delim) return;

    const lines = text.split('\n').filter((l) => l.trim() !== '');
    if (lines.length === 0) return;

    const rows = lines.map((line) => line.split(delim));

    // Normalize column count.
    const maxCols = Math.max(...rows.map((r) => r.length));
    const normalized = rows.map((row) => {
      const padded = [...row];
      while (padded.length < maxCols) padded.push('');
      return padded;
    });

    onParsed(normalized);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, py: 2, px: 2 }}>
      <TextField
        multiline
        minRows={8}
        maxRows={16}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste your data here..."
        sx={{ '& textarea': { fontFamily: 'monospace', fontSize: '0.85rem' } }}
      />

      <Box>
        <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
          Delimiter
        </Typography>
        <FormControl>
          <RadioGroup
            row
            value={delimiter}
            onChange={(e) => setDelimiter(e.target.value as Delimiter)}
          >
            <FormControlLabel value="tab" control={<Radio size="small" />} label="Tab" />
            <FormControlLabel value="semicolon" control={<Radio size="small" />} label="Semicolon" />
            <FormControlLabel value="comma" control={<Radio size="small" />} label="Comma" />
            <FormControlLabel value="custom" control={<Radio size="small" />} label="Custom" />
          </RadioGroup>
        </FormControl>
        {delimiter === 'custom' && (
          <TextField
            size="small"
            value={customDelimiter}
            onChange={(e) => setCustomDelimiter(e.target.value)}
            placeholder="Enter delimiter"
            sx={{ width: 120, ml: 1 }}
          />
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button onClick={onBack}>Back</Button>
        <Button
          variant="contained"
          onClick={handleNext}
          disabled={!text.trim()}
        >
          Next
        </Button>
      </Box>
    </Box>
  );
}
