import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Slider,
  Stack,
  Typography,
} from '@mui/material';
import Cropper, { type Area } from 'react-easy-crop';

/**
 * Draws the selected crop region onto a canvas, downscales so the longer side is
 * ≤ maxSide, and re-encodes it as a PNG blob — keeps logos small (the backend caps
 * files at 2 MB).
 */
async function getCroppedImg(src: string, pixels: Area, maxSide = 512): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('image load failed'));
    el.src = src;
  });
  const { width, height } = pixels;
  if (!width || !height) throw new Error('empty crop');
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unsupported');
  ctx.drawImage(img, pixels.x, pixels.y, width, height, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('encode failed');
  return blob;
}

export interface LogoCropDialogProps {
  /** Object URL of the picked image; `null` keeps the dialog closed. */
  imageSrc: string | null;
  /** Parent is uploading the cropped blob — disables the controls and shows a spinner. */
  busy?: boolean;
  onCancel: () => void;
  /** Called with the cropped PNG blob when the user confirms. */
  onCropped: (blob: Blob) => void;
}

/**
 * Interactive square-crop modal for the event logo. The user pans / zooms the
 * picked image; on Save the selected region is rendered to a ≤ 512px PNG blob and
 * handed to the parent for upload.
 */
export default function LogoCropDialog({ imageSrc, busy, onCancel, onCropped }: LogoCropDialogProps) {
  const { t } = useTranslation();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixels, setPixels] = useState<Area | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = imageSrc !== null;

  // Reset the crop state each time a new image is opened.
  useEffect(() => {
    if (open) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setPixels(null);
      setError(null);
    }
  }, [open, imageSrc]);

  const handleCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setPixels(areaPixels);
  }, []);

  const handleSave = async () => {
    if (!imageSrc || !pixels) return;
    setError(null);
    try {
      const blob = await getCroppedImg(imageSrc, pixels);
      onCropped(blob);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settings.logoError'));
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onCancel} fullWidth maxWidth="xs">
      <DialogTitle>{t('settings.cropTitle')}</DialogTitle>
      <DialogContent>
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            height: 320,
            bgcolor: 'action.hover',
            borderRadius: 1,
            overflow: 'hidden',
          }}
        >
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="rect"
              showGrid
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={handleCropComplete}
            />
          )}
        </Box>
        <Stack sx={{ mt: 2 }} spacing={0.5}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t('settings.zoom')}
          </Typography>
          <Slider
            value={zoom}
            min={1}
            max={3}
            step={0.05}
            onChange={(_, value) => setZoom(typeof value === 'number' ? value : value[0])}
            disabled={busy}
            aria-label={t('settings.zoom')}
          />
        </Stack>
        {error && (
          <Typography variant="caption" sx={{ color: 'error.main' }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={busy}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={busy || !pixels}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
